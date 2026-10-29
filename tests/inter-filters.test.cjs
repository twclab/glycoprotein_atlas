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
  assert.match(html, /value="atlas"/);
  assert.match(html, /value="myelin"/);
  assert.match(html, /data-inter-clear>Reset filters<\/button>/);
  assert.doesNotMatch(html, /Clear list filters/);
  assert.match(html, /value="effective"[^>]*>Weighted glycan types: B − A<\/option>/);
  assert.doesNotMatch(html, /value="h">Shannon H/);
  assert.doesNotMatch(html, /ordered A v B/);
  assert.doesNotMatch(html, /value="young"|young only/);
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
});

test('selected pair is named above the list and reset clears every list filter', async () => {
  const {api, node} = browser();
  await api.loadInter();
  assert.equal(node('[data-inter-count]').textContent, '5,266 of 5,266');
  node('[data-inter-pair]').onchange({target: {value: 'liver__kidney'}});
  assert.equal(node('[data-inter-pair-context]').textContent, 'Kidney v Liver');
  assert.equal(node('[data-inter-count]').textContent, '738 of 738');
  const pairTable = node('[data-inter-hits]').innerHTML;
  const firstRow = pairTable.match(/<tr class="site-row[^>]*>[\s\S]*?<\/tr>/)[0];
  assert.match(firstRow, /<small>[^<]+<\/small><\/th><td><div class="comparison-pair"><span>Kidney<\/span><span>Liver<\/span><\/div><\/td>/);
  assert.doesNotMatch(firstRow.match(/<small>[^<]+<\/small>/)[0], /Kidney|Liver| v /);
  assert.match(pairTable, /<div class="composition-bar-pair" data-hover-label="/);
  assert.match(pairTable, /<div class="inter-metric-values"[^>]*><span>[\d.]+<\/span><span>[\d.]+<\/span><\/div>/);
  assert.match(firstRow, /<\/div><\/td><td><div class="composition-bar-pair" data-hover-label="/);
  assert.match(firstRow, /<\/div><\/td><td><div class="inter-metric-values"/);
  assert.match(firstRow, /<\/div><\/td><td>[\d.]+<\/td><\/tr>/);
  assert.match(pairTable, /class="window-spacer"[^>]*><td colspan="5"/);
  assert.doesNotMatch(pairTable, /<span>(?:Kidney|Liver) [\d.]+<\/span>|>A<\/span>|>B<\/span>/);
  node('[data-inter-state]').onchange({target: {value: 'strongly_remodeled'}});
  node('[data-inter-sort]').onchange({target: {value: 'gene'}});
  node('[data-inter-search]').oninput({target: {value: 'absent-glycosite'}});
  assert.equal(node('[data-inter-count]').textContent, '0 of 738');
  const plot = node('[data-inter-boxes]').innerHTML;
  node('[data-inter-clear]').onclick();
  assert.equal(node('[data-inter-count]').textContent, '5,266 of 5,266');
  assert.equal(node('[data-inter-pair-context]').textContent, 'All organ comparisons');
  assert.equal(node('[data-inter-pair]').value, 'all');
  assert.equal(node('[data-inter-state]').value, 'all');
  assert.equal(node('[data-inter-diversity]').value, 'all');
  assert.equal(node('[data-inter-sort]').value, 'descending');
  assert.equal(node('[data-inter-search]').value, '');
  assert.equal(node('[data-inter-boxes]').innerHTML, plot);
  assert.equal((node('[data-inter-hits]').innerHTML.match(/class="site-row /g) || []).length, 24);
});

test('either composition bar gives the complete paired composition and glycoPSM evidence', async () => {
  const {api, node} = browser();
  await api.loadInter();
  node('[data-inter-pair]').onchange({target: {value: 'brain__liver'}});
  const table = node('[data-inter-hits]').innerHTML;
  assert.match(table, /data-hover-label="Ckap5 N449 · 15 total glycoPSMs\nBrain \(10 glycoPSMs\): High mannose 60\.0%, Paucimannose 10\.0%, Undecorated 20\.0%, Fucosylated 10\.0%\nLiver \(5 glycoPSMs\): Sialylated 100\.0%"/);
  assert.doesNotMatch(table, /<i[^>]+data-hover-label=/);
});
