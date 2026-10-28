# Protein aliases

Search uses a local supplement from NCBI Gene mouse synonyms and UniProt protein names. It maps to the atlas's existing protein identifiers. It adds no proteins and does not change the published search index or protein shards.

The supplement has 33,282 aliases for 11,053 atlas proteins. NCBI symbols match 11,847 of 12,280 indexed proteins. Proteins without a symbol match still support their existing symbol, accession and description searches. UniProt names add CD133 and CD279. Existing IRE1 shortcuts are retained.

Search ignores case, spaces and punctuation. Exact symbols and accessions rank first, followed by exact aliases. Shared aliases return each matching protein. Comparison filters use exact symbols, accessions or aliases when available, so PD-1 does not also select Entpd1. The same lookup serves Explore, the age screen and comparison lists. The dropdown shows the first 50 ranked matches and reports when more matches exist. Refining the query searches all proteins. All data load locally; there are no external requests while searching. If the alias supplement cannot load, canonical searches still work.

Source URLs, retrieval date, hashes and coverage are in `data/protein-aliases.provenance.json`. To rebuild, download the public mouse gene table, then run:

```sh
curl --fail --location https://ftp.ncbi.nlm.nih.gov/gene/DATA/GENE_INFO/Mammalia/Mus_musculus.gene_info.gz --output /tmp/Mus_musculus.gene_info.gz
python3 scripts/build_protein_aliases.py --gene-info /tmp/Mus_musculus.gene_info.gz --retrieved YYYY-MM-DD
node --test tests/protein-search.test.cjs
```

The small UniProt name extract is retained in `scripts/reference/protein-name-aliases.tsv`. The downloaded NCBI table is not shipped to the browser. The static supplement is 469,512 bytes. Local measurements on October 28, 2026: preparation took 37.4 ms; searches for CD133, PD-1, CD279 and CD45 averaged 2.6 ms over 40 calls. These are scripting times, not network or rendering times.

