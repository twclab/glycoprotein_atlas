#!/usr/bin/env python3
"""Download UniProt name fields for every accession in the atlas search index."""
import argparse
import hashlib
import json
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

API = 'https://rest.uniprot.org'
FIELDS = 'accession,id,protein_name,gene_names,organism_id'
ROOT = Path(__file__).resolve().parents[1]


def request(url, form=None):
    if urlsplit(url).scheme != 'https' or urlsplit(url).netloc != 'rest.uniprot.org':
        raise ValueError('Expected an official UniProt REST URL')
    body = None if form is None else urlencode(form).encode()
    for attempt in range(4):
        try:
            with urlopen(Request(url, data=body, headers={'User-Agent': 'GlycoproteinAtlas/alias-import'}), timeout=90) as response:
                return response.read(), dict(response.headers)
        except (HTTPError, URLError) as error:
            if attempt == 3 or isinstance(error, HTTPError) and error.code not in {429, 500, 502, 503, 504}:
                raise
            time.sleep(min(10, 2 ** attempt))


def download(accessions, output, retrieved, job_id=None):
    accessions = sorted(set(accessions))
    if job_id is None:
        body, _ = request(API + '/idmapping/run', {'from': 'UniProtKB_AC-ID', 'to': 'UniProtKB', 'ids': ','.join(accessions)})
        job_id = json.loads(body)['jobId']
    print(f'UniProt mapping job {job_id}: {len(accessions):,} atlas accessions', flush=True)
    for _ in range(100):
        body, _ = request(API + '/idmapping/status/' + job_id)
        status = json.loads(body)
        if status.get('jobStatus') in {'RUNNING', 'NEW'}:
            time.sleep(3)
            continue
        if status.get('jobStatus') == 'FAILED':
            raise RuntimeError('UniProt ID mapping failed')
        break
    else:
        raise TimeoutError('UniProt mapping is still running; resume with --job-id ' + job_id)
    body, _ = request(API + '/idmapping/details/' + job_id)
    redirect = json.loads(body)['redirectURL']
    endpoint = redirect.split('?')[0].replace('/results/', '/results/stream/')
    url = endpoint + '?' + urlencode({'format': 'json', 'fields': FIELDS})
    body, headers = request(url)
    payload = json.loads(body)
    returned = {row['from'] for row in payload.get('results', [])}
    failed = set(payload.get('failedIds', []))
    if returned | failed != set(accessions) or returned & failed:
        raise ValueError('UniProt response does not account for every requested accession')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(body)
    metadata = {'retrieved': retrieved, 'api': API, 'from': 'UniProtKB_AC-ID', 'to': 'UniProtKB',
                'fields': FIELDS.split(','), 'job_id': job_id, 'result_url': url,
                'release': headers.get('x-uniprot-release') or headers.get('X-UniProt-Release'),
                'requested_accessions': accessions, 'returned_accessions': len(returned),
                'failed_accessions': sorted(failed), 'raw_sha256': hashlib.sha256(body).hexdigest()}
    output.with_suffix('.metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(f'{len(returned):,} returned; {len(failed):,} unavailable; {len(body):,} bytes', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--index', type=Path, default=ROOT / 'data/search-index.json')
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--retrieved', required=True)
    parser.add_argument('--job-id', help='Resume an existing mapping job')
    args = parser.parse_args()
    download([row['protein_id'] for row in json.loads(args.index.read_text())], args.out, args.retrieved, args.job_id)


if __name__ == '__main__':
    main()
