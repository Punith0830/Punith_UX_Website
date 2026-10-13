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

  let targets = [...document.querySelectorAll('.portfolio-reveal')];
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

  if (!('IntersectionObserver' in window) || !window.CSS || !CSS.supports('translate', '0 1px')) return;
  const parallaxEnabled = matchMedia('(min-width: 901px) and (prefers-reduced-motion: no-preference)');
  const visuals = [];
  const decoration = document.querySelector('.demo-stage') || document.querySelector('.hero');
  if (decoration) { decoration.dataset.portfolioParallax = 'decoration'; visuals.push(decoration); }
  document.querySelectorAll('.project img,.hero-media img,.showcase img,.mockup img').forEach((el, index) => {
    if (index < 8) { el.dataset.portfolioParallax = 'image'; visuals.push(el); }
  });
  if (!visuals.length) return;
  const active = new Set(); let observer, frame = 0, printing = false;
  function update() {
    frame = 0;
    if (!parallaxEnabled.matches || printing) return;
    const offsets = [...active].map(el => {
      const rect = el.getBoundingClientRect();
      const previous = el.dataset.portfolioParallax === 'image' ? parseFloat(el.style.getPropertyValue('--portfolio-parallax-y')) || 0 : 0;
      return [el, Math.max(-15, Math.min(15, (innerHeight / 2 - (rect.top - previous + rect.height / 2)) * .035))];
    });
    offsets.forEach(([el, y]) => el.style.setProperty('--portfolio-parallax-y', `${y.toFixed(2)}px`));
  }
  const schedule = () => { if (active.size && !frame && !printing) frame = requestAnimationFrame(update); };
  function stop() {
    if (observer) observer.disconnect();
    active.clear(); cancelAnimationFrame(frame); frame = 0;
    removeEventListener('scroll', schedule); removeEventListener('resize', schedule);
    visuals.forEach(el => el.style.removeProperty('--portfolio-parallax-y'));
  }
  function configure() {
    stop();
    if (!parallaxEnabled.matches || printing) return;
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) active.add(entry.target);
        else { active.delete(entry.target); entry.target.style.removeProperty('--portfolio-parallax-y'); }
      });
      schedule();
    }, { rootMargin: '60px 0px', threshold: 0 });
    visuals.forEach(el => observer.observe(el));
    addEventListener('scroll', schedule, { passive: true }); addEventListener('resize', schedule, { passive: true });
  }
  parallaxEnabled.addEventListener('change', configure);
  addEventListener('beforeprint', () => { printing = true; stop(); });
  addEventListener('afterprint', () => { printing = false; configure(); });
  configure();
})();
