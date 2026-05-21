(function () {
  'use strict';

  // ── Page-exit fade ────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return;
    if (a.target === '_blank' || a.getAttribute('download') != null) return;
    try {
      var url = new URL(href, location.href);
      if (url.hostname !== location.hostname) return;
    } catch (_) { return; }
    e.preventDefault();
    gsap.to(document.body, { opacity: 0, duration: 0.35, onComplete: function () { location.href = href; } });
  });

  // ── GSAP + ScrollTrigger ──────────────────────────────────────────────────
  gsap.registerPlugin(ScrollTrigger);

  var ease = 'power4.out';

  // Hero — animate on load
  if (document.querySelector('.hero')) {
    var tl = gsap.timeline({ defaults: { ease: ease } });
    tl.from('.hero h1',        { opacity: 0, y: 80,  duration: 1.1 })
      .from('.hero-sub',       { opacity: 0, y: 50,  duration: 0.9 }, '-=0.6')
      .from('.hero-buttons a', { opacity: 0, y: 30,  duration: 0.7, stagger: 0.15 }, '-=0.5')
      .from('.stat-item',      { opacity: 0, y: 30,  duration: 0.7, stagger: 0.1  }, '-=0.4');
  }

  // Page-hero (inner pages)
  if (document.querySelector('.page-hero-content')) {
    gsap.from('.page-hero-content', { opacity: 0, y: 60, duration: 1, ease: ease });
  }

  // Helper: scroll-reveal a single element
  function reveal(selector, extra) {
    gsap.utils.toArray(selector).forEach(function (el) {
      gsap.from(el, Object.assign({
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
        opacity: 0, y: 60, duration: 0.9, ease: ease
      }, extra || {}));
    });
  }

  // Helper: scroll-reveal every child inside a grid (staggered)
  function revealGrid(gridSelector, childSelector, stagger) {
    gsap.utils.toArray(gridSelector).forEach(function (grid) {
      var items = childSelector ? grid.querySelectorAll(childSelector) : grid.children;
      if (!items.length) return;
      gsap.from(items, {
        scrollTrigger: { trigger: grid, start: 'top 88%', toggleActions: 'play none none none' },
        opacity: 0, y: 70, duration: 0.85, stagger: stagger || 0.12, ease: ease
      });
    });
  }

  // Section headers
  reveal('.section-header');

  // Card grids
  revealGrid('.industries-grid',  '.industry-card');
  revealGrid('.services-grid',    '.service-card');
  revealGrid('.why-grid',         '.why-card');
  revealGrid('.appreciation-grid','.appreciation-card');
  revealGrid('.mvp-grid',         '.mvp-card');
  revealGrid('.values-grid',      '.value-card');
  revealGrid('.team-grid',        '.team-card');
  revealGrid('.cert-grid',        '.cert-card');
  revealGrid('.biz-grid',         '.biz-card');
  revealGrid('.offices-grid',     '.office-card');
  revealGrid('.timeline',         '.timeline-item', 0.18);

  // Process steps
  revealGrid('.process-steps', '.process-step', 0.15);

  // Location pills
  revealGrid('.location-pills', '.location-pill', 0.15);

  // Global CTA section
  if (document.querySelector('.global-section')) {
    var gTl = gsap.timeline({
      scrollTrigger: { trigger: '.global-section', start: 'top 80%' }
    });
    gTl.from('.global-section h2',          { opacity: 0, y: 60, duration: 1,   ease: ease })
       .from('.global-section .sub',         { opacity: 0, y: 40, duration: 0.8, ease: ease }, '-=0.5')
       .from('.global-section .location-pills', { opacity: 0, y: 30, duration: 0.7, ease: ease }, '-=0.4')
       .from('.global-section .btn',         { opacity: 0, y: 20, duration: 0.7, ease: ease }, '-=0.3');
  }

  // Marquee section label
  reveal('.marquee-label', { y: 20, duration: 0.6 });

  // Story / about page
  reveal('.story-content');
  reveal('.kural-block', { y: 30, duration: 0.7 });
  reveal('.founder-card', { y: 50 });

  // Services page
  gsap.utils.toArray('.service-detail-inner').forEach(function (row) {
    var content = row.querySelector('.service-detail-content');
    var visual  = row.querySelector('.service-visual-box');
    if (content) gsap.from(content, {
      scrollTrigger: { trigger: row, start: 'top 85%' },
      opacity: 0, x: -50, duration: 0.9, ease: ease
    });
    if (visual) gsap.from(visual, {
      scrollTrigger: { trigger: row, start: 'top 85%' },
      opacity: 0, x: 50, duration: 0.9, ease: ease
    });
  });

  // Contact / office blocks
  revealGrid('.contact-grid', '.office-block', 0.15);

})();
