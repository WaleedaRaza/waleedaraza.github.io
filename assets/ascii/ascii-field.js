/* ═══════════════════════════════════════════════════════════════════════
   ASCII FIELD — a small, reusable glowing-ASCII renderer
   ───────────────────────────────────────────────────────────────────────
   Same look as the "WALEED A RAZA" hero: monospace glyphs that "type in"
   with a two-tone (top/bottom) colour split, then settle into a glow.

   Usage:
     var field = AsciiField.create(preElement, {
       cols: 150, rows: 48,
       palette: { bark: '#8a5a3c', leaf: '#ff6b35', ... },  // name -> colour
       typing: ['#ff6b35', '#00d4aa']                       // reveal colours
     });
     var buf = field.buffer();        // { cols, rows, ch[], c[] }
     buf.set(x, y, '#', 'leaf');      // write a glyph with a palette key
     field.draw(buf);                 // render (run-length spans, one innerHTML)

   A scene is just a function that fills a buffer each frame, so new art
   (a yin yang, an image converted to ASCII, a name in a shape) only needs
   a new fill function. Helpers below: noise, ramps, line glyphs, image
   sampling.

   Plain script, no modules, no network: works from file:// and on
   locked-down browsers.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var TYPING = '__typing';
  var styleId = 0;

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function escapeChar(ch) {
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '&') return '&amp;';
    return ch;
  }

  /* ── Buffer ─────────────────────────────────────────────────────────── */
  function Buffer(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.ch = new Array(cols * rows);
    this.c = new Array(cols * rows);
    this.clear();
  }
  Buffer.prototype.clear = function () {
    for (var i = 0; i < this.ch.length; i++) { this.ch[i] = ' '; this.c[i] = null; }
  };
  Buffer.prototype.set = function (x, y, ch, colorKey) {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    var i = y * this.cols + x;
    this.ch[i] = ch;
    this.c[i] = colorKey;
  };
  Buffer.prototype.get = function (x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return ' ';
    return this.ch[y * this.cols + x];
  };
  /* Write a multi-line string (array of lines) at x, y. Spaces are transparent. */
  Buffer.prototype.stamp = function (x, y, lines, colorKey) {
    for (var r = 0; r < lines.length; r++) {
      for (var k = 0; k < lines[r].length; k++) {
        var ch = lines[r][k];
        if (ch !== ' ') this.set(x + k, y + r, ch, colorKey);
      }
    }
  };

  /* ── Field (the DOM side) ───────────────────────────────────────────── */
  function Field(el, opts) {
    this.el = el;
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.palette = opts.palette || {};
    this.cls = 'af' + (styleId++);
    this.typing = opts.typing || ['#ff6b35', '#00d4aa'];
    this.glow = opts.glow !== false;
    this.lineHeight = opts.lineHeight || 1.1;
    this.fit = opts.fit !== false;
    el.classList.add('ascii-field', this.cls);
    this._injectStyles();
    if (this.fit) {
      var self = this;
      this._fitNow();
      if (global.ResizeObserver) {
        new ResizeObserver(function () { self._fitNow(); }).observe(el.parentElement || el);
      } else {
        global.addEventListener('resize', function () { self._fitNow(); });
      }
    }
  }

  Field.prototype.buffer = function () { return new Buffer(this.cols, this.rows); };

  Field.prototype.resize = function (cols, rows) {
    this.cols = cols; this.rows = rows;
    if (this.fit) this._fitNow();
  };

  /* Size the font so exactly `cols` glyphs span the parent's width. */
  Field.prototype._fitNow = function () {
    var parent = this.el.parentElement || this.el;
    var w = parent.clientWidth;
    if (!w) return;
    var probe = document.createElement('span');
    probe.textContent = 'MMMMMMMMMM';
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit;font-size:100px;';
    this.el.appendChild(probe);
    var charW = probe.getBoundingClientRect().width / 10 / 100; // em per glyph
    this.el.removeChild(probe);
    if (!charW) charW = 0.6;
    this.charAspect = this.lineHeight / charW; // cell height / cell width
    var size = Math.max(3, Math.floor((w / (this.cols * charW)) * 100) / 100);
    this.el.style.fontSize = size + 'px';
  };

  Field.prototype._injectStyles = function () {
    var css = '.' + this.cls + '{white-space:pre;line-height:' + this.lineHeight + ';margin:0;' +
      'font-family:"IBM Plex Mono","JetBrains Mono",Consolas,"Courier New",monospace;' +
      'font-variant-ligatures:none;letter-spacing:0;user-select:none;}\n';
    var keys = Object.keys(this.palette);
    for (var i = 0; i < keys.length; i++) {
      var col = this.palette[keys[i]];
      var rgb = hexToRgb(col.color || col);
      var glow = (col.glow !== undefined) ? col.glow : 0.45;
      var r = rgb.join(',');
      css += '.' + this.cls + ' .k-' + keys[i] + '{color:' + (col.color || col) + ';' +
        (this.glow && glow > 0 ? 'text-shadow:0 0 ' + (col.blur || 6) + 'px rgba(' + r + ',' + glow + ');' : '') + '}\n';
    }
    // Two-tone typing colours: exactly the hero name's top/bottom split.
    css += '.' + this.cls + ' .k-' + TYPING + '{background:linear-gradient(180deg,' +
      this.typing[0] + ' 0%,' + this.typing[0] + ' 49%,' + this.typing[1] + ' 51%,' + this.typing[1] + ' 100%);' +
      '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;}\n';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  };

  /* Render a buffer as run-length spans: one innerHTML write per frame. */
  Field.prototype.draw = function (buf) {
    var out = [];
    var cols = buf.cols, rows = buf.rows;
    for (var y = 0; y < rows; y++) {
      var runKey = undefined, run = '';
      for (var x = 0; x < cols; x++) {
        var i = y * cols + x;
        var ch = buf.ch[i];
        var key = ch === ' ' ? null : buf.c[i];
        if (key !== runKey) {
          if (run) out.push(runKey ? '<span class="k-' + runKey + '">' + run + '</span>' : run);
          run = ''; runKey = key;
        }
        run += escapeChar(ch);
      }
      if (run) out.push(runKey ? '<span class="k-' + runKey + '">' + run + '</span>' : run);
      if (y < rows - 1) out.push('\n');
    }
    this.el.innerHTML = out.join('');
  };

  /* ── Helpers ────────────────────────────────────────────────────────── */

  // Deterministic hash -> [0,1)
  function hash(x, y, seed) {
    var h = (x | 0) * 374761393 + (y | 0) * 668265263 + ((seed || 0) | 0) * 2246822519;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  // Smooth value noise in [0,1)
  function noise(x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
    var c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  // Fractal noise, 3 octaves, [0,1)
  function fbm(x, y, seed) {
    return (noise(x, y, seed) * 0.57 + noise(x * 2.03, y * 2.03, seed + 7) * 0.29 + noise(x * 4.1, y * 4.1, seed + 13) * 0.14);
  }

  // Pick a glyph from a density ramp, v in [0,1]
  function ramp(v, chars) {
    chars = chars || ' .:-=+*#%@';
    var i = Math.max(0, Math.min(chars.length - 1, Math.floor(v * chars.length)));
    return chars[i];
  }

  // Line glyph for a direction in screen space (dx right, dy down, isotropic units)
  function lineChar(dx, dy, under) {
    var a = Math.atan2(-dy, dx) * 180 / Math.PI; // up is positive
    if (a < 0) a += 180;
    if (a < 22.5 || a >= 157.5) return under ? '_' : '-';
    if (a < 67.5) return '/';
    if (a < 112.5) return '|';
    return '\\';
  }

  // Seeded PRNG (mulberry32)
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Sample an <img>/<canvas> into a cols x rows grid of {lum, r, g, b}.
     Groundwork for image -> coloured ASCII scenes (sunsets, Banff, ...).
     The image must be same-origin (a file in this repo). */
  function sampleImage(img, cols, rows) {
    var cv = document.createElement('canvas');
    cv.width = cols; cv.height = rows;
    var cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0, cols, rows);
    var d = cx.getImageData(0, 0, cols, rows).data;
    var out = new Array(cols * rows);
    for (var i = 0; i < cols * rows; i++) {
      var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      out[i] = { r: r, g: g, b: b, lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 };
    }
    return out;
  }

  var prefersReducedMotion = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* Run a scene: calls render(t, dt) on rAF while visible, pauses offscreen. */
  function animate(el, render, opts) {
    opts = opts || {};
    var fps = opts.fps || 30, interval = 1000 / fps;
    var start = null, last = 0, visible = true, raf = 0, stopped = false;
    var elapsedBeforePause = 0;
    function loop(now) {
      if (stopped) return;
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) { start = null; return; }
      if (start === null) { start = now - elapsedBeforePause; last = now - interval; }
      if (now - last < interval) return;
      var dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      var t = (now - start) / 1000;
      elapsedBeforePause = now - start;
      if (render(t, dt) === false) stopped = true;
    }
    if (global.IntersectionObserver) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(el);
    }
    raf = requestAnimationFrame(loop);
    return {
      restart: function () { start = null; elapsedBeforePause = 0; if (stopped) { stopped = false; raf = requestAnimationFrame(loop); } },
      stop: function () { stopped = true; cancelAnimationFrame(raf); },
      setFps: function (f) { fps = f; interval = 1000 / f; }
    };
  }

  global.AsciiField = {
    create: function (el, opts) { return new Field(el, opts); },
    Buffer: Buffer,
    TYPING: TYPING,
    hash: hash,
    noise: noise,
    fbm: fbm,
    ramp: ramp,
    lineChar: lineChar,
    rng: rng,
    sampleImage: sampleImage,
    animate: animate,
    reducedMotion: prefersReducedMotion
  };
})(window);
