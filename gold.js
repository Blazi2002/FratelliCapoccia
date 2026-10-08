/* ============================================================
   LIQUID GOLD + CIOCCHE — hero light layer
   Raw WebGL, no library. One fullscreen pass produces:
     - molten gold flow (two-stage domain-warped fbm)
     - thin bright hair strands riding that flow
     - a specular bloom that follows pointer / device tilt
   The canvas is composited in `screen` blend over the salon photo,
   so the photo stays visible and the gold reads as light on it.

   Cost control:
     - render scale + DPR cap, hard 1.1M fragment budget
     - a watchdog steps the resolution down, then disables the layer,
       if a real device cannot hold frame rate
     - 3 fbm octaves + fewer strands on low-power devices, 5 on desktop
     - rAF stops when the hero leaves the viewport or the tab hides
     - never boots under prefers-reduced-motion (CSS gradient stays)
   Scroll comes in through window.__fcScroll (written by the single
   scroll loop in script.js) so there is only ever one scroll listener.
   ============================================================ */
(function () {
  'use strict';

  var VERT =
    'attribute vec2 aPos;' +
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  function frag(oct, strands, warp) {
    return [
      'precision mediump float;',
      'uniform vec2  uRes;',
      'uniform float uTime;',
      'uniform vec2  uMouse;',
      'uniform float uIntro;',
      'uniform float uScroll;',
      '#define OCT ' + oct,

      'vec2 hash2(vec2 p){',
      '  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));',
      '  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);',
      '}',

      'float vnoise(vec2 p){',
      '  vec2 i = floor(p), f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),',
      '                 dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),',
      '             mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),',
      '                 dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);',
      '}',

      'float fbm(vec2 p){',
      '  float v = 0.0, a = 0.5;',
      '  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);',
      '  for (int i = 0; i < OCT; i++){',
      '    v += a * vnoise(p);',
      '    p = rot * p * 2.03;',
      '    a *= 0.5;',
      '  }',
      '  return v;',
      '}',

      'void main(){',
      '  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;',
      '  float t = uTime * 0.055;',
      '  vec2 mo = uMouse * 0.20;',
      /* rotate + squash the sampling space so features stretch along one
         axis: the field reads as flowing hair, not marble */
      '  mat2 R = mat2(0.940, -0.342, 0.342, 0.940);',
      '  vec2 ps = R * p * vec2(0.44, 1.28);',

      '  vec2 q = vec2(fbm(ps * 1.05 + vec2(0.0, t) + mo),',
      '                fbm(ps * 1.05 + vec2(5.2, 1.3) - vec2(0.0, t * 0.8) + mo));',
      /* the second warp stage is what costs: five fbm evaluations per
         fragment instead of three. Phones get the single-stage version,
         which still reads as organic flow. */
      warp > 1
        ? '  vec2 r = vec2(fbm(ps * 1.35 + 2.6 * q + vec2(1.7, 9.2) + t * 1.1),\n' +
          '                fbm(ps * 1.35 + 2.6 * q + vec2(8.3, 2.8) - t * 0.7));\n' +
          '  float f = fbm(ps * 1.15 + 2.4 * r);'
        : '  vec2 r = q.yx;\n' +
          '  float f = fbm(ps * 1.20 + 2.9 * q);',

      /* the flow coordinate every strand rides; scrolling combs it */
      '  float flow = ps.y * 2.0 + f * 2.6 + r.x * 1.1 + uScroll * 1.9;',
      '  float band = sin(flow * 3.1 + uTime * 0.22);',
      '  float silk = smoothstep(-0.45, 1.0, band);',

      '  float lum = clamp(f * 1.5 + 0.5, 0.0, 1.0);',
      '  float lit = smoothstep(0.22, 0.86, lum);',

      '  vec3 c0 = vec3(0.020, 0.016, 0.014);',
      '  vec3 c1 = vec3(0.214, 0.132, 0.052);',
      '  vec3 c2 = vec3(0.831, 0.658, 0.408);',
      '  vec3 c3 = vec3(0.984, 0.941, 0.855);',

      '  vec3 col = mix(c0, c1, smoothstep(0.10, 0.70, lum));',
      '  col = mix(col, c2, smoothstep(0.42, 0.90, lum * 0.66 + silk * 0.50));',
      '  col = mix(col, c3, pow(silk, 9.0) * smoothstep(0.56, 1.0, lum) * 0.55);',

      /* ---- CIOCCHE: thin filaments riding the flow ---- */
      '  float hair = 0.0;',
      '  float gA = 1.0 - abs(sin(flow * 7.5 + f * 2.0));',
      '  hair += pow(gA, 26.0) * 0.85;',
      strands > 1
        ? '  float gB = 1.0 - abs(sin(flow * 15.3 + r.y * 3.1 + 1.7));\n' +
          '  hair += pow(gB, 44.0) * 0.55;'
        : '',
      strands > 2
        ? '  float gC = 1.0 - abs(sin(flow * 26.0 - q.x * 4.0 + 3.4));\n' +
          '  hair += pow(gC, 60.0) * 0.34;'
        : '',
      /* strands only glint where the field is lit, and they shimmer along
         their length so they never read as flat stripes */
      '  float glint = 0.55 + 0.45 * sin(flow * 1.7 - uTime * 0.5 + f * 5.0);',
      '  hair *= (0.30 + 0.70 * lit) * glint;',
      '  col += c3 * hair * 0.62;',
      '  col += c2 * hair * 0.42;',

      /* pointer-tracked specular bloom */
      '  float d = length(p - uMouse);',
      '  col += c3 * 0.10 * exp(-d * d * 2.2) * (0.5 + 0.5 * silk);',

      /* Shaping happens HERE rather than in a CSS mask: masking a
         full-viewport blended layer forces the compositor to re-blend the
         whole hero every frame. Baked into the fragment it is free.
         This layer composites in `screen`, so its darks must reach true
         black or they haze the photograph underneath. */
      '  vec2 lc = vec2(min(0.85, uRes.x / uRes.y * 0.62), 0.62);',
      '  float conc = 1.0 - smoothstep(0.25, 1.60, length((p - lc) * vec2(0.62, 1.0)));',
      '  col *= 0.05 + 0.95 * conc;',
      '  col *= smoothstep(-1.20, -0.20, p.y) * 0.55 + 0.45;',
      '  col = max(col - 0.010, 0.0);',

      '  col *= uIntro;',
      '  float dith = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);',
      '  col += (dith - 0.5) / 255.0;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].filter(Boolean).join('\n');
  }

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  }

  function profile() {
    var coarse = window.matchMedia('(pointer:coarse)').matches;
    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory || 4;
    var small = Math.min(window.innerWidth, window.innerHeight) < 560;
    var weak = (coarse && (cores <= 4 || mem <= 4)) || small;
    return weak
      ? { oct: 3, strands: 1, warp: 1, scale: 0.60, dpr: 1.0, fps: 30, low: true,
          pauseOnScroll: true, budget: 420000 }
      : { oct: 5, strands: 3, warp: 2, scale: 0.72, dpr: 1.5, fps: 60, low: false,
          pauseOnScroll: false, budget: 1100000 };
  }

  function isSoftware(gl) {
    try {
      var info = gl.getExtension('WEBGL_debug_renderer_info');
      var name = info
        ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER);
      return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(name || ''));
    } catch (e) { return false; }
  }

  function boot() {
    var host = document.getElementById('hero-gl');
    if (!host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    var opts = {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'low-power', failIfMajorPerformanceCaveat: false
    };
    var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return;

    /* Software rasterizers (SwiftShader, llvmpipe, Microsoft Basic Render…)
       run every fragment on the CPU. There the shader costs whole seconds
       of main thread — measured: 8.6s on a mid-range phone profile — so we
       keep the CSS gradient instead. This is also what a phone with a
       blocklisted GPU falls back to, so it protects real users, not only
       the PageSpeed lab. Real GPUs (Apple, Adreno, Mali…) are unaffected. */
    if (isSoftware(gl)) {
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return;
    }

    var prof = profile();
    if (prof.low) document.body.classList.add('lowfx');

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, frag(prof.oct, prof.strands, prof.warp));
    if (vs && !fs) {                       /* older mobile drivers */
      prof.oct = 3; prof.strands = 1; prof.warp = 1;
      prof.scale = Math.min(prof.scale, 0.6);
      fs = compile(gl, gl.FRAGMENT_SHADER, frag(3, 1, 1));
    }
    if (!vs || !fs) return;

    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, 'uRes');
    var uTime = gl.getUniformLocation(prog, 'uTime');
    var uMouse = gl.getUniformLocation(prog, 'uMouse');
    var uIntro = gl.getUniformLocation(prog, 'uIntro');
    var uScroll = gl.getUniformLocation(prog, 'uScroll');

    host.appendChild(canvas);

    var W = 0, H = 0;
    function resize() {
      var r = host.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, prof.dpr) * prof.scale;
      var w = Math.max(2, Math.round(r.width * dpr));
      var h = Math.max(2, Math.round(r.height * dpr));
      var MAX = prof.budget;
      if (w * h > MAX) { var k = Math.sqrt(MAX / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
      if (w === W && h === H) return;
      W = w; H = h;
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    }
    resize();

    var tx = 0, ty = 0, mx = 0, my = 0;
    window.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      tx = ((e.clientX - r.left) / r.width * 2 - 1) * (r.width / r.height);
      ty = -((e.clientY - r.top) / r.height * 2 - 1);
    }, { passive: true });
    window.addEventListener('deviceorientation', function (e) {
      if (e.gamma == null) return;
      tx = Math.max(-1.2, Math.min(1.2, e.gamma / 40));
      ty = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
    }, { passive: true });

    var onScreen = true, awake = true, raf = 0;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; pump(); },
        { threshold: 0 }).observe(host);
    }
    document.addEventListener('visibilitychange', function () { awake = !document.hidden; pump(); });

    var t0 = performance.now(), last = 0, sc = 0;
    var minDelta = 1000 / prof.fps - 2;

    /* ---- adaptive quality ----
       rAF fires once per display frame whether or not we draw, so the
       callback interval is a direct read on whether this device is
       keeping up. Sustained slow frames step the render scale down, then
       give up entirely and hand the hero back to the CSS gradient. */
    var ema = 16.7, prev = 0, budget = 0, steps = 0;
    var STEPS = [0.62, 0.42];
    var grace = 2600;                          /* ignore start-up noise */
    function watchdog(now) {
      var dt = prev ? now - prev : 16.7;
      prev = now;
      if (dt > 900) return;                    /* tab was hidden; not our doing */
      if (grace > 0) { grace -= dt; return; }
      ema += (Math.min(dt, 400) - ema) * 0.10;
      if (ema > 32) {
        /* budget in milliseconds, not frames: a device already down to
           3fps would need half a minute to reach a frame-count threshold */
        budget += dt;
        if (budget > 1400) {
          budget = 0;
          if (steps < STEPS.length) {
            prof.scale = STEPS[steps++];
            W = H = 0;
            resize();
            ema = 16.7;
            grace = 2200;                      /* let the new size settle */
          } else if (ema > 55 || steps >= STEPS.length) {
            /* out of headroom: hand the hero back to the CSS gradient */
            host.classList.add('gl-off');
            host.classList.remove('gl-live');
            if (raf) { cancelAnimationFrame(raf); raf = 0; }
            onScreen = false;
          }
        }
      } else if (budget > 0) { budget = Math.max(0, budget - dt * 2); }
    }

    function loop(now) {
      raf = requestAnimationFrame(loop);
      /* While the page is being scrolled on a phone, every millisecond
         belongs to the scroll. The gold is not what anyone is looking at
         mid-swipe, so we stop drawing and pick it back up when the finger
         lets go — the flow resumes from where it was. */
      if (prof.pauseOnScroll && window.__fcScrolling) {
        prev = 0; ema = 16.7; budget = 0;
        return;
      }
      watchdog(now);
      if (now - last < minDelta) return;
      last = now;
      mx += (tx - mx) * 0.045;
      my += (ty - my) * 0.045;
      sc += ((window.__fcScroll || 0) - sc) * 0.10;
      var el = (now - t0) / 1000;
      gl.uniform1f(uTime, el);
      gl.uniform2f(uMouse, mx, my);
      gl.uniform1f(uScroll, sc);
      gl.uniform1f(uIntro, Math.min(1, el / 1.6));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function pump() {
      var should = onScreen && awake;
      if (should && !raf) { last = 0; raf = requestAnimationFrame(loop); }
      else if (!should && raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    pump();

    var rt;
    function onResize() { clearTimeout(rt); rt = setTimeout(resize, 140); }
    if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(host);
    window.addEventListener('orientationchange', onResize);
    window.addEventListener('resize', onResize, { passive: true });
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    });

    host.classList.add('gl-live');
  }

  /* The gold is decoration: it waits until the page has loaded and the
     main thread is idle, so it never competes with the first paint, the
     largest contentful paint or the first tap. uIntro fades it in, so the
     late start reads as an entrance rather than as a delay. */
  function whenIdle() {
    if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 1500 });
    else setTimeout(boot, 350);
  }
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
})();
