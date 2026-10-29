/* Pure layout calculations shared by the browser and regression tests. */
(() => {
  'use strict';
  const ROW_HEIGHT = 84;
  const PAIR_STYLES = Object.freeze([
    { key: 'liver__kidney', organs: ['kidney', 'liver'], color: '#5AA150' },
    { key: 'brain__liver', organs: ['brain', 'liver'], color: '#F28E2C' },
    { key: 'spleen__liver', organs: ['spleen', 'liver'], color: '#9C7660' },
    { key: 'brain__kidney', organs: ['brain', 'kidney'], color: '#4F7AA7' },
    { key: 'spleen__kidney', organs: ['spleen', 'kidney'], color: '#FF9DA7' },
    { key: 'brain__spleen', organs: ['brain', 'spleen'], color: '#77B7B2' },
    { key: 'spleen__plasma', organs: ['spleen', 'plasma'], color: '#BAB0AC' },
    { key: 'brain__plasma', organs: ['brain', 'plasma'], color: '#E1585A' },
    { key: 'kidney__plasma', organs: ['kidney', 'plasma'], color: '#EDC949' },
    { key: 'liver__plasma', organs: ['plasma', 'liver'], color: '#B07BA1' },
    { key: 'myelin_male__myelin_female', organs: ['myelin_female', 'myelin_male'], color: '#83749E' },
    { key: 'brain__myelin_male', organs: ['myelin_male', 'brain'], color: '#547099' },
    { key: 'brain__myelin_female', organs: ['myelin_female', 'brain'], color: '#B377A2' },
  ]);
  const MATRIX_CLASSES = Object.freeze(['stubs', 'paucimannose', 'high_mannose', 'phospho', 'undecorated', 'fucosylated', 'sialylated', 'fucosylated_and_sialylated', 'mixed']);
  function displayPair(record, rows) {
    const style = PAIR_STYLES.find(pair => pair.key === record.key);
    const organs = style ? style.organs : record.organs;
    const reversed = organs[0] !== record.organs[0];
    return { ...record, organs, color: style?.color, rows: rows.map(row => {
      const result = { ...row, pair: record.key, organs };
      if (reversed) for (const field of ['h', 'effective', 'composition', 'psm']) {
        result[`${field}_a`] = row[`${field}_b`];
        result[`${field}_b`] = row[`${field}_a`];
      }
      return result;
    }) };
  }
  function matrixColor(count) {
    if (!count) return '#d9d9d9';
    const stops = ['#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786', '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'];
    const value = Math.min(1, Math.max(0, (count - 1) / 29)) * (stops.length - 1);
    const index = Math.min(stops.length - 2, Math.floor(value)), fraction = value - index;
    const channel = (color, offset) => parseInt(color.slice(offset, offset + 2), 16);
    return '#' + [1, 3, 5].map(offset => Math.round(channel(stops[index], offset) * (1 - fraction) + channel(stops[index + 1], offset) * fraction).toString(16).padStart(2, '0')).join('');
  }
  function windowRange(length, scrollTop, viewportHeight, rowHeight = ROW_HEIGHT, overscan = 8) {
    const visible = Math.max(1, Math.ceil(viewportHeight / rowHeight));
    const count = Math.max(24, visible + 2 * overscan);
    const first = Math.max(0, Math.floor(Math.max(0, scrollTop) / rowHeight));
    const start = Math.min(Math.max(0, length - count), Math.max(0, first - overscan));
    const end = Math.min(length, start + count);
    return { start, end, before: start * rowHeight, after: (length - end) * rowHeight };
  }
  function changeCounts(rows, classes) {
    const cells = Object.fromEntries(classes.map(loss => [loss, Object.fromEntries(classes.map(gain => [gain, 0]))]));
    const losses = Object.fromEntries(classes.map(name => [name, 0]));
    const gains = { ...losses };
    let max = 1;
    for (const row of rows) {
      if (!cells[row.loss] || cells[row.loss][row.gain] === undefined) continue;
      max = Math.max(max, ++cells[row.loss][row.gain]);
      losses[row.loss]++;
      gains[row.gain]++;
    }
    return { cells, losses, gains, max };
  }
  const api = { ROW_HEIGHT, PAIR_STYLES, MATRIX_CLASSES, displayPair, matrixColor, windowRange, changeCounts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.ATLAS_COMPARISON_LAYOUT = api;
})();
