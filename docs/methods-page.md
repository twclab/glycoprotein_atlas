# Methods page

The master `website_methods.pdf` defines the figure order. The eight prose
paragraphs in `website_methods_figure_text_v3.docx` are preserved verbatim.

Methods uses unnumbered headings, plain figures and 18px body text across each
card. It has no figure captions, full-size links, duplicate disclosures or manual
image controls. Section navigation remains available.

The three glycan examples change every four seconds. The exporter aligns their
eight type labels and gives all frames the same canvas. It preserves the drawing
paths; its small scale/position corrections remove differences between the PDF
artboards. The page loads all frames before starting. Reduced-motion preferences
keep the first image static. Hidden or off-screen views do not advance.

TVD significance follows the TVD composition paragraph. Its source is Figure 3A
and the Figure S15 legend: fixed-size animal-label permutation, Tier 2+ atlas
coverage, at least nine detected animals and 18 glycoPSMs per compared age bin,
and raw p <0.05 without multiple-testing adjustment. No permutation count or
unprovided p-value estimator is assumed.

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
