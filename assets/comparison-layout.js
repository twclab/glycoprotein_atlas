/* Pure layout calculations shared by the browser and regression tests. */
(() => {
  'use strict';
  const ROW_HEIGHT = 104;
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
  const api = { ROW_HEIGHT, windowRange, changeCounts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.ATLAS_COMPARISON_LAYOUT = api;
})();
