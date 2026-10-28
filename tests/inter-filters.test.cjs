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
  assert.doesNotMatch(html, /value="young"|young only/);
  assert.ok(requested.every(name => !name.startsWith('young_')));
});

test('selected pair is named above the list and clear resets every list filter', async () => {
  const {api, node} = browser();
  await api.loadInter();
  assert.equal(node('[data-inter-count]').textContent, '5,266 of 5,266');
  node('[data-inter-pair]').onchange({target: {value: 'liver__kidney'}});
  assert.equal(node('[data-inter-pair-context]').textContent, 'Kidney v Liver');
  assert.equal(node('[data-inter-count]').textContent, '738 of 738');
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
