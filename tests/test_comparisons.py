"""Scientific boundaries and real-release regression checks for comparison exports."""
import collections
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_comparisons', ROOT/'scripts/build_comparisons.py')
metrics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(metrics)


class MetricsTests(unittest.TestCase):
    def test_tvd_is_percent_not_fraction_or_full_l1(self):
        self.assertEqual(metrics.tvd([100, 0], [0, 100]), 100)
        self.assertEqual(metrics.tvd([80, 20], [60, 40]), 20)
        self.assertEqual(metrics.tvd([80, 20], [80, 20]), 0)

    def test_effective_types_and_entropy(self):
        h, effective = metrics.diversity([100, 0, 0])
        self.assertEqual((h, effective), (0, 1))
        h, effective = metrics.diversity([25, 25, 25, 25])
        self.assertAlmostEqual(h, math.log(4))
        self.assertAlmostEqual(effective, 4)

    def test_diversity_boundaries(self):
        self.assertEqual(metrics.diversity_band(1.499999), 'low')
        self.assertEqual(metrics.diversity_band(1.5), 'intermediate')
        self.assertEqual(metrics.diversity_band(2.5), 'high')

    def test_remodeling_boundaries(self):
        self.assertEqual(metrics.remodeling_state(19.999), 'conserved')
        self.assertEqual(metrics.remodeling_state(20), 'partially_shifted')
        self.assertEqual(metrics.remodeling_state(50), 'strongly_remodeled')

    def test_dominance_is_directional_and_includes_sixty_percent(self):
        # O - Y: high mannose loses 50pp, paucimannose gains 30pp, stubs gain 20pp.
        old, young = [0, 30, 20, 50, 0, 0, 0, 0], [50, 0, 0, 50, 0, 0, 0, 0]
        self.assertEqual(metrics.dominant_change(old, young), ('high_mannose', 'paucimannose'))
        old = [0, 29, 21, 50, 0, 0, 0, 0]
        self.assertEqual(metrics.dominant_change(old, young), ('high_mannose', 'mixed'))
        self.assertEqual(metrics.dominant_change(young, young), ('mixed', 'mixed'))

    def test_missing_profile_is_not_zero_profile(self):
        self.assertIsNone(metrics.vector([]))
        with self.assertRaises(ValueError):
            metrics.vector([dict(name='high_mannose', percent=20)])
        with self.assertRaises(ValueError):
            metrics.vector([dict(name='unrecognized', percent=100)])


class ReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = ROOT/'data/comparisons'
        cls.manifest = json.loads((cls.data/'manifest.json').read_text())

    def test_sources_match_the_pinned_public_release(self):
        self.assertEqual(self.manifest['data_version'], 'E330-2026-09-29')
        for path, expected in self.manifest['source_sha256'].items():
            self.assertEqual(hashlib.sha256((ROOT/path).read_bytes()).hexdigest(), expected, path)

    def test_all_age_hits_preserve_exported_statistics_and_direction(self):
        for record in self.manifest['age']:
            original = json.loads((ROOT/'data/tvd'/f'{record["dataset"]}_age_bins_{record["comparison"]}.json').read_text())
            expected = {r['site_key']: r for r in original if r['p_value'] < .05}
            actual = json.loads((self.data/record['file']).read_text())
            self.assertEqual(len(actual), len(expected))
            self.assertEqual(len(actual), record['n_hits'])
            self.assertEqual(record['n_direction_unavailable'], 0)
            for row in actual:
                self.assertEqual({k: row[k] for k in expected[row['site_key']]}, expected[row['site_key']])
                self.assertIn(row['loss'], (*metrics.CLASSES, 'mixed'))
                self.assertIn(row['gain'], (*metrics.CLASSES, 'mixed'))

    def test_manuscript_age_hit_counts_and_brain_paucimannose(self):
        expected = {'brain': 158, 'spleen': 187, 'liver': 90, 'kidney': 126, 'plasma': 68}
        for organ, n in expected.items():
            rows=json.loads((self.data/f'atlas_{organ}_O_vs_Y_hits.json').read_text())
            self.assertEqual(len(rows), n)
        brain=json.loads((self.data/'atlas_brain_O_vs_Y_hits.json').read_text())
        self.assertEqual(sum(r['gain']=='paucimannose' for r in brain), 26)
        self.assertEqual(sum(r['loss']=='paucimannose' for r in brain), 1)
        mog=next(r for r in brain if r['glycosite']=='Mog N59')
        self.assertEqual((mog['loss'],mog['gain']),('fucosylated','mixed'))

    def test_every_pooled_site_is_unique_bounded_and_correctly_classified(self):
        counts=collections.Counter()
        total=0
        for group in self.manifest['pairs']:
            rows=json.loads((self.data/group['file']).read_text())
            self.assertEqual(len(rows),group['n'])
            self.assertEqual(len({r['site_key'] for r in rows}),len(rows))
            for r in rows:
                self.assertGreaterEqual(r['tvd'],0)
                self.assertLessEqual(r['tvd'],100)
                self.assertGreaterEqual(min(r['psm_a'],r['psm_b']),5)
                self.assertEqual(r['state'],metrics.remodeling_state(r['tvd']))
                for organ in ('a','b'):
                    self.assertAlmostEqual(math.exp(r[f'h_{organ}']),r[f'effective_{organ}'],places=6)
                if 'myelin' not in group['key']:
                    counts[r['state']]+=1
            if 'myelin' not in group['key']:
                total+=len(rows)
        self.assertEqual(total,5266)
        self.assertEqual(dict(counts),dict(conserved=2994,partially_shifted=1070,strongly_remodeled=1202))

    def test_pair_counts_match_figure_2b_and_myelin_is_separate(self):
        expected={'brain__spleen':798,'brain__liver':663,'brain__kidney':739,'brain__plasma':112,
                  'spleen__liver':856,'spleen__kidney':814,'spleen__plasma':167,
                  'liver__kidney':738,'liver__plasma':255,'kidney__plasma':124}
        atlas={r['key']:r['n'] for r in self.manifest['pairs'] if 'myelin' not in r['key']}
        self.assertEqual(atlas,expected)
        myelin=[r for r in self.manifest['pairs'] if 'myelin' in r['key']]
        self.assertEqual({r['key']:r['n'] for r in myelin}, {
            'brain__myelin_male':792, 'brain__myelin_female':748,
            'myelin_male__myelin_female':716})

    def test_young_pairs_have_complete_diversity_fields(self):
        self.assertEqual(len(self.manifest['young_pairs']),10)
        for group in self.manifest['young_pairs']:
            rows=json.loads((self.data/group['file']).read_text())
            self.assertEqual(len(rows),group['n'])
            for r in rows:
                self.assertEqual(r['state'],metrics.remodeling_state(r['tvd']))
                self.assertGreaterEqual(min(r['effective_a'],r['effective_b']),1-1e-9)


if __name__ == '__main__':
    unittest.main()
