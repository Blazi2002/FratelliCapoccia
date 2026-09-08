/* =========================================================
   fx-3d.js — Fratelli Capoccia · Atelier  (v3)
   1. Hero WebGL: la foto del salone rifratta da seta d'oro
   2. Titolo che si compone lettera per lettera in 3D
   3. Rivelazioni in prospettiva allo scroll (con stagger)
   4. Tilt 3D sulle schede
   5. Parallasse di profondita' sulle immagini
   6. Cursore dorato + bottoni magnetici (solo desktop)
   7. Barra di avanzamento scroll
   Nessuna dipendenza esterna.
   ========================================================= */
(function () {
  'use strict';

  var qs  = function (s, e) { return (e || document).querySelector(s); };
  var qsa = function (s, e) { return Array.prototype.slice.call((e || document).querySelectorAll(s)); };

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* =======================================================
     1. HERO — foto rifratta dentro l'oro
     ======================================================= */

  var VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  function buildFrag(octaves) {
    return [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#else',
      'precision mediump float;',
      '#endif',
      '#define OCT ' + octaves,

      'varying vec2 vUv;',
      'uniform vec2      uRes;',
      'uniform vec2      uTexRes;',
      'uniform float     uTime;',
      'uniform vec2      uMouse;',
      'uniform float     uScroll;',
      'uniform float     uNarrow;',
      'uniform float     uReveal;',
      'uniform sampler2D uTex;',

      'vec2 hash2(vec2 p){',
      '  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));',
      '  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;',
      '}',
      'float noise(vec2 p){',
      '  vec2 i = floor(p), f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(dot(hash2(i+vec2(0.0,0.0)), f-vec2(0.0,0.0)),',
      '                 dot(hash2(i+vec2(1.0,0.0)), f-vec2(1.0,0.0)), u.x),',
      '             mix(dot(hash2(i+vec2(0.0,1.0)), f-vec2(0.0,1.0)),',
      '                 dot(hash2(i+vec2(1.0,1.0)), f-vec2(1.0,1.0)), u.x), u.y);',
      '}',
      'float fbm(vec2 p){',
      '  float v = 0.0, a = 0.5;',
      '  for (int i = 0; i < OCT; i++){ v += a*noise(p); p = p*2.03 + vec2(3.1,1.7); a *= 0.5; }',
      '  return v;',
      '}',
      'float height(vec2 p){',
      '  float t = uTime * 0.085;',
      '  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2,1.3) - vec2(t*0.75, 0.0)));',
      '  return fbm(p + 2.35 * q);',
      '}',

      // riempimento tipo background-size:cover
      'vec2 coverUV(vec2 uv){',
      '  float ra = uRes.x / uRes.y;',
      '  float ta = uTexRes.x / uTexRes.y;',
      '  vec2 s = ra > ta ? vec2(1.0, ta/ra) : vec2(ra/ta, 1.0);',
      '  return (uv - 0.5) * s + 0.5;',
      '}',

      'void main(){',
      '  vec2 uv = vUv;',
      '  vec2 p  = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;',
      '  p *= 2.5;',
      '  p.y += uScroll * 0.5;',
      '  p += uMouse * 0.14;',

      '  float e = 0.013;',
      '  float h  = height(p);',
      '  float hx = height(p + vec2(e,0.0)) - h;',
      '  float hy = height(p + vec2(0.0,e)) - h;',

      '  vec3 n = normalize(vec3(-hx, -hy, e*0.5));',

      // la foto viene spostata dalla pendenza della seta: e' la rifrazione
      '  vec2 base = coverUV(uv);',
      '  vec2 d = vec2(hx, hy) * (0.075 * uReveal) / e;',
      // leggera aberrazione cromatica sui bordi delle pieghe
      '  float r = texture2D(uTex, base + d * 1.14).r;',
      '  float g = texture2D(uTex, base + d * 1.00).g;',
      '  float b = texture2D(uTex, base + d * 0.86).b;',
      '  vec3 foto = vec3(r, g, b);',

      '  vec3 L = normalize(vec3(uMouse.x*0.7 + 0.2, uMouse.y*0.7 + 0.35, 0.85));',
      '  vec3 V = vec3(0.0,0.0,1.0);',
      '  vec3 H = normalize(L + V);',
      '  float diff = max(dot(n,L), 0.0);',
      '  float spec = pow(max(dot(n,H), 0.0), 42.0);',
      '  float fres = pow(1.0 - max(n.z,0.0), 3.0);',

      '  vec3 oro       = vec3(0.792, 0.651, 0.463);',
      '  vec3 oroScuro  = vec3(0.470, 0.335, 0.155);',
      '  vec3 champagne = vec3(1.000, 0.955, 0.870);',

      // il velo dorato si posa solo sulle creste
      '  float velo = smoothstep(0.02, 0.34, h);',
      '  vec3 metallo = mix(oroScuro, oro, smoothstep(-0.05,0.30,h));',
      '  metallo += champagne * spec * 1.7;',
      '  metallo += oro * fres * 0.45;',
      '  metallo *= 0.45 + 0.85 * diff;',

      '  float lato  = smoothstep(0.10, 0.78, uv.x);',
      '  float sotto = smoothstep(0.06, 0.70, 1.0 - uv.y);',
      '  float mask  = mix(lato, sotto, uNarrow);',

      '  float k = clamp(velo * mask * 1.05, 0.0, 1.0) * uReveal;',
      '  vec3 col = mix(foto, metallo, k);',
      '  col += champagne * spec * mask * 0.55 * uReveal;',

      // scurisce dove sta il testo, cosi' resta leggibile sempre
      '  float scrim = mix(smoothstep(0.62, 0.02, uv.x), smoothstep(0.72, 0.10, uv.y), uNarrow);',
      '  col *= mix(1.0, 0.34, scrim * 0.92);',

      // vignettatura
      '  vec2 c = uv - 0.5;',
      '  col *= 1.0 - dot(c,c) * 0.55;',

      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');
  }

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  }

  function initHero(cv) {
    var gl = cv.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'high-performance'
    }) || cv.getContext('experimental-webgl');
    if (!gl) return;

    var narrow  = window.innerWidth < 760;
    var octaves = narrow ? 3 : 4;
    var scale   = narrow ? 0.60 : 0.78;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, buildFrag(octaves));
    if (!vs || !fs) return;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['uRes','uTexRes','uTime','uMouse','uScroll','uNarrow','uReveal','uTex'].forEach(function (k) {
      U[k] = gl.getUniformLocation(prog, k);
    });

    // texture 1x1 finche' la foto non arriva, cosi' non lampeggia
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([20, 18, 16, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(U.uTex, 0);
    gl.uniform2f(U.uTexRes, 1, 1);

    var texReady = false;
    var img = new Image();
    img.onload = function () {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.uniform2f(U.uTexRes, img.width, img.height);
      texReady = true;
      cv.classList.add('is-live');
    };
    img.src = cv.getAttribute('data-src') || 'images/salone-bg.png';

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2) * scale;
      var w = Math.max(1, Math.round(cv.clientWidth * dpr));
      var h = Math.max(1, Math.round(cv.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) {
        cv.width = w; cv.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(U.uRes, cv.width, cv.height);
      gl.uniform1f(U.uNarrow, window.innerWidth < 760 ? 1.0 : 0.0);
    }
    resize();
    window.addEventListener('resize', resize);

    var mx = 0, my = 0, tx = 0, ty = 0;
    if (finePointer) {
      window.addEventListener('pointermove', function (e) {
        tx = (e.clientX / window.innerWidth - 0.5) * 2;
        ty = (e.clientY / window.innerHeight - 0.5) * -2;
      }, { passive: true });
    }

    var scrollN = 0;
    window.addEventListener('scroll', function () {
      scrollN = window.scrollY / Math.max(1, window.innerHeight);
    }, { passive: true });

    var visible = true, running = true, start = performance.now(), raf = 0, reveal = 0;

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(frame);
      }, { threshold: 0 }).observe(cv);
    }
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running && !raf) raf = requestAnimationFrame(frame);
    });
    cv.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); if (raf) { cancelAnimationFrame(raf); raf = 0; }
    });

    function frame(now) {
      if (!visible || !running) { raf = 0; return; }
      var t = (now - start) * 0.001;
      if (!finePointer) {
        tx = Math.sin(t * 0.25) * 0.85;
        ty = Math.cos(t * 0.18) * 0.55;
      }
      mx = lerp(mx, tx, 0.05);
      my = lerp(my, ty, 0.05);
      // l'oro cala addosso alla foto nei primi secondi
      reveal = lerp(reveal, texReady ? 1 : 0, 0.018);

      resize();
      gl.uniform1f(U.uTime, t);
      gl.uniform2f(U.uMouse, mx, my);
      gl.uniform1f(U.uScroll, scrollN);
      gl.uniform1f(U.uReveal, reveal);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  var heroCanvas = qs('#hero-canvas');
  if (heroCanvas && !reduceMotion) initHero(heroCanvas);

  /* =======================================================
     2. TITOLO LETTERA PER LETTERA
     Le parole restano identiche: si spezzano solo i nodi di
     testo, i tag interni (<br>) sopravvivono.
     ======================================================= */
  qsa('.split-3d').forEach(function (el) {
    if (reduceMotion) { el.classList.add('is-in'); return; }
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.nodeValue.split('').forEach(function (c) {
            if (c === ' ') { frag.appendChild(document.createTextNode(' ')); return; }
            var sp = document.createElement('span');
            sp.className = 'ch';
            sp.textContent = c;
            sp.style.transitionDelay = (i * 0.032).toFixed(3) + 's';
            i++;
            frag.appendChild(sp);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          walk(n);
        }
      });
    })(el);
    requestAnimationFrame(function () {
      setTimeout(function () { el.classList.add('is-in'); }, 220);
    });
  });

  /* =======================================================
     3. RIVELAZIONI ALLO SCROLL, CON STAGGER
     ======================================================= */
  var revealEls = qsa('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var group = qsa('.reveal', e.target.parentNode);
        var idx = group.indexOf(e.target);
        e.target.style.transitionDelay = (Math.max(0, idx) * 0.09).toFixed(2) + 's';
        e.target.classList.add('is-in');
        ro.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { ro.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* =======================================================
     4. TILT 3D
     ======================================================= */
  if (finePointer && !reduceMotion) {
    qsa('.service__card, .svc-card, .review__card, .tilt').forEach(function (card) {
      card.classList.add('fx-tilt');
      var pending = false, ev = null;
      card.addEventListener('pointermove', function (e) {
        ev = e;
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
          pending = false;
          var r = card.getBoundingClientRect();
          var px = (ev.clientX - r.left) / r.width - 0.5;
          var py = (ev.clientY - r.top) / r.height - 0.5;
          card.style.setProperty('--ry', (px * 12).toFixed(2) + 'deg');
          card.style.setProperty('--rx', (py * -12).toFixed(2) + 'deg');
          card.style.setProperty('--gx', ((px + 0.5) * 100).toFixed(1) + '%');
          card.style.setProperty('--gy', ((py + 0.5) * 100).toFixed(1) + '%');
          card.classList.add('is-tilting');
        });
      }, { passive: true });
      card.addEventListener('pointerleave', function () {
        card.classList.remove('is-tilting');
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* =======================================================
     5. PARALLASSE SULLE IMMAGINI
     L'immagine scorre piu' lenta della sua cornice: da'
     profondita' senza ingrandirla (le foto sono piccole).
     ======================================================= */
  var paraEls = qsa('[data-parallax]');
  if (paraEls.length && !reduceMotion) {
    var ticking = false;
    var onScrollPara = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var vh = window.innerHeight;
        paraEls.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) return;
          var k = parseFloat(el.getAttribute('data-parallax')) || 0.12;
          var centre = (r.top + r.height / 2 - vh / 2) / vh;
          el.style.setProperty('--py', (centre * k * -100).toFixed(2) + 'px');
        });
      });
    };
    window.addEventListener('scroll', onScrollPara, { passive: true });
    window.addEventListener('resize', onScrollPara);
    onScrollPara();
  }

  /* =======================================================
     6. CURSORE DORATO + BOTTONI MAGNETICI
     ======================================================= */
  if (finePointer && !reduceMotion) {
    var dot = document.createElement('div');
    dot.className = 'fx-cursor';
    var ring = document.createElement('div');
    ring.className = 'fx-cursor__ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    var cx = -100, cy = -100, rx = -100, ry = -100;
    window.addEventListener('pointermove', function (e) {
      cx = e.clientX; cy = e.clientY;
      dot.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
    }, { passive: true });

    (function loop() {
      rx = lerp(rx, cx, 0.16);
      ry = lerp(ry, cy, 0.16);
      ring.style.transform = 'translate(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px)';
      requestAnimationFrame(loop);
    })();

    qsa('a, button, .service__card, .svc-acc').forEach(function (el) {
      el.addEventListener('pointerenter', function () { ring.classList.add('is-big'); });
      el.addEventListener('pointerleave', function () { ring.classList.remove('is-big'); });
    });

    qsa('.magnetic').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + (dx * 0.22).toFixed(1) + 'px,' + (dy * 0.30).toFixed(1) + 'px)';
      }, { passive: true });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* =======================================================
     7. BARRA DI AVANZAMENTO
     ======================================================= */
  var bar = document.createElement('div');
  bar.className = 'fx-progress';
  document.body.appendChild(bar);
  var updateBar = function () {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0).toFixed(4) + ')';
  };
  window.addEventListener('scroll', updateBar, { passive: true });
  window.addEventListener('resize', updateBar);
  updateBar();
})();
