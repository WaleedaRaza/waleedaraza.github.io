/* ═══════════════════════════════════════════════════════════════════════
   ASCII CANVAS: renderer v2 (needs ascii-field.js for noise and timing)
   ───────────────────────────────────────────────────────────────────────
   A scene paints true-colour light into a grid that is 2 x 4 finer than
   the character grid. The renderer then decides, cell by cell:
     · fully lit cell  -> a character chosen by brightness, in its colour
     · partly lit cell -> the lit sub-squares themselves, so silhouettes
                          are smooth instead of stair-stepped
   and adds real bloom. Characters stay the texture; edges stay sharp.

     var g = AsciiCanvas.run(canvasEl, cols, rows, function (g, t) {
       g.px(i, j, r, g, b)        // paint sub-pixel (0..g.W, 0..g.H), 0..1
       g.add(i, j, r, g, b)       // additive
       g.text(col, row, 'label', [r, g, b])
     }, { fps: 24, stillAt: 2, ramp: ' .:;=+*#%@', solid: false });

   World units: one character cell is 1 wide and 2 tall, so a sub-pixel is
   0.5 x 0.5 and circles stay round.  wx = (i + 0.5) / 2, wy = (j + 0.5) / 2.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var AF = global.AsciiField;
  var DEF_RAMP = ' .,:;~=+*x#%@';
  var cssCache = {};
  function css(r, g, b) {
    var R = r >= 1 ? 255 : r <= 0 ? 0 : (r * 255) | 0, G = g >= 1 ? 255 : g <= 0 ? 0 : (g * 255) | 0, B = b >= 1 ? 255 : b <= 0 ? 0 : (b * 255) | 0;
    var k = (R >> 2 << 12) | (G >> 2 << 6) | (B >> 2);
    return cssCache[k] || (cssCache[k] = 'rgb(' + (R & 252) + ',' + (G & 252) + ',' + (B & 252) + ')');
  }

  function create(canvas, cols, rows, opts) {
    opts = opts || {};
    var W = cols * 2, H = rows * 4, buf = new Float32Array(W * H * 3);
    var solid = new Uint8Array(W * H);            // 1 = always draw as pixels, never as a character
    var ramp = opts.ramp || DEF_RAMP, texts = [];
    var layer = document.createElement('canvas'), lctx = layer.getContext('2d'), ctx = canvas.getContext('2d');
    var cw = 8, ch = 16, dpr = 1, canBlur = typeof ctx.filter === 'string';
    canvas.style.display = 'block'; canvas.style.width = '100%';

    function resize() {
      var cssW = canvas.clientWidth || (canvas.parentNode && canvas.parentNode.clientWidth) || 800;
      dpr = Math.min(2, global.devicePixelRatio || 1);
      cw = cssW * dpr / cols; ch = cw * 2;
      canvas.width = layer.width = Math.round(cw * cols);
      canvas.height = layer.height = Math.round(ch * rows);
      canvas.style.height = (canvas.height / dpr) + 'px';
    }
    var g = {
      W: W, H: H, cols: cols, rows: rows, buf: buf, solid: solid,
      clear: function () { buf.fill(0); solid.fill(0); texts.length = 0; },
      px: function (i, j, r, gg, b, s) {
        if (i < 0 || j < 0 || i >= W || j >= H) return;
        var k = (j * W + i) * 3; buf[k] = r; buf[k + 1] = gg; buf[k + 2] = b; if (s) solid[j * W + i] = 1;
      },
      add: function (i, j, r, gg, b) {
        if (i < 0 || j < 0 || i >= W || j >= H) return;
        var k = (j * W + i) * 3; buf[k] += r; buf[k + 1] += gg; buf[k + 2] += b;
      },
      text: function (col, row, str, rgb) { texts.push([col, row, str, rgb || [0.6, 0.62, 0.7]]); },
      resize: resize
    };

    g.draw = function () {
      var x, y, i, j, k, n, L, r, gr, b, m;
      lctx.clearRect(0, 0, layer.width, layer.height);
      lctx.font = Math.floor(ch * 0.9) + 'px "Ascii Art Mono", "IBM Plex Mono", Consolas, Menlo, "DejaVu Sans Mono", monospace';
      lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
      var sw = cw / 2, sh = ch / 4, rl = ramp.length - 1;
      for (y = 0; y < rows; y++) {
        for (x = 0; x < cols; x++) {
          n = 0; r = 0; gr = 0; b = 0; m = 0;
          for (j = 0; j < 4; j++) for (i = 0; i < 2; i++) {
            k = ((y * 4 + j) * W + x * 2 + i);
            var pr = buf[k * 3], pg = buf[k * 3 + 1], pb = buf[k * 3 + 2];
            if (pr + pg + pb > 0.03) { n++; r += pr; gr += pg; b += pb; m += solid[k]; }
          }
          if (!n) continue;
          if (n === 8 && !m && !opts.solid) {
            // a full cell: one character carries the brightness, a dim wash sits behind it
            r /= 8; gr /= 8; b /= 8;
            L = Math.max(r, gr, b); if (L > 1) L = 1;
            var idx = Math.max(1, Math.round(Math.pow(L, 0.75) * rl));
            var boost = L > 0 ? (0.45 + 0.55 * L) / L : 0;
            var x0 = Math.round(x * cw), y0 = Math.round(y * ch);
            lctx.fillStyle = css(r * 0.3, gr * 0.3, b * 0.3);
            lctx.fillRect(x0, y0, Math.round((x + 1) * cw) - x0, Math.round((y + 1) * ch) - y0);
            lctx.fillStyle = css(r * boost, gr * boost, b * boost);
            lctx.fillText(ramp.charAt(idx), (x + 0.5) * cw, (y + 0.52) * ch);
          } else {
            // an edge or a solid cell: draw the lit sub-squares themselves
            for (j = 0; j < 4; j++) for (i = 0; i < 2; i++) {
              k = ((y * 4 + j) * W + x * 2 + i) * 3;
              if (buf[k] + buf[k + 1] + buf[k + 2] <= 0.03) continue;
              var px0 = Math.round((x * 2 + i) * sw), py0 = Math.round((y * 4 + j) * sh);
              lctx.fillStyle = css(buf[k], buf[k + 1], buf[k + 2]);
              lctx.fillRect(px0, py0, Math.round((x * 2 + i + 1) * sw) - px0, Math.round((y * 4 + j + 1) * sh) - py0);
            }
          }
        }
      }
      for (i = 0; i < texts.length; i++) {
        var T = texts[i]; lctx.fillStyle = css(T[3][0], T[3][1], T[3][2]);
        for (j = 0; j < T[2].length; j++) lctx.fillText(T[2].charAt(j), (T[0] + j + 0.5) * cw, (T[1] + 0.52) * ch);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (opts.glow !== false && canBlur) {
        ctx.filter = 'blur(' + (cw * (opts.bloom || 0.9)).toFixed(1) + 'px)';
        ctx.globalAlpha = opts.glowAlpha || 0.75;
        ctx.drawImage(layer, 0, 0);
        ctx.filter = 'none'; ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter';
      }
      ctx.drawImage(layer, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    };
    resize();
    return g;
  }

  /* run: animate a scene, pause on click via toggle(), still frame for reduced motion */
  function run(canvas, cols, rows, fill, opts) {
    opts = opts || {};
    var g = create(canvas, cols, rows, opts);
    var paused = false, tPaused = 0, offset = 0, lastT = 0, lastW = 0;
    function frame(t) { g.clear(); fill(g, t); g.draw(); }
    function fit() { var w = canvas.clientWidth; if (w && w !== lastW) { lastW = w; g.resize(); return true; } return false; }
    global.addEventListener('resize', function () { if (fit() && (paused || AF.reducedMotion)) frame(paused ? tPaused - offset : (opts.stillAt || 2)); });
    fit();
    if (AF.reducedMotion) { frame(opts.stillAt || 2); return { toggle: function () {}, g: g }; }
    AF.animate(canvas, function (t) { lastT = t; fit(); if (!paused) frame(t - offset); }, { fps: opts.fps || 24 });
    return { g: g, toggle: function () { paused = !paused; if (paused) tPaused = lastT; else offset += lastT - tPaused; return paused; } };
  }

  global.AsciiCanvas = { create: create, run: run };
})(window);
