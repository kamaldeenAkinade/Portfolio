// Page interactions. Everything here is progressive enhancement: the page is
// fully readable and usable without it.

const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* Mobile menu ------------------------------------------------------------- */
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

function setMenu(open) {
  toggle.setAttribute('aria-expanded', String(open));
  toggle.querySelector('b').textContent = open ? 'Close' : 'Menu';
  nav.classList.toggle('is-open', open);
  document.body.classList.toggle('nav-open', open);
}
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); } });

/* Header state + scroll progress ----------------------------------------- */
const header = document.querySelector('.site-header');
const progress = document.querySelector('.scroll-progress span');
let lastY = scrollY;
let ticking = false;

function onScroll() {
  const y = scrollY;
  const max = root.scrollHeight - innerHeight;
  progress.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
  header.classList.toggle('is-scrolled', y > 20);
  header.classList.toggle('is-hidden', y > lastY && y > 400 && !nav.classList.contains('is-open'));
  lastY = y;
  ticking = false;
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();

/* Reveal on scroll + active nav link ------------------------------------- */
const revealer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealer.unobserve(entry.target); }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach((el) => revealer.observe(el));

const navLinks = [...nav.querySelectorAll('a[href^="#"]:not(.nav-cta)')];
const spy = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${entry.target.id}`));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
navLinks.forEach((a) => { const s = document.querySelector(a.getAttribute('href')); if (s) spy.observe(s); });

/* Pointer niceties (desktop only) ---------------------------------------- */
if (finePointer && !reducedMotion) {
  document.querySelectorAll('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  document.querySelectorAll('[data-tilt]').forEach((card) => {
    const art = card.querySelector('.project-art');
    art.addEventListener('pointermove', (e) => {
      const r = art.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.classList.add('is-tilting');
      art.style.setProperty('--ry', `${(px - 0.5) * 8}deg`);
      art.style.setProperty('--rx', `${(0.5 - py) * 6}deg`);
      art.style.setProperty('--gx', `${px * 100}%`);
      art.style.setProperty('--gy', `${py * 100}%`);
    });
    art.addEventListener('pointerleave', () => {
      card.classList.remove('is-tilting');
      art.style.setProperty('--rx', '0deg');
      art.style.setProperty('--ry', '0deg');
    });
  });
}

/* Lagos clock, copy email, year ------------------------------------------ */
const clock = document.querySelector('[data-clock]');
if (clock) {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' });
  const tick = () => { clock.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 15000);
}

const copyBtn = document.querySelector('[data-copy]');
if (copyBtn) {
  const badge = copyBtn.querySelector('small');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copyBtn.dataset.copy);
      badge.textContent = 'Copied';
      copyBtn.classList.add('is-copied');
    } catch {
      location.href = `mailto:${copyBtn.dataset.copy}`;
      return;
    }
    setTimeout(() => { badge.textContent = 'Copy'; copyBtn.classList.remove('is-copied'); }, 2200);
  });
}

const year = document.querySelector('[data-year]');
if (year) year.textContent = new Date().getFullYear();

/* 3D hero ------------------------------------------------------------------
   Loaded only after the page has finished loading, when the browser is idle,
   and never for reduced-motion or data-saver users. Until then (or if WebGL
   is missing) the optimized photo stays in place. */
function canRun3D() {
  if (reducedMotion) return false;
  if (navigator.connection && navigator.connection.saveData) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function start3D() {
  const container = document.querySelector('[data-hero-visual]');
  const image = document.querySelector('[data-hero-image]');
  if (!container || !image || !canRun3D()) return;
  import('./hero-scene.js')
    .then(({ initHeroScene }) => initHeroScene({ container, image, section: document.querySelector('.hero') }))
    .catch((err) => console.warn('3D hero disabled:', err));
}

const whenIdle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
if (document.readyState === 'complete') whenIdle(start3D, { timeout: 1500 });
else addEventListener('load', () => whenIdle(start3D, { timeout: 1500 }), { once: true });
