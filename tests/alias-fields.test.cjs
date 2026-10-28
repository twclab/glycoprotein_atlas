const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {create, loadAliases} = require('../assets/protein-search.js');
const root = path.join(__dirname, '..');
const data = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const index = data('data/search-index.json');

async function browser(mode = 'uniprot') {
  const nodes = new Map();
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: '', textContent: '', value: '', dataset: {}, style: {}, clientWidth: 900, clientHeight: 430,
      events: {}, addEventListener(name, fn) { this.events[name] = fn; },
      querySelectorAll: () => [], contains: () => false, focus() {}, setAttribute() {},
      querySelector: query => query === 'table' || query.includes('data-box=') || query.includes('data-point-pair=') || query.includes('aria-pressed') || query.includes('selected') ? null : node(query),
    });
    return nodes.get(selector);
  }
  const inputs = ['#hero-search-input', '#explore-search-input'].map(id => node(id));
  inputs.forEach((input, i) => {
    input.closest = () => ({querySelector: () => node(`results-${i}`)});
  });
  const pages = ['methods', 'contact', 'tvd', 'inter-organ'].map(name => {
    const page = node(`page-${name}`); page.dataset.page = name; return page;
  });
  const queryAll = selector => selector === '[data-search-input]' ? inputs
    : selector === '[data-page]' ? pages : selector === '[data-search-results]' ? [node('results-0'), node('results-1')] : [];
  const location = {pathname: '/', search: '?aliases=' + mode};
  const history = {urls: [], pushState(a, b, url) { this.urls.push(url); }};
  const context = {window: {scrollTo() {}, ATLAS_COMPARISON_LAYOUT: require('../assets/comparison-layout.js')},
    document: {querySelector: node, querySelectorAll: queryAll, addEventListener() {},
      body: {classList: {add() {}, remove() {}}}},
    location, history, URLSearchParams, performance, console,
    fetch: async url => ({ok: true, json: async () => data(url.split('?')[0])}),
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/theme.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/comparisons.js'), 'utf8'), context);
  const source = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8').replace(
    'document.addEventListener("DOMContentLoaded", init);',
    'window.fields = {state, dom, bindSearch, loadTVD, renderAgeComparisons, showHome, showExplore, showPage};');
  vm.runInContext(source, context);
  const fields = context.window.fields;
  const selected = await loadAliases(async url => data(url.split('?')[0]), mode);
  fields.state.proteinSearch = create(index, selected);
  fields.state.searchIndex = index;
  fields.state.byProtein = new Map(index.map(row => [row.protein_id, row]));
  context.window.ATLAS_COMPARISONS.configure({
    matchesProtein: (...args) => fields.state.proteinSearch.matchesProtein(...args), openSite() {},
  });
  fields.bindSearch();
  node('[data-tvd-dataset]').value = 'atlas_brain';
  node('[data-tvd-comparison]').value = 'O_vs_Y';
  return {...fields, inputs, node, history, comparisons: context.window.ATLAS_COMPARISONS};
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('Home and Explore inputs use the expanded names and keep the existing search result limit', async () => {
  const view = await browser();
  for (const [query, id] of [['CD156c', 'O35598'], ['CD316', 'Q8R366'], ['CD321', 'O88792'], ['CD133', 'O54990'], ['PD-1', 'Q02242'], ['CD279', 'Q02242']]) {
    for (const [i, input] of view.inputs.entries()) {
      input.value = query; input.events.input();
      assert.match(view.node(`results-${i}`).innerHTML, new RegExp(`data-result-id="${id}"`));
      assert.ok((view.node(`results-${i}`).innerHTML.match(/data-result-id=/g) || []).length <= 50);
    }
  }
});

test('Age scatter highlights, age-hit filtering and the inter-organ list resolve the same new alias', async () => {
  const view = await browser();
  await view.loadTVD(); await settle();
  const query = 'CD316', id = 'Q8R366';
  const tested = data('data/tvd/atlas_brain_age_bins_O_vs_Y.json').filter(row => row.protein_id === id);
  assert.ok(tested.length > 0);
  const ageInput = view.node('[data-tvd-search]'); ageInput.value = query; ageInput.events.input(); await settle();
  const plot = view.node('[data-tvd-plot]').innerHTML;
  const highlights = [...plot.matchAll(/<circle class="search-hit"[^>]*data-tvd-protein="([^"]+)"/g)].map(match => match[1]);
  assert.equal(highlights.length, tested.length);
  assert.ok(highlights.every(found => found === id));
  assert.equal(view.node('[data-age-hit-count]').textContent, '1 of 158 hits');
  assert.match(view.node('[data-age-hits]').innerHTML, /Igsf8/);
  await view.comparisons.loadInter();
  view.node('[data-inter-search]').oninput({target: {value: query}});
  const manifest = data('data/comparisons/manifest.json');
  const total = manifest.pairs.filter(pair => !pair.key.includes('myelin')).reduce((sum, pair) => sum + data('data/comparisons/' + pair.file).filter(row => row.protein_id === id).length, 0);
  assert.ok(total > 0);
  assert.equal(view.node('[data-inter-count]').textContent, `${total} of 5,266`);
  const mounted = [...view.node('[data-inter-hits]').innerHTML.matchAll(/href="#explore\/([^?]+)\?/g)].map(match => match[1]);
  assert.ok(mounted.length > 0 && mounted.every(found => found === id));
});

test('previous and off modes apply consistently to every search field and survive page navigation', async () => {
  for (const mode of ['previous', 'off']) {
    const view = await browser(mode);
    for (const [i, input] of view.inputs.entries()) {
      input.value = 'CD316'; input.events.input();
      assert.match(view.node(`results-${i}`).innerHTML, /No protein or UniProt match/);
    }
    await view.loadTVD(); await settle();
    const ageInput = view.node('[data-tvd-search]'); ageInput.value = 'CD316'; ageInput.events.input(); await settle();
    assert.doesNotMatch(view.node('[data-tvd-plot]').innerHTML, /class="search-hit"/);
    assert.equal(view.node('[data-age-hit-count]').textContent, '0 of 158 hits');
    await view.comparisons.loadInter();
    view.node('[data-inter-search]').oninput({target: {value: 'CD316'}});
    assert.equal(view.node('[data-inter-count]').textContent, '0 of 5,266');
    view.showHome(); view.showExplore(true); view.showPage('methods');
    assert.equal(view.history.urls.length, 3);
    assert.ok(view.history.urls.every(url => url.startsWith('/?aliases=' + mode + '#')));
  }
});
