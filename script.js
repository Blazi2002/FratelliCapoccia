/* ============================================================
   FRATELLI CAPOCCIA — interaction layer
   One rAF loop for everything scroll/pointer driven.
   Every effect degrades: no JS -> readable static page.
   ============================================================ */
(function () {
  'use strict';

  var qs = function (s, r) { return (r || document).querySelector(s); };
  var qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var body = document.body;

  /* ---------- 1. Preloader ---------- */
  (function () {
    var pre = qs('#pre');
    if (!pre) return;
    var kill = function () {
      pre.classList.add('done');
      setTimeout(function () { if (pre.parentNode) pre.parentNode.removeChild(pre); }, 1100);
    };
    if (document.documentElement.classList.contains('no-pre')) { kill(); return; }
    /* released on DOMContentLoaded, not `load`: `load` also waits for
       third parties (cookie policy, fonts) and on a slow connection held
       the logo on screen for seconds */
    var go = function () { setTimeout(kill, reduce ? 0 : 420); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true });
    else go();
  })();

  /* ---------- 2. Split words for display reveals ---------- */
  function splitNode(el) {
    if (el.dataset.splitDone) return;
    var out = document.createDocumentFragment();
    var i = 0;
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        node.nodeValue.split(/(\s+)/).forEach(function (chunk) {
          if (!chunk) return;
          if (/^\s+$/.test(chunk)) { out.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span');
          w.className = 'sp';
          var inner = document.createElement('i');
          inner.textContent = chunk;
          inner.style.transitionDelay = (i * 55) + 'ms';
          i++;
          w.appendChild(inner);
          out.appendChild(w);
        });
      } else if (node.nodeType === 1) {
        if (node.tagName === 'BR') { out.appendChild(node.cloneNode()); return; }
        var host = node.cloneNode(false);
        node.textContent.split(/(\s+)/).forEach(function (chunk) {
          if (!chunk) return;
          if (/^\s+$/.test(chunk)) { host.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span');
          w.className = 'sp';
          var inner = document.createElement('i');
          inner.textContent = chunk;
          inner.style.transitionDelay = (i * 55) + 'ms';
          i++;
          w.appendChild(inner);
          host.appendChild(w);
        });
        out.appendChild(host);
      }
    });
    el.innerHTML = '';
    el.appendChild(out);
    el.dataset.splitDone = '1';
  }
  if (!reduce) qsa('[data-split]').forEach(splitNode);

  /* ---------- 3. Reveal on enter ---------- */
  (function () {
    var items = qsa('[data-rv], [data-split]');
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || reduce) {
      items.forEach(function (el) {
        el.classList.add('in');
        qsa('.sp', el).forEach(function (s) { s.classList.add('in'); });
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        qsa('.sp', e.target).forEach(function (s) { s.classList.add('in'); });
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- 4. Mobile menu ---------- */
  (function () {
    var burger = qs('#burger');
    var menu = qs('#menu');
    if (!burger || !menu) return;
    var lastFocus = null;

    function set(open) {
      menu.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      body.classList.toggle('is-locked', open);
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) {
        lastFocus = document.activeElement;
        var first = qs('a', menu);
        if (first) setTimeout(function () { first.focus(); }, 260);
      } else if (lastFocus) {
        lastFocus.focus();
      }
    }
    burger.addEventListener('click', function () {
      set(burger.getAttribute('aria-expanded') !== 'true');
    });
    qsa('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { set(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) set(false);
      if (e.key !== 'Tab' || !menu.classList.contains('open')) return;
      var f = qsa('a[href], button:not([disabled])', menu);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1000 && menu.classList.contains('open')) set(false);
    }, { passive: true });
  })();

  /* ---------- 5. The one scroll loop ----------
     Header state, reading progress, hero parallax and every scroll scene
     are computed here, in a single rAF-throttled pass. Each scene gets a
     0..1 `--p` custom property; ALL the visuals then live in CSS on
     transform/opacity, so the compositor does the work, not the main
     thread. Scenes off screen are skipped entirely.                    */
  (function () {
    var hdr = qs('#hdr');
    var hero = qs('#hero');
    var prog = qs('#prog');
    var up = qs('#to-top');
    var ticking = false;
    var vh = 0;   /* read inside the first frame, never during script evaluation */

    var scenes = qsa('[data-scene]').map(function (el) {
      var s = { el: el, wantsPin: el.getAttribute('data-scene') === 'pin', live: false, p: -1 };
      el.__scene = s;
      return s;
    });

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    if (reduce || !('IntersectionObserver' in window)) {
      /* no motion budget: park every scene at its finished state */
      scenes.forEach(function (s) { s.el.style.setProperty('--p', '1'); });
      scenes.length = 0;
    } else {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var s = entries[i].target.__scene;
          if (!s) continue;
          s.live = entries[i].isIntersecting;
          /* will-change only while the scene is actually animating */
          s.el.classList.toggle('scene-live', s.live);
        }
        onScroll();
      }, { rootMargin: '25% 0px 25% 0px' });
      scenes.forEach(function (s) { io.observe(s.el); });
    }

    function frame() {
      ticking = false;
      if (!vh) vh = window.innerHeight || 1;
      var y = window.pageYOffset || document.documentElement.scrollTop;

      if (hdr) hdr.classList.toggle('stuck', y > 24);
      if (up) up.classList.toggle('show', y > 620);
      /* on a phone the floating WhatsApp button lands on top of the hero's
         own call to action, so it waits until the hero is behind you */
      if (hero) body.classList.toggle('past-hero', y > vh * 0.55);

      if (prog) {
        var h = document.documentElement.scrollHeight - vh;
        prog.style.setProperty('--sp-progress', h > 0 ? clamp01(y / h) : 0);
      }
      if (hero && !reduce) {
        hero.style.setProperty('--sx', clamp01(y / (hero.offsetHeight || 1)).toFixed(4));
        /* the shader combs its strands with this */
        window.__fcScroll = y / vh;
      }

      for (var i = 0; i < scenes.length; i++) {
        var s = scenes[i];
        if (!s.live) continue;
        var r = s.el.getBoundingClientRect();
        var p;
        /* a scene only uses pin math while it is actually taller than the
           viewport: below 900px CSS unpins these sections (no scroll
           hijacking on touch) and they fall back to view-progress */
        if (s.wantsPin && r.height > vh * 1.25) {
          var span = r.height - vh;
          p = clamp01(-r.top / span);
        } else {
          p = clamp01((vh - r.top) / (vh + r.height * 0.85));
        }
        if (Math.abs(p - s.p) < 0.0015) continue;
        s.p = p;
        s.el.style.setProperty('--p', p.toFixed(4));
      }
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(frame);
    }
    /* one flag the shader reads so it can stand down mid-swipe */
    var stopTimer = 0;
    function markScrolling() {
      window.__fcScrolling = true;
      clearTimeout(stopTimer);
      stopTimer = setTimeout(function () { window.__fcScrolling = false; }, 140);
    }

    window.addEventListener('scroll', function () {
      markScrolling();
      onScroll();
    }, { passive: true });
    window.addEventListener('resize', function () {
      vh = window.innerHeight || 1;
      for (var i = 0; i < scenes.length; i++) scenes[i].p = -1;
      onScroll();
    }, { passive: true });
    window.addEventListener('orientationchange', function () {
      vh = window.innerHeight || 1;
      onScroll();
    });
    /* First pass on the next frame: run synchronously here it forced a
       full layout right after the title split rewrote the DOM (77ms of
       forced reflow inside one long task on a mid-range phone). */
    requestAnimationFrame(frame);

    if (up) up.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  })();

  /* ---------- 5b. Counters ---------- */
  (function () {
    var els = qsa('[data-count]');
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        io.unobserve(el);
        var end = parseFloat(el.getAttribute('data-count')) || 0;
        var dur = 1250, t0 = 0;
        function step(now) {
          if (!t0) t0 = now;
          var k = Math.min(1, (now - t0) / dur);
          var eased = 1 - Math.pow(1 - k, 3);
          el.textContent = Math.round(end * eased).toString();
          if (k < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    /* The observer's first report says where each counter is without
       reading layout ourselves: on screen already -> leave the real number
       (never flash "Aperti 0 giorni su 7"); below the fold -> zero it and
       count up when it arrives. */
    var first = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        first.unobserve(e.target);
        if (e.isIntersecting) return;
        e.target.textContent = '0';
        io.observe(e.target);
      });
    });
    els.forEach(function (el) { first.observe(el); });
  })();

  /* ---------- 5c. "Aperto ora" ----------
     Reads the schedule, the closures and the reduced-hours days from
     orari.js, on the visitor's own clock. That file is the only thing
     anyone has to edit; if it fails to load we fall back to the plain
     weekly hours rather than showing nothing.                        */
  (function () {
    var box = qs('#open-now');
    if (!box) return;
    var txt = qs('.openband__txt', box);
    if (!txt) return;

    var DAY_KEYS = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
    var DAY_IT = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
    var MONTH_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

    var CFG = window.FC_ORARI || {};
    var WEEK = CFG.settimana || {
      domenica: null, lunedi: ['09:00', '19:00'], martedi: ['09:00', '22:00'],
      mercoledi: ['09:00', '19:00'], giovedi: ['09:00', '19:00'],
      venerdi: ['09:00', '22:00'], sabato: ['09:00', '19:00']
    };
    var SHUT = CFG.chiusure || [];
    var SPECIAL = CFG.speciali || [];

    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function hm(str) {
      var m = /^(\d{1,2}):(\d{2})$/.exec(String(str || ''));
      return m ? (+m[1]) * 60 + (+m[2]) : null;
    }
    function show(mins) { return pad2(Math.floor(mins / 60)) + ':' + pad2(mins % 60); }
    function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
    function md(d) { return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

    /* Easter is movable, so Pasquetta has to be computed (Meeus/Butcher) */
    var easterCache = {};
    function easterMonday(year) {
      if (easterCache[year]) return easterCache[year];
      var a = year % 19, b = Math.floor(year / 100), c = year % 100;
      var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
      var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
      var i = Math.floor(c / 4), k = c % 4;
      var l = (32 + 2 * e + 2 * i - h - k) % 7;
      var m = Math.floor((a + 11 * h + 22 * l) / 451);
      var month = Math.floor((h + l - 7 * m + 114) / 31);
      var day = ((h + l - 7 * m + 114) % 31) + 1;
      var dt = new Date(year, month - 1, day + 1);   /* +1 = Pasquetta */
      easterCache[year] = ymd(dt);
      return easterCache[year];
    }

    function closureOn(date) {
      var day = ymd(date), stamp = md(date);
      for (var i = 0; i < SHUT.length; i++) {
        var c = SHUT[i];
        if (!c) continue;
        if (c.pasquetta && day === easterMonday(date.getFullYear())) return c;
        if (c.ogniAnno && c.ogniAnno === stamp) return c;
        if (c.giorno && c.giorno === day) return c;
        if (c.dal && c.al && day >= c.dal && day <= c.al) return c;
      }
      return null;
    }

    /* [openMinutes, closeMinutes] for a date, or null when shut */
    function hoursOn(date) {
      if (closureOn(date)) return null;
      var day = ymd(date);
      for (var i = 0; i < SPECIAL.length; i++) {
        var sp = SPECIAL[i];
        if (sp && sp.giorno === day) {
          var a = hm(sp.dalle), b = hm(sp.alle);
          if (a != null && b != null && b > a) return [a, b];
        }
      }
      var w = WEEK[DAY_KEYS[date.getDay()]];
      if (!w) return null;
      var o = hm(w[0]), cl = hm(w[1]);
      return (o != null && cl != null && cl > o) ? [o, cl] : null;
    }

    function nextOpening(from) {
      var probe = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      for (var i = 1; i <= 400; i++) {
        probe.setDate(probe.getDate() + 1);
        var h = hoursOn(probe);
        if (h) return { date: new Date(probe), open: h[0], days: i };
      }
      return null;
    }

    function whenLabel(n) {
      if (n.days === 1) return 'domani';
      if (n.days <= 6) return DAY_IT[n.date.getDay()];
      return DAY_IT[n.date.getDay()] + ' ' + n.date.getDate() + ' ' + MONTH_IT[n.date.getMonth()];
    }

    function paint() {
      var now = new Date();
      var mins = now.getHours() * 60 + now.getMinutes();
      var today = hoursOn(now);

      if (today && mins >= today[0] && mins < today[1]) {
        box.classList.add('is-open');
        txt.textContent = 'Aperto ora — si chiude alle ' + show(today[1]);
        box.hidden = false;
        return;
      }

      box.classList.remove('is-open');

      if (today && mins < today[0]) {
        txt.textContent = 'Chiuso — si apre oggi alle ' + show(today[0]);
        box.hidden = false;
        return;
      }

      var shut = closureOn(now);
      var head = shut && shut.nota ? 'Chiuso per ' + shut.nota : 'Chiuso';
      var n = nextOpening(now);
      txt.textContent = n
        ? head + ' — si riapre ' + whenLabel(n) + ' alle ' + show(n.open)
        : head;
      box.hidden = false;
    }

    paint();
    setInterval(paint, 60000);
  })();

  /* ---------- 6. 3D tilt cards ---------- */
  if (fine && !reduce) {
    qsa('[data-tilt]').forEach(function (card) {
      var inner = qs('.tcard__in', card) || card.firstElementChild;
      if (!inner) return;
      var rect = null, pending = false, rx = 0, ry = 0, px = 50, py = 0;

      function apply() {
        pending = false;
        inner.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateZ(0)';
        inner.style.setProperty('--mx', px.toFixed(1) + '%');
        inner.style.setProperty('--my', py.toFixed(1) + '%');
      }
      card.addEventListener('pointerenter', function () { rect = card.getBoundingClientRect(); });
      card.addEventListener('pointermove', function (e) {
        if (!rect) rect = card.getBoundingClientRect();
        var nx = (e.clientX - rect.left) / rect.width;
        var ny = (e.clientY - rect.top) / rect.height;
        px = nx * 100; py = ny * 100;
        ry = (nx - 0.5) * 11;
        rx = -(ny - 0.5) * 9;
        if (!pending) { pending = true; requestAnimationFrame(apply); }
      });
      card.addEventListener('pointerleave', function () {
        rect = null; rx = 0; ry = 0; px = 50; py = 0;
        inner.style.transform = '';
        inner.style.setProperty('--mx', '50%');
        inner.style.setProperty('--my', '0%');
      });
    });
  }

  /* ---------- 7. Parallax depth on framed images ---------- */
  if (fine && !reduce) {
    qsa('[data-depth]').forEach(function (el) {
      var img = qs('img', el);
      if (!img) return;
      var rect = null, pending = false, tx = 0, ty = 0, r = 0;
      function apply() {
        pending = false;
        el.style.transform = 'perspective(1200px) rotateY(' + r.toFixed(2) + 'deg) rotateX(' + (-ty * 3).toFixed(2) + 'deg)';
        img.style.transformOrigin = (50 + tx * 8) + '% ' + (50 + ty * 8) + '%';
      }
      el.addEventListener('pointerenter', function () { rect = el.getBoundingClientRect(); });
      el.addEventListener('pointermove', function (e) {
        if (!rect) rect = el.getBoundingClientRect();
        tx = (e.clientX - rect.left) / rect.width - 0.5;
        ty = (e.clientY - rect.top) / rect.height - 0.5;
        r = tx * 7;
        if (!pending) { pending = true; requestAnimationFrame(apply); }
      });
      el.addEventListener('pointerleave', function () {
        rect = null; el.style.transform = ''; img.style.transformOrigin = '';
      });
    });
  }

  /* ---------- 8. Magnetic buttons ---------- */
  if (fine && !reduce) {
    qsa('[data-mag]').forEach(function (b) {
      var rect = null;
      b.addEventListener('pointerenter', function () { rect = b.getBoundingClientRect(); });
      b.addEventListener('pointermove', function (e) {
        if (!rect) rect = b.getBoundingClientRect();
        var x = (e.clientX - rect.left - rect.width / 2) * 0.16;
        var y = (e.clientY - rect.top - rect.height / 2) * 0.24;
        b.style.transform = 'translate(' + x.toFixed(1) + 'px,' + (y - 2).toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function () { rect = null; b.style.transform = ''; });
    });
  }

  /* ---------- 9. Custom cursor ---------- */
  if (fine && !reduce) {
    var ring = document.createElement('div'); ring.className = 'cursor';
    var dot = document.createElement('div'); dot.className = 'cursor-dot';
    ring.setAttribute('aria-hidden', 'true'); dot.setAttribute('aria-hidden', 'true');
    body.appendChild(ring); body.appendChild(dot);
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2, ex = cx, ey = cy, live = false;

    window.addEventListener('pointermove', function (e) {
      cx = e.clientX; cy = e.clientY;
      dot.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
      if (!live) { live = true; body.classList.add('cursor-on'); ex = cx; ey = cy; tick(); }
    }, { passive: true });
    window.addEventListener('pointerdown', function () { body.classList.add('cursor-hot'); });
    window.addEventListener('pointerup', function () { body.classList.remove('cursor-hot'); });
    document.addEventListener('pointerleave', function () { body.classList.remove('cursor-on'); });

    function tick() {
      ex += (cx - ex) * 0.16;
      ey += (cy - ey) * 0.16;
      ring.style.transform = 'translate(' + ex.toFixed(1) + 'px,' + ey.toFixed(1) + 'px)';
      requestAnimationFrame(tick);
    }
    var hotSel = 'a, button, [data-tilt], .acc__btn, input, textarea';
    document.addEventListener('pointerover', function (e) {
      if (e.target.closest && e.target.closest(hotSel)) body.classList.add('cursor-hot');
    });
    document.addEventListener('pointerout', function (e) {
      if (e.target.closest && e.target.closest(hotSel)) body.classList.remove('cursor-hot');
    });
  }

  /* ---------- 10. Accordion (servizi) ---------- */
  qsa('.acc__btn').forEach(function (btn) {
    var row = btn.closest('.acc__row');
    var panel = qs('#' + btn.getAttribute('aria-controls'));
    if (!row || !panel) return;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      row.classList.toggle('open', !open);
    });
  });

  /* ---------- 11. Marquee: duplicate the group so the loop is seamless ---------- */
  qsa('.marquee__track').forEach(function (track) {
    var g = qs('.marquee__group', track);
    if (g && track.children.length === 1) track.appendChild(g.cloneNode(true));
  });

  /* ---------- 12. Active nav link ---------- */
  (function () {
    var page = location.pathname.split('/').pop() || 'index.html';
    qsa('[data-nav]').forEach(function (a) {
      var on = a.getAttribute('href') === page;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  })();

  /* ---------- 13. WhatsApp (unchanged number & message) ---------- */
  (function () {
    var NUM = '+390630325318';
    var TXT = encodeURIComponent('Ciao! Vorrei prenotare una consulenza.');
    var URL = 'https://wa.me/' + NUM + '?text=' + TXT;
    qsa('[data-wa]').forEach(function (a) { a.setAttribute('href', URL); });
  })();

  /* ---------- 14. Google Maps consent (same contract as before) ---------- */
  (function () {
    var KEY = 'mapsConsent'; /* 'granted' | 'denied' */
    var read = function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
    var write = function (v) { try { localStorage.setItem(KEY, v); } catch (e) {} };
    var clear = function () { try { localStorage.removeItem(KEY); } catch (e) {} };

    var banner = qs('#consent');
    var mapOn = qs('#map-on');
    var mapOff = qs('#map-off');

    function paintMap() {
      if (!mapOn && !mapOff) return;
      var ok = read() === 'granted';
      if (mapOn) mapOn.hidden = !ok;
      if (mapOff) mapOff.hidden = ok;
    }

    var root = document.documentElement;
    if (banner) {
      /* whether to show it was already decided in <head>, before the first
         frame: here we only honour the "rivedi la scelta" link */
      if (location.hash === '#consenso-mappe') {
        clear();
        root.classList.add('consent-open');
      }

      var yes = qs('#consent-yes'), no = qs('#consent-no');
      var close = function (value) {
        write(value);
        root.classList.remove('consent-open');
        paintMap();
      };
      if (yes) yes.addEventListener('click', function () { close('granted'); });
      if (no) no.addEventListener('click', function () { close('denied'); });
    }
    paintMap();
  })();
})();
