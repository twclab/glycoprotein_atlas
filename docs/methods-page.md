# Methods page

The Methods tab uses Michael's `website_methods_figure_text_v3.docx` and the ten
individual PDFs supplied alongside `website_methods.pdf`. The master PDF defines
the section order. The Word draft's eight prose paragraphs are preserved verbatim;
the two metric explanations precede the final summary, as in the master.

1. Animal cohorts and sampled tissues: primary atlas plus the supplied male and
   female myelin cohort drawings, including myelinating oligodendrocytes.
2. Glycoproteomics and proteomics workflow, followed by the preparation/QC text.
3. Glycosite coverage tiers: coverage curves and the threshold table.
4. Reducing glycan complexity: one of the three supplied examples at a time.
5. Glycan type assignment logic.
6. Glycosite heterogeneity: Shannon H and exp(H), weighted/effective glycan types.
7. Quantifying composition differences: TVD and pooled versus animal-mean profiles.
8. Site-level composition and summary metrics: the shared Site A/B example.

The three glycan examples rotate every **4 seconds**, as requested. Previous,
next, direct selection and pause/play controls remain available. Rotation pauses
while the panel is hovered or contains keyboard focus, while outside the viewport,
when Methods is hidden, or while the browser document is hidden. Reduced-motion
preferences start the panel paused; readers can still select or play examples.
Only manual changes are announced to screen readers. The first figure and all
Methods prose remain available without JavaScript.

## Source fidelity and presentation

`scripts/build_methods_assets.py` exports each supplied PDF with Poppler; it does
not redraw, recolor, recompute, or crop any panel. The source SHA-256 values and
export hashes are recorded in `assets/methods/manifest.json`. The master PDF and
DOCX remain local source documents; only their hashes and the panel artwork are
committed. There is no new scientific-data processing or change to the shards.

The two illustration-heavy panels use 2600px PNG previews (about 450KB combined)
instead of loading their 4.7MB combined SVGs. Other panels use their smaller SVG
exports. Images load lazily; full vector figures open on request. All image sizes
are reserved to avoid layout shifts. The carousel preloads its three small images
when it enters view and holds a fixed aspect ratio.

Figures have descriptive alternatives; the coverage table and assignment tree
also have selectable text equivalents. Equations are repeated as text. On narrow
screens the decision tree stacks above its explanation. Figures can be opened at
full size without losing the Methods page.

The existing browser-comparison rules remain in an expandable note at the end,
including raw permutation p-values, coverage, TVD categories, and young-only
thresholds. A short clarification distinguishes the most abundant glycan type at
a site from the ≥60% dominant gain/loss definition used in Age comparisons.

## Regenerate artwork

Install Poppler, then run from the repository root:

```sh
python3 scripts/build_methods_assets.py --source-dir /path/to/supplied/folder
```

The folder must include all ten panel PDFs, the master `website_methods.pdf`, and
`website_methods_figure_text_v3.docx`. These are the author-supplied website panels,
not panels reconstructed from earlier manuscript drafts.
