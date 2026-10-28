(() => {
  "use strict";

  const page = document.querySelector('[data-page="methods"]');
  if (!page) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const carousel = page.querySelector('[data-methods-carousel]');
  if (!carousel) return;
  const slides = [...carousel.querySelectorAll('[data-methods-slide]')];
  let current = 0;
  let inView = false;
  let ready = false;
  let loading;
  let timer;

  function schedule() {
    clearTimeout(timer);
    if (!ready || !inView || page.hidden || document.hidden || motion.matches) return;
    timer = setTimeout(() => {
      slides[current].hidden = true;
      current = (current + 1) % slides.length;
      slides[current].hidden = false;
      schedule();
    }, 4000);
  }

  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', schedule);
  new MutationObserver(schedule).observe(page, { attributes: true, attributeFilter: ['hidden'] });
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView && !loading) {
      loading = Promise.all(slides.map((slide) => {
        const img = slide.querySelector('img');
        img.loading = 'eager';
        return img.decode();
      })).then(() => { ready = true; schedule(); }).catch(() => {});
    }
    schedule();
  }, { threshold: 0.25 }).observe(carousel);
})();

(() => {
  "use strict";
  const story = document.querySelector('[data-permutation-story]');
  if (!story) return;
  const page = document.querySelector('[data-page="methods"]');
  const stage = story.querySelector('[data-permutation-stage]');
  const steps = [...story.querySelectorAll('[data-permutation-step]')];
  const plots = steps.map(step => step.querySelector('[data-permutation-plot]'));
  const desktop = window.matchMedia('(min-width: 1000px)');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0, frame = 0, ready = false, nearby = false, failed = false, loading;

  function update() {
    frame = 0;
    if (!ready || !story.classList.contains('is-scroll-story') || page.hidden || document.hidden) return;
    const line = window.innerHeight * .6;
    let next = 0;
    steps.forEach((step, index) => {
      if (step.querySelector('[data-permutation-copy]').getBoundingClientRect().top <= line) next = index;
    });
    current = next;
    steps.forEach((step, index) => step.classList.toggle('is-active', index === current));
    plots.forEach((plot, index) => { plot.hidden = index !== current; });
  }

  function onScroll() {
    if (!frame && story.classList.contains('is-scroll-story') && !page.hidden && !document.hidden) frame = requestAnimationFrame(update);
  }

  function layout(enabled = desktop.matches && !motion.matches && !failed) {
    story.classList.toggle('is-scroll-story', enabled);
    stage.hidden = !enabled;
    plots.forEach((plot, index) => {
      if (enabled) stage.append(plot);
      else steps[index].prepend(plot);
      plot.hidden = enabled && index !== current;
      steps[index].classList.toggle('is-active', !enabled || index === current);
    });
    update();
    if (enabled) load();
  }

  function load() {
    if (!nearby || loading || !desktop.matches || motion.matches) return;
    loading = Promise.all(plots.map(plot => {
      const image = plot.querySelector('img');
      image.loading = 'eager';
      return image.decode();
    })).then(() => { ready = true; update(); }).catch(() => { failed = true; layout(false); });
    observer.disconnect();
  }

  const observer = new IntersectionObserver(entries => {
    nearby = entries.some(entry => entry.isIntersecting);
    load();
  }, { rootMargin: '600px 0px' });
  observer.observe(story);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  desktop.addEventListener('change', () => layout());
  motion.addEventListener('change', () => layout());
  document.addEventListener('visibilitychange', onScroll);
  new MutationObserver(onScroll).observe(page, { attributes: true, attributeFilter: ['hidden'] });
  layout();
})();
