const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROW_HEIGHT, windowRange, changeCounts } = require('../assets/comparison-layout.js');
const data = name => JSON.parse(fs.readFileSync(path.join(__dirname, '../data/comparisons', name)));

test('age-group key is visible only for grouped ages and uses cohort-specific months', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  assert.match(html, /<p class="age-bin-key" data-age-bin-key>Y = Young \(1–6 months\)&#10;MA = Middle-aged \(9–16 months\)&#10;O = Old \(19–28 months\)<\/p>/);
  assert.match(app, /myelin_male: "Y = Young \(3 months\)\\nMA = Middle-aged \(16 months\)\\nO = Old \(29 months\)"/);
  assert.match(app, /myelin_female: "Y = Young \(3–4 months\)\\nMA = Middle-aged \(13 months\)\\nO = Old \(27 months\)"/);
  assert.match(app, /dom\.ageBinKey\.hidden = !site \|\| state\.ageMode !== "age_bins"/);
  assert.match(styles, /\.age-bin-key \{ margin: -3px 0 0; color: var\(--ink-soft\); font-size: 14px; line-height: 1\.4; white-space: pre-line; \}/);
});

test('numeric glycoPSM counts are singular only for one', () => {
  const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
  const comparisons = fs.readFileSync(path.join(__dirname, '../assets/comparisons.js'), 'utf8');
  const appFormat = app.match(/  function formatNumber\(value\) \{[^\n]+\}/)?.[0];
  const appCount = app.match(/  function formatGlycoPSMCount\(value, qualifier = ""\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(appFormat && appCount, 'the count formatter is present');
  const formatCount = new Function(`${appFormat}\n${appCount}\nreturn formatGlycoPSMCount;`)();
  assert.equal(formatCount(1), '1 glycoPSM');
  assert.equal(formatCount('1', 'total'), '1 total glycoPSM');
  assert.equal(formatCount(0), '0 glycoPSMs');
  assert.equal(formatCount(2, 'total'), '2 total glycoPSMs');
  const comparisonNum = comparisons.match(/  const num = \(v\) => [^\n]+/)?.[0];
  const comparisonCount = comparisons.match(/  const glycoPSMCount = \(v, qualifier = ""\) => [^\n]+/)?.[0];
  assert.ok(comparisonNum && comparisonCount, 'the inter-organ count formatter is present');
  const formatComparisonCount = new Function(`${comparisonNum}\n${comparisonCount}\nreturn glycoPSMCount;`)();
  assert.equal(formatComparisonCount(1, 'total'), '1 total glycoPSM');
  assert.equal(formatComparisonCount(2, 'total'), '2 total glycoPSMs');
  assert.match(app, /evidence\.textContent = formatGlycoPSMCount\(site\.total_psm\)/);
  assert.match(comparisons, /glycoPSMCount\(psm, "total"\)/);
});

test('visible relation labels use spaces around their symbols', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
  const comparisons = fs.readFileSync(path.join(__dirname, '../assets/comparisons.js'), 'utf8');
  assert.match(html, /low-confidence glycosite \(&lt; 5 glycoPSMs\)/);
  assert.match(app, /Low-confidence site \(< 5 glycoPSMs\)/);
  assert.match(app, /n = \$\{point\.n\}/);
  assert.match(app, /n = \$\{row\.n\}/);
  assert.match(app, /"n = " \+ row\.n/);
  assert.match(comparisons, />n = 0<\/text>/);
  assert.match(comparisons, /<small>n = \$\{num\(n\)\}<\/small>/);
});

test('visible glycan type terminology is not hyphenated', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const comparisons = fs.readFileSync(path.join(__dirname, '../assets/comparisons.js'), 'utf8');
  assert.match(html, /Shannon H measures glycan type diversity and evenness/);
  assert.doesNotMatch(html, /glycan-type diversity/i);
  assert.doesNotMatch(comparisons, /Glycan-type colors|glycan-type heterogeneity/i);
});

