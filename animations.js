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
    document.body.style.opacity = '0';
    var dest = href;
    setTimeout(function () { location.href = dest; }, 370);
  });

  // ── Scroll reveal ─────────────────────────────────────────────────────────
  // CSS already sets these elements to animation-play-state:paused (hidden).
  // We just observe them and add .anim-in to start the animation.
  var SELECTORS = [
    '.section-header', '.industry-card', '.service-card', '.why-card',
    '.process-step', '.appreciation-card', '.location-pill', '.mvp-card',
    '.value-card', '.cert-card', '.biz-card', '.team-card',
    '.timeline-content', '.founder-card', '.story-content', '.kural-block',
    '.service-detail-content', '.service-visual-box', '.office-block', '.office-card',
  ];

  function initReveal() {
    // Collect unique elements and group by parent for stagger
    var seen = new WeakSet();
    var groups = new Map();

    SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (seen.has(el)) return;
        seen.add(el);
        var key = el.parentElement || document.body;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(el);
      });
    });

    // Assign stagger delays within each container
    groups.forEach(function (els) {
      els.forEach(function (el, i) {
        if (i > 0) el.style.animationDelay = Math.min(i * 0.1, 0.3) + 's';
      });
    });

    // Observe and reveal on scroll
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('anim-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

    var toObserve = new WeakSet();
    SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        if (toObserve.has(el)) return;
        toObserve.add(el);
        io.observe(el);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }
})();
