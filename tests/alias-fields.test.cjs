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
    : selector === '[data-page]' ? pages : selector === '[data-search-results]' ? [node('results-0'), node('results-1')]
    : selector === '[data-explore-link]' ? [node('explore-link')] : [];
  const location = {pathname: '/', search: '?aliases=' + mode};
  const history = {urls: [], pushState(a, b, url) { this.urls.push(url); }};
  const context = {window: {scrollTo() {}, addEventListener() {}, ATLAS_COMPARISON_LAYOUT: require('../assets/comparison-layout.js')},
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
    'window.fields = {state, dom, bindNavigation, bindSearch, loadTVD, renderAgeComparisons, resetTVDFilters, showHome, showExplore, showPage};');
  vm.runInContext(source, context);
  const fields = context.window.fields;
  const selected = await loadAliases(async url => data(url.split('?')[0]), mode);
  fields.state.proteinSearch = create(index, selected);
  fields.state.searchIndex = index;
  fields.state.byProtein = new Map(index.map(row => [row.protein_id, row]));
  context.window.ATLAS_COMPARISONS.configure({
    matchesProtein: (...args) => fields.state.proteinSearch.matchesProtein(...args), openSite() {}, resetTVDFilters: fields.resetTVDFilters,
  });
  fields.bindSearch();
  node('[data-tvd-dataset]').value = 'atlas_brain';
  node('[data-tvd-comparison]').value = 'O_vs_Y';
  return {...fields, inputs, node, history, comparisons: context.window.ATLAS_COMPARISONS};
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('Age TVD axis names the selected groups and the note uses the shared definition', async () => {
  const view = await browser();
  const description = 'Total variation distance (TVD) summarizes the compositional differences between two age groups, from 0% for identical to 100% when they share no glycan types.';
  await view.loadTVD(); await settle();
  assert.match(view.node('[data-tvd-plot]').innerHTML, /Total variation distance \(O v Y, %\)/);
  assert.ok(view.node('[data-tvd-note]').textContent.startsWith(description));
  view.node('[data-tvd-comparison]').value = 'O_vs_MA';
  await view.loadTVD(); await settle();
  assert.match(view.node('[data-tvd-plot]').innerHTML, /Total variation distance \(O v MA, %\)/);
  view.node('[data-tvd-dataset]').value = 'myelin_male';
  await view.loadTVD(); await settle();
  assert.ok(view.node('[data-tvd-note]').textContent.startsWith(description));
});

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

