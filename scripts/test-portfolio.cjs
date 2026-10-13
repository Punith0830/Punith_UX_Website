// DOM-level regression tests. These are not browser layout measurements.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { parseHTML } = require('../audit/tools/node_modules/linkedom');
const pages = ['index.html', 'routiq.html', 'chotadhobi.html', 'myfuturejobs.html', 'esgplatform.html', 'orchestration.html'];
const script = fs.readFileSync('assets/portfolio.js', 'utf8');
let scenarios = 0;

function create(page, { width = 1440, light = false, saved = null, reduced = false, storageBlocked = false, observerSupported = true } = {}) {
  const source = fs.readFileSync(page, 'utf8');
  const { document, window } = parseHTML(source);
  const storage = new Map(saved ? [['portfolio-theme', saved]] : []);
  const media = new Map();
  const observers = [];
  const frames = new Map();
  let sequence = 0, activeElement;
  Object.defineProperty(document, 'activeElement', { get: () => activeElement });
  Object.defineProperty(window.HTMLElement.prototype, 'open', {
    configurable: true, get() { return this.hasAttribute('open'); },
    set(value) { if (value) this.setAttribute('open', ''); else this.removeAttribute('open'); }
  });
  window.HTMLElement.prototype.focus = function () { activeElement = this; this.dispatchEvent(new window.Event('focusin', { bubbles: true })); };
  window.HTMLElement.prototype.getClientRects = function () {
    if (this.closest('[inert]')) return [];
    const details = this.closest('details');
    if (details && !details.open && this.tagName !== 'SUMMARY') return [];
    return [{}];
  };
  window.HTMLElement.prototype.getBoundingClientRect = function () { return { top: 200, height: 400, width: 600 }; };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  function matchMedia(query) {
    if (!media.has(query)) {
      const value = query.includes('prefers-color-scheme') ? light : query.includes('max-width') ? width <= 900 : query.includes('min-width') ? width >= 901 && !reduced : reduced;
      media.set(query, { matches: value, listeners: [], addEventListener(type, listener) { this.listeners.push(listener); } });
    }
    return media.get(query);
  }
  class Observer {
    constructor(callback, options) { this.callback = callback; this.options = options; this.elements = new Set(); observers.push(this); }
    observe(el) { this.elements.add(el); }
    unobserve(el) { this.elements.delete(el); }
    disconnect() { this.elements.clear(); }
    enter() { this.callback([...this.elements].map(target => ({ target, isIntersecting: true }))); }
  }
  window.matchMedia = matchMedia;
  window.CSS = { supports: () => true };
  if (observerSupported) window.IntersectionObserver = Observer;
  else delete window.IntersectionObserver;
  const location = { hash: '' };
  const context = vm.createContext({
    window, document, matchMedia, CSS: window.CSS, IntersectionObserver: observerSupported ? Observer : undefined,
    localStorage: { getItem(key) { if (storageBlocked) throw Error('Storage blocked'); return storage.get(key) || null; }, setItem(key, value) { if (storageBlocked) throw Error('Storage blocked'); storage.set(key, value); } },
    getComputedStyle: () => ({ backgroundColor: document.documentElement.dataset.theme === 'light' ? 'rgb(244, 244, 242)' : 'rgb(0, 0, 0)' }),
    addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window),
    location, innerHeight: 900, innerWidth: width, scrollY: 0,
    requestAnimationFrame: callback => { frames.set(++sequence, callback); return sequence; }, cancelAnimationFrame: id => frames.delete(id),
    navigator: { clipboard: { writeText: async () => {} } }, setTimeout: () => 1, clearTimeout() {}, console, Date
  });
  for (const script of document.querySelectorAll('script:not([src])')) new vm.Script(script.textContent).runInContext(context);
  new vm.Script(script).runInContext(context);
  const fireKey = (key, shiftKey = false) => { const event = new window.Event('keydown', { bubbles: true, cancelable: true }); event.key = key; event.shiftKey = shiftKey; document.dispatchEvent(event); };
  const click = el => el.dispatchEvent(new window.Event('click', { bubbles: true }));
  return { document, window, storage, media, observers, frames, context, location, fireKey, click };
}

