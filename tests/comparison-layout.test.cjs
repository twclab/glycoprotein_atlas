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
