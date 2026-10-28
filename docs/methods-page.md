# Methods page

The master `website_methods.pdf` defines the figure order. The eight prose
paragraphs in `website_methods_figure_text_v3.docx` are preserved verbatim.

Methods uses unnumbered headings, plain figures and 18px body text across each
card. It has no figure captions, full-size links, duplicate disclosures or manual
image controls or section-navigation buttons. Assignment-logic text sits beside
the tall figure on desktop and below it on small screens.

The three glycan examples change every four seconds. The exporter aligns their
eight type labels and gives all frames the same canvas. It preserves the drawing
paths; its small scale/position corrections remove differences between the PDF
artboards. The page loads all frames before starting. Reduced-motion preferences
keep the first image static. Hidden or off-screen views do not advance.

TVD significance follows the TVD composition paragraph. The two added SVGs are
schematics, not measured distributions. They show fixed-size animal-label
permutation and the estimator `p = (k + 1) / (B + 1)`, where `k` counts permuted
TVDs greater than or equal to observed TVD. Atlas tests use 99,999,999 permutations;
myelin tests use 9,999. The source is the v8 manuscript Methods paragraph beginning
“For comparisons between ages or experimental conditions.” Its local DOCX is
`glycoproteomics_paper_collated_manuscript_v8.docx`, SHA-256
`2544e9b1cc1392b8a818adda2f08988cf024d63d3ca3da25ef8e20b7966e4e7a`.

Regenerate these schematics with:

```sh
python3 scripts/build_tvd_explainers.py
```

The existing significance paragraph retains the atlas eligibility rule and raw
p <0.05 interpretation. No age-test values or scientific data were recalculated.

All visible exp(H) labels use **Weighted glycan types**. Existing data-field names
are retained for compatibility.

## Artwork

`scripts/build_methods_assets.py` exports the ten author-supplied PDFs with
Poppler. `assets/methods/manifest.json` records source hashes, export hashes and
the glycan alignment transforms. The master PDF and DOCX remain local sources.
The two illustration-heavy panels use 2600px PNG previews; other panels use SVG.
Figures retain descriptive alternative text and load lazily.

```sh
python3 scripts/build_methods_assets.py --source-dir /path/to/supplied/folder
```

The source folder must contain the ten panel PDFs, `website_methods.pdf`, and
`website_methods_figure_text_v3.docx`.

For copy and interface edits, follow
[plain-website-editing](../.agents/skills/plain-website-editing/SKILL.md).
