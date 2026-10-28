const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { windowRange, changeCounts } = require('../assets/comparison-layout.js');
const data = name => JSON.parse(fs.readFileSync(path.join(__dirname, '../data/comparisons', name)));

test('the full 5,266-site list mounts a bounded first window', () => {
  const range = windowRange(5266, 0, 500);
  assert.deepEqual(range, { start: 0, end: 24, before: 0, after: 5242 * 104 });
});
test('empty and short lists have no phantom spacer rows', () => {
  assert.deepEqual(windowRange(0, 0, 500), { start: 0, end: 0, before: 0, after: 0 });
  assert.deepEqual(windowRange(3, 0, 500), { start: 0, end: 3, before: 0, after: 0 });
});
test('every site is reachable, including after a direct jump to the end', () => {
  for (let index = 0; index < 5266; index++) {
    const range = windowRange(5266, index * 104, 500);
    assert.ok(range.start <= index && range.end > index);
    assert.ok(range.end - range.start <= 24);
    assert.equal(range.before + (range.end - range.start) * 104 + range.after, 5266 * 104);
  }
  assert.equal(windowRange(5266, Number.MAX_SAFE_INTEGER, 500).end, 5266);
});
test('a selected site centered in the scroll pane is always mounted', () => {
  for (const index of [0, 1, 400, 800, 5265]) {
    const range = windowRange(5266, Math.max(0, index * 104 - (500 - 104) / 2), 500);
    assert.ok(range.start <= index && range.end > index);
  }
});
test('fractional scroll and different pane heights preserve the visible rows', () => {
  for (const height of [180, 420, 500, 1200]) {
    const range = windowRange(5266, 10400.5, height);
    assert.ok(range.start <= 100);
    assert.ok(range.end >= 100 + Math.ceil(height / 104));
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

test('rendered matrix labels its loss rows and gain columns with correct marginal counts', async () => {
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
  const html = node('[data-age-matrix]').innerHTML;
  assert.match(html, /<thead>.*<th scope="col" class="matrix-loss-end"><span>All losses<\/span><\/th>/);
  assert.match(html, /<tfoot><tr class="matrix-gain-labels"><td colspan="3" aria-hidden="true"><\/td>/);
  assert.match(html, /<th class="matrix-gain-end" scope="row">All gains<\/th>/);
  assert.match(html, /aria-label="All Paucimannose gains: 26 hits"[^>]*class="matrix-margin-button"[^>]*><span>26<\/span><\/button>/);
  assert.match(html, /aria-label="All Paucimannose losses: 1 hit"[^>]*class="matrix-margin-button"[^>]*><span>1<\/span><\/button>/);
  const margins = [...html.matchAll(/aria-label="All [^"]+ (losses|gains): ([\d,]+) hits?"[^>]*class="matrix-margin-button"[^>]*style="background:[^"]+"/g)];
  assert.equal(margins.length, 18);
  for (const direction of ['losses', 'gains']) {
    assert.equal(margins.filter(match => match[1] === direction).reduce((sum, match) => sum + Number(match[2].replaceAll(',', '')), 0), hits.length);
  }
  assert.equal((html.match(/<tfoot>/g) || []).length, 1);
  assert.doesNotMatch(html, /matrix-total|legend-swatch/);
  const rows = [...html.matchAll(/<th scope="row"><button[^>]*data-loss="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(rows, [...layout.MATRIX_CLASSES].reverse());
  node('[data-age-matrix]').querySelectorAll('button').find(button => button.margin && button.dataset.loss === 'paucimannose').click();
  assert.equal(node('[data-age-hit-count]').textContent, '1 of 158 hits');
  node('[data-age-clear]').onclick();
  node('[data-age-matrix]').querySelectorAll('button').find(button => button.margin && button.dataset.gain === 'paucimannose').click();
  assert.equal(node('[data-age-hit-count]').textContent, '26 of 158 hits');
});
