#!/usr/bin/env python3
"""Build the local alias supplement without changing the atlas search index."""
import argparse
import csv
import gzip
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NCBI_URL = 'https://ftp.ncbi.nlm.nih.gov/gene/DATA/GENE_INFO/Mammalia/Mus_musculus.gene_info.gz'
UNIPROT_URL = 'https://rest.uniprot.org/uniprotkb/search?query=accession%3AO54990%20OR%20accession%3AQ02242&fields=accession%2Cgene_names%2Cprotein_name&size=10&format=tsv'


def gene_aliases(stream):
    records = defaultdict(set)
    for row in csv.DictReader(stream, delimiter='\t'):
        if row['#tax_id'] != '10090':
            continue
        symbols = {row['Symbol'], row['Symbol_from_nomenclature_authority']} - {'-', ''}
        aliases = set(row['Synonyms'].split('|')) - {'-', ''}
        for symbol in symbols:
            records[symbol].update(aliases | symbols - {symbol})
    return records


def build(index, gene_info, uniprot):
    genes = gene_aliases(gene_info)
    proteins = {}
    for row in csv.DictReader(uniprot, delimiter='\t'):
        names = set(row['Gene Names'].split())
        names.update(re.findall(r'\(([^()]*)\)', row['Protein names']))
        names.update(re.findall(r'CD antigen (CD\d+)', row['Protein names']))
        proteins[row['Entry']] = names
    result = {}
    matched = 0
    for row in index:
        if row['gene'] in genes:
            matched += 1
        aliases = genes.get(row['gene'], set()) | proteins.get(row['protein_id'], set())
        # Keep legacy IRE1 searches, which predate the downloaded supplement.
        if row['gene'] == 'Ern1':
            aliases = aliases | {'IRE1', 'IRE1α'}
        aliases = sorted(a for a in aliases if a.lower() not in {row['gene'].lower(), row['protein_id'].lower()})
        if aliases:
            result[row['protein_id']] = aliases
    return dict(sorted(result.items())), matched


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gene-info', type=Path, required=True, help='Downloaded Mus_musculus.gene_info.gz from NCBI Gene')
    parser.add_argument('--uniprot', type=Path, default=ROOT / 'scripts/reference/protein-name-aliases.tsv')
    parser.add_argument('--retrieved', default='2026-10-28', help='Source retrieval date (YYYY-MM-DD)')
    args = parser.parse_args()
    index = json.loads((ROOT / 'data/search-index.json').read_text())
    with gzip.open(args.gene_info, 'rt') as gene_info, args.uniprot.open() as uniprot:
        aliases, matched = build(index, gene_info, uniprot)
    output = ROOT / 'data/protein-aliases.json'
    output.write_text(json.dumps(aliases, separators=(',', ':'), ensure_ascii=False) + '\n')
    metadata = {
        'retrieved': args.retrieved,
        'taxon': 10090,
        'sources': [
            {'name': 'NCBI Gene mouse gene_info', 'url': NCBI_URL, 'sha256': hashlib.sha256(args.gene_info.read_bytes()).hexdigest(), 'fields': ['Symbol', 'Symbol_from_nomenclature_authority', 'Synonyms']},
            {'name': 'UniProt names for Prom1 and Pdcd1', 'url': UNIPROT_URL, 'sha256': hashlib.sha256(args.uniprot.read_bytes()).hexdigest()},
        ],
        'mapping': 'Exact mouse gene symbol for NCBI; exact UniProt accession for supplemental protein names. Ambiguous aliases retain every matched atlas protein.',
        'indexed_proteins': len(index),
        'proteins_with_ncbi_symbol_match': matched,
        'proteins_with_aliases': len(aliases),
        'alias_count': sum(map(len, aliases.values())),
        'output_bytes': output.stat().st_size,
        'output_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'search_index_sha256': hashlib.sha256((ROOT / 'data/search-index.json').read_bytes()).hexdigest(),
        'legacy_aliases': {'Ern1': ['IRE1', 'IRE1α']},
    }
    (ROOT / 'data/protein-aliases.provenance.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(f"{len(aliases):,} atlas proteins; {metadata['alias_count']:,} aliases; {output.stat().st_size:,} bytes")


if __name__ == '__main__':
    main()
