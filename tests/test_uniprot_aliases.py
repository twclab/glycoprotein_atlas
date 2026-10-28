import importlib.util
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('uniprot_aliases', ROOT / 'scripts/build_uniprot_aliases.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class UniProtAliasesTests(unittest.TestCase):
    def test_structured_names_include_components_and_cd_labels_without_annotation_fragments(self):
        description = {
            'recommendedName': {'fullName': {'value': 'Receptor ligand (mature form)'}, 'shortNames': [{'value': 'RL-1'}],
                                'ecNumbers': [{'value': '1.2.3.4'}]},
            'alternativeNames': [{'fullName': {'value': 'CD40 ligand'}, 'shortNames': [{'value': 'CD40L'}]}],
            'cdAntigenNames': [{'value': 'CD154'}],
            'submissionNames': [{'fullName': {'value': 'Old submitted name'}}],
            'contains': [{'recommendedName': {'fullName': {'value': 'Processed ligand'}}}],
            'includes': [{'alternativeNames': [{'fullName': {'value': 'Component name'}}]}],
            'flag': 'Precursor', 'evidences': [{'id': '123456'}],
        }
        names = builder.protein_names(description)
        self.assertEqual(names, {'Receptor ligand (mature form)', 'RL-1', 'CD40 ligand', 'CD40L', 'CD154',
                                 'Old submitted name', 'Processed ligand', 'Component name'})
        self.assertNotIn('CD40', names)
        self.assertNotIn('mature form', names)

    def test_gene_fields_are_read_as_names_instead_of_evidence_values(self):
        genes = [{'geneName': {'value': 'First', 'evidences': [{'id': '99'}]},
                  'synonyms': [{'value': 'Alias'}], 'orfNames': [{'value': 'ORF1'}],
                  'orderedLocusNames': [{'value': 'Locus1'}]}]
        self.assertEqual(builder.gene_names(genes), {'First', 'Alias', 'ORF1', 'Locus1'})

    def test_invalid_or_ambiguous_mappings_are_not_silently_assigned(self):
        index = [{'protein_id': 'P1', 'gene': 'First'}]
        entry = {'primaryAccession': 'P1', 'organism': {'taxonId': 10090}, 'uniProtkbId': 'FIRST_MOUSE',
                 'proteinDescription': {'recommendedName': {'fullName': {'value': 'First protein'}}}}
        for payload in [{'results': [], 'failedIds': ['P1']},
                        {'results': [{'from': 'P1', 'to': entry}] * 2}]:
            with self.assertRaises(ValueError): builder.snapshot(payload, {}, index)
        entry['primaryAccession'] = 'P2'
        with self.assertRaises(ValueError): builder.snapshot({'results': [{'from': 'P1', 'to': entry}]}, {}, index)
        entry['primaryAccession'] = 'P1'; entry['organism']['taxonId'] = 9606
        with self.assertRaises(ValueError): builder.snapshot({'results': [{'from': 'P1', 'to': entry}]}, {}, index)

    def test_expanded_release_matches_its_reference_and_preserves_previous_release(self):
        reference_path = ROOT / 'scripts/reference/uniprot-protein-names.json'
        reference = json.loads(reference_path.read_text())
        index_path = ROOT / 'data/search-index.json'
        index = json.loads(index_path.read_text())
        previous_path = ROOT / 'data/protein-aliases.json'
        previous = json.loads(previous_path.read_text())
        output = ROOT / 'data/protein-aliases-uniprot.json'
        expanded = json.loads(output.read_text())
        meta = json.loads((ROOT / 'data/protein-aliases-uniprot.provenance.json').read_text())
        self.assertEqual(builder.build(index, previous, reference), expanded)
        self.assertEqual(len(reference['entries']), len(index))
        for field, path in [('reference_sha256', reference_path), ('previous_aliases_sha256', previous_path),
                            ('search_index_sha256', index_path), ('output_sha256', output)]:
            self.assertEqual(meta[field], hashlib.sha256(path.read_bytes()).hexdigest())
        for accession, names in previous.items(): self.assertTrue(set(names).issubset(expanded[accession]))


if __name__ == '__main__':
    unittest.main()
