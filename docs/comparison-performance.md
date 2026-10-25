# Comparison interaction performance

The merged comparison page rendered all 5,266 atlas rows and composition bars at once. Selecting a box or point replaced the entire comparison page, including all SVG points and event handlers. SVG titles also relied on the browser's delayed hover tooltip.

## Changes

- Keep the plot and controls mounted when selecting boxes, points, or list filters. Only a scope or metric change rebuilds the plot. Returning from Explore reuses the comparison view and its scroll position.
- Draw every original point as one SVG circle, with delegated interaction handlers, a larger transparent hit area, clickable box labels, and immediate pointer/focus labels.
- Keep a bounded moving window of table rows plus scroll spacers. Every site remains reachable through the scrollbar, keyboard scrolling, search, and sort; this is not a top-hit cutoff. Fixed row geometry, logical `aria-rowindex` values, and the total `aria-rowcount` preserve the position within the full list. The visible-range label describes the rows on screen.
- The page's protein/site search matches every record. Native browser Find sees only the currently mounted table rows.
- Count age gain/loss cells in one pass instead of repeatedly filtering the hit list for every cell. Build the eight-class mean-change details only when expanded.
- Reuse only the most recently requested protein shard, including an in-flight request. The cache does not grow with browsing history. Ignore stale protein-load results, and honor a site link clicked before the Explorer lookup index finishes loading.

No data export, eligibility threshold, statistic, plotted point count, or glycan classification changes.

## Local browser measurements

Representative scripting samples from the same browser on October 24, 2026 (America/Los_Angeles), comparing merged main `c1fb27b` with this follow-up:

| Measurement | Before | After |
| --- | ---: | ---: |
| Atlas comparison-page elements | 131,204 | 5,980 |
| Mounted atlas table rows | 5,266 | 24, with every row scrollable |
| Drawn atlas points | 5,266 | 5,266 |
| Initial comparison render | 182.1 ms | 89.4 ms |
| Select Brain / Spleen box | 334.2 ms | 6.7 ms |
| Select Scarb2 N249 dot from all pairs | 259.9 ms | 8.1 ms |

The page-element reduction is approximately 95%. Repeated measurements varied (initial rendering was also observed at 57.2 ms and box selection at 19.2 ms). These are local scripting measurements, not network or paint timings; absolute times depend on hardware, cache state, and other work in the browser. They do not diagnose the user's overall system memory pressure.

For a repeatable trace, open `/?profileComparisons=1#inter-organ`, select Brain / Spleen, choose all pairs again, then select Scarb2 N249. Console entries prefixed `ATLAS_PROFILE` separate data readiness, plot rendering, list updates, and total selection work. Profiling is opt-in and sends no telemetry. Explorer entries distinguish first-shard loading from reuse.

## Validation

- Existing 17 scientific regression tests continue to pass.
- Eight Node tests cover bounded rendering, every scroll position through all 5,266 sites, selected-site visibility, fractional scroll, filtering at the end of a list, unchanged matrix totals, and Mog's mixed-gain classification.
- Browser checks cover the final atlas row, dot-to-row selection, unchanged 104-pixel row geometry, immediate focus labels, full-pair filter reset, search and empty states, all comparison scopes and metrics, lazy Mog details, exact Explorer context, and repeated shard reuse.
- A temporary localhost fixture held the lookup index until after a site click, then released it and confirmed the correct site loaded. It also held an older protein shard until a newer site was displayed; releasing that older response did not replace the newer selection. The fixture and its tab were stopped after testing.

Run:

```sh
node --test tests/comparison-layout.test.cjs
python3 -m unittest discover -s tests -v
node --check assets/app.js
node --check assets/comparisons.js
node --check assets/comparison-layout.js
```
