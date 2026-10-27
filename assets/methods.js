(() => {
  "use strict";

  const page = document.querySelector('[data-page="methods"]');
  if (!page) return;
  const nav = page.querySelector('[data-methods-nav]');
  nav.hidden = false;
  nav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-methods-jump]');
    if (!button) return;
    const heading = document.getElementById(button.dataset.methodsJump);
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
  });

  const carousel = page.querySelector('[data-methods-carousel]');
  const slides = [...carousel.querySelectorAll('[data-methods-slide]')];
  const controls = carousel.querySelector('[data-methods-controls]');
  const pause = carousel.querySelector('[data-methods-pause]');
  const choices = [...carousel.querySelectorAll('[data-methods-choice]')];
  const counter = carousel.querySelector('[data-methods-counter]');
  const live = carousel.querySelector('[data-methods-live]');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const INTERVAL_MS = 4000;
  let current = 0;
  let paused = motion.matches;
  let inView = false;
  let hovered = false;
  let timer;
  controls.hidden = false;

  function schedule() {
    clearTimeout(timer);
    pause.textContent = paused ? 'Play examples' : 'Pause examples';
    pause.setAttribute('aria-label', paused ? 'Play automatic glycan examples' : 'Pause automatic glycan examples');
    if (paused || !inView || hovered || page.hidden || document.hidden || carousel.contains(document.activeElement)) return;
    timer = setTimeout(() => show(current + 1), INTERVAL_MS);
  }

  function show(index, manual = false) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => { slide.hidden = i !== current; });
    choices.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
    counter.textContent = `Example ${current + 1} of ${slides.length}`;
    if (manual) live.textContent = `Glycan example ${current + 1} of ${slides.length}`;
    schedule();
  }

  controls.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button === pause) {
      paused = !paused;
      schedule();
    } else if (button.hasAttribute('data-methods-choice')) {
      show(Number(button.dataset.methodsChoice), true);
    } else if (button.hasAttribute('data-methods-next')) {
      show(current + 1, true);
    } else if (button.hasAttribute('data-methods-previous')) {
      show(current - 1, true);
    }
  });
  carousel.addEventListener('mouseenter', () => { hovered = true; schedule(); });
  carousel.addEventListener('mouseleave', () => { hovered = false; schedule(); });
  carousel.addEventListener('focusin', schedule);
  carousel.addEventListener('focusout', () => queueMicrotask(schedule));
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', () => { paused = motion.matches; schedule(); });
  new MutationObserver(schedule).observe(page, { attributes: true, attributeFilter: ['hidden'] });
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    // Fetch the other two small examples before their first timed transition.
    if (inView) slides.forEach((slide) => { slide.querySelector('img').loading = 'eager'; });
    schedule();
  }, { threshold: 0.25 }).observe(carousel);
  show(0);
})();
