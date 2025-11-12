/* ========== Helpers ========== */
const qs = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => [...el.querySelectorAll(s)];

/* ========== Mobile Menu ========== */
const navMenu = qs('#nav-menu');
const navToggle = qs('#nav-toggle');
const navOverlay = qs('#nav-overlay');

/* --- focus trap helper --- */
const trapFocusIn = (container)=>{
  const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const els = qsa(FOCUSABLE, container);
  if (!els.length) return ()=>{};
  const first = els[0], last = els[els.length - 1];

  const handler = (e)=>{
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first){
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last){
      e.preventDefault(); first.focus();
    }
  };
  container.addEventListener('keydown', handler);
  return ()=> container.removeEventListener('keydown', handler);
};

let removeTrap = ()=>{};

/* --- funzione principale --- */
const setMenuOpen = (open)=>{
  if (!navMenu || !navToggle) return;
  navMenu.classList.toggle('show', open);
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (navOverlay){
    navOverlay.classList.toggle('show', open);
    navOverlay.toggleAttribute('hidden', !open);
  }
  document.body.classList.toggle('menu-open', open);

  if (open){
    const firstLink = qs('.nav__link', navMenu) || navMenu;
    firstLink.focus();
    removeTrap = trapFocusIn(navMenu);
  } else {
    removeTrap();
    navToggle.focus();
  }
};

if (navToggle && navMenu){
  navToggle.addEventListener('click', ()=> setMenuOpen(!navMenu.classList.contains('show')));
  qsa('.nav__link', navMenu).forEach(link=>{
    link.addEventListener('click', ()=> setMenuOpen(false));
  });
  if (navOverlay){
    navOverlay.addEventListener('click', ()=> setMenuOpen(false));
  }
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && navMenu.classList.contains('show')) setMenuOpen(false);
  });
}

/* ========== Header shadow ========== */
const header = qs('#header');
const onScrollHeader = () => { if (!header) return; header.classList.toggle('scrolled', window.scrollY > 10); };
onScrollHeader();
window.addEventListener('scroll', onScrollHeader);

/* ========== Theme toggle (persist) ========== */
const themeToggle = qs('#theme-toggle');
const root = document.body;
const THEME_KEY = 'fc-theme';
const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme) {
  root.setAttribute('data-theme', savedTheme);
} else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  root.setAttribute('data-theme', 'dark');
}
const setTheme = (next)=>{
  root.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  if (themeToggle){
    themeToggle.setAttribute('aria-label', next === 'dark' ? 'Attiva tema chiaro' : 'Attiva tema scuro');
    themeToggle.innerHTML = next === 'dark'
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
  }
};
if (themeToggle){
  setTheme(root.getAttribute('data-theme') || 'light');
  themeToggle.addEventListener('click', ()=>{
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });
}

/* ========== Scroll-up btn ========== */
const scrollUp = qs('#scroll-up');
if (scrollUp){
  const onScrollUp = () => { (window.scrollY > 400) ? scrollUp.classList.add('show') : scrollUp.classList.remove('show'); };
  onScrollUp();
  window.addEventListener('scroll', onScrollUp);
  scrollUp.addEventListener('click', ()=> window.scrollTo({top:0, behavior:'smooth'}));
}