test('exact glycan age heading has a rule on both sides of its label', () => {
  const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  assert.match(app, /<div class="exact-age-heading"><span><span>Age \(months\)<\/span><\/span><\/div>/);
  assert.match(styles, /\.exact-age-heading > span \{ background: linear-gradient\(var\(--axis-ink\),var\(--axis-ink\)\) center \/ 100% 1px no-repeat; \}/);
  assert.match(styles, /\.exact-age-heading > span > span \{ padding-inline: 10px; background: white; \}/);
  assert.doesNotMatch(styles, /\.exact-age-heading span::after/);
});

test('exact glycan age heading omits Composition but preserves the age columns', () => {
  const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
  assert.match(app, /<div class="exact-row exact-head"><span class="exact-name" aria-hidden="true"><\/span>\$\{keys\.map/);
  assert.doesNotMatch(app, /<span class="exact-name">Composition<\/span>/);
});

test('exact glycan row labels and age numbers are both 14 px', () => {
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  assert.match(styles, /\.exact-name \{ font: 14px\/34px ui-monospace, monospace; \}/);
  assert.match(styles, /\.exact-header \{ color: var\(--ink-soft\); font-family: var\(--sans\); font-size: 14px; font-weight: 400; \}/);
});

test('exact glycan secondary headings and notation key use the revised type scale', () => {
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  assert.match(styles, /\.exact-key \{ font-size: 14px;/);
  assert.match(styles, /\.abundance-scale-label, \.abundance-scale \{ color: var\(--axis-ink\); font-size: 16px;/);
  assert.match(styles, /\.exact-age-heading > span \{ font-size: 16px; \}/);
});

test('exact glycan notation uses S for Neu5Ac and G for Neu5Gc', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
  assert.match(html, /S: Neu5Ac · G: Neu5Gc/);
  assert.ok(app.includes('replace(/Neu5Ac\\((\\d+)\\)/g, "S$1 ")'));
  assert.ok(app.includes('replace(/Neu5Gc\\((\\d+)\\)/g, "G$1 ")'));
  assert.match(app, /const tooltip = `\$\{displayName\} ·/);
  assert.doesNotMatch(html, /A: NeuAc|G: NeuGc/);
});

test('exact glycan values keep the normal cursor', () => {
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  assert.match(styles, /\.exact-cell \{[^}]*cursor: default;/);
  assert.doesNotMatch(styles, /\.exact-cell \{[^}]*cursor: help;/);
});

test('small positive exact-glycan percentages do not display as zero', () => {
  const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
  const formatter = app.match(/  function formatExactPercent\(percent\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(formatter, 'the exact-glycan percentage formatter exists');
  const format = new Function(`${formatter}; return formatExactPercent;`)();
  assert.equal(format(0), '0.0%');
  assert.equal(format(0.01992825827), '0.02%');
  assert.equal(format(0.004), '< 0.01%');
  assert.equal(format(0.1), '0.1%');
  assert.match(app, /const displayPercent = formatExactPercent\(percent\)/);
  assert.match(app, /\$\{displayPercent\} of pooled glycoPSMs/);
  assert.match(app, /escapeHTML\(displayPercent\)/);
});

test('pairwise menus share one wide row and wrap as the card narrows', () => {
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  assert.match(styles, /\.pairwise-detail \{ container-type: inline-size; \}/);
  assert.match(styles, /\.pairwise-controls \{ grid-template-columns: minmax\(0, 2fr\) repeat\(3, minmax\(0, 1fr\)\); gap: 12px; \}/);
  assert.match(styles, /\.pairwise-controls \.pairwise-top-row, \.pairwise-controls \.pair-selectors, \.pairwise-controls \.pair-selectors:has\(\[data-pair-site-a\]\) \{ display: contents; \}/);
  assert.match(styles, /@container \(max-width: 700px\) \{\s*\.pairwise-controls \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(styles, /@container \(max-width: 420px\) \{\s*\.pairwise-controls \{ grid-template-columns: 1fr; \}/);
});

test('pairwise and exact composition cards align titles and control spacing', () => {
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  assert.match(styles, /\.pairwise-detail-panel \{ padding-top: 20px; \}/);
  assert.match(styles, /\.pairwise-detail-panel \.panel-header \{ min-height: 0; margin-bottom: 18px; \}/);
  assert.match(styles, /\.pairwise-detail-panel h3, \.exact-panel h3 \{ margin: 0; font-size: 18px; \}/);
  assert.match(styles, /\.exact-toolbar \{[^}]*margin-top: 18px; \}/);
});

test('exact composition card matches pairwise height with an internal scroll on wide screens', () => {
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  assert.match(styles, /@media \(min-width: 1001px\) \{\s*\.support-grid \{ align-items: stretch; \}/);
  assert.match(styles, /\.exact-panel \{ display: flex; flex-direction: column; min-height: 0; \}/);
  assert.match(styles, /\.exact-grid \{ flex: 1 1 0; height: 0; min-height: 0; overflow: auto; \}/);
  assert.match(styles, /@media \(max-width: 1000px\) \{\s*\.exact-grid \{ max-height: 520px; overflow: auto; \}/);
});

test('pairwise metric boxes are compact and dataset labels have balanced spacing', () => {
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  assert.match(styles, /\.comparison-columns \{[^}]*margin-top: 16px; \}/);
  assert.match(styles, /\.comparison-profile > strong \{ display: block; min-height: 0; margin-bottom: 16px; font-size: 14px; line-height: 1\.25; \}/);
  assert.match(styles, /\.comparison-site-metrics \{ display: grid; gap: 5px; margin-top: 8px; \}/);
  assert.match(styles, /\.comparison-metric \{ min-height: 52px; padding: 6px 10px; border: 1px solid var\(--gray-100\); border-radius: 7px; \}/);
});

test('pairwise cross-dataset labels use the selected dataset names', () => {
  const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
  const render = app.match(/  function renderPairwise\(site\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(render, 'the pairwise renderer exists');
  assert.match(render, /const datasetAName = ORGAN_LABELS\[state\.pairOrganA\];/);
  assert.match(render, /const datasetBName = ORGAN_LABELS\[state\.pairOrganB\];/);
  assert.match(render, /<label>\$\{escapeHTML\(datasetAName\)\}<select data-pair-organ-a/);
  assert.match(render, /<label>\$\{escapeHTML\(datasetBName\)\}<select data-pair-organ-b/);
  assert.match(render, /\$\{escapeHTML\(datasetBName\)\} − \$\{escapeHTML\(datasetAName\)\}/);
  assert.doesNotMatch(render, /Dataset A|Dataset B/);
});

test('pairwise TVD bar sits beside its value inside the metric box', () => {
  const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  assert.match(app, /class="comparison-distance"><div class="comparison-metric"><span>Total variation distance \(TVD\)<\/span><div class="comparison-distance-value"><strong>/);
  assert.match(app, /<div class="distance-track" aria-hidden="true"><i style="width:/);
  assert.match(styles, /\.comparison-distance-value \{ display: flex; align-items: center; gap: 12px; margin-top: 4px; \}/);
  assert.match(styles, /\.comparison-distance-value \.distance-track \{ flex: 1; min-width: 0; margin-top: 0; \}/);
});

test('pairwise percentages use two decimals only when either dataset value is small', () => {
  const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
  const formatter = app.match(/  function formatPairwisePercentRow\(valueA, valueB\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(formatter, 'the pairwise row formatter exists');
  const format = new Function(`${formatter}; return formatPairwisePercentRow;`)();
  assert.deepEqual(format(0.0058726802913, 0.050220972278), ['0.01%', '0.05%', '+0.04 pp']);
  assert.deepEqual(format(0, 0.05), ['0.00%', '0.05%', '+0.05 pp']);
  assert.deepEqual(format(1.3154803852, 3.5556448373), ['1.3%', '3.6%', '+2.2 pp']);
  assert.deepEqual(format(9.6605590792, 12.6456408196), ['9.7%', '12.6%', '+3.0 pp']);
  assert.deepEqual(format(66.4258867747, 61.6110887907), ['66.4%', '61.6%', '-4.8 pp']);
  assert.deepEqual(format(0.001, 0.003), ['< 0.01%', '< 0.01%', '+0.002 pp']);
  assert.deepEqual(format(0.003, 0.001), ['< 0.01%', '< 0.01%', '-0.002 pp']);
  assert.deepEqual(format(0, 0), ['0.0%', '0.0%', '0.0 pp']);
  assert.match(app, /const \[displayA, displayB, displayDifference\] = formatPairwisePercentRow\(valueA, valueB\);/);
});

test('pairwise table uses compact left-aligned white-header styling', () => {
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  assert.match(styles, /\.comparison-table-wrap table \{[^}]*font-size: 14px;/);
  assert.match(styles, /\.comparison-table-wrap th, \.comparison-table-wrap td \{[^}]*padding: 5px 7px; line-height: 16px; text-align: left;/);
  assert.match(styles, /\.comparison-table-wrap tbody th \{ font-weight: 400; \}/);
  assert.match(styles, /\.comparison-table-wrap thead th \{ background: white;/);
  assert.match(styles, /\.comparison-profile > strong \{[^}]*color: var\(--ink-soft\);/);
});

test('heterogeneity metric and calculation method use synchronized dropdowns', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  assert.match(html, /<label class="heterogeneity-control-row">Heterogeneity metric<select data-diversity-metric/);
  assert.match(html, /<option value="effective"[^>]*>Weighted glycan types<\/option><option value="shannon"[^>]*>Shannon H<\/option>/);
  assert.match(html, /<label class="heterogeneity-control-row">Calculation method<select data-diversity-grouping/);
  assert.match(html, /<option value="sample"[^>]*>Per sample<\/option><option value="pooled"[^>]*>Pooled by age<\/option>/);
  assert.match(app, /dom\.diversityMetricSelect\.addEventListener\("change"/);
  assert.match(app, /dom\.diversityGroupingSelect\.addEventListener\("change"/);
  const defaults = app.match(/function setSiteDefaults\(site\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(defaults, 'site defaults remain available');
  assert.match(defaults, /state\.diversityGrouping = moderateOrLower \? "pooled" : "sample";/);
  assert.match(defaults, /syncDiversityControls\(\);/);
  assert.match(styles, /\.heterogeneity-controls \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(styles, /@container \(max-width: 330px\) \{\s*\.heterogeneity-controls \{ grid-template-columns: 1fr; \}/);
});

test('glycosite labels are not underlined across comparison and Explore views', () => {
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  const comparisons = fs.readFileSync(path.join(__dirname, '../assets/comparisons.css'), 'utf8');
  assert.match(comparisons, /\.hit-table a \{[^}]*text-decoration: none;/);
  assert.match(styles, /\.tvd-panel \.age-selection a \{[^}]*text-decoration: none;/);
  assert.match(styles, /\.profile-site-label:focus-visible \{ outline: 2px solid var\(--teal-700\);/);
  assert.doesNotMatch(styles, /\.profile-site-label:hover, \.profile-site-label:focus-visible \{[^}]*text-decoration: underline/);
});

test('age preview keeps its heading and colors the selected glycosite by organ', () => {
  const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
  assert.match(app, /dom\.tvdPreviewTitle\.innerHTML = `N-glycosite composition with age: <a href="\$\{escapeHTML\(href\)\}" data-tvd-preview-open style="color:\$\{ORGAN_COLORS\[organ\]\}">/);
  assert.doesNotMatch(app, /dom\.tvdPreviewTitle\.textContent = "Loading glycosite…"/);
});

test('age comparison headings sit inside their plot and preview cards', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  assert.match(html, /<div class="tvd-panel"><div class="age-selection"><strong data-age-selection>.*?<\/strong><\/div><div class="tvd-plot"/);
  assert.match(html, /<div class="tvd-panel"><div class="age-selection"><strong data-tvd-preview-title>.*?<\/strong><\/div><article class="scientific-panel tvd-preview"/);
  assert.match(styles, /\.tvd-panel \{[^}]*border: 1px solid var\(--gray-300\);[^}]*border-radius: 14px;/);
  assert.match(styles, /\.tvd-panel \.tvd-plot, \.tvd-panel \.tvd-preview \{ border: 0; \}/);
});

