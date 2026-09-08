/* =========================================================
   fx-3d.js — Livello grafico 3D per Fratelli Capoccia
   ========================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform vec2  uMouse;',
    'float strand(vec2 p, float depth, float seed){',
    '  float speed = mix(0.34, 0.12, depth);',
    '  float amp   = mix(0.26, 0.07, depth);',
    '  float freq  = mix(1.15, 2.90, depth);',
    '  float t     = uTime * speed + seed * 7.31;',
    '  float y = sin(p.x * freq + t) * amp',
    '          + sin(p.x * freq * 0.57 - t * 0.83) * amp * 0.55',
    '          + sin(p.x * freq * 2.13 + t * 1.27) * amp * 0.19;',
    '  y += (seed - 0.5) * 1.15;',
    '  float thick = mix(0.085, 0.014, depth);',
    '  float d = abs(p.y - y);',
    '  return smoothstep(thick, 0.0, d);',
    '}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  vec2 p  = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;',
    '  vec3 gold  = vec3(0.792, 0.651, 0.463);',
    '  vec3 light = vec3(0.980, 0.941, 0.867);',
    '  vec3 col = vec3(0.0);',
    '  float alpha = 0.0;',
    '  for (int i = 0; i < 7; i++) {',
    '    float fi    = float(i);',
    '    float depth = fi / 6.0;',
    '    float seed  = fract(sin(fi * 12.9898) * 43758.5453);',
    '    vec2 q = p + uMouse * mix(0.075, 0.008, depth);',
    '    float s = strand(q, depth, seed);',
    '    float fade = mix(0.95, 0.30, depth);',
    '    vec3 tint  = mix(light, gold, depth);',
    '    col   += tint * s * fade;',
    '    alpha += s * fade * 0.55;',
    '  }',
    '  float edge = smoothstep(0.0, 0.22, uv.y) * smoothstep(1.0, 0.72, uv.y);',
    '  alpha *= edge * 0.62;',
    '  col   *= edge;',
    '  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));',
    '}'
  ].join('\n');

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
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'low-power'
    }) || cv.getContext('experimental-webgl');
    if (!gl) return;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
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

    var uRes   = gl.getUniformLocation(prog, 'uRes');
    var uTime  = gl.getUniformLocation(prog, 'uTime');
    var uMouse = gl.getUniformLocation(prog, 'uMouse');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = Math.max(1, Math.round(cv.clientWidth  * dpr));
      var h = Math.max(1, Math.round(cv.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, cv.width, cv.height);
    }
    resize();
    window.addEventListener('resize', resize);

    var mx = 0, my = 0, tx = 0, ty = 0;
    if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      window.addEventListener('pointermove', function (e) {
        tx = (e.clientX / window.innerWidth  - 0.5) * 2;
        ty = (e.clientY / window.innerHeight - 0.5) * -2;
      }, { passive: true });
    }

    var visible = true, running = true, start = performance.now(), raf = 0;

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !raf) { raf = requestAnimationFrame(frame); }
      }, { threshold: 0 }).observe(cv);
    }

    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running && !raf) { raf = requestAnimationFrame(frame); }
    });

    cv.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    });

    function frame(now) {
      if (!visible || !running) { raf = 0; return; }
      mx += (tx - mx) * 0.045;
      my += (ty - my) * 0.045;
      resize();
      gl.uniform1f(uTime, (now - start) * 0.001);
      gl.uniform2f(uMouse, mx, my);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }
    cv.classList.add('is-live');
    raf = requestAnimationFrame(frame);
  }

  var heroCanvas = document.getElementById('hero-canvas');
  if (heroCanvas && !reduceMotion) initHero(heroCanvas);

  var finePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

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
          card.style.setProperty('--ry', (px *  7).toFixed(2) + 'deg');
          card.style.setProperty('--rx', (py * -7).toFixed(2) + 'deg');
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
