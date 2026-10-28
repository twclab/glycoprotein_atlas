#!/usr/bin/env python3
"""Export the three author-supplied permutation PDFs without redrawing them."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

PANELS = {
    'permutation-lamc1': 'permutation_test_Lamc1_N574.pdf',
    'permutation-nfasc': 'permutation_test_Nfasc_N1047.pdf',
    'permutation-thy1': 'permutation_test_Thy1_N94.pdf',
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--out-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'assets/methods')
    args = parser.parse_args()
    sources = [*PANELS.values(), 'website_methods_permutation_test_text.docx']
    missing = [name for name in sources if not (args.source_dir / name).is_file()]
    if missing:
        parser.error('Missing supplied sources: ' + ', '.join(missing))
    args.out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {'description': 'Author-supplied permutation plots and text; Lamc1, Nfasc, Thy1 scroll order.',
                'sources': {name: sha256(args.source_dir / name) for name in sources}, 'panels': []}
    for slug, source in PANELS.items():
        target = args.out_dir / (slug + '.svg')
        subprocess.run(['pdftocairo', '-svg', str(args.source_dir / source), str(target)], check=True)
        canvas = ET.parse(target).getroot().get('viewBox')
        if canvas != '0 0 468 774':
            raise ValueError(f'Unexpected figure canvas: {source}: {canvas}')
        manifest['panels'].append({'source': source, 'vector': target.name, 'viewBox': canvas,
                                   'bytes': target.stat().st_size, 'sha256': sha256(target)})
    (args.out_dir / 'permutation-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
