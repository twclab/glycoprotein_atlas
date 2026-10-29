const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function browser() {
  const nodes = new Map(), requested = [];
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: '', textContent: '', value: '', dataset: {}, style: {}, clientWidth: 650, clientHeight: 430,
      querySelectorAll: () => [], contains: () => false, addEventListener() {}, focus() {}, setAttribute() {},
      querySelector: query => query === 'table' || query.includes('data-box=') || query.includes('data-point-pair=') || query.includes('selected') ? null : node(query),
    });
    return nodes.get(selector);
  }
  const theme = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/theme.js'), 'utf8'), {window: theme});
  const context = {window: {...theme, ATLAS_COMPARISON_LAYOUT: require('../assets/comparison-layout.js')},
    document: {querySelector: node, activeElement: null}, location: {search: ''}, URLSearchParams, performance,
    fetch: async url => {
      const name = url.split('?')[0].split('/').at(-1); requested.push(name);
      return {ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, 'data/comparisons', name), 'utf8'))};
    }};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/comparisons.js'), 'utf8'), context);
  context.window.ATLAS_COMPARISONS.configure({
    matchesProtein: (id, query, extra) => `${id} ${extra}`.toLowerCase().includes(query.toLowerCase()),
    openSite() {},
  });
  return {api: context.window.ATLAS_COMPARISONS, node, requested};
}

test('only pooled atlas and brain/myelin scopes are offered', async () => {
  const {api, node, requested} = browser();
  await api.loadInter();
  const html = node('[data-inter-content]').innerHTML;
  assert.match(html, /<h3>Browse glycosites: <span class="inter-pair-context" data-inter-pair-context aria-live="polite"><\/span><\/h3>/);
  assert.doesNotMatch(html, /<p class="inter-pair-context"/);
  assert.match(html, /aria-label="Glycan type colors"/);
  assert.match(node('[data-inter-summary]').innerHTML, /Remodeling and glycan type heterogeneity/);
  assert.equal(node('[data-inter-plot-title]').textContent, 'Glycosite composition across datasets');
  assert.match(html, /value="atlas"/);
  assert.match(html, /value="atlas" selected>Atlas organs<\/option>/);
  assert.match(html, /value="myelin" >Brain and myelin<\/option>/);
  assert.doesNotMatch(html, /Atlas organs · pooled/);
  assert.doesNotMatch(html, /Brain and myelin · pooled/);
  assert.doesNotMatch(html, /Select a box to browse the pair, or a point to find its glycosite/);
  assert.match(html, /value="myelin"/);
  assert.match(html, /data-inter-clear>Reset filters<\/button>/);
  assert.doesNotMatch(html, /data-inter-selection|Selected:/);
  assert.match(html, /<div class="comparison-heading"><h3>Browse glycosites: <span class="inter-pair-context" data-inter-pair-context aria-live="polite"><\/span><\/h3><strong data-inter-count[^>]*><\/strong><\/div>/);
  assert.match(html, /data-inter-metric>[\s\S]*?<\/select><\/label><button type="button" class="comparison-reset inter-toolbar-reset" data-inter-toolbar-reset>Reset filters<\/button>/);
  assert.doesNotMatch(html, /Clear list filters/);
  assert.match(html, /value="effective"[^>]*>Weighted glycan types: B − A<\/option>/);
  assert.match(html, /Conserved \(TVD &lt; 20%\)/);
  assert.match(html, /Partially shifted \(20% ≤ TVD &lt; 50%\)/);
  assert.match(html, /Strongly remodeled \(TVD ≥ 50%\)/);
  assert.doesNotMatch(html, /Compare glycosite composition and heterogeneity across organs/);
  assert.doesNotMatch(html, /All ages pooled within each site and dataset/);
  assert.doesNotMatch(html, /value="h">Shannon H/);
  assert.doesNotMatch(html, /ordered A v B/);
  assert.doesNotMatch(html, /value="young"|young only/);
  const summary = node('[data-inter-summary]').innerHTML;
  assert.match(summary, /<small>n = [\d,]+<\/small>/);
  assert.doesNotMatch(summary, /All displayed organ pairs|Click a segment to browse/);
  assert.ok(summary.indexOf('class="comparison-legend"') < summary.indexOf('Low heterogeneity:'));
  assert.match(summary, /Low heterogeneity: Weighted glycan types &lt; 1\.5<br>Intermediate heterogeneity: 1\.5 ≤ Weighted glycan types &lt; 2\.5<br>High heterogeneity: Weighted glycan types ≥ 2\.5/);
  assert.ok(requested.every(name => !name.startsWith('young_')));
  const plot = node('[data-inter-boxes]').innerHTML;
  assert.match(plot, /<line class="box-axis" x1="72" x2="72" y1="44" y2="[^"]+"\/>/);
  assert.match(plot, /Total variation distance \(%\)/);
  const table = node('[data-inter-hits]').innerHTML;
  assert.match(table, /<th scope="col">Glycosite<\/th><th scope="col">Comparison<\/th><th scope="col">Glycosite composition<\/th><th scope="col">Weighted glycan types<\/th><th scope="col">TVD \(%\)<\/th>/);
  assert.match(table, /<colgroup><col style="width:18%"><col style="width:17%"><col style="width:31%"><col style="width:18%"><col style="width:16%"><\/colgroup>/);
  const css = fs.readFileSync(path.join(root, 'assets/comparisons.css'), 'utf8');
  assert.match(css, /\.inter-hit-table \{ min-width: 0; \}/);
  assert.match(css, /\.inter-hit-table thead th, \.inter-hit-table tr\.site-row > th, \.inter-hit-table tr\.site-row > td \{ text-align: center; \}/);
  assert.match(css, /\.inter-hit-table thead th \{ vertical-align: bottom; \}/);
  assert.match(css, /\.inter-hit-table tr\.site-row > th, \.inter-hit-table tr\.site-row > td \{[^}]*vertical-align: middle;/);
  assert.doesNotMatch(table, /Weighted glycan types \(A v B\)|Glycan composition/);
  assert.doesNotMatch(table, /Shannon H|Heterogeneity \(A \/ B\)/);
  node('[data-inter-pair]').onchange({target: {value: 'liver__plasma'}});
  assert.equal(node('[data-inter-pair-context]').textContent, 'Plasma v Liver');
  assert.equal(node('[data-inter-pair-context]').style.color, '#B07BA1');
  assert.match(node('[data-inter-boxes]').innerHTML, /fill="#B07BA1"/);
});

