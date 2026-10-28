import importlib.util
import io
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('protein_aliases', ROOT / 'scripts/build_protein_aliases.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class ProteinAliasesTests(unittest.TestCase):
    def test_exact_mouse_gene_and_accession_mapping(self):
        info = io.StringIO('#tax_id\tSymbol\tSymbol_from_nomenclature_authority\tSynonyms\n'
                           '10090\tProm1\tProm1\tCD133|AC133\n'
                           '10090\tSecond\tSecond\tCD133\n'
                           '9606\tOther\tOther\tHumanOnly\n')
        uniprot = io.StringIO('Entry\tGene Names\tProtein names\nQ02242\tPdcd1 Pd1\tProgrammed cell death protein 1 (CD antigen CD279)\n')
        rows = [{'protein_id':'O54990','gene':'Prom1'}, {'protein_id':'P2','gene':'Second'}, {'protein_id':'Q02242','gene':'Pdcd1'}, {'protein_id':'P3','gene':'Other'}, {'protein_id':'P4','gene':'Unknown'}]
        aliases, count = builder.build(rows, info, uniprot)
        self.assertEqual(count, 2)
        self.assertIn('CD133', aliases['O54990'])
        self.assertIn('CD133', aliases['P2'])
        self.assertIn('CD279', aliases['Q02242'])
        self.assertNotIn('P3', aliases)
        self.assertNotIn('P4', aliases)

    def test_supplement_hash_matches_provenance(self):
        import hashlib
        provenance = json.loads((ROOT / 'data/protein-aliases.provenance.json').read_text())
        self.assertEqual(provenance['output_sha256'], hashlib.sha256((ROOT / 'data/protein-aliases.json').read_bytes()).hexdigest())
        self.assertEqual(provenance['search_index_sha256'], hashlib.sha256((ROOT / 'data/search-index.json').read_bytes()).hexdigest())


if __name__ == '__main__':
    unittest.main()