test('age and inter-organ card headings share one size and default text color', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/comparisons.css'), 'utf8');
  assert.match(css, /\.comparison-page \{ --comparison-card-title-size: 20px;/);
  assert.match(css, /\.age-selection strong \{ color: var\(--ink\); font-size: var\(--comparison-card-title-size\);/);
  assert.match(css, /\.comparison-card h3 \{[^}]*color: var\(--ink\); font-size: var\(--comparison-card-title-size\);/);
});

test('age hit columns are left aligned and use balanced widths', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/comparisons.css'), 'utf8');
  const comparisons = fs.readFileSync(path.join(__dirname, '../assets/comparisons.js'), 'utf8');
  assert.match(css, /\.age-hit-table \{ min-width: 505px; table-layout: fixed; \}/);
  assert.match(css, /\.age-hit-table thead th, \.age-hit-table tbody th, \.age-hit-table tbody td \{ text-align: left; vertical-align: top; \}/);
  assert.match(comparisons, /<colgroup><col style="width:23%"><col style="width:12%"><col style="width:14%"><col style="width:16%"><col style="width:35%"><\/colgroup>/);
});

test('myelin labels use lowercase female and male across views', () => {
  const app = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8');
  const comparisons = fs.readFileSync(path.join(__dirname, '../assets/comparisons.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  for (const source of [app, comparisons]) {
    assert.match(source, /myelin_male: "Myelin \(male\)"/);
    assert.match(source, /myelin_female: "Myelin \(female\)"/);
    assert.doesNotMatch(source, /Myelin \((?:Male|Female)\)/);
  }
  assert.doesNotMatch(styles, /\.segment-organ-row > strong \{[^}]*text-transform: capitalize/);
});

test('age cards and square matrix cells stay bounded on wide and short screens', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/comparisons.css'), 'utf8');
  assert.match(css, /\.age-grid \{ grid-template-columns: minmax\(0,min\(680px,56%\)\) minmax\(0,1fr\); height: auto; \}/);
  assert.match(css, /\.age-grid \.comparison-scroll \{ width: 100%; max-width: 544px; margin-inline: auto; justify-items: center; align-content: start; \}/);
  assert.match(css, /\.age-grid \.matrix-table-wrap \{ width: 100%; display: flex; justify-content: center; \}/);
  assert.match(css, /\.age-grid \.matrix-count-key \{[^}]*width: min\(280px, 100%\); margin: 0 0 12px;/);
  assert.match(css, /\.age-grid \.matrix-class-legend \{[^}]*width: min\(100%, 512px\); margin: 0 0 18px;/);
  const matrixRule = css.match(/\.age-grid \.gain-loss-matrix \{([^}]*)\}/g)?.at(-1);
  assert.ok(matrixRule, 'the age matrix has its own sizing rule');
  assert.match(matrixRule, /--matrix-cell: clamp\(14px, min\([^;]*100cqi[^;]*100svh[^;]*\), 48px\)/);
  assert.match(matrixRule, /width: calc\(10 \* var\(--matrix-cell\) \+ 64px\)/);
  assert.match(css, /\.age-grid \.comparison-hit-scroll \{ contain: size; flex: 1; height: 0; \}/);
});

