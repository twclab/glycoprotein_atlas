#!/usr/bin/env python3
"""Derive comparison views exclusively from the website's versioned public JSON.

No raw spectra, manuscript files, external services, or new hypothesis tests.
Run from any directory: python3 scripts/build_comparisons.py
"""
import argparse
import hashlib
import itertools
import json
import math
from pathlib import Path

CLASSES = ('high_mannose', 'paucimannose', 'stubs', 'phospho',
           'undecorated', 'fucosylated', 'fucosylated_and_sialylated', 'sialylated')
ORGANS = ('brain', 'spleen', 'liver', 'kidney', 'plasma')


def vector(rows, field='percent'):
    if not rows:
        return None
    values = {row['name']: row[field] for row in rows}
    if any(name not in CLASSES for name in values):
        raise ValueError('Unrecognized glycan class')
    result = [values.get(name, 0) for name in CLASSES]
    if any(not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0 for v in result):
        raise ValueError('Invalid composition')
    if not math.isclose(sum(result), 100, abs_tol=1e-5):
        raise ValueError(f'Composition does not sum to 100: {sum(result)}')
    return result


def tvd(a, b):
    return sum(abs(x-y) for x, y in zip(a, b)) / 2


def diversity(a):
    h = -sum((x/100)*math.log(x/100) for x in a if x > 0)
    return h, math.exp(h)


def diversity_band(effective):
    return 'low' if effective < 1.5 else 'intermediate' if effective < 2.5 else 'high'


def remodeling_state(distance):
    return 'conserved' if distance < 20 else 'partially_shifted' if distance < 50 else 'strongly_remodeled'


def dominant_change(a, b):
    """Return dominant loss/gain for a - b; each must explain >=60% of its side."""
    delta = [x-y for x, y in zip(a, b)]
    def direction(sign):
        parts = [max(sign*x, 0) for x in delta]
        total = sum(parts)
        if total <= 1e-9:
            return 'mixed'
        i = max(range(len(parts)), key=parts.__getitem__)
        return CLASSES[i] if parts[i] / total >= .6 - 1e-12 else 'mixed'
    return direction(-1), direction(1)


def young_eligible(site):
    """Author-recalled Figure 3B coverage, independently in each young organ."""
    young = next((row for row in site['shannon']['age_bins'] if row['key'] == 'Y'), {})
    pooled = young.get('pooled', {})
    return (pooled.get('n_samples_detected', 0) >= 9 and
            pooled.get('glycosite_psms', 0) >= 18)