/* ========== Reveal on scroll ========== */
const revealEls = qsa('.fade-in-element');
if ('IntersectionObserver' in window && revealEls.length){
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if (e.isIntersecting){ e.target.classList.add('is-visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  revealEls.forEach(el=> io.observe(el));
} else {
  revealEls.forEach(el=> el.classList.add('is-visible'));
}

/* ========== Active link ========== */
{
  let path = location.pathname.split('/').pop();
  if (!path || path === '/') path = 'index.html';
  qsa('.nav__link').forEach(a=>{
    const isActive = a.getAttribute('href') === path;
    if (isActive){
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    } else {
      a.removeAttribute('aria-current');
    }
  });
}

/* ========== LISTINO: Filtri ========== */
const priceChips = qsa('.price__filters .chip');
const priceCards = qsa('.price__card');
const applyPriceFilter = (filter)=>{
  priceCards.forEach(card=>{
    const cat = card.getAttribute('data-category');
    card.style.display = (filter === 'all' || filter === cat) ? '' : 'none';
  });
};
if (priceChips.length && priceCards.length){
  priceChips.forEach(chip=>{
    chip.addEventListener('click', ()=>{
      priceChips.forEach(c=> c.classList.remove('is-active'));
      chip.classList.add('is-active');
      const filter = chip.dataset.filter;
      priceChips.forEach(c=> c.setAttribute('aria-selected', c === chip ? 'true' : 'false'));
      applyPriceFilter(filter);
    });
  });
}

/* ========== LISTINO: Accordion robusto ========== */
qsa('.price__accordion').forEach(btn=>{
  const content = qs('#' + btn.getAttribute('aria-controls'));
  if (!content) return;
  const toggle = ()=>{
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    content.classList.toggle('open', !expanded);
  };
  btn.addEventListener('click', toggle);
  btn.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
});

/* ========== SERVIZI: Filtri ========== */
const svcChips = qsa('.svc__filters .chip');
const svcCards  = qsa('.svc-card');
const applySvcFilter = (filter)=>{
  svcCards.forEach(card=>{
    const cat = card.getAttribute('data-category');
    card.style.display = (filter === 'all' || filter === cat) ? '' : 'none';
  });
};
if (svcChips.length && svcCards.length){
  svcChips.forEach(chip=>{
    chip.addEventListener('click', ()=>{
      svcChips.forEach(c=> c.classList.remove('is-active'));
      chip.classList.add('is-active');
      const filter = chip.dataset.filter;
      svcChips.forEach(c=> c.setAttribute('aria-selected', c === chip ? 'true' : 'false'));
      applySvcFilter(filter);
    });
  });
}

/* ========== SERVIZI: Accordion robusto ========== */
qsa('.svc-acc').forEach(btn=>{
  const content = qs('#' + btn.getAttribute('aria-controls'));
  if (!content) return;
  const toggle = ()=>{
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    content.classList.toggle('open', !isOpen);
  };
  btn.addEventListener('click', toggle);
  btn.addEventListener('keydown', (e)=>{ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
});

/* ========== WhatsApp link (contatti) ========== */
const waBtn = qs('#whatsapp-btn');
const waLink = qs('#wh-link');
const WA_NUMBER = '+390630325318';
const WA_TEXT = encodeURIComponent('Ciao! Vorrei prenotare una consulenza.');
const WA_URL = `https://wa.me/${WA_NUMBER}?text=${WA_TEXT}`;
if (waBtn) waBtn.setAttribute('href', WA_URL);
if (waLink) waLink.setAttribute('href', WA_URL);

/* === PRELOADER ANIMATION === */
window.addEventListener('DOMContentLoaded', () => {
  const pre = document.getElementById('preloader');
  if (pre) {
    setTimeout(() => {
      pre.classList.add('hidden');
    }, 800);
  }
});

/* === AGGIUNTA: Consenso Google Maps (banner in home + controllo in contatti) === */
(function () {
  const KEY = 'mapsConsent'; // 'granted' | 'denied'

  // Banner (presente solo in home)
  const banner = document.getElementById('maps-consent-banner');
  if (banner) {
    const saved = localStorage.getItem(KEY);
    if (saved !== 'granted' && saved !== 'denied') {
      banner.style.display = 'block';
    }
    const acceptBtn = document.getElementById('maps-consent-accept');
    const declineBtn = document.getElementById('maps-consent-decline');
    if (acceptBtn) acceptBtn.addEventListener('click', () => {
      localStorage.setItem(KEY, 'granted');
      banner.remove();
    });
    if (declineBtn) declineBtn.addEventListener('click', () => {
      localStorage.setItem(KEY, 'denied');
      banner.remove();
    });
  }

  // Pagina Contatti: mostra/nascondi la mappa in base al consenso
  const mapContainer = document.getElementById('google-map-container');
  const mapDisabled = document.getElementById('map-disabled');
  if (mapContainer || mapDisabled) {
    const consent = localStorage.getItem(KEY);
    const showMap = consent === 'granted';
    if (mapContainer) mapContainer.style.display = showMap ? 'block' : 'none';
    if (mapDisabled) mapDisabled.style.display = showMap ? 'none' : 'block';
  }
})();