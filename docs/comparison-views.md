# Comparison views and scientific provenance

These views use only JSON already published in this repository's E330-2026-09-29 release. The supplied manuscript PDFs are design and calculation references, not website assets or data inputs. No raw data or unpublished manuscript files are added.

## Panel crosswalk

The gain/loss panel is **Figure 3C** in the supplied October draft. Age comparisons now pair Figures **3A and 3C** with a hit list. The age-versus-young-organ Figure 3B companion has been removed from that page following author feedback; the young-only scope is also removed from the Inter-organ dataset choices.

| Draft panel | Website view | Interaction |
| --- | --- | --- |
| 3A | Age comparisons: TVD vs −log₁₀(p value) | Select a dataset/comparison and search; a point selects a composition preview with links to its precise glycosite in Explore |
| 3C and S15D | Dominant loss/gain matrix | Cell selects both directions; colored count boxes at left and below the heatmap select one direction; full hit list includes expandable glycan type composition changes |
| 2B | Inter-organ: atlas organs, TVD | All ten organ pairs; boxes filter the list, dots select and scroll to a list row, and its site link opens Explore |
| 2C and S10 | Remodeling and glycan type heterogeneity | All three remodeling states, six diversity relationships; click a segment to filter the site list |
| 4H | Inter-organ: brain and myelin | Brain/male myelin, brain/female myelin, male/female myelin distributions and complete site lists |
| 1R and S3 | Methods and pairwise detail | TVD definition, percentage-point differences, Shannon H and weighted glycan types |

The inter-organ metric selector offers TVD and signed differences in weighted glycan types (dataset B minus A). The list displays paired weighted glycan types; Shannon H is retained in the source data but is not a display option here. Each row shows the glycosite and protein ID, then a two-line Comparison column naming the organs. The corresponding glycosite-composition bars and weighted-type values align horizontally with those names. A single TVD value appears at the far right, centered between the two lines. Inter-organ rows are descriptive comparisons, not hypothesis-test hits.

Age comparisons display the selected dataset's TVD screen next to a preview of the selected glycosite's composition with age. Clicking a TVD point selects the preview; its glycosite name and a separate link open the site in Explore. The matrix below follows Figure 3C: gain columns, loss rows in reverse order, gray zero cells and a plasma count scale from 1 to 30+. Mixed uses multicolor diagonal stripes. Colored loss count boxes sit left of the heatmap; colored gain count boxes sit below it. The All gains and All losses labels are omitted, but the counts remain. A shared color key identifies the glycan types. The matrix panel, cells and counts scale with the available width, without a fixed maximum cell size. The neighboring hit list stays within the panel height. Cell values remain exact above the color limit. Dataset and age-comparison controls update the plot, matrix and list together. Each colored count box or matrix cell filters the raw-p <0.05 hits. Search filters the matrix and list and highlights TVD matches. Expanded hit details show all eight signed percentage-point changes and their shares of the separate directional totals. Site names open the exact glycosite in Explore.

Inter-organ boxes use the Figure 2B pair order and colors; the myelin view uses Figure 4H. Displayed scores, composition bars and links follow that pair order. The underlying exports retain their original order. Selecting a box resets list filters and shows all eligible sites for that pair. The selected pair is named above the list as “Kidney v Liver”, for example. Reset filters resets pair, remodeling, diversity, search and sorting, and removes point selection. List rows keep their fixed 84px height for accurate virtual scrolling. Selecting a dot also clears conflicting filters, highlights the corresponding row, scrolls it into the list viewport and moves keyboard focus there. Only clicking the row's glycosite name opens Explore. Mouse and keyboard selection follow the same path.

## Calculations and thresholds

- TVD in percent is half the L1 distance between percentage vectors. It is in [0, 100].
- The age screen preserves **all original tested-site TVD and p values**. Hits use raw permutation p <0.05, as in the draft. No FDR-adjusted significance is implied.
- Age gain/loss vectors use per-animal mean percentages (`glycan_classes.age_bins[].percent`), A minus B. The builder checks their recomputed TVD against the original exported TVD (absolute tolerance 1e-5 percentage points) before assigning direction. Pooled percentages are not substituted for these means.
- Dominance is evaluated separately for gain and loss: the largest changing class must account for at least 60% of that side's total. Otherwise the direction is `mixed`.
- For O versus Y, signed class changes are old mean percentage minus young mean percentage. Positive changes are summed as gains; absolute negative changes are summed as losses. Dominance refers to the share of the compositional change, not the site's most abundant glycan type. Other age contrasts follow their displayed A-minus-B order.
- All-age inter-organ vectors use `glycan_classes.pooled[].percent`, requiring at least 5 total PSMs at that site in each dataset. This is Tier 1+ in atlas organs. Male/female myelin are separate datasets and are never pooled into the five-organ atlas comparison total.
- Young-only inter-organ reference vectors use `pooled_percent` in Y. They require at least 9 detected young animals and 18 young-bin PSMs in each organ, following the author's recollection. There is no additional whole-lifespan Tier cutoff. These exports remain for reproducibility but are no longer offered or fetched by the website. Exact Figure 3B dot-count equivalence has not been established from the supplied raster panel.
- Derived entropy and effective-type scores are rounded to eight decimal places for byte-stable exports across Linux and macOS libm implementations. Original age-test statistics are preserved without rounding.
- TVD is stored at eight decimal places and classified at that same precision to prevent a displayed 50% from retaining a <50% state through floating-point roundoff.
- Weighted glycan types are exp(Shannon H), calculated on pooled class proportions. Diversity cutoffs: low <1.5; intermediate 1.5 to <2.5; high >=2.5. Remodeling cutoffs: conserved <20%; partially shifted 20% to <50%; strongly remodeled >=50%.
- Missing site profiles are excluded from pairwise comparisons, never filled with a zero-composition vector. An age hit without a matching composition would be retained with unavailable direction and counted in provenance; the current release has none.
- Box plots show every site's point with deterministic jitter, median, IQR and the most extreme observations within 1.5 IQR. No top-20 truncation or random sampling is used.