test('inter-organ page uses the age page width and top alignment without changing plot height', () => {
  const styles = fs.readFileSync(path.join(__dirname, '../assets/styles.css'), 'utf8');
  const comparisons = fs.readFileSync(path.join(__dirname, '../assets/comparisons.css'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(styles, /#tvd\.content-page, #inter-organ\.content-page \{\s*padding: 84px max\(clamp\(20px, 3vw, 50px\), calc\(\(100% - 1600px\) \/ 2\)\) 90px;/);
  assert.match(styles, /\.home-view \{[^}]*background: var\(--paper\);/);
  assert.match(styles, /\.explore-view \{[^}]*background: var\(--paper\);/);
  assert.match(styles, /\.content-page \{[^}]*background: var\(--paper\);/);
  assert.match(comparisons, /#inter-organ \.comparison-intro \{ margin-bottom: 8px; \}/);
  assert.match(comparisons, /#inter-organ > \[data-inter-content\] > \.comparison-toolbar \{ align-items: end; margin: 10px 0 6px; \}/);
  assert.match(comparisons, /\.inter-grid \{ grid-template-columns: minmax\(0, 1\.15fr\) minmax\(0, 1fr\); align-items: stretch; \}/);
  assert.match(comparisons, /#inter-organ \.inter-grid \{ margin-top: 18px; \}/);
  assert.match(comparisons, /\.inter-grid > \.comparison-card \{ padding: 14px 20px; \}/);
  assert.match(comparisons, /\.inter-hit-scroll \{ height: 410px;/);
  assert.match(html, /<section class="content-page comparison-page" id="inter-organ"[^>]*>\s*<div class="comparison-intro"><h2>Inter-organ comparisons<\/h2><\/div>/);
});

test('inter-organ toolbars match age comparison control styling and use box plot terminology', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/comparisons.css'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../assets/comparisons.js'), 'utf8');
  assert.match(css, /\.comparison-toolbar label \{[^}]*color: var\(--gray-500\);[^}]*font-size: 15px; font-weight: 700; letter-spacing: \.03em;/);
  assert.match(css, /\.comparison-toolbar input, \.comparison-toolbar select \{[^}]*height: 40px;[^}]*border-radius: 8px;/);
  assert.match(css, /\.comparison-reset \{[^}]*border-radius: 8px;/);
  assert.match(js, /<label>Box plot metric<select data-inter-metric>/);
  assert.doesNotMatch(js, /Box-plot metric/);
});

test('inter-organ glycan type legend has a left-hand label and divider', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/comparisons.css'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../assets/comparisons.js'), 'utf8');
  assert.match(js, /class="composition-legend-title">Glycan types<\/strong><div class="composition-legend-items">/);
  assert.match(css, /\.composition-legend \{ display: grid; grid-template-columns: max-content minmax\(0, 1fr\);/);
  assert.match(css, /\.composition-legend-title \{[^}]*border-right: 2px solid #111;/);
});

test('contact cards identify author roles without the introductory sentence', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.doesNotMatch(html, /For questions about the atlas and the study, contact:/);
  assert.match(html, /<h3>Michael Schoof<\/h3><p class="contact-role">Lead author<\/p>/);
  assert.match(html, /<h3>Tony Wyss-Coray<\/h3><p class="contact-role">Corresponding author<\/p>/);
  assert.match(html, /<h3>Carolyn Bertozzi<\/h3><p class="contact-role">Corresponding author<\/p>/);
});