test('Explore navigation retains the selected protein and never defaults to Ace', async () => {
  const view = await browser();
  view.bindNavigation();
  const clickExplore = () => view.node('explore-link').events.click({preventDefault() {}});
  clickExplore();
  assert.match(view.history.urls.at(-1), /#explore$/);
  assert.equal(view.node('[data-dashboard]').hidden, true);
  assert.match(view.node('[data-loading]').innerHTML, /Choose a protein/);
  view.state.currentProtein = {protein_id: 'Q02242', gene: 'Pdcd1'};
  view.node('[data-dashboard]').hidden = false;
  clickExplore();
  assert.match(view.history.urls.at(-1), /#explore\/Q02242$/);
  assert.equal(view.node('[data-dashboard]').hidden, false);
});

test('Age scatter highlights, age-hit filtering and the inter-organ list resolve the same new alias', async () => {
  const view = await browser();
  await view.loadTVD(); await settle();
  const query = 'CD316', id = 'Q8R366';
  const tested = data('data/tvd/atlas_brain_age_bins_O_vs_Y.json').filter(row => row.protein_id === id);
  assert.ok(tested.length > 0);
  const baselineDots = (view.node('[data-tvd-plot]').innerHTML.match(/<circle class=/g) || []).length;
  const baselineMatrix = view.node('[data-age-matrix]').innerHTML;
  const ageInput = view.node('[data-tvd-search]'); ageInput.value = query; ageInput.events.input(); await settle();
  view.state.tvdSelectedSite = tested[0].site_key;
  view.state.tvdPreviewSite = {id: tested[0].site_key};
  view.node('[data-tvd-preview-title]').textContent = 'Selected glycosite';
  view.node('[data-tvd-preview-chart]').innerHTML = '<svg></svg>';
  ageInput.events.input(); await settle();
  const plot = view.node('[data-tvd-plot]').innerHTML;
  assert.match(plot, /aria-pressed="true"/);
  assert.doesNotMatch(plot, /tested sites|Select a point to see its glycosite/);
  assert.equal((plot.match(/<circle class=/g) || []).length, baselineDots, 'search keeps the other sites visible');
  const highlights = [...plot.matchAll(/<circle class="search-hit[^"]*"[^>]*data-tvd-protein="([^"]+)"/g)].map(match => match[1]);
  assert.equal(highlights.length, tested.length);
  assert.ok(highlights.every(found => found === id));
  assert.equal(view.node('[data-age-hit-count]').textContent, '1 of 158 hits');
  assert.match(view.node('[data-age-hits]').innerHTML, /Igsf8/);
  const clearSearch = view.node('[data-tvd-clear-search]');
  clearSearch.events.click(); await settle();
  assert.equal(ageInput.value, '');
  assert.equal(view.state.tvdSelectedSite, null);
  assert.equal(view.state.tvdPreviewSite, null);
  assert.equal(view.node('[data-tvd-preview-title]').textContent, 'N-glycosite composition with age');
  assert.match(view.node('[data-tvd-preview-chart]').innerHTML, /Select a glycosite/);
  assert.doesNotMatch(view.node('[data-tvd-plot]').innerHTML, /class="search-hit/);
  assert.doesNotMatch(view.node('[data-tvd-plot]').innerHTML, /aria-pressed="true"/);
  assert.equal((view.node('[data-tvd-plot]').innerHTML.match(/<circle class=/g) || []).length, baselineDots);
  assert.equal(view.node('[data-age-matrix]').innerHTML, baselineMatrix);
  assert.equal(view.node('[data-age-hit-count]').textContent, '158 of 158 hits');
  await view.comparisons.loadInter();
  view.node('[data-inter-search]').oninput({target: {value: query}});
  const manifest = data('data/comparisons/manifest.json');
  const total = manifest.pairs.filter(pair => !pair.key.includes('myelin')).reduce((sum, pair) => sum + data('data/comparisons/' + pair.file).filter(row => row.protein_id === id).length, 0);
  assert.ok(total > 0);
  assert.equal(view.node('[data-inter-count]').textContent, `${total} of 5,266`);
  const mounted = [...view.node('[data-inter-hits]').innerHTML.matchAll(/href="#explore\/([^?]+)\?/g)].map(match => match[1]);
  assert.ok(mounted.length > 0 && mounted.every(found => found === id));
});

test('Browse hits reset also clears the Age search, selected dot, and preview', async () => {
  const view = await browser();
  await view.loadTVD(); await settle();
  const row = data('data/tvd/atlas_brain_age_bins_O_vs_Y.json')[0];
  const search = view.node('[data-tvd-search]');
  search.value = 'lamp'; search.events.input(); await settle();
  view.state.tvdSelectedSite = row.site_key;
  view.state.tvdPreviewSite = {id: row.site_key};
  view.node('[data-tvd-preview-title]').textContent = 'Selected glycosite';
  view.node('[data-tvd-preview-chart]').innerHTML = '<svg></svg>';
  view.node('[data-age-clear]').onclick();
  assert.equal(search.value, '');
  assert.equal(view.state.tvdSelectedSite, null);
  assert.equal(view.state.tvdPreviewSite, null);
  assert.equal(view.node('[data-tvd-preview-title]').textContent, 'N-glycosite composition with age');
  assert.match(view.node('[data-tvd-preview-chart]').innerHTML, /Select a glycosite/);
  assert.doesNotMatch(view.node('[data-tvd-plot]').innerHTML, /aria-pressed="true"|class="search-hit/);
  assert.equal(view.node('[data-age-active-filter]').textContent, 'All glycan type changes');
});

test('Age search highlights all Lamp1 and Lamp2 glycosites despite an exact Lsamp alias', async () => {
  const view = await browser();
  await view.loadTVD(); await settle();
  const ageInput = view.node('[data-tvd-search]');
  ageInput.value = 'lamp'; ageInput.events.input(); await settle();
  const rows = data('data/tvd/atlas_brain_age_bins_O_vs_Y.json');
  const genes = ['Lamp1', 'Lamp2', 'Lsamp'];
  const ids = new Set(index.filter(row => genes.includes(row.gene)).map(row => row.protein_id));
  const expected = rows.filter(row => ids.has(row.protein_id));
  const highlighted = [...view.node('[data-tvd-plot]').innerHTML.matchAll(/<circle class="search-hit[^\"]*"[^>]*data-tvd-protein="([^"]+)"/g)].map(match => match[1]);
  assert.equal(expected.length, 20);
  assert.equal(highlighted.length, expected.length);
  for (const gene of genes) {
    const id = index.find(row => row.gene === gene).protein_id;
    assert.equal(highlighted.filter(hit => hit === id).length, expected.filter(row => row.protein_id === id).length, gene);
  }
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
