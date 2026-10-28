const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function preview({wide = true, reduced = false, failImage = false} = {}) {
  function element() {
    const classes = new Set();
    return {hidden: false, children: [], classList: {
      contains: name => classes.has(name),
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
    }, append(child) { move(child, this, false); }, prepend(child) { move(child, this, true); }};
  }
  function move(child, parent, first) {
    if (child.parent) child.parent.children = child.parent.children.filter(n => n !== child);
    child.parent = parent;
    if (first) parent.children.unshift(child); else parent.children.push(child);
  }
  const positions = [0, 900, 1600], images = [], plots = [], steps = [];
  for (let i = 0; i < 3; i++) {
    const image = {loading: 'lazy', decode: () => failImage ? Promise.reject(Error('offline')) : Promise.resolve()};
    images.push(image);
    const plot = element(); plot.querySelector = () => image; plots.push(plot);
    const copy = {getBoundingClientRect: () => ({top: positions[i]})};
    const step = element(); step.append(plot);
    step.querySelector = selector => selector.includes('copy') ? copy : step.children.find(n => n === plot);
    steps.push(step);
  }
  const story = element(), stage = element(), page = element();
  story.querySelector = () => stage; story.querySelectorAll = () => steps;
  page.querySelector = () => null;
  const events = {}, frames = [], observers = [], mutations = [];
  const desktop = {matches: wide, addEventListener: (_, fn) => { desktop.change = fn; }};
  const motion = {matches: reduced, addEventListener: (_, fn) => { motion.change = fn; }};
  const document = {hidden: false, querySelector: selector => selector.includes('permutation-story') ? story : page,
    addEventListener: (name, fn) => { events['document-' + name] = fn; }};
  const window = {innerHeight: 800, matchMedia: query => query.includes('min-width') ? desktop : motion,
    addEventListener: (name, fn) => { events[name] = fn; }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/methods.js'), 'utf8'), {
    window, document, requestAnimationFrame: fn => { frames.push(fn); return frames.length; },
    IntersectionObserver: class { constructor(fn) { observers.push(fn); } observe() {} disconnect() {} },
    MutationObserver: class { constructor(fn) { mutations.push(fn); } observe() {} },
  });
  function flush() { while (frames.length) frames.shift()(); }
  return {story, stage, steps, plots, images, page, document, desktop, motion,
    async load() { observers[0]([{isIntersecting: true}]); await new Promise(resolve => setImmediate(resolve)); },
    scroll(next) { positions.splice(0, 3, ...next); events.scroll(); flush(); },
    reveal() { mutations[0](); flush(); }};
}

function active(view) {
  const visible = view.plots.map(plot => !plot.hidden);
  assert.deepEqual(view.steps.map(step => step.classList.contains('is-active')), visible);
  assert.equal(visible.filter(Boolean).length, 1);
  return visible.indexOf(true);
}

test('scrolling forward, backward and across a large jump keeps plot and text together', async () => {
  const view = preview();
  await view.load();
  assert.equal(active(view), 0);
  assert.ok(view.images.every(image => image.loading === 'eager'));
  view.scroll([-700, 200, 1000]); assert.equal(active(view), 1);
  view.scroll([-1700, -800, 0]); assert.equal(active(view), 2);
  view.scroll([-700, 200, 1000]); assert.equal(active(view), 1);
  view.scroll([200, 1100, 1800]); assert.equal(active(view), 0);
  view.scroll([-2000, -1100, -400]); assert.equal(active(view), 2);
});

test('narrow layouts and reduced motion retain each plot beside its own text in document order', async () => {
  for (const options of [{wide: false}, {reduced: true}]) {
    const view = preview(options);
    assert.equal(view.stage.hidden, true);
    assert.equal(view.story.classList.contains('is-scroll-story'), false);
    view.steps.forEach((step, i) => {
      assert.equal(step.children[0], view.plots[i]);
      assert.equal(view.plots[i].hidden, false);
    });
  }
  const view = preview(); await view.load();
  view.scroll([-700, 200, 1000]);
  view.desktop.matches = false; view.desktop.change();
  assert.equal(view.stage.children.length, 0);
  view.steps.forEach((step, i) => assert.equal(step.children[0], view.plots[i]));
  view.desktop.matches = true; view.desktop.change();
  assert.equal(view.stage.children.length, 3);
  assert.equal(active(view), 1);
});

test('returning to Methods updates the sequence after hidden-page scrolling', async () => {
  const view = preview(); await view.load();
  view.page.hidden = true;
  view.scroll([-2000, -1100, -400]); assert.equal(active(view), 0);
  view.page.hidden = false; view.reveal(); assert.equal(active(view), 2);
});

test('an image-loading failure restores the readable inline sequence', async () => {
  const view = preview({failImage: true}); await view.load();
  assert.equal(view.stage.hidden, true);
  view.steps.forEach((step, i) => {
    assert.equal(step.children[0], view.plots[i]);
    assert.equal(view.plots[i].hidden, false);
  });
});


test('opening a narrow or reduced-motion section then enabling the desktop sequence loads every plot', async () => {
  for (const options of [{wide: false}, {reduced: true}]) {
    const view = preview(options); await view.load();
    view.desktop.matches = true; view.motion.matches = false;
    view.desktop.change();
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(view.images.every(image => image.loading === 'eager'));
    view.scroll([-700, 200, 1000]); assert.equal(active(view), 1);
  }
});
