# Protein aliases

All four protein search fields use one alias index: Home, Explore, Age comparisons
(the TVD plot and gain/loss list), and the Inter-organ glycosite list. The expansion
adds no proteins and changes no search-index entries, protein shards or test values.

UniProt release 2026_03 returned one current mouse primary record for each of the
12,280 atlas accessions, with no unavailable, redirected or ambiguous mappings.
The expanded supplement has 87,944 names and aliases, including all 33,282 aliases
in the previous release. The import includes recommended and alternative full
names, short names, CD antigen labels, component names, gene synonyms, ORF/locus
names, and UniProt entry names. It reads named JSON fields rather than parsing
parentheses or extracting CD numbers from arbitrary descriptions. EC numbers,
evidence identifiers and free-text comments are excluded.

Search ignores case, spaces and punctuation, and normalizes alpha/beta/gamma
letters. Exact symbols and accessions rank first, then exact aliases. Shared names
retain every matching protein. Exact comparison matches take precedence over
partial names, so PD-1 does not select Entpd1. The autocomplete shows at most 50
rows and reports the full match count. The largest exact-name group in this
snapshot contains 11 proteins. Searching makes no external requests.

## Saved version and rollback

The existing `data/protein-aliases.json` and its provenance file are unchanged.
Their previous source builder and two-protein UniProt extract are also retained.
The complete prior website is saved as Git tag
`pre-uniprot-alias-expansion-2026-10-28`. The old matcher is saved under
`tests/fixtures/protein-search-before-uniprot.js` for compatibility checks.

Use these modes with a fresh page load, followed by any normal page navigation:

- `?aliases=previous#home`: use only the saved previous alias release.
- `?aliases=off#home`: use symbols, accessions and existing descriptions without an alias supplement.
- `?aliases=uniprot#home`: use the full import (the default).

The mode remains in the URL through navigation. There are no added interface
controls. All search fields use the selected release. If the expanded file cannot
load, the previous release is tried automatically; if both fail, canonical search
still works.

For a site-wide rollback, change `DEFAULT_ALIAS_MODE` in
`assets/protein-search.js` to `"previous"` or `"off"`, and change that script's
version token in `index.html` so existing browsers load the switch. Reverting the
isolated alias PR is another option. These approaches preserve later layout work;
restoring the whole tagged website is unnecessary for an alias-only rollback.

## Sources and reproduction

The previous release combines NCBI Gene mouse synonyms and the earlier UniProt
extract. The full name snapshot is in
`scripts/reference/uniprot-protein-names.json`; its source metadata records the
[official UniProt ID Mapping API](https://www.uniprot.org/help/api_idmapping),
selected fields, mapping job, release and raw-response hash. The expanded data
and its input/output hashes are recorded in
`data/protein-aliases-uniprot.provenance.json`.

Rebuild the expanded supplement offline from the saved snapshot:

```sh
python3 scripts/build_uniprot_aliases.py
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -v
```

Refresh the official snapshot, then rebuild:

```sh
python3 scripts/download_uniprot_names.py --out /tmp/uniprot-mapping.json --retrieved YYYY-MM-DD
python3 scripts/build_uniprot_aliases.py --mapping /tmp/uniprot-mapping.json
```

Downloads use the atlas accessions, not gene-name guesses. Refresh stops for
missing, redirected, non-mouse or multiply mapped entries so those cases can be
reviewed before replacing the reference.

The browser supplement is 1,881,769 bytes (608,121 bytes when gzip-compressed).
On the local reference run, preparation took about 119 ms; example searches took
2–24 ms. These are scripting measurements, not network or rendering timings.
Tests verify every imported name, previous-alias retention, all four search fields,
previous/off modes, fallback loading and behavior against the saved old matcher.