test('brain and myelin box plots use the atlas plot height with stacked labels', async () => {
  const {api, node} = browser();
  await api.loadInter();
  const atlasPlot = node('[data-inter-boxes]').innerHTML;
  assert.match(atlasPlot, /<line class="box-axis" x1="72" x2="72" y1="44" y2="529"/);
  assert.match(atlasPlot, /<text class="box-label" transform="translate\([\d.]+ 540\) rotate\(-48\)"/);
  node('[data-inter-scope]').onchange({target: {value: 'myelin'}});
  await new Promise(resolve => setImmediate(resolve));
  const plot = node('[data-inter-boxes]').innerHTML;
  assert.match(plot, /<svg viewBox="0 0 650 654"/);
  assert.match(plot, /<line class="box-axis" x1="72" x2="72" y1="44" y2="529"/);
  assert.match(plot, /<text class="box-label" x="[\d.]+" y="565" text-anchor="middle"><tspan x="[\d.]+">Myelin \(female\)<\/tspan><tspan x="[\d.]+" dy="22">v<\/tspan><tspan x="[\d.]+" dy="22">Myelin \(male\)<\/tspan><\/text>/);
  const outlines = [...plot.matchAll(/<rect class="box-selection" x="[^"]+" y="([\d.]+)" width="48" height="([\d.]+)"/g)];
  assert.equal(outlines.length, 3);
  assert.ok(outlines.every(([, top, height]) => Number(top) + Number(height) <= 527));
  assert.match(plot, /Myelin \(female\) v Myelin \(male\)/);
  node('[data-inter-pair]').onchange({target: {value: 'myelin_male__myelin_female'}});
  assert.equal(node('[data-inter-pair-context]').textContent, 'Myelin (female) v Myelin (male)');
  assert.equal(node('[data-inter-pair-context]').style.color, '#83749E');
});

test('protein search highlights only matching dots in the visible comparisons', async () => {
  const {api, node} = browser();
  await api.loadInter();
  const boxes = node('[data-inter-boxes]');
  const tags = [...boxes.innerHTML.matchAll(/<circle class="box-point[^>]+>/g)].map(([tag]) => tag);
  const matching = tags.filter(tag => tag.includes('data-hover-label="Ckap5 N449'));
  assert.ok(matching.length > 1);
  const other = tags.find(tag => !tag.includes('data-hover-label="Ckap5'));
  const points = [...matching, other].map(tag => {
    const classes = new Set();
    return {
      dataset: {
        pointPair: tag.match(/data-point-pair="([^"]+)"/)[1],
        pointSite: tag.match(/data-point-site="([^"]+)"/)[1],
      },
      classList: {toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name), contains: name => classes.has(name)},
    };
  });
  boxes.querySelectorAll = selector => selector === '.box-point' ? points : [];
  node('[data-inter-search]').oninput({target: {value: 'Ckap5 N449'}});
  assert.ok(points.slice(0, -1).every(point => point.classList.contains('search-match')));
  assert.equal(points.at(-1).classList.contains('search-match'), false);
  node('[data-inter-pair]').onchange({target: {value: points[0].dataset.pointPair}});
  assert.ok(points.some(point => point.classList.contains('search-match')));
  assert.ok(points.filter(point => point.classList.contains('search-match')).every(point => point.dataset.pointPair === points[0].dataset.pointPair));
  node('[data-inter-clear]').onclick();
  assert.ok(points.every(point => !point.classList.contains('search-match')));
  assert.match(fs.readFileSync(path.join(root, 'assets/comparisons.css'), 'utf8'), /\.box-point\.search-match \{ r: 5; fill-opacity: 1; stroke: white;/);
});

test('selected pair is named above the list and reset clears every list filter', async () => {
  const {api, node} = browser();
  await api.loadInter();
  assert.equal(node('[data-inter-count]').textContent, '5,266 of 5,266');
  node('[data-inter-pair]').onchange({target: {value: 'liver__kidney'}});
  assert.equal(node('[data-inter-pair-context]').textContent, 'Kidney v Liver');
  assert.equal(node('[data-inter-pair-context]').style.color, '#5AA150');
  assert.equal(node('[data-inter-count]').textContent, '738 of 738');
  const pairTable = node('[data-inter-hits]').innerHTML;
  const firstRow = pairTable.match(/<tr class="site-row[^>]*>[\s\S]*?<\/tr>/)[0];
  assert.match(firstRow, /<small>[^<]+<\/small><\/th><td><div class="comparison-pair"><span>Kidney<\/span><span>Liver<\/span><\/div><\/td>/);
  assert.doesNotMatch(firstRow.match(/<small>[^<]+<\/small>/)[0], /Kidney|Liver| v /);
  assert.match(pairTable, /<div class="composition-bar-pair"><div class="comparison-composition-bar composition-bar"/);
  assert.match(pairTable, /<div class="inter-metric-values"[^>]*><span>[\d.]+<\/span><span>[\d.]+<\/span><\/div>/);
  assert.match(firstRow, /<\/div><\/td><td><div class="composition-bar-pair"><div class="comparison-composition-bar composition-bar"/);
  assert.match(firstRow, /<\/div><\/td><td><div class="inter-metric-values"/);
  assert.match(firstRow, /<\/div><\/td><td>[\d.]+<\/td><\/tr>/);
  assert.match(pairTable, /class="window-spacer"[^>]*><td colspan="5"/);
  assert.doesNotMatch(pairTable, /<span>(?:Kidney|Liver) [\d.]+<\/span>|>A<\/span>|>B<\/span>/);
  node('[data-inter-state]').onchange({target: {value: 'strongly_remodeled'}});
  node('[data-inter-sort]').onchange({target: {value: 'gene'}});
  node('[data-inter-search]').oninput({target: {value: 'absent-glycosite'}});
  assert.equal(node('[data-inter-count]').textContent, '0 of 738');
  const plot = node('[data-inter-boxes]').innerHTML;
  assert.equal(node('[data-inter-toolbar-reset]').onclick, node('[data-inter-clear]').onclick);
  node('[data-inter-toolbar-reset]').onclick();
  assert.equal(node('[data-inter-count]').textContent, '5,266 of 5,266');
  assert.equal(node('[data-inter-pair-context]').textContent, 'All organ comparisons');
  assert.equal(node('[data-inter-pair-context]').style.color, '');
  assert.equal(node('[data-inter-pair]').value, 'all');
  assert.equal(node('[data-inter-state]').value, 'all');
  assert.equal(node('[data-inter-diversity]').value, 'all');
  assert.equal(node('[data-inter-sort]').value, 'descending');
  assert.equal(node('[data-inter-search]').value, '');
  assert.equal(node('[data-inter-boxes]').innerHTML, plot);
  assert.equal((node('[data-inter-hits]').innerHTML.match(/class="site-row /g) || []).length, 24);
});

test('each composition bar gives only its own organ composition and glycoPSM evidence', async () => {
  const {api, node} = browser();
  await api.loadInter();
  node('[data-inter-pair]').onchange({target: {value: 'brain__liver'}});
  const table = node('[data-inter-hits]').innerHTML;
  assert.match(table, /data-hover-label="Ckap5 N449 · Brain · 10 total glycoPSMs\nHigh mannose 60\.0%, Paucimannose 10\.0%, Undecorated 20\.0%, Fucosylated 10\.0%"/);
  assert.match(table, /data-hover-label="Ckap5 N449 · Liver · 5 total glycoPSMs\nSialylated 100\.0%"/);
  assert.doesNotMatch(table, /Ckap5 N449 · 15 total glycoPSMs/);
  assert.doesNotMatch(table, /<i[^>]+data-hover-label=/);
});
