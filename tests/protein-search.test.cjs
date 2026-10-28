const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {create, normalize, loadAliases} = require('../assets/protein-search.js');
const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/search-index.json')));
const aliases = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/protein-aliases.json')));
const search = create(index, aliases);

test('common mouse protein aliases resolve to the atlas identifiers', () => {
  for (const [query, id] of [['CD133','O54990'], ['PD-1','Q02242'], ['CD279','Q02242'], ['pd 1','Q02242'], ['CD-133','O54990']]) {
    assert.equal(search.search(query)[0].protein_id, id, query);
    assert.equal(search.findExact(query).protein_id, id, query);
    assert.equal(search.matchesProtein(id, query), true, query);
  }
});

test('canonical symbols, accessions, descriptions and older shortcuts still work', () => {
  for (const query of ['Prom1','O54990','prominin']) assert.equal(search.search(query)[0].protein_id, 'O54990');
  for (const query of ['BIP','GRP78']) assert.equal(search.search(query)[0].gene, 'Hspa5');
  for (const query of ['IRE1','IRE1α']) assert.equal(search.search(query)[0].gene, 'Ern1');
  assert.equal(search.matchesProtein('O54990', 'PD-1'), false);
  assert.deepEqual(search.search('   '), []);
  assert.deepEqual(search.search('???'), []);
  assert.equal(search.matchesProtein('O54990', '???'), false);
});

test('alias punctuation and case normalize consistently', () => {
  assert.equal(normalize('  PD-1 '), normalize('pd 1'));
  assert.equal(normalize('CD–133'), normalize('CD133'));
  assert.equal(normalize('IRE1α'), normalize('IRE1-alpha'));
});

test('ambiguous aliases retain all matching proteins and respect result limits', () => {
  const rows = [
    {protein_id:'P1', gene:'First', description:'one'},
    {protein_id:'P2', gene:'Second', description:'two'},
  ];
  const ambiguous = create(rows, {P1:['Shared marker'], P2:['Shared-marker']});
  assert.deepEqual(ambiguous.search('shared marker').map(row => row.protein_id), ['P1','P2']);
  assert.equal(ambiguous.search('shared marker', 1).length, 1);
  assert.equal(ambiguous.matchesProtein('P1','shared marker'), true);
  assert.equal(ambiguous.matchesProtein('P2','shared marker'), true);
  assert.equal(ambiguous.matchesProtein('missing','shared marker'), false);
});

test('downloaded aliases cover the atlas without adding or changing proteins', () => {
  const ids = new Set(index.map(row => row.protein_id));
  assert.ok(Object.keys(aliases).length > 10000);
  assert.ok(Object.keys(aliases).every(id => ids.has(id)));
  assert.ok(aliases.O54990.includes('CD133'));
  assert.ok(aliases.Q02242.includes('CD279'));
  assert.ok(fs.statSync(path.join(__dirname, '../data/protein-aliases.json')).size < 550000);
});


test('an unavailable alias supplement preserves canonical search', async () => {
  const warning = console.warn;
  let warningCount = 0;
  console.warn = () => { warningCount += 1; };
  try {
    const unavailable = await loadAliases(() => Promise.reject(new Error('offline')));
    const canonical = create(index, unavailable);
    assert.deepEqual(unavailable, {});
    assert.equal(warningCount, 1);
    assert.equal(canonical.search('Prom1')[0].protein_id, 'O54990');
    assert.equal(canonical.search('Q02242')[0].gene, 'Pdcd1');
  } finally {
    console.warn = warning;
  }
});

test('autocomplete mounts at most 50 results and reports the full match count', () => {
  const vm = require('node:vm');
  const container = {innerHTML:'', hidden:true, querySelectorAll: () => []};
  const document = {querySelector: () => ({}), querySelectorAll: () => [], addEventListener: () => {}};
  const window = {ATLAS_THEME:{}, ATLAS_PROTEIN_SEARCH:{}};
  const context = vm.createContext({window, document, location:{search:''}, URLSearchParams, console});
  const source = fs.readFileSync(path.join(__dirname, '../assets/app.js'), 'utf8')
    .replace('document.addEventListener("DOMContentLoaded", init);', 'window.autocompleteTest = {updateSearchResults, state};');
  vm.runInContext(source, context);
  const {updateSearchResults, state} = window.autocompleteTest;
  state.proteinSearch = search;
  const input = {value:'a', closest: () => ({querySelector: () => container})};
  updateSearchResults(input);
  const total = search.search('a', Infinity).length;
  assert.ok(total > 10000);
  assert.equal((container.innerHTML.match(/data-result-id=/g) || []).length, 50);
  assert.ok(container.innerHTML.includes(`Showing 50 of ${total.toLocaleString('en-US')} matches. Refine your search.`));
  input.value = 'CD133';
  updateSearchResults(input);
  assert.ok(container.innerHTML.includes('data-result-id="O54990"'));
  assert.ok(!container.innerHTML.includes('Refine your search.'));
  input.value = 'not-a-real-protein-name';
  updateSearchResults(input);
  assert.ok(container.innerHTML.includes('No protein or UniProt match'));
});


test('comparison filters use exact identities before partial names', () => {
  for (const query of ['PD-1','pd1','CD279','Pdcd1','Q02242']) {
    assert.equal(search.matchesProtein('Q02242', query), true, query);
    assert.equal(search.matchesProtein('P55772', query, 'Entpd1 N291'), false, query);
  }
  assert.equal(search.matchesProtein('P55772', 'triphosphate'), true);
  assert.equal(search.matchesProtein('P55772', 'N291', 'Entpd1 N291'), true);
  assert.equal(search.matchesProtein('P55772', 'Entpd1 N291', 'Entpd1 N291'), true);
  assert.equal(search.matchesProtein('P55772', 'N332', 'Entpd1 N291'), false);
  assert.equal(search.matchesProtein('O54990', 'promin'), true);
  assert.equal(search.matchesProtein('O54990', 'PD-1'), false);
  assert.equal(search.matchesProtein('Q02242', 'PD-1'), true);
  const ambiguous = create([
    {protein_id:'P1', gene:'First', description:'one'},
    {protein_id:'P2', gene:'Second', description:'two'},
    {protein_id:'P3', gene:'SharedMarkerLonger', description:'three'},
  ], {P1:['Shared marker'], P2:['Shared-marker']});
  assert.equal(ambiguous.matchesProtein('P1','shared marker'), true);
  assert.equal(ambiguous.matchesProtein('P2','shared marker'), true);
  assert.equal(ambiguous.matchesProtein('P3','shared marker'), false);
});