for (const page of pages) {
  for (const width of [390, 768, 1024, 1440]) {
    for (const theme of ['light', 'dark']) {
      const t = create(page, { width, saved: theme });
      const header = t.document.querySelector('header');
      const toggle = header.querySelector('[class*="theme-toggle"]');
      const menu = header.querySelector('[class*="menu-btn"]');
      const nav = header.querySelector('[class*="nav-links"]');
      const details = header.querySelector('details');
      assert.equal(t.document.documentElement.dataset.theme, theme);
      assert.equal(toggle.getAttribute('aria-pressed'), String(theme === 'light'));
      t.click(toggle);
      assert.equal(t.document.documentElement.dataset.theme, theme === 'light' ? 'dark' : 'light');
      assert.equal(t.storage.get('portfolio-theme'), theme === 'light' ? 'dark' : 'light');
      if (width <= 900) {
        assert.equal(nav.inert, true);
        t.click(menu); assert.equal(menu.getAttribute('aria-expanded'), 'true'); assert.equal(nav.inert, false);
        assert.equal(t.document.activeElement, nav.querySelector('a'));
        toggle.focus(); t.fireKey('Tab'); assert.equal(t.document.activeElement, menu);
        t.fireKey('Escape'); assert.equal(menu.getAttribute('aria-expanded'), 'false'); assert.equal(t.document.activeElement, menu);
        t.click(menu); t.click(nav.querySelector('a')); assert.equal(menu.getAttribute('aria-expanded'), 'false');
        const media = t.media.get('(max-width: 900px)'); media.matches = false; media.listeners.forEach(fn => fn({ matches: false }));
        assert.equal(nav.inert, false); assert(!t.document.body.classList.contains('menu-open'));
      } else {
        details.open = true; t.fireKey('Escape'); assert.equal(details.open, false); assert.equal(t.document.activeElement, details.querySelector('summary'));
      }
      const reveal = t.observers.find(observer => observer.options.rootMargin === '0px 0px -32px 0px');
      assert(reveal, `${page}: reveal observer missing`);
      const elements = [...reveal.elements]; assert(elements.length);
      reveal.enter(); assert(elements.every(el => !el.hasAttribute('data-scroll-pending')));
      const storageEvent = new t.window.Event('storage'); storageEvent.key = 'portfolio-theme'; storageEvent.newValue = theme;
      t.window.dispatchEvent(storageEvent); assert.equal(t.document.documentElement.dataset.theme, theme);
      if (width >= 1024) {
        const parallax = t.observers.find(observer => observer.options.rootMargin === '60px 0px');
        assert(parallax); parallax.enter();
        t.window.dispatchEvent(new t.window.Event('scroll'));
        const count = t.frames.size;
        t.window.dispatchEvent(new t.window.Event('scroll')); assert.equal(t.frames.size, count);
        const frames = [...t.frames]; t.frames.clear(); frames.forEach(([id, fn]) => fn());
        assert.equal(t.frames.size, 0, 'Animation must not run while idle');
        for (const el of parallax.elements) assert(Math.abs(parseFloat(el.style.getPropertyValue('--portfolio-parallax-y'))) <= 15);
        const enabled = t.media.get('(min-width: 901px) and (prefers-reduced-motion: no-preference)');
        enabled.matches = false; enabled.listeners.forEach(fn => fn({ matches: false }));
        assert([...t.document.querySelectorAll('[data-portfolio-parallax]')].every(el => !el.style.getPropertyValue('--portfolio-parallax-y')));
      }
      if (page === 'orchestration.html') {
        const button = t.document.querySelector('[data-agent-filter="01"]'); t.click(button);
        assert.equal(button.getAttribute('aria-pressed'), 'true');
        t.click(t.document.getElementById('reset-skills')); assert.equal(button.getAttribute('aria-pressed'), 'false');
        const trace = t.document.querySelector('.trace-node'); t.click(trace); assert.equal(trace.getAttribute('aria-pressed'), 'true');
      }
      scenarios++;
    }
  }
  const blocked = create(page, { storageBlocked: true });
  blocked.click(blocked.document.querySelector('header [class*="theme-toggle"]'));
  assert.equal(blocked.document.documentElement.dataset.theme, 'light');
  const reduced = create(page, { reduced: true });
  assert(!reduced.document.querySelector('[data-scroll-pending]'));
  const unsupported = create(page, { observerSupported: false });
  assert(!unsupported.document.querySelector('[data-scroll-pending]'));
  const direct = create(page);
  const hidden = direct.document.querySelector('[data-scroll-pending]');
  assert(hidden);
  hidden.id = 'audit-direct-section'; direct.location.hash = '#audit-direct-section';
  direct.window.dispatchEvent(new direct.window.Event('hashchange'));
  assert(!hidden.hasAttribute('data-scroll-pending'));
  const focus = create(page);
  const parent = focus.document.createElement('div'); parent.className = 'portfolio-reveal'; parent.setAttribute('data-scroll-pending', '');
  const child = focus.document.createElement('div'); child.className = 'portfolio-reveal'; child.setAttribute('data-scroll-pending', '');
  const button = focus.document.createElement('button'); child.append(button); parent.append(child); focus.document.body.append(parent);
  button.focus(); assert(!parent.hasAttribute('data-scroll-pending')); assert(!child.hasAttribute('data-scroll-pending'));
  scenarios += 5;
  console.log(`${page}: themes, menu, focus, reveal, reduced motion, blocked storage and observer fallback pass`);
}
fs.writeFileSync('audit/runtime-tests.json', JSON.stringify({ scenarios, pages: pages.length, result: 'passed', scope: 'DOM/runtime only; no rendered layout measurements' }, null, 2));
console.log(`${scenarios} DOM interaction scenarios passed.`);