test('the full 5,266-site list mounts a bounded first window', () => {
  assert.equal(ROW_HEIGHT, 84);
  const range = windowRange(5266, 0, 500);
  assert.deepEqual(range, { start: 0, end: 24, before: 0, after: 5242 * ROW_HEIGHT });
});
test('empty and short lists have no phantom spacer rows', () => {
  assert.deepEqual(windowRange(0, 0, 500), { start: 0, end: 0, before: 0, after: 0 });
  assert.deepEqual(windowRange(3, 0, 500), { start: 0, end: 3, before: 0, after: 0 });
});
test('every site is reachable, including after a direct jump to the end', () => {
  for (let index = 0; index < 5266; index++) {
    const range = windowRange(5266, index * ROW_HEIGHT, 500);
    assert.ok(range.start <= index && range.end > index);
    assert.ok(range.end - range.start <= 24);
    assert.equal(range.before + (range.end - range.start) * ROW_HEIGHT + range.after, 5266 * ROW_HEIGHT);
  }
  assert.equal(windowRange(5266, Number.MAX_SAFE_INTEGER, 500).end, 5266);
});
test('a selected site centered in the scroll pane is always mounted', () => {
  for (const index of [0, 1, 400, 800, 5265]) {
    const range = windowRange(5266, Math.max(0, index * ROW_HEIGHT - (500 - ROW_HEIGHT) / 2), 500);
    assert.ok(range.start <= index && range.end > index);
  }
});
test('fractional scroll and different pane heights preserve the visible rows', () => {
  for (const height of [180, 420, 500, 1200]) {
    const range = windowRange(5266, 100 * ROW_HEIGHT + 0.5, height);
    assert.ok(range.start <= 100);
    assert.ok(range.end >= 100 + Math.ceil(height / ROW_HEIGHT));
  }
});
test('filtering a scrolled list cannot leave an empty window past its end', () => {
  assert.deepEqual(windowRange(1, 500000, 500), { start: 0, end: 1, before: 0, after: 0 });
});
test('single-pass matrix counts preserve all manuscript brain groups', () => {
  const rows = data('atlas_brain_O_vs_Y_hits.json');
  const classes = [...data('manifest.json').classes, 'mixed'];
  const counts = changeCounts(rows, classes);
  assert.equal(counts.gains.paucimannose, 26);
  assert.equal(counts.losses.paucimannose, 1);
  assert.equal(counts.cells.fucosylated.mixed, 12);
  assert.equal(Object.values(counts.losses).reduce((a,b) => a+b), 158);
  assert.equal(Object.values(counts.gains).reduce((a,b) => a+b), 158);
  assert.equal(counts.max, Math.max(...Object.values(counts.cells).flatMap(row => Object.values(row))));
});
test('Mog stays mixed-gain when the matrix is filtered to that site', () => {
  const rows = data('atlas_brain_O_vs_Y_hits.json').filter(row => row.glycosite === 'Mog N59');
  const counts = changeCounts(rows, [...data('manifest.json').classes, 'mixed']);
  assert.equal(counts.cells.fucosylated.mixed, 1);
  assert.equal(counts.gains.paucimannose, 0);
});

