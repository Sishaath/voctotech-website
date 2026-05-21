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
    gsap.to(document.body, {
      opacity: 0, duration: 0.3,
      onComplete: function () { location.href = href; }
    });
  });

  // ── Hero / page-hero: animate on load ────────────────────────────────────
  function heroEntrance() {
    if (document.querySelector('.hero')) {
      // Set hidden first, then double-rAF so opacity:0 is painted before animating
      gsap.set(['.hero h1', '.hero .hero-sub', '.hero .hero-buttons', '.hero .stat-item'],
               { opacity: 0, y: 60 });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          gsap.timeline()
            .to('.hero h1',             { opacity: 1, y: 0, duration: 1.1, ease: 'power4.out' })
            .to('.hero .hero-sub',      { opacity: 1, y: 0, duration: 0.9, ease: 'power4.out' }, '-=0.6')
            .to('.hero .hero-buttons',  { opacity: 1, y: 0, duration: 0.7, ease: 'power4.out' }, '-=0.5')
            .to('.hero .stat-item',     { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power4.out' }, '-=0.4');
        });
      });
    }

    if (document.querySelector('.page-hero-content')) {
      gsap.set('.page-hero-content', { opacity: 0, y: 60 });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          gsap.to('.page-hero-content', { opacity: 1, y: 0, duration: 1, ease: 'power4.out' });
        });
      });
    }
  }

  // ── Scroll-reveal (IntersectionObserver + gsap.to) ────────────────────────
  // Using IO instead of ScrollTrigger avoids the "elements stuck invisible" bug.
  var SELECTORS = [
    '.section-header',
    '.industry-card', '.service-card', '.why-card',
    '.process-step', '.appreciation-card', '.location-pill',
    '.mvp-card', '.value-card', '.cert-card', '.biz-card',
    '.team-card', '.timeline-content', '.founder-card',
    '.story-content', '.kural-block',
    '.service-detail-content', '.service-visual-box',
    '.office-block', '.office-card',
  ];

  function scrollReveal() {
    var seen = new WeakSet();
    var groups = new Map();

    SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (seen.has(el)) return;
        seen.add(el);
        var p = el.parentElement;
        if (!groups.has(p)) groups.set(p, []);
        groups.get(p).push(el);
      });
    });

    // Assign stagger delays and hide all at once
    var all = [];
    groups.forEach(function (els) {
      els.forEach(function (el, i) {
        el._revealDelay = Math.min(i * 0.1, 0.3);
        all.push(el);
      });
    });

    // Hide synchronously so opacity:0 is in the DOM before first paint
    gsap.set(all, { opacity: 0, y: 60 });

    // After two frames (opacity:0 is now painted), start observing
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var el = entry.target;
            gsap.to(el, {
              opacity: 1, y: 0,
              duration: 0.85,
              delay: el._revealDelay || 0,
              ease: 'power4.out',
              clearProps: 'transform'
            });
            io.unobserve(el);
          });
        }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

        all.forEach(function (el) { io.observe(el); });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      heroEntrance();
      scrollReveal();
    });
  } else {
    heroEntrance();
    scrollReveal();
  }

})();
