(() => {
  "use strict";

  const page = document.querySelector('[data-page="methods"]');
  if (!page) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const carousel = page.querySelector('[data-methods-carousel]');
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