def build(root, output):
    data = root / 'data'
    sources = {}
    def read(path):
        raw = path.read_bytes()
        sources[str(path.relative_to(root))] = hashlib.sha256(raw).hexdigest()
        return json.loads(raw)
    release = read(data/'manifest.json')
    site_lookup = {}
    pairs = {f'{a}__{b}': [] for a, b in itertools.combinations(ORGANS, 2)}
    pairs.update({f'{a}__{b}': [] for a, b in
                  [('brain', 'myelin_male'), ('brain', 'myelin_female'), ('myelin_male', 'myelin_female')]})
    young_pairs = {key: [] for key in pairs if 'myelin' not in key}
    for path in sorted((data/'shards').glob('*.json')):
        for protein in read(path).values():
            sites = {}
            for organ, records in protein['organs'].items():
                for site in records.get('glycosites', []):
                    site_lookup[(organ, site['id'])] = site
                    if site['total_psm'] >= 5:
                        sites.setdefault(site['id'], {})[organ] = site
            for site_key, observations in sites.items():
                for key, rows in pairs.items():
                    organ_a, organ_b = key.split('__')
                    a, b = observations.get(organ_a), observations.get(organ_b)
                    if not a or not b:
                        continue
                    va, vb = vector(a['glycan_classes']['pooled']), vector(b['glycan_classes']['pooled'])
                    if va is None or vb is None:
                        continue
                    ha, ea = diversity(va)
                    hb, eb = diversity(vb)
                    # Classify the same canonical precision stored and shown by the browser.
                    d = round(tvd(va, vb), 8)
                    record = dict(protein_id=protein['protein_id'], site_key=site_key,
                                  glycosite=a['label'], position=a['position'],
                                  tvd=round(d, 8), h_a=round(ha, 8), h_b=round(hb, 8),
                                  effective_a=round(ea, 8), effective_b=round(eb, 8),
                                  composition_a=[round(x, 8) for x in va],
                                  composition_b=[round(x, 8) for x in vb],
                                  psm_a=a['total_psm'], psm_b=b['total_psm'],
                                  state=remodeling_state(d),
                                  diversity='-'.join(sorted([diversity_band(ea), diversity_band(eb)],
                                                            key=['low', 'intermediate', 'high'].index)))
                    rows.append(record)
                    if key in young_pairs:
                        if young_eligible(a) and young_eligible(b):
                            ya = vector(a['glycan_classes']['age_bins']['Y'], 'pooled_percent')
                            yb = vector(b['glycan_classes']['age_bins']['Y'], 'pooled_percent')
                            hy_a, ey_a = diversity(ya)
                            hy_b, ey_b = diversity(yb)
                            dy = round(tvd(ya, yb), 8)
                            young_pairs[key].append(dict(protein_id=protein['protein_id'], site_key=site_key,
                                                        glycosite=a['label'], position=a['position'],
                                                        tvd=round(dy, 8), h_a=round(hy_a, 8), h_b=round(hy_b, 8),
                                                        effective_a=round(ey_a, 8), effective_b=round(ey_b, 8),
                                                        composition_a=[round(x, 8) for x in ya],
                                                        composition_b=[round(x, 8) for x in yb],
                                                        state=remodeling_state(dy),
                                                        diversity='-'.join(sorted([diversity_band(ey_a), diversity_band(ey_b)],
                                                                                  key=['low', 'intermediate', 'high'].index))))
    output.mkdir(parents=True, exist_ok=True)
    def write(name, obj):
        (output/name).write_text(json.dumps(obj, separators=(',', ':'), allow_nan=False)+'\n')
    manifest = dict(data_version=release['data_version'], classes=CLASSES,
                    age=[], pairs=[], young_pairs=[],
                    rules=dict(inter_organ='Pooled site PSM composition; at least 5 total PSMs in both datasets (Tier 1+ for atlas organs).',
                               young_inter_organ='Pooled young-bin PSM composition; at least 9 detected animals and 18 PSMs per young bin in both atlas organs; author-recalled rule, without an additional whole-lifespan Tier cutoff.',
                               age_direction='Difference of per-animal mean glycan-type percentages, group A minus group B (old minus young for O_vs_Y); dominant if >=60% of summed gains or absolute losses, separately. Dominance describes change, not abundance.',
                               composition_vectors='Composition percentages and signed age changes follow the manifest classes order; inter-organ composition uses the same pooled estimator as its TVD and heterogeneity.',
                               age_hits='Existing tested-site export, raw permutation p <0.05; p values and TVD preserved.',
                               diversity='exp(-sum(p*ln(p))) from pooled glycan-type proportions; low <1.5, intermediate <2.5, high >=2.5.',
                               remodeling='Conserved TVD <20%; partially shifted 20% to <50%; strongly remodeled >=50%.'),
                    manuscript_reference='Figures 2B/2C, 3B/3C and 4H; figure numbering follows the supplied October 2026 draft.',
                    young_reference_status='Coverage follows author recollection. Visual distributions are broadly consistent; exact manuscript dot counts cannot be recovered from the overlapping raster points.')
    for key, rows in pairs.items():
        rows.sort(key=lambda x: (-x['tvd'], x['site_key']))
        filename = f'pooled_{key}.json'
        write(filename, rows)
        manifest['pairs'].append(dict(key=key, organs=key.split('__'), n=len(rows), file=filename))
    for key, rows in young_pairs.items():
        filename = f'young_{key}.json'
        write(filename, rows)
        manifest['young_pairs'].append(dict(key=key, organs=key.split('__'), n=len(rows), file=filename))
    audit = {}
    for comparison in read(data/'tvd/index.json')['comparisons']:
        dataset, name = comparison['dataset'], comparison['comparison']
        organ = dataset.removeprefix('atlas_')
        a_key, b_key = name.split('_vs_')
        tested = read(data/'tvd'/comparison['file'])
        hits, unavailable = [], 0
        for row in tested:
            if row['p_value'] >= .05:
                continue
            site = site_lookup.get((organ, row['site_key']))
            bins = site['glycan_classes']['age_bins'] if site else {}
            va, vb = vector(bins.get(a_key, [])), vector(bins.get(b_key, []))
            if va is None or vb is None:
                hits.append(dict(row, loss='unavailable', gain='unavailable', changes=None))
                unavailable += 1
                continue
            # Direction and reported TVD must describe the same composition estimator.
            if not math.isclose(tvd(va, vb), row['percent_difference'], abs_tol=1e-5):
                raise ValueError(f'Age TVD estimator mismatch: {dataset} {name} {row["site_key"]}')
            loss, gain = dominant_change(va, vb)
            hits.append(dict(row, loss=loss, gain=gain,
                             changes=[round(x-y, 8) for x, y in zip(va, vb)]))
        filename = f'{dataset}_{name}_hits.json'
        write(filename, hits)
        manifest['age'].append(dict(dataset=dataset, comparison=name, n_tested=len(tested),
                                    n_hits=len(hits), n_direction_unavailable=unavailable, file=filename))
        if name == 'O_vs_Y':
            audit[dataset] = dict(tested=len(tested), hits=len(hits), direction_unavailable=unavailable)
    manifest['source_sha256'] = sources
    write('manifest.json', manifest)
    print(json.dumps(dict(age=audit, pooled_pairs={k: len(v) for k, v in pairs.items()},
                          atlas_pair_total=sum(len(v) for k, v in pairs.items() if 'myelin' not in k)), indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    build(args.root, args.output or args.root/'data/comparisons')