## Release regression checks

The derived data reproduce the supplied manuscript's five O-versus-Y counts: brain 158, spleen 187, liver 90, kidney 126, plasma 68. Brain has 26 dominant paucimannose gains and one dominant paucimannose loss.

The author's Mog N59 example is reproduced numerically: paucimannose gains 8.15 percentage points (56.9% of total gains, hence mixed gain); fucosylated glycans lose 12.07 points (84.2% of total losses, hence dominant fucosylated loss). The hit is in fucosylated loss / mixed gain. Regression tests cover these values, directional-total consistency for every age hit, and composition-bar consistency with TVD and entropy for every inter-organ row.

The ten pooled atlas pairs reproduce **5,266 comparisons** and every Figure 2B pair count. They reproduce **2,994 conserved, 1,070 partially shifted and 1,202 strongly remodeled** comparisons. The Figure 4H counts also match exactly: brain/myelin use 792, 748 and 716 shared eligible sites for brain/male, brain/female and male/female respectively.

`data/comparisons/manifest.json` records source SHA-256 hashes, release, rules, filenames, counts and unclassifiable directions. `scripts/build_comparisons.py` regenerates the exports deterministically with Python's standard library. New views fetch compact derived files instead of downloading all 453 MB of protein shards.

## Navigation and content

Raw data, Publications and Learning are removed from both navigation bars while their content is pending. Overview is also removed; old #overview links open Methods. Methods contains the supplied artwork and author prose. The primer remains author-owned future work. Existing explorer controls and glycan colors are retained.

Contact names were confirmed by the user. Email sources, checked October 24, 2026:

- Michael Schoof, `mlschoof@stanford.edu`: [Bertozzi Group profile](https://bertozzigroup.stanford.edu/lab-members/schoof).
- Tony Wyss-Coray, `twc@stanford.edu`: [Stanford faculty directory](https://web.stanford.edu/group/biox/faculty/dept_neurology.html) and [Stanford biography](https://neuroscience.stanford.edu/sites/default/files/5cc682f1adb017512bf5e8101ffb0d7a.pdf).
- Carolyn Bertozzi, `bertozzi@stanford.edu`: [Bertozzi Group contact page](https://bertozzigroup.stanford.edu/contact-us).

## Validation

```sh
python3 -m unittest discover -s tests -v
node --check assets/app.js
node --check assets/comparisons.js
python3 scripts/build_comparisons.py
git diff --exit-code -- data/comparisons
```

Use a feature branch and PR for review. GitHub Pages deploys the repository root on `main`; pushing this feature branch does not publish it to the production domain. Preview over HTTP, not `file://`.


## Figure 3B visual and coverage check

The author recalled a minimum of nine animals in each condition and 18 total PSMs. For young-organ comparisons these conditions are applied independently to each organ's young bin. The earlier reconstruction additionally required whole-lifespan Tier 2+; removing that extra condition changes the plotted count by only 0–2 sites per pair. The coverage audit is in [figure3b-coverage-check.csv](figure3b-coverage-check.csv).

The original panel and reconstructed plots were compared at matched 0–100% TVD scales. The broad tissue-specific distribution pattern is similar, but some medians and quartiles differ. The supplied panel is one embedded 2,231 × 3,469-pixel figure image, rather than separately recoverable vector point objects. Figure 3B has no n labels and many points overlap, so an exact source dot count cannot be inferred reliably from pixels. This remains a documented approximation suitable for review, rather than an assertion of exact manuscript reproduction.

A local visual audit also compared pooled PSM proportions with mean animal-level proportions. Neither visual similarity nor the recalled coverage rule establishes the original estimator. The reproducibility exports retain the pooled-PSM young-organ calculation; the website no longer offers that scope. All-age inter-organ and original age-screen statistics remain unchanged. No manuscript image is added to this public repository.
