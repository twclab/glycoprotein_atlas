#!/usr/bin/env python3
"""Add atlas-wide UniProt names while preserving the previous alias release."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / 'scripts/reference/uniprot-protein-names.json'


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def protein_names(description):
    names = set()
    blocks = [description.get('recommendedName', {}), *description.get('alternativeNames', []), *description.get('submissionNames', [])]
    for block in blocks:
        if block.get('fullName', {}).get('value'):
            names.add(block['fullName']['value'])
        names.update(item['value'] for item in block.get('shortNames', []) if item.get('value'))
    names.update(item['value'] for item in description.get('cdAntigenNames', []) if item.get('value'))
    for part in [*description.get('contains', []), *description.get('includes', [])]:
        names.update(protein_names(part))
    return names


def gene_names(genes):
    names = set()
    for gene in genes:
        if gene.get('geneName', {}).get('value'):
            names.add(gene['geneName']['value'])
        for field in ['synonyms', 'orfNames', 'orderedLocusNames']:
            names.update(item['value'] for item in gene.get(field, []) if item.get('value'))
    return names


def snapshot(mapping, metadata, index):
    expected = {row['protein_id'] for row in index}
    rows = mapping.get('results', [])
    counts = Counter(row['from'] for row in rows)
    if mapping.get('failedIds') or set(counts) != expected or any(n != 1 for n in counts.values()):
        raise ValueError('Every atlas accession must have exactly one UniProt mapping')
    entries = []
    for row in rows:
        entry = row['to']
        if row['from'] != entry['primaryAccession'] or entry['organism']['taxonId'] != 10090:
            raise ValueError('A redirected or non-mouse accession requires review: ' + row['from'])
        entries.append({'accession': row['from'], 'entry_name': entry['uniProtkbId'],
                        'gene_names': sorted(gene_names(entry.get('genes', []))),
                        'protein_names': sorted(protein_names(entry.get('proteinDescription', {})))})
    if any(not entry['protein_names'] for entry in entries):
        raise ValueError('A UniProt record has no protein names')
    source = {key: metadata[key] for key in ['retrieved', 'api', 'from', 'to', 'fields', 'job_id', 'result_url', 'release', 'raw_sha256']}
    return {'source': source, 'entries': sorted(entries, key=lambda entry: entry['accession'])}


def build(index, previous, reference):
    entries = {entry['accession']: entry for entry in reference['entries']}
    expected = {row['protein_id'] for row in index}
    if len(entries) != len(reference['entries']) or set(entries) != expected or not set(previous).issubset(expected):
        raise ValueError('Reference and alias accessions must match the unchanged atlas index')
    aliases = {}
    for row in index:
        accession = row['protein_id']
        entry = entries[accession]
        old = set(previous.get(accession, []))
        names = old | set(entry['protein_names']) | set(entry['gene_names']) | {entry['entry_name']}
        canonical = {row['gene'].casefold(), accession.casefold()}
        names = {name for name in names if name.casefold() not in canonical}
        if not old.issubset(names):
            raise ValueError('Expansion must preserve every previous alias')
        aliases[accession] = sorted(names)
    return dict(sorted(aliases.items()))


def write_reference(path, reference):
    header = json.dumps(reference['source'], indent=2, ensure_ascii=False)
    lines = [json.dumps(entry, ensure_ascii=False, separators=(',', ':')) for entry in reference['entries']]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('{\n  "source": ' + header.replace('\n', '\n  ') + ',\n  "entries": [\n    ' + ',\n    '.join(lines) + '\n  ]\n}\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--index', type=Path, default=ROOT / 'data/search-index.json')
    parser.add_argument('--previous', type=Path, default=ROOT / 'data/protein-aliases.json')
    parser.add_argument('--reference', type=Path, default=REFERENCE)
    parser.add_argument('--mapping', type=Path, help='Fresh raw JSON from download_uniprot_names.py')
    parser.add_argument('--out', type=Path, default=ROOT / 'data/protein-aliases-uniprot.json')
    args = parser.parse_args()
    index = json.loads(args.index.read_text())
    if args.mapping:
        metadata = json.loads(args.mapping.with_suffix('.metadata.json').read_text())
        if metadata['raw_sha256'] != sha256(args.mapping):
            raise ValueError('Raw UniProt response hash does not match its metadata')
        reference = snapshot(json.loads(args.mapping.read_text()), metadata, index)
        write_reference(args.reference, reference)
    else:
        reference = json.loads(args.reference.read_text())
    previous = json.loads(args.previous.read_text())
    aliases = build(index, previous, reference)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(aliases, separators=(',', ':'), ensure_ascii=False) + '\n')
    metadata = {'retrieved': reference['source']['retrieved'], 'release': reference['source']['release'],
                'source': reference['source'], 'reference_sha256': sha256(args.reference),
                'previous_aliases_sha256': sha256(args.previous), 'search_index_sha256': sha256(args.index),
                'indexed_proteins': len(index), 'proteins_with_uniprot_names': len(reference['entries']),
                'previous_alias_count': sum(map(len, previous.values())), 'alias_count': sum(map(len, aliases.values())),
                'output_bytes': args.out.stat().st_size, 'output_sha256': sha256(args.out),
                'mapping': 'Exact atlas accessions; one mouse UniProt primary record per atlas protein. Shared names retain every matching protein.',
                'name_fields': ['recommended full names', 'alternative full names', 'short names', 'CD antigen names',
                                'component protein names', 'gene symbols and synonyms', 'ORF/locus names', 'UniProt entry names'],
                'excluded_fields': ['EC numbers', 'evidence identifiers', 'free-text annotation comments'],
                'rollback': 'The previous data/protein-aliases.json is unchanged. Use ?aliases=previous or ?aliases=off; change DEFAULT_ALIAS_MODE for a site-wide rollback.'}
    args.out.with_suffix('.provenance.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(f'{len(aliases):,} proteins; {metadata["alias_count"]:,} aliases; {metadata["output_bytes"]:,} bytes')


if __name__ == '__main__':
    main()