test('paper pair order and display orientation keep signed scores and composition together', () => {
  const { PAIR_STYLES, displayPair } = require('../assets/comparison-layout.js');
  assert.deepEqual(PAIR_STYLES.slice(0, 10).map(pair => pair.key), [
    'liver__kidney', 'brain__liver', 'spleen__liver', 'brain__kidney', 'spleen__kidney',
    'brain__spleen', 'spleen__plasma', 'brain__plasma', 'kidney__plasma', 'liver__plasma',
  ]);
  const manifest = data('manifest.json');
  for (const record of [...manifest.pairs, ...manifest.young_pairs]) {
    const input = data(record.file), original = JSON.stringify(input);
    const display = displayPair(record, input);
    const reversed = display.organs[0] !== record.organs[0];
    assert.equal(JSON.stringify(input), original, 'source rows stay unchanged');
    for (let i = 0; i < input.length; i++) {
      const row = display.rows[i];
      assert.equal(row.tvd, input[i].tvd);
      assert.equal(row.site_key, input[i].site_key);
      assert.ok(row.h_b - row.h_a === (reversed ? -1 : 1) * (input[i].h_b - input[i].h_a));
      assert.ok(row.effective_b - row.effective_a === (reversed ? -1 : 1) * (input[i].effective_b - input[i].effective_a));
      assert.deepEqual(row.composition_a, input[i][reversed ? 'composition_b' : 'composition_a']);
      assert.deepEqual(row.composition_b, input[i][reversed ? 'composition_a' : 'composition_b']);
      assert.deepEqual(row.organs, display.organs);
    }
  }
});

