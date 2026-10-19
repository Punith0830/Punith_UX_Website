/* Shared portfolio interactions. No framework or animation dependencies. */
(() => {
  'use strict';
  const root = document.documentElement;
  const header = document.querySelector('header');
  const toggle = header.querySelector('.theme-toggle, .pk-theme-toggle');
  const label = toggle.querySelector('.theme-label, .pk-theme-label');
  const nav = header.querySelector('.nav-links, .pk-nav-links');
  const menu = header.querySelector('.menu-btn, .pk-menu-btn');
  const projects = nav.querySelector('.nav-dropdown, .pk-nav-dropdown');
  const summary = projects.querySelector('summary');
  const meta = document.querySelector('meta[name="theme-color"]');
  const compact = matchMedia('(max-width: 900px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const systemTheme = matchMedia('(prefers-color-scheme: light)');

  function readTheme() {
    try { return localStorage.getItem('portfolio-theme'); } catch { return null; }
  }
  function applyTheme(theme, persist = false) {
    const active = theme === 'light' ? 'light' : 'dark';
    root.dataset.theme = active;
    toggle.setAttribute('aria-pressed', String(active === 'light'));
    const next = active === 'light' ? 'dark' : 'light';
    toggle.setAttribute('aria-label', `Switch to ${next} mode`);
    if (label) label.textContent = `${next[0].toUpperCase()}${next.slice(1)} mode`;
    const background = getComputedStyle(document.body).backgroundColor;
    if (meta) meta.setAttribute('content', background);
    if (persist) {
      try { localStorage.setItem('portfolio-theme', active); } catch {}
    }
  }
  applyTheme(root.dataset.theme);
  toggle.addEventListener('click', () => applyTheme(root.dataset.theme === 'light' ? 'dark' : 'light', true));
  addEventListener('storage', event => {
    if (event.key === 'portfolio-theme') applyTheme(event.newValue || (systemTheme.matches ? 'light' : 'dark'));
  });
  systemTheme.addEventListener('change', () => {
    if (!['light', 'dark'].includes(readTheme())) applyTheme(systemTheme.matches ? 'light' : 'dark');
  });

  function setMenu(open, restoreFocus = false) {
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
    nav.inert = compact.matches && !open;
    document.body.classList.toggle('menu-open', compact.matches && open);
    if (!open) projects.removeAttribute('open');
    if (restoreFocus) menu.focus();
  }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    setMenu(open);
    if (open) nav.querySelector('a').focus();
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', event => {
    if (!projects.contains(event.target)) projects.removeAttribute('open');
    if (compact.matches && nav.classList.contains('open') && !header.contains(event.target)) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (compact.matches && nav.classList.contains('open')) { event.preventDefault(); setMenu(false, true); }
      else if (projects.open) { projects.removeAttribute('open'); summary.focus(); }
    }
    if (event.key === 'Tab' && compact.matches && nav.classList.contains('open')) {
      const focusable = [menu, ...nav.querySelectorAll('a, summary, button')].filter(el => el.getClientRects().length && !el.disabled);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  compact.addEventListener('change', () => setMenu(false));
  setMenu(false);
  document.querySelectorAll('#year, #portfolio-year').forEach(el => { el.textContent = String(new Date().getFullYear()); });

  // A single frame per scroll batch; the progress indicator never changes layout.
  const progress = document.querySelector('.progress, .read-progress');
  if (progress) {
    let frame = 0;
    function update() {
      frame = 0;
      const range = root.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${range > 0 ? Math.max(0, Math.min(1, scrollY / range)) : 0})`;
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule, { passive: true });
    addEventListener('load', schedule);
    document.addEventListener('toggle', schedule, true);
    update();
  }

  const openingHero = document.querySelector('main .hero');
  if (openingHero && !reduced.matches) {
    root.classList.add('portfolio-motion-ready');
    if (!openingHero.classList.contains('home-hero')) {
      openingHero.classList.add('portfolio-opening-hero');
      const revealSelectors = [
        '.hero-copy > .hero-logo', '.hero-copy > .client-logo', '.hero-copy > .eyebrow',
        '.hero-copy > h1', '.hero-copy > .hero-lead', '.hero-copy > .lead', '.hero-copy > .lede',
        '.hero-copy > .meta', '.hero-copy > .chips', '.hero-copy > .hero-rule',
        '.hero-copy > .actions', '.hero-copy > .hero-note', '.hero-copy > .hero-facts',
        '.hero-inner > .eyebrow', '.hero-inner > h1', '.hero-inner > .lead',
        '.hero-inner > .hero-bottom'
      ];
      const textTargets = [...openingHero.querySelectorAll(revealSelectors.join(','))];
      const delayStep = compact.matches ? 75 : 110;
      textTargets.forEach((target, index) => {
        let role = 'intro';
        if (target.matches('h1')) role = 'title';
        else if (target.matches('.hero-lead, .lead, .lede, .hero-note')) role = 'body';
        else if (target.matches('.meta, .chips, .hero-rule, .actions, .hero-facts, .hero-bottom')) role = 'support';
        target.dataset.projectHeroEnter = role;
        target.style.setProperty('--project-hero-delay', `${50 + index * delayStep}ms`);
      });
      const visual = openingHero.querySelector('.hero-media, .demo-stage');
      if (visual) {
        visual.dataset.projectHeroVisual = '';
        const visualDelay = compact.matches
          ? Math.min(460, 140 + textTargets.length * 45)
          : Math.min(680, 180 + textTargets.length * 65);
        visual.style.setProperty('--project-hero-delay', `${visualDelay}ms`);
      }
    }
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('portfolio-motion-entered')));
  }

  let targets = [...document.querySelectorAll('.portfolio-reveal')].filter(el => !el.closest('.portfolio-opening-hero'));
  if (!targets.length) {
    const selectors = '.section-head,.hero-copy,.hero-inner,.intro-card,.research-block,.chapter-label,.steps,.flow-card,.check-panel,.lesson,.finish .shell,.agent-card,.skill-group,.layer,.stage,.memory-card,.info-layer,.tree-card,.guardrail,.system-diagram,.pk-contact-inner';
    targets = [...document.querySelectorAll(selectors)].filter(el => !el.parentElement.closest(selectors));
    targets.forEach(el => el.classList.add('portfolio-reveal'));
  }
  if ('IntersectionObserver' in window && !reduced.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.removeAttribute('data-scroll-pending'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -32px 0px' });
    targets.forEach(el => { el.setAttribute('data-scroll-pending', ''); observer.observe(el); });
    const revealAll = () => { targets.forEach(el => el.removeAttribute('data-scroll-pending')); observer.disconnect(); };
    document.addEventListener('focusin', event => {
      for (let target = event.target; target; target = target.parentElement) {
        if (target.classList.contains('portfolio-reveal')) {
          target.removeAttribute('data-scroll-pending'); observer.unobserve(target);
        }
      }
    });
    function revealHash() {
      if (!location.hash) return;
      let id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
      const target = document.getElementById(id);
      for (let el = target; el; el = el.parentElement) {
        if (el.classList.contains('portfolio-reveal')) { el.removeAttribute('data-scroll-pending'); observer.unobserve(el); }
      }
    }
    addEventListener('hashchange', revealHash);
    revealHash();
    addEventListener('beforeprint', revealAll);
    reduced.addEventListener('change', event => { if (event.matches) revealAll(); });
  }

  const supportsTranslate = window.CSS && CSS.supports('translate', '0 1px');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const magneticTargets = supportsTranslate
    ? [...document.querySelectorAll('main .button, main .btn, main .contact-button, main .pk-contact-button')]
    : [];
  function resetMagnetic(target) {
    target.style.removeProperty('--portfolio-magnetic-x');
    target.style.removeProperty('--portfolio-magnetic-y');
  }
  magneticTargets.forEach(target => {
    target.dataset.portfolioMagnetic = '';
    target.addEventListener('pointermove', event => {
      if (!finePointer.matches || reduced.matches) return;
      const rect = target.getBoundingClientRect();
      const x = Math.max(-5, Math.min(5, (event.clientX - rect.left - rect.width / 2) * .12));
      const y = Math.max(-5, Math.min(5, (event.clientY - rect.top - rect.height / 2) * .12));
      target.style.setProperty('--portfolio-magnetic-x', `${x.toFixed(2)}px`);
      target.style.setProperty('--portfolio-magnetic-y', `${y.toFixed(2)}px`);
    }, { passive: true });
    target.addEventListener('pointerleave', () => resetMagnetic(target));
    target.addEventListener('blur', () => resetMagnetic(target));
  });
  finePointer.addEventListener('change', () => magneticTargets.forEach(resetMagnetic));
  reduced.addEventListener('change', event => { if (event.matches) magneticTargets.forEach(resetMagnetic); });

  if (!supportsTranslate) return;
  const parallaxEnabled = matchMedia('(min-width: 901px) and (prefers-reduced-motion: no-preference)');
  const visuals = [];
  const decoration = document.querySelector('.demo-stage') || document.querySelector('.hero');
  if (decoration) { decoration.dataset.portfolioParallax = 'decoration'; visuals.push(decoration); }
  document.querySelectorAll('.hero-media img,.showcase img,.mockup img').forEach((el, index) => {
    if (index < 8) { el.dataset.portfolioParallax = 'image'; visuals.push(el); }
  });
  const heroLayers = [...document.querySelectorAll('[data-portfolio-hero-depth]')];
  const projectCards = [...document.querySelectorAll('.work .project')];
  if (!visuals.length && !heroLayers.length && !projectCards.length) return;
  const active = new Set(); let observer, frame = 0, printing = false;
  const clamp = (min, max, value) => Math.max(min, Math.min(max, value));
  function update() {
    frame = 0;
    if (!parallaxEnabled.matches || printing) return;
    const offsets = [...active].map(el => {
      const rect = el.getBoundingClientRect();
      const previous = el.dataset.portfolioParallax === 'image' ? parseFloat(el.style.getPropertyValue('--portfolio-parallax-y')) || 0 : 0;
      return [el, Math.max(-15, Math.min(15, (innerHeight / 2 - (rect.top - previous + rect.height / 2)) * .035))];
    });
    offsets.forEach(([el, y]) => el.style.setProperty('--portfolio-parallax-y', `${y.toFixed(2)}px`));
    heroLayers.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.bottom < -80 || rect.top > innerHeight + 80) {
        el.style.removeProperty('--portfolio-hero-y');
        return;
      }
      const depth = Number.parseFloat(el.dataset.portfolioHeroDepth) || .25;
      const y = clamp(-18, 18, (innerHeight / 2 - (rect.top + rect.height / 2)) * .04 * depth);
      el.style.setProperty('--portfolio-hero-y', `${y.toFixed(2)}px`);
    });
    const stickyTop = innerWidth <= 900 ? 64 : 68;
    projectCards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > innerHeight + 100) {
        card.style.removeProperty('--portfolio-card-scale');
        card.style.removeProperty('--portfolio-card-brightness');
        card.style.removeProperty('--portfolio-project-image-y');
        card.style.removeProperty('--portfolio-project-copy-y');
        card.style.removeProperty('--portfolio-project-image-scale');
        return;
      }
      const travel = clamp(-1, 1, (innerHeight / 2 - (rect.top + rect.height / 2)) / Math.max(innerHeight, 1));
      card.style.setProperty('--portfolio-project-image-y', `${(travel * 12).toFixed(2)}px`);
      card.style.setProperty('--portfolio-project-copy-y', `${(-travel * 6).toFixed(2)}px`);
      card.style.setProperty('--portfolio-project-image-scale', (1 + Math.abs(travel) * .012).toFixed(4));
      const next = projectCards[index + 1];
      if (!next) {
        card.style.setProperty('--portfolio-card-scale', '1');
        card.style.setProperty('--portfolio-card-brightness', '1');
        return;
      }
      const approach = clamp(0, 1, (innerHeight - next.getBoundingClientRect().top) / Math.max(innerHeight - stickyTop, 1));
      card.style.setProperty('--portfolio-card-scale', (1 - approach * .028).toFixed(4));
      card.style.setProperty('--portfolio-card-brightness', (1 - approach * .14).toFixed(4));
    });
  }
  const schedule = () => {
    if ((active.size || heroLayers.length || projectCards.length) && !frame && !printing) frame = requestAnimationFrame(update);
  };
  function stop() {
    if (observer) observer.disconnect();
    active.clear(); cancelAnimationFrame(frame); frame = 0;
    removeEventListener('scroll', schedule); removeEventListener('resize', schedule);
    visuals.forEach(el => el.style.removeProperty('--portfolio-parallax-y'));
    heroLayers.forEach(el => el.style.removeProperty('--portfolio-hero-y'));
    projectCards.forEach(card => {
      card.style.removeProperty('--portfolio-card-scale');
      card.style.removeProperty('--portfolio-card-brightness');
      card.style.removeProperty('--portfolio-project-image-y');
      card.style.removeProperty('--portfolio-project-copy-y');
      card.style.removeProperty('--portfolio-project-image-scale');
    });
  }
  function configure() {
    stop();
    if (!parallaxEnabled.matches || printing) return;
    if ('IntersectionObserver' in window && visuals.length) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) active.add(entry.target);
          else { active.delete(entry.target); entry.target.style.removeProperty('--portfolio-parallax-y'); }
        });
        schedule();
      }, { rootMargin: '60px 0px', threshold: 0 });
      visuals.forEach(el => observer.observe(el));
    } else visuals.forEach(el => active.add(el));
    addEventListener('scroll', schedule, { passive: true }); addEventListener('resize', schedule, { passive: true });
    schedule();
  }
  parallaxEnabled.addEventListener('change', configure);
  addEventListener('beforeprint', () => { printing = true; stop(); });
  addEventListener('afterprint', () => { printing = false; configure(); });
  configure();
})();
