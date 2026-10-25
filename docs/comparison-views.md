# Comparison views and scientific provenance

These views use only JSON already published in this repository's E330-2026-09-29 release. The supplied manuscript PDFs are design and calculation references, not website assets or data inputs. No raw data or unpublished manuscript files are added.

## Panel crosswalk

The feedback called the gain/loss panel Figure 3B. In the supplied October draft it is **Figure 3C**; **Figure 3B** is the age-versus-young-inter-organ TVD distribution. Both are implemented.

| Draft panel | Website view | Interaction |
| --- | --- | --- |
| 3A | Age comparisons: existing TVD vs raw permutation p | Select a dataset/comparison, search, zoom, open the precise glycosite |
| 3C and S15D | Dominant loss/gain matrix | Cell selects both directions; row/column labels and margins select one direction; full hit list is scrollable |
| 3B | Aging and organ identity | Selected age comparison plus young-only inter-organ distributions; boxes open the corresponding full site list |
| 2B | Inter-organ: atlas organs, TVD | All ten organ pairs, every shared eligible site, clickable box and point |
| 2C and S10 | Remodeling and glycan-type heterogeneity | All three remodeling states, six diversity relationships; click a segment to filter the site list |
| 4H | Inter-organ: brain and myelin | Brain/male myelin, brain/female myelin, male/female myelin distributions and complete site lists |
| 1R and S3 | Methods and pairwise detail | TVD definition, percentage-point differences, Shannon H and effective glycan types |

The inter-organ metric selector also exposes signed differences in effective glycan types and Shannon H (dataset B minus A). Every table row reports both organ-specific scores. Pair order is always A / B. Inter-organ rows are descriptive comparisons, not hypothesis-test hits.

## Calculations and thresholds

- TVD in percent is half the L1 distance between percentage vectors. It is in [0, 100].
- The age screen preserves **all original tested-site TVD and p values**. Hits use raw permutation p <0.05, as in the draft. No FDR-adjusted significance is implied.
- Age gain/loss vectors use per-animal mean percentages (`glycan_classes.age_bins[].percent`), A minus B. The builder checks their recomputed TVD against the original exported TVD (absolute tolerance 1e-5 percentage points) before assigning direction. Pooled percentages are not substituted for these means.
- Dominance is evaluated separately for gain and loss: the largest changing class must account for at least 60% of that side's total. Otherwise the direction is `mixed`.
- All-age inter-organ vectors use `glycan_classes.pooled[].percent`, requiring at least 5 total PSMs at that site in each dataset. This is Tier 1+ in atlas organs. Male/female myelin are separate datasets and are never pooled into the five-organ atlas comparison total.
- Young-only inter-organ reference vectors use `pooled_percent` in Y. They require at least 9 detected young animals and 18 young-bin PSMs in each organ, following the author's recollection. There is no additional whole-lifespan Tier cutoff. These rules are explicitly displayed; exact Figure 3B dot-count equivalence has not been established from the supplied raster panel.
- Derived entropy and effective-type scores are rounded to eight decimal places for byte-stable exports across Linux and macOS libm implementations. Original age-test statistics are preserved without rounding.
- TVD is stored at eight decimal places and classified at that same precision to prevent a displayed 50% from retaining a <50% state through floating-point roundoff.
- Effective types are exp(Shannon H), calculated on pooled class proportions. Diversity cutoffs: low <1.5; intermediate 1.5 to <2.5; high >=2.5. Remodeling cutoffs: conserved <20%; partially shifted 20% to <50%; strongly remodeled >=50%.
- Missing site profiles are excluded from pairwise comparisons, never filled with a zero-composition vector. An age hit without a matching composition would be retained with unavailable direction and counted in provenance; the current release has none.
- Box plots show every site's point with deterministic jitter, median, IQR and the most extreme observations within 1.5 IQR. No top-20 truncation or random sampling is used.

## Release regression checks

The derived data reproduce the supplied manuscript's five O-versus-Y counts: brain 158, spleen 187, liver 90, kidney 126, plasma 68. Brain has 26 dominant paucimannose gains and one dominant paucimannose loss.

The ten pooled atlas pairs reproduce **5,266 comparisons** and every Figure 2B pair count. They reproduce **2,994 conserved, 1,070 partially shifted and 1,202 strongly remodeled** comparisons. The Figure 4H counts also match exactly: brain/myelin use 792, 748 and 716 shared eligible sites for brain/male, brain/female and male/female respectively.

`data/comparisons/manifest.json` records source SHA-256 hashes, release, rules, filenames, counts and unclassifiable directions. `scripts/build_comparisons.py` regenerates the exports deterministically with Python's standard library. New views fetch compact derived files instead of downloading all 453 MB of protein shards.

## Navigation and content

Raw data, Publications and Learning are removed from both navigation bars while their content is pending. Overview and a clearly labeled Methods summary are filled from the supplied scientific context; the full experimental methods and primer remain author-owned future work. Existing explorer controls and glycan colors are retained.

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

A local visual audit also compared pooled PSM proportions with mean animal-level proportions. Neither visual similarity nor the recalled coverage rule establishes the original estimator. The website retains its explicitly labeled pooled-PSM young-organ calculation. All-age inter-organ and original age-screen statistics remain unchanged. No manuscript image is added to this public repository.