test('rendered matrix keeps colored count totals at left and below the heatmap', async () => {
  const vm = require('node:vm');
  const layout = require('../assets/comparison-layout.js');
  const manifest = data('manifest.json'), hits = data('atlas_brain_O_vs_Y_hits.json');
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', dataset: {},
      querySelectorAll(query) {
        if (selector !== '[data-age-matrix]' || query !== 'button') return [];
        if (this.buttonsHTML !== this.innerHTML) {
          this.buttonsHTML = this.innerHTML;
          this.buttons = [...this.innerHTML.matchAll(/<button([^>]*)>/g)].map(([, attrs]) => ({
            dataset: {loss: attrs.match(/data-loss="([^"]+)"/)?.[1], gain: attrs.match(/data-gain="([^"]+)"/)?.[1]},
            margin: attrs.includes('matrix-margin-button'),
            addEventListener(event, callback) { this[event] = callback; },
          }));
        }
        return this.buttons;
      }, querySelector: () => null, addEventListener() {} });
    return nodes.get(selector);
  };
  const theme = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/theme.js'), 'utf8'), { window: theme });
  const context = { window: { ...theme, ATLAS_COMPARISON_LAYOUT: layout },
    document: { querySelector: node }, location: { search: '' }, URLSearchParams, performance,
    fetch: async url => ({ ok: true, json: async () => url.includes('manifest.json') ? manifest : hits }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/comparisons.js'), 'utf8'), context);
  await context.window.ATLAS_COMPARISONS.renderAge({ dataset: 'atlas_brain', comparison: 'O_vs_Y', query: '' });
  for (const selector of ['[data-age-selection]', '[data-age-matrix-title]', '[data-age-hits-title]']) {
    assert.match(node(selector).innerHTML, /<span class="comparison-organ" style="color:#D98276">Brain \(Old versus Young\)<\/span>/);
  }
  const html = node('[data-age-matrix]').innerHTML;
  assert.match(html, /class="matrix-loss-title"><span>Dominant glycan type loss<\/span><\/th>/);
  assert.match(html, /<tfoot><tr class="matrix-gain-totals">/);
  assert.match(html, /<th colspan="9" class="matrix-gain-title"><span>Dominant glycan type gain<\/span><\/th>/);
  const css = fs.readFileSync(path.join(__dirname, '../assets/comparisons.css'), 'utf8');
  assert.match(css, /\.matrix-gain-title \{[^}]*font-weight: 400;[^}]*100% 2px no-repeat/);
  assert.match(css, /\.matrix-loss-title \{[^}]*font-weight: 400;[^}]*2px 100% no-repeat/);
  assert.match(html, /Number of glycosites/);
  assert.match(html, /<div class="matrix-count-scale"><span>1<\/span><i aria-hidden="true"><\/i><span>30\+<\/span><\/div>/);
  assert.doesNotMatch(html, /All gains|All losses|<thead>|>0<\/button>/);
  assert.match(html, /aria-label="Paucimannose gain: 26 hits"/);
  assert.match(html, /aria-label="Paucimannose loss: 1 hit"/);
  assert.match(html, /data-gain="paucimannose"[^>]*class="matrix-margin-button"[^>]*><span>26<\/span><\/button>/);
  assert.match(html, /data-loss="paucimannose"[^>]*class="matrix-margin-button"[^>]*><span>1<\/span><\/button>/);
  const rows = [...html.matchAll(/<th scope="row"><button[^>]*data-loss="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(rows, [...layout.MATRIX_CLASSES].reverse());
  node('[data-age-matrix]').querySelectorAll('button').find(button => button.dataset.loss === 'paucimannose' && !button.dataset.gain).click();
  assert.equal(node('[data-age-hit-count]').textContent, '1 of 158 hits');
  node('[data-age-clear]').onclick();
  node('[data-age-matrix]').querySelectorAll('button').find(button => button.dataset.gain === 'paucimannose' && !button.dataset.loss).click();
  assert.equal(node('[data-age-hit-count]').textContent, '26 of 158 hits');
});
