/* =========================================================
   fx-3d.js — Livello grafico 3D per Fratelli Capoccia  (v2)
   - Hero: seta d'oro liquido in WebGL, con luce e riflessi reali
   - Tilt 3D sulle schede
   Nessuna dipendenza esterna.
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* =======================================================
     1. HERO — oro liquido
     Campo di altezza con domain warping, normali per
     differenze finite, poi luce diffusa + speculare.
     E' la luce che lo fa sembrare metallo e non un disegno.
     ======================================================= */

  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  function buildFrag(octaves) {
    return [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#else',
      'precision mediump float;',
      '#endif',
      '#define OCTAVES ' + octaves,

      'uniform vec2  uRes;',
      'uniform float uTime;',
      'uniform vec2  uMouse;',
      'uniform float uScroll;',
      'uniform float uNarrow;',

      'vec2 hash2(vec2 p){',
      '  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));',
      '  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;',
      '}',

      'float noise(vec2 p){',
      '  vec2 i = floor(p), f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(dot(hash2(i + vec2(0.0,0.0)), f - vec2(0.0,0.0)),',
      '                 dot(hash2(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),',
      '             mix(dot(hash2(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)),',
      '                 dot(hash2(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x), u.y);',
      '}',

      'float fbm(vec2 p){',
      '  float v = 0.0, a = 0.5;',
      '  for (int i = 0; i < OCTAVES; i++){',
      '    v += a * noise(p);',
      '    p = p * 2.03 + vec2(3.1, 1.7);',
      '    a *= 0.5;',
      '  }',
      '  return v;',
      '}',

      // il warping e' cio' che trasforma il rumore in pieghe di stoffa
      'float height(vec2 p){',
      '  float t = uTime * 0.10;',
      '  vec2 q = vec2(fbm(p + vec2(0.0, t)),',
      '                fbm(p + vec2(5.2, 1.3) - vec2(t * 0.8, 0.0)));',
      '  return fbm(p + 2.4 * q);',
      '}',

      'void main(){',
      '  vec2 uv = gl_FragCoord.xy / uRes;',
      '  vec2 p  = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;',
      '  p *= 2.6;',
      '  p.y += uScroll * 0.55;',
      '  p += uMouse * 0.16;',

      '  float e = 0.012;',
      '  float h  = height(p);',
      '  float hx = height(p + vec2(e, 0.0)) - h;',
      '  float hy = height(p + vec2(0.0, e)) - h;',

      '  vec3 n = normalize(vec3(-hx, -hy, e * 0.55));',
      '  vec3 L = normalize(vec3(uMouse.x * 0.7 + 0.25, uMouse.y * 0.7 + 0.35, 0.85));',
      '  vec3 V = vec3(0.0, 0.0, 1.0);',
      '  vec3 H = normalize(L + V);',

      '  float diff = max(dot(n, L), 0.0);',
      '  float spec = pow(max(dot(n, H), 0.0), 46.0);',
      '  float fres = pow(1.0 - max(n.z, 0.0), 3.0);',

      '  vec3 bronzo    = vec3(0.075, 0.045, 0.020);',
      '  vec3 oroScuro  = vec3(0.545, 0.395, 0.185);',
      '  vec3 oro       = vec3(0.792, 0.651, 0.463);',
      '  vec3 champagne = vec3(1.000, 0.955, 0.870);',

      '  vec3 col = mix(bronzo, oroScuro, smoothstep(-0.32, 0.12, h));',
      '  col = mix(col, oro, smoothstep(-0.02, 0.34, h));',
      '  col += champagne * spec * 1.55;',
      '  col += oro * fres * 0.40;',
      '  col *= 0.42 + 0.85 * diff;',

      // su desktop l'oro sta a destra (il testo e' a sinistra),
      // su mobile scende in basso, dove non c'e' testo
      '  float lato  = smoothstep(0.08, 0.72, uv.x);',
      '  float sotto = smoothstep(0.10, 0.72, 1.0 - uv.y);',
      '  float mask  = mix(lato, sotto, uNarrow);',
      '  mask *= smoothstep(0.0, 0.10, uv.y) * smoothstep(1.0, 0.90, uv.y);',

      '  float a = smoothstep(-0.06, 0.30, h);',
      '  a = pow(a, 1.35);',
      '  a = a * 0.92 + spec * 0.55;',
      '  a *= mask;',

      '  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));',
      '}'
    ].join('\n');
  }

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function initHero(cv) {
    var gl = cv.getContext('webgl', {
      alpha: true, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, powerPreference: 'high-performance'
    }) || cv.getContext('experimental-webgl');
    if (!gl) return;

    var narrow  = window.innerWidth < 760;
    var octaves = narrow ? 3 : 4;
    // il canvas gira sotto risoluzione: l'effetto e' morbido, non si nota,
    // e il costo per pixel cala di oltre la meta'
    var scale = narrow ? 0.55 : 0.70;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, buildFrag(octaves));
    if (!vs || !fs) return;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var uRes    = gl.getUniformLocation(prog, 'uRes');
    var uTime   = gl.getUniformLocation(prog, 'uTime');
    var uMouse  = gl.getUniformLocation(prog, 'uMouse');
    var uScroll = gl.getUniformLocation(prog, 'uScroll');
    var uNarrow = gl.getUniformLocation(prog, 'uNarrow');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2) * scale;
      var w = Math.max(1, Math.round(cv.clientWidth  * dpr));
      var h = Math.max(1, Math.round(cv.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) {
        cv.width = w; cv.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, cv.width, cv.height);
      gl.uniform1f(uNarrow, window.innerWidth < 760 ? 1.0 : 0.0);
    }
    resize();
    window.addEventListener('resize', resize);

    var mx = 0, my = 0, tx = 0, ty = 0;
    if (finePointer) {
      window.addEventListener('pointermove', function (e) {
        tx = (e.clientX / window.innerWidth  - 0.5) * 2;
        ty = (e.clientY / window.innerHeight - 0.5) * -2;
      }, { passive: true });
    }

    var scrollN = 0;
    function onScroll() {
      scrollN = window.scrollY / Math.max(1, window.innerHeight);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    var visible = true, running = true, start = performance.now(), raf = 0;

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(frame);
      }, { threshold: 0 }).observe(cv);
    }
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running && !raf) raf = requestAnimationFrame(frame);
    });
    cv.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    });

    function frame(now) {
      if (!visible || !running) { raf = 0; return; }
      var t = (now - start) * 0.001;

      // senza mouse (mobile) la luce gira comunque, piano
      if (!finePointer) {
        tx = Math.sin(t * 0.27) * 0.85;
        ty = Math.cos(t * 0.19) * 0.55;
      }
      mx += (tx - mx) * 0.05;
      my += (ty - my) * 0.05;

      resize();
      gl.uniform1f(uTime, t);
      gl.uniform2f(uMouse, mx, my);
      gl.uniform1f(uScroll, scrollN);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }

    cv.classList.add('is-live');
    raf = requestAnimationFrame(frame);
  }

  var heroCanvas = document.getElementById('hero-canvas');
  if (heroCanvas && !reduceMotion) initHero(heroCanvas);

  /* =======================================================
     2. TILT 3D SULLE SCHEDE
     ======================================================= */
  if (finePointer && !reduceMotion) {
    var cards = document.querySelectorAll('.service__card, .svc-card, .review__card');
    Array.prototype.forEach.call(cards, function (card) {
      card.classList.add('fx-tilt');
      var pending = false, ev = null;

      card.addEventListener('pointermove', function (e) {
        ev = e;
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
          pending = false;
          var r = card.getBoundingClientRect();
          var px = (ev.clientX - r.left) / r.width  - 0.5;
          var py = (ev.clientY - r.top)  / r.height - 0.5;
          card.style.setProperty('--ry', (px * 11).toFixed(2) + 'deg');
          card.style.setProperty('--rx', (py * -11).toFixed(2) + 'deg');
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
})();
