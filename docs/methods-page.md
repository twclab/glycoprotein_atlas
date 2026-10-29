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

The last section uses the three supplied permutation plots and the prose from
`website_methods_permutation_test_text.docx`. The prose is unchanged; the final
paragraph is split at its three glycosite examples. At widths of at least 760px, the plot stays
beside the text and changes from Lamc1 N574 to Nfasc N1047 to Thy1 N94 as each
example's text reaches the reading area. The plot is capped at 680px and sized
for the viewport with room for the sticky section title. Plot and text change together, including
when scrolling back or jumping through the page. All three images preload before
scroll changes begin. On small screens and with reduced motion, each plot remains
inline with its corresponding text. No timer or manual controls are used for this
sequence. The short Nfasc and Thy1 examples use compact spacing, with enough
trailing room to keep the final plot visible. The earlier glycan-type carousel
retains its four-second interval.

The two agent-created schematics and their builder are removed. The earlier
added significance paragraph is also replaced by the author's supplied section.
No age-test values or scientific data were recalculated.

`scripts/build_permutation_assets.py` exports the three PDFs to SVG without
redrawing them. `assets/methods/permutation-manifest.json` records source and
export hashes and the shared 468 × 774 canvas. Regenerate them with:

```sh
python3 scripts/build_permutation_assets.py --source-dir /path/to/new/supplied/folder
```

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
