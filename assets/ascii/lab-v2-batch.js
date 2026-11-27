/* ═══════════════════════════════════════════════════════════════════════
   LAB V2 BATCH: many small scenes on the v2 renderer (ascii-canvas.js).
   Most are "shaders": one function gives the colour of a point in world
   units (a character cell is 1 wide and 2 tall).
   LabBatch.<name>(canvas) -> { toggle(), g }
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var AF = global.AsciiField, AC = global.AsciiCanvas, PI = Math.PI, TAU = PI * 2;
  var sin = Math.sin, cos = Math.cos, abs = Math.abs, exp = Math.exp, pow = Math.pow, hyp = Math.hypot, max = Math.max, min = Math.min, floor = Math.floor;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sm(e0, e1, v) { var t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function frac(v) { return v - floor(v); }
  function mix(a, b, u) { return a + (b - a) * u; }
  function hsv(o, h, s, v) {
    h = frac(h) * 6; var i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), u = v * (1 - s * (1 - f));
    if (i === 0) { o[0] = v; o[1] = u; o[2] = p; } else if (i === 1) { o[0] = q; o[1] = v; o[2] = p; } else if (i === 2) { o[0] = p; o[1] = v; o[2] = u; }
    else if (i === 3) { o[0] = p; o[1] = q; o[2] = v; } else if (i === 4) { o[0] = u; o[1] = p; o[2] = v; } else { o[0] = v; o[1] = p; o[2] = q; }
  }
  var ORANGE = [1, 0.42, 0.21], TEAL = [0, 0.83, 0.67];
  function star(o, x, y, t, dens) {
    var cx = floor(x), cy = floor(y / 2), h = AF.hash(cx, cy, 7);
    if (h < (dens || 0.012) && floor(x * 2) % 2 === (h * 977 & 1) && floor(y * 2) % 4 === (h * 3571 & 3)) { var tw = 0.35 + 0.3 * sin(t * 1.3 + h * 4000); o[0] = tw; o[1] = tw; o[2] = tw * 1.25; }
  }

  // a shader scene: fn(x, y, t, out, W, H) writes rgb into out
  function shader(C, R, fn, opts) {
    opts = opts || {};
    return function (canvas) {
      var o = [0, 0, 0], Wd = C, Hd = R * 2;
      return AC.run(canvas, C, R, function (g, t) {
        if (opts.pre) opts.pre(t, Wd, Hd);
        for (var j = 0; j < g.H; j++) for (var i = 0; i < g.W; i++) {
          o[0] = o[1] = o[2] = 0;
          fn((i + 0.5) / 2, (j + 0.5) / 2, t, o, Wd, Hd);
          if (o[0] + o[1] + o[2] > 0.03) g.px(i, j, o[0], o[1], o[2]);
        }
        if (opts.post) opts.post(g, t, Wd, Hd);
      }, opts);
    };
  }
  // a plotted scene with phosphor persistence: draw(plot, t, W, H, g)
  function plotter(C, R, draw, opts) {
    opts = opts || {};
    return function (canvas) {
      var keep = null, decay = opts.decay === undefined ? 0.86 : opts.decay;
      return AC.run(canvas, C, R, function (g, t) {
        if (!keep) keep = new Float32Array(g.buf.length);
        for (var k = 0; k < keep.length; k++) keep[k] *= decay;
        function plot(x, y, r, gg, b) {
          var i = floor(x * 2), j = floor(y * 2); if (i < 0 || j < 0 || i >= g.W || j >= g.H) return;
          var q = (j * g.W + i) * 3; keep[q] = min(1.6, keep[q] + r); keep[q + 1] = min(1.6, keep[q + 1] + gg); keep[q + 2] = min(1.6, keep[q + 2] + b);
        }
        plot.line = function (x0, y0, x1, y1, r, gg, b) { var n = Math.ceil(max(abs(x1 - x0), abs(y1 - y0)) * 2) || 1; for (var s = 0; s <= n; s++) plot(x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n, r, gg, b); };
        draw(plot, t, C, R * 2, g);
        g.buf.set(keep);
      }, opts);
    };
  }
  var S = {};

  /* ───────────────────────────── MUSIC ───────────────────────────── */

  // IN RAINBOWS: colour running down the page
  S.rainbows = shader(150, 40, function (x, y, t, o, W, H) {
    var col = floor(x / 2.5), len = H * (0.25 + 0.75 * AF.noise(col * 0.37, t * 0.12, 3)) + sin(t * 0.7 + col) * 3;
    var d = len - y, wob = abs(x / 2.5 - col - 0.5) * 2;
    if (d < 0 && hyp((x / 2.5 - col - 0.5) * 2.5, y - len) > 1.6) return;
    if (d > 0 && wob > 0.55 + 0.4 * AF.noise(col, y * 0.08 - t * 0.4, 5)) return;
    hsv(o, AF.noise(x * 0.012, 1, 9) * 1.4 + y * 0.004 + t * 0.02, 0.85, 0.35 + 0.75 * sm(H, 0, d) + (d < 2 ? 0.4 : 0));
  }, { stillAt: 3, fps: 15 });

  // PYRAMID: a stage made of light
  S.pyramid = shader(120, 46, function (x, y, t, o, W, H) {
    var cx = W / 2, top = 14, base = H - 6, v = (y - top) / (base - top), hw = v * 44, dx = x - cx;
    if (v < 0) {  // beams leaving the apex
      var a = Math.atan2(top - y, dx), beam = pow(max(0, sin(a * 14 + sin(t * 0.8) * 2)), 12) * exp(-hyp(dx, y - top) / 22);
      o[0] = beam * 0.9; o[1] = beam * 0.95; o[2] = beam * 1.1; return;
    }
    if (v > 1 || abs(dx) > hw) { if (y > base && y < base + 1.5 && abs(dx) < 54) { o[0] = 0.25; o[1] = 0.28; o[2] = 0.35; } return; }
    var rows = 9, r = floor(v * rows), fy = frac(v * rows), u = (dx + hw) / (2 * hw + 0.001), cells = r + 1, fx = frac(u * cells);
    var lineE = fy < 0.1 || fx < 0.06 || abs(dx) > hw - 0.7;
    var beat = frac(t * 2), lit = (floor(u * cells) + r + floor(t * 4)) % 3 === 0 ? 1 : 0.12;
    var sweep = exp(-pow((v - frac(t * 0.45)) * 7, 2));
    var I = lineE ? 0.9 : lit * (0.5 + 0.5 * (1 - beat)) + sweep * 0.7;
    hsv(o, 0.02 + r * 0.012 + sweep * 0.5, lineE ? 0.1 : 0.75, I);
  }, { stillAt: 2 });

  // SMOKE: one thread of it, the way a slow song feels
  S.smoke = shader(96, 50, function (x, y, t, o, W, H) {
    var cx = W / 2, by = H - 8, h = by - y;
    if (h < 0) { var e = hyp(x - cx, (y - by - 1) * 1.2); if (e < 1.3) { o[0] = 1.2; o[1] = 0.45; o[2] = 0.1; } else if (y > by && y < by + 2.2 && x > cx && x < cx + 16) { o[0] = 0.75; o[1] = 0.72; o[2] = 0.68; } return; }
    var spread = 0.6 + h * 0.11, drift = sin(h * 0.09 - t * 0.9) * h * 0.16 + sin(h * 0.04 + t * 0.4) * h * 0.1;
    var d = (x - cx - drift) / spread;
    var wisp = AF.fbm(x * 0.12 + sin(h * 0.1) * 2, h * 0.09 - t * 0.7, 4);
    var I = exp(-d * d * 1.6) * (0.25 + 1.1 * wisp) * sm(H, 8, h) * sm(0, 4, h + 2);
    if (abs(d) < 2.2) I += exp(-pow(abs(d) - 1.1, 2) * 9) * wisp * 0.35 * sm(H, 20, h);
    o[0] = I * 0.82; o[1] = I * 0.84; o[2] = I * 0.9;
  }, { stillAt: 3, fps: 18, glowAlpha: 0.5 });

  // HEAVEN OR LAS VEGAS v2: city light out of focus
  (function () {
    var rnd = AF.rng(11), L = [], HUE = [[1, 0.35, 0.72], [0.62, 0.48, 1], [1, 0.62, 0.3], [0.35, 0.95, 0.82]];
    for (var i = 0; i < 30; i++) L.push([rnd() * 150, 14 + rnd() * 66, 3.5 + rnd() * 8, HUE[floor(rnd() * 4)], rnd() * 6, (rnd() - 0.5) * 0.8]);
    S.bokeh = shader(150, 44, function (x, y, t, o) {
      for (var k = 0; k < L.length; k++) {
        var B = L[k], lx = (B[0] + t * B[5] + 300) % 150, d = hyp(x - lx, y - B[1]) / B[2];
        if (d > 1.08) continue;
        var a = (0.16 + 0.1 * sin(t * 0.6 + B[4])) * (sm(1.08, 0.94, d)) * (1 + 1.3 * sm(0.72, 0.98, d));
        o[0] += B[3][0] * a; o[1] += B[3][1] * a; o[2] += B[3][2] * a;
      }
    }, { stillAt: 2, fps: 15, glowAlpha: 0.9, bloom: 1.4 });
  })();

  // EQUALIZER
  S.equalizer = shader(150, 36, function (x, y, t, o, W, H) {
    var n = 50, k = floor(x / W * n), fx = frac(x / W * n); if (fx > 0.78) return;
    var f = k / n, lvl = (0.25 + 0.75 * pow(AF.noise(k * 0.31, t * 1.6, 2), 1.4)) * (1 - f * 0.45) * (0.75 + 0.25 * sin(t * 7.5 + k)) ;
    var hgt = (H - 6) * clamp(lvl, 0.04, 1), yy = H - 3 - y;
    var peak = (H - 6) * clamp((0.25 + 0.75 * pow(AF.noise(k * 0.31, floor(t * 1.6 * 2) / 2, 2), 1.4)) * (1 - f * 0.45) + 0.06, 0, 1);
    if (yy < 0) { if (yy > -2) { var rf = 0.1; o[0] = rf; o[1] = rf * 1.4; o[2] = rf * 1.3; } return; }
    if (abs(yy - peak) < 0.6) { o[0] = 1.1; o[1] = 1.05; o[2] = 1; return; }
    if (yy > hgt || frac(yy / 2.5) > 0.75) return;
    var u = yy / (H - 6); o[0] = mix(0, 1.1, u * u) ; o[1] = mix(0.8, 0.45, u); o[2] = mix(0.66, 0.15, u);
  }, { stillAt: 2 });

  /* ─────────────────────── FILM, SHOWS, PLACES ─────────────────────── */

  // SPIRITED AWAY: the train across the water
  S.train = shader(150, 44, function (x, y, t, o, W, H) {
    var hor = H * 0.6, tx = ((t * 3.2 + 85) % (W + 70)) - 50, refl = y > hor;
    var yy = refl ? hor - (y - hor) * 1.6 + sin(y * 1.3 + t * 2 + x * 0.2) * 0.5 : y, u = yy / hor;
    // dusk sky
    var r = mix(0.05, 0.95, pow(clamp(u, 0, 1), 2.4)), g = mix(0.08, 0.5, pow(clamp(u, 0, 1), 2.0)), b = mix(0.22, 0.42, pow(clamp(u, 0, 1), 1.2));
    var cl = AF.fbm(x * 0.03 + t * 0.01, yy * 0.11, 3); if (cl > 0.55 && u < 0.85) { var c = (cl - 0.55) * 2.2; r += c * 0.5; g += c * 0.28; b += c * 0.3; }
    // the train: two cars, lit windows, riding the horizon
    var lx = x - tx, ty = hor - yy;
    if (lx > 0 && lx < 40 && ty > 0.3 && ty < 5.2 && !(lx > 19 && lx < 21)) {
      r = 0.03; g = 0.03; b = 0.05;
      if (ty > 2.2 && ty < 4 && frac(lx / 3.2) > 0.3) { r = 1.25; g = 0.95; b = 0.5; }
      if (ty > 4.6) { r = 0.3; g = 0.1; b = 0.08; }
    }
    if (abs(x - 128) < 0.5 && ty > 0 && ty < 7) { r = 0.05; g = 0.05; b = 0.06; }
    if (hyp(x - 128, ty - 7.6) < 1) { r = 1.3; g = 0.4; b = 0.3; }
    if (abs(ty) < 0.35 && !refl) { r = 0.1; g = 0.1; b = 0.14; }
    var k = refl ? 0.55 * (0.8 + 0.2 * sin(y * 2.2 - t * 1.5 + x * 0.15)) : 1;
    o[0] = r * k * 0.8; o[1] = g * k * 0.8; o[2] = b * k * 0.85;
  }, { stillAt: 14, fps: 15, glowAlpha: 0.5 });

  // SEVERANCE: a corridor that goes on
  S.corridor = shader(150, 44, function (x, y, t, o, W, H) {
    var dx = x - W / 2, dy = y - H * 0.5, ew = 9, eh = 6.5, sx = abs(dx) / ew, sy = abs(dy) / eh, s = max(sx, sy);
    if (s < 1) { var door = abs(dx) < 3.4 && dy > -3.5; o[0] = door ? 0.02 : 0.2; o[1] = door ? 0.03 : 0.24; o[2] = door ? 0.03 : 0.22; if (door && hyp(dx - 2.4, dy - 1) < 0.5) { o[0] = 0.1; o[1] = 1.1; o[2] = 0.5; } return; }
    var z = 1 / s, along = s, wall = sx > sy, ceil = !wall && dy < 0;
    var light = 0.28 + 0.5 * pow(z, 0.6), seam = frac(along * 1.6) < 0.05 * along;
    if (ceil) { var panel = frac(along * 0.8 + 0.2) < 0.4 && abs(dx / along) < 3.4; var fl = 1 - (AF.hash(floor(along * 0.8 + 0.2), floor(t * 9), 3) > 0.985 ? 0.6 : 0); light = panel ? 1.25 * fl : light * 0.8; }
    else if (!wall) { light *= 0.75 + 0.5 * exp(-pow(dx / along / 3, 2)) * (0.6 + 0.4 * sin(along * 5.03 + 1.6)); }
    else if (frac(dy / along * 0.22 + 0.5) < 0.04) light *= 0.6;
    if (seam && !ceil) light *= 0.55;
    o[0] = light * 0.78; o[1] = light * 0.9; o[2] = light * 0.84;
  }, { stillAt: 2, fps: 12, glowAlpha: 0.45 });

  // FREEDOM: above the clouds, one bird
  S.clouds = shader(150, 44, function (x, y, t, o, W, H) {
    var u = y / H, r = mix(0.1, 0.95, pow(u, 1.8)), g = mix(0.28, 0.62, pow(u, 1.3)), b = mix(0.62, 0.5, u);
    var n = AF.fbm(x * 0.022 + t * 0.03, y * 0.05 + 3, 4), n2 = AF.fbm(x * 0.06 + t * 0.06, y * 0.14, 8);
    var den = sm(0.42, 0.75, n + n2 * 0.3 + (u - 0.55) * 0.5);
    var shade = sm(0.3, 0.7, AF.fbm(x * 0.022 + t * 0.03 + 0.25, y * 0.05 + 2.8, 4) + n2 * 0.3 + (u - 0.55) * 0.5);
    r = mix(r, mix(1.15, 0.6, shade * 0.8), den); g = mix(g, mix(1.0, 0.45, shade * 0.8), den); b = mix(b, mix(0.92, 0.55, shade * 0.8), den);
    // the bird: two strokes that open and close
    var bx = W * 0.5 + sin(t * 0.21) * 34, by = H * 0.3 + sin(t * 0.33) * 5, flap = sin(t * 5.5) * 0.6, lx = abs(x - bx), ly = y - by;
    if (lx < 5 && abs(ly + lx * flap - (lx * lx) * 0.06) < 0.5) { r = 0.03; g = 0.03; b = 0.06; }
    o[0] = r * 0.72; o[1] = g * 0.72; o[2] = b * 0.76;
  }, { stillAt: 4, fps: 12, glowAlpha: 0.35 });

  // ARRAKIS v2
  (function () {
    function hgt(x, l, t) { var u = x * (0.05 - l * 0.011) + l * 4.1 + t * 0.004 * (l + 1); return (0.5 + 0.5 * sin(u) + 0.3 * sin(u * 2.3 + 1.7) + 0.12 * sin(u * 5.3)) * (9 + l * 6); }
    S.dunes = shader(150, 44, function (x, y, t, o, W, H) {
      for (var l = 2; l >= 0; l--) {
        var top = H * (0.5 + l * 0.17) - hgt(x, l, t);
        if (y > top) {
          var slope = hgt(x + 0.7, l, t) - hgt(x - 0.7, l, t), d = y - top;
          var lit = clamp(0.5 + slope * 0.9, 0, 1) * exp(-d * 0.05) + 0.12, lee = slope < 0 ? sm(14, 0, d) * 0.5 : 0;
          var rip = 0.9 + 0.1 * sin(x * 1.6 + d * 2.2 + l * 3), near = 0.55 + l * 0.22, I = (lit - lee * 0.6) * rip * near;
          var crest = exp(-d * d * 0.6) * 0.5 * (slope > 0 ? 1 : 0.3);
          o[0] = I * 1.1 + crest; o[1] = I * 0.56 + crest * 0.8; o[2] = I * 0.24 + crest * 0.5; return;
        }
      }
      var u = y / (H * 0.6); o[0] = 0.05 + 0.5 * pow(u, 3); o[1] = 0.03 + 0.17 * pow(u, 3); o[2] = 0.09 + 0.1 * u;
      var m1 = hyp(x - 112, y - 14), m2 = hyp(x - 124, y - 8);
      if (m1 < 4.6) { var s1 = 1.15 - m1 * 0.06; o[0] = s1; o[1] = s1 * 0.93; o[2] = s1 * 0.8; } else if (m2 < 2.3) { o[0] = 0.8; o[1] = 0.72; o[2] = 0.62; }
      else if (u < 0.7) star(o, x, y, t, 0.01);
    }, { stillAt: 5, fps: 12, glowAlpha: 0.5 });
  })();

  // SHIP AT SEA
  S.ship = shader(150, 44, function (x, y, t, o, W, H) {
    var hor = H * 0.5, mx = 104, my = 15;
    var sx = 52 + sin(t * 0.2) * 3, bob = sin(t * 1.1) * 0.8, lx = x - sx, ly = y - (hor + 1.5 + bob), tilt = sin(t * 0.9) * 0.05; lx += ly * tilt;
    var hull = ly > -3 && ly < 0.6 && abs(lx) < 11 - (ly + 3) * 1.4 + (lx > 0 ? 2 : 0), mast = abs(lx) < 0.4 && ly > -19 && ly < -3;
    var sail = lx > 0.8 && ly < -4 && ly > -18 && lx < (ly + 18) * 0.62 + 0.8, jib = lx < -0.8 && ly < -4 && ly > -15 && -lx < (ly + 15) * 0.5 + 0.8;
    if (hull || mast) { o[0] = 0.05; o[1] = 0.05; o[2] = 0.07; if (hull && ly < -2.2) { o[0] = 0.45; o[1] = 0.2; o[2] = 0.1; } return; }
    if (sail || jib) { var sh = 0.55 + 0.3 * sm(-18, -4, ly) + (sail ? 0.12 : 0); o[0] = sh * 0.95; o[1] = sh * 0.9; o[2] = sh * 0.8; return; }
    if (hyp(lx + 9.5, ly + 4.2) < 0.6) { o[0] = 1.3; o[1] = 0.8; o[2] = 0.3; return; }
    if (y < hor) {
      var m = hyp(x - mx, y - my); if (m < 5) { var c = 1.1 - 0.25 * AF.noise(x * 0.5, y * 0.5, 2); o[0] = c; o[1] = c * 0.97; o[2] = c * 0.88; return; }
      var gl = exp(-m / 16) * 0.3; o[0] = 0.02 + gl * 0.8; o[1] = 0.04 + gl * 0.85; o[2] = 0.1 + gl; star(o, x, y, t, 0.014); if (m < 30 && o[0] > 0.3) { o[0] = 0.02 + gl * 0.8; o[1] = 0.04 + gl * 0.85; o[2] = 0.1 + gl; }
      return;
    }
    var d = y - hor, w = sin(x * 0.22 + t * 1.3 + d * 0.9) * 0.5 + sin(x * 0.09 - t * 0.7 + d * 0.5) * 0.5 + AF.noise(x * 0.3, d * 0.8 - t, 3) - 0.5;
    var path = exp(-pow((x - mx) / (3 + d * 0.55), 2)), gli = pow(max(0, w), 2) * path * 1.6 + pow(max(0, w), 3) * 0.14;
    o[0] = 0.02 + gli; o[1] = 0.05 + d * 0.0012 + gli * 0.97; o[2] = 0.11 + d * 0.002 + gli * 0.9;
  }, { stillAt: 3, fps: 15, glowAlpha: 0.6 });

  // AURORA
  S.aurora = shader(150, 44, function (x, y, t, o, W, H) {
    var mt = H - 7 - AF.fbm(x * 0.03, 2, 5) * 9 - (1 - abs(AF.noise(x * 0.08, 4, 6) * 2 - 1)) * 5;
    if (y > mt) { var sn = y - mt < 2.5 && AF.noise(x * 0.4, 1, 7) > 0.45; o[0] = sn ? 0.3 : 0.03; o[1] = sn ? 0.36 : 0.04; o[2] = sn ? 0.42 : 0.07; return; }
    for (var k = 0; k < 3; k++) {
      var base = 20 + k * 9 + sin(x * 0.045 + t * 0.2 + k * 2) * 7 + sin(x * 0.11 - t * 0.33 + k) * 2.5;
      var d = base - y; if (d < -1.5 || d > 34) continue;
      var ray = 0.55 + 0.45 * sin(x * 1.1 + sin(x * 0.07 + t * 0.4 + k) * 6 + k * 3), I = (d < 0 ? sm(-1.5, 0, d) : exp(-d / (9 + ray * 9))) * (0.3 + 0.7 * ray) * (0.75 - k * 0.15);
      var hi = sm(4, 28, d); o[0] += I * mix(0.08, 0.7, hi); o[1] += I * mix(1.0, 0.2, hi); o[2] += I * mix(0.55, 0.9, hi);
    }
    if (o[1] < 0.12) star(o, x, y, t, 0.016);
  }, { stillAt: 4, fps: 15, glowAlpha: 0.8 });

  // ECLIPSE
  S.eclipse = shader(110, 50, function (x, y, t, o, W, H) {
    var dx = x - W / 2, dy = y - H / 2, r = hyp(dx, dy), R0 = 17, a = Math.atan2(dy, dx);
    if (r < R0) { var e = sm(R0 - 1.2, R0, r) * 0.03; o[0] = e; o[1] = e; o[2] = e; return; }
    var streak = 0.5 + 0.5 * pow(abs(sin(a * 3 + 0.6 + sin(t * 0.1) * 0.2)), 1.5) + 0.35 * AF.noise(a * 9, r * 0.05 - t * 0.25, 3);
    var I = exp(-(r - R0) / (5 + 13 * streak * streak * 0.6)) * (0.55 + 0.6 * streak) + exp(-pow((r - R0) / 0.7, 2)) * 0.9;
    var bead = exp(-(pow(dx - cos(-0.7) * R0, 2) + pow(dy - sin(-0.7) * R0, 2)) / 3.2) * (1.6 + 0.3 * sin(t * 2));
    o[0] = I * 1.0 + bead; o[1] = I * 0.93 + bead; o[2] = I * 0.86 + bead * 0.95;
    if (I < 0.1) star(o, x, y, t, 0.012);
  }, { stillAt: 2, fps: 15, bloom: 1.3 });

  // PALE BLUE DOT
  S.paleDot = shader(150, 40, function (x, y, t, o, W, H) {
    var u = (x * 0.8 + y * 0.6) / 14, beams = [[2.2, 1.4, [0.55, 0.32, 0.2]], [4.4, 0.9, [0.3, 0.42, 0.3]], [6.3, 1.7, [0.5, 0.36, 0.26]], [8.6, 0.8, [0.3, 0.3, 0.46]]];
    for (var k = 0; k < 4; k++) { var B = beams[k], I = exp(-pow((u - B[0]) / B[1], 2) * 2) * (0.55 + 0.12 * AF.noise(x * 0.4, y * 0.4 + t * 0.2, k)); o[0] += B[2][0] * I; o[1] += B[2][1] * I; o[2] += B[2][2] * I; }
    var g = AF.hash(floor(x * 2), floor(y * 2), floor(t * 6)) * 0.035; o[0] += g; o[1] += g; o[2] += g;
    if (hyp(x - 96.25, y - 33.25) < 0.36) { var p = 1.25 + 0.2 * sin(t * 1.4); o[0] = 0.6 * p; o[1] = 0.8 * p; o[2] = 1.1 * p; }
  }, { stillAt: 2, fps: 10, glowAlpha: 0.5 });

  /* ───────────────────────── TECH AND MATHS ───────────────────────── */

  // GPU: three fans and a strip of light
  S.gpu = shader(150, 34, function (x, y, t, o, W, H) {
    var x0 = 8, x1 = W - 8, y0 = 14, y1 = H - 12;
    if (x < x0 || x > x1 || y < y0 - 3 || y > y1 + 4) return;
    if (y < y0) { hsv(o, x / W * 0.8 + t * 0.12, 0.85, y > y0 - 2 ? 1.1 : 0.25); return; }
    if (y > y1) { if (y < y1 + 2.2 && frac(x / 1.2) < 0.55 && x > x0 + 6 && x < x1 - 30) { o[0] = 0.85; o[1] = 0.65; o[2] = 0.2; } return; }
    var R0 = (y1 - y0) / 2 - 2.5, best = 1e9, bx = 0, k;
    for (k = 0; k < 3; k++) { var fx = x0 + (x1 - x0) * (0.2 + k * 0.3); var d = hyp(x - fx, y - (y0 + y1) / 2); if (d < best) { best = d; bx = fx; } }
    var r = best / R0, shroud = 0.13 + 0.05 * AF.noise(x * 0.5, y * 0.5, 2) + (abs(frac((x + y) / 9) - 0.5) < 0.04 ? 0.12 : 0);
    if (r > 1.06) { o[0] = shroud; o[1] = shroud * 1.05; o[2] = shroud * 1.2; return; }
    if (r > 0.98) { hsv(o, (bx / W) * 0.8 + t * 0.12, 0.8, 0.9); return; }
    if (r < 0.2) { var hb = 0.3 + 0.3 * (1 - r * 5); o[0] = hb; o[1] = hb; o[2] = hb * 1.15; return; }
    var a = Math.atan2(y - (y0 + y1) / 2, x - bx) + t * 9 * (bx > W / 2 + 10 || bx < W / 2 - 10 ? 1 : -1) + r * 1.4, bl = frac(a * 9 / TAU);
    if (bl < 0.62) { var sh = 0.35 + 0.9 * bl; o[0] = sh * 0.6; o[1] = sh * 0.66; o[2] = sh * 0.8; } else { o[0] = 0.05; o[1] = 0.05; o[2] = 0.07; }
  }, { stillAt: 1 });

  // JULIA: a shape that never stops changing its mind
  S.julia = shader(110, 50, function (x, y, t, o, W, H) {
    var zx = (x - W / 2) / 30, zy = (y - H / 2) / 30, a = t * 0.13, cx = 0.7885 * cos(a), cy = 0.7885 * sin(a), n = 0, m2 = 0;
    for (; n < 36; n++) { var xx = zx * zx - zy * zy + cx; zy = 2 * zx * zy + cy; zx = xx; m2 = zx * zx + zy * zy; if (m2 > 16) break; }
    if (n >= 36) { o[0] = 0.02; o[1] = 0.05; o[2] = 0.05; return; }
    var s = (n + 1 - Math.log(Math.log(m2) * 0.5) / 0.693) / 36, k = pow(clamp(s, 0, 1), 0.6);
    o[0] = mix(0, 1.15, sm(0.35, 1, k)); o[1] = mix(0.0, 0.8, sm(0, 0.5, k)) * mix(1, 0.6, sm(0.5, 1, k)); o[2] = mix(0.0, 0.65, sm(0, 0.45, k)) * mix(1, 0.25, sm(0.4, 1, k));
  }, { stillAt: 6, fps: 12 });

  // DONUT: the old terminal classic, lit properly
  S.donut = shader(90, 46, function (x, y, t, o, W, H) {
    var ux = (x - W / 2) / 21, uy = (y - H / 2) / 21; if (ux * ux + uy * uy > 2.9) return;
    var ca = cos(t * 0.7), sa = sin(t * 0.7), cb = cos(t * 0.45), sb = sin(t * 0.45), z = -3, d = 0, px, py, pz, i;
    function sdf(X, Y, Z) { var y1 = Y * ca - Z * sa, z1 = Y * sa + Z * ca, x1 = X * cb - z1 * sb, z2 = X * sb + z1 * cb; var q = hyp(x1, z2) - 1.05; return hyp(q, y1) - 0.48; }
    for (i = 0; i < 28; i++) { d = sdf(ux, uy, z); if (d < 0.01) break; z += d; if (z > 3) return; }
    if (d >= 0.02) return;
    var e = 0.01, nx = sdf(ux + e, uy, z) - d, ny = sdf(ux, uy + e, z) - d, nz = sdf(ux, uy, z + e) - d, nl = hyp(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    var dif = max(0, nx * -0.5 + ny * -0.6 + nz * -0.62), sp = pow(max(0, nx * -0.27 + ny * -0.33 + nz * -0.9), 30), rim = pow(1 + nz, 2) * 0.35;
    o[0] = 0.1 + dif * 1.0 + sp + rim * 0.0; o[1] = 0.03 + dif * 0.42 + sp * 0.9 + rim * 0.75; o[2] = 0.02 + dif * 0.2 + sp * 0.8 + rim * 0.6;
  }, { stillAt: 2, fps: 15 });

  // TUNNEL
  S.tunnel = shader(120, 46, function (x, y, t, o, W, H) {
    var dx = x - W / 2 - sin(t * 0.4) * 6, dy = y - H / 2 - cos(t * 0.3) * 3, r = hyp(dx, dy) + 0.001, a = Math.atan2(dy, dx);
    var z = 18 / r + t * 1.6, ring = frac(z), spoke = frac(a / TAU * 12 + sin(z * 0.5) * 0.3), edge = min(ring, 1 - ring) < 0.07 || min(spoke, 1 - spoke) < 0.035;
    var fade = clamp(r / 26, 0, 1), cell = (floor(z) + floor(a / TAU * 12 + sin(z * 0.5) * 0.3)) % 2 === 0;
    var I = (edge ? 1.1 : cell ? 0.26 : 0.07) * pow(fade, 1.2); var T = floor(z) % 4 === 0 ? ORANGE : TEAL;
    o[0] = T[0] * I + (edge ? 0.15 * I : 0); o[1] = T[1] * I + (edge ? 0.15 * I : 0); o[2] = T[2] * I + (edge ? 0.15 * I : 0);
  }, { stillAt: 2, fps: 18 });

  /* ───────────────────── OBJECTS AND SYMBOLS ───────────────────── */

  // YIN YANG v2
  S.yinyang = shader(96, 48, function (x, y, t, o, W, H) {
    var dx = x - W / 2, dy = y - H / 2, RR = 38 * (1 + 0.02 * sin(t * 0.9)), d = hyp(dx, dy);
    if (d > RR) { var gl = exp(-(d - RR) / 2.2) * 0.55; o[0] = 0; o[1] = gl * 0.83; o[2] = gl * 0.67; return; }
    var rot = t * 0.15, px = dx * cos(rot) + dy * sin(rot), py = -dx * sin(rot) + dy * cos(rot);
    px += sin(py / RR * 5 + t * 0.7) * RR * 0.03;
    var h = RR / 2, dT = hyp(px, py + h), dB = hyp(px, py - h), light = dT < h ? true : dB < h ? false : px > 0;
    var nz = Math.sqrt(1 - d * d / (RR * RR)), sh = 0.6 + 0.45 * clamp((-dx * 0.5 - dy * 0.6) / RR + nz * 0.5, 0, 1);
    if (dT < RR / 7.5) light = false; else if (dB < RR / 7.5) { o[0] = 1.15 * sh; o[1] = 0.48 * sh; o[2] = 0.22 * sh; return; }
    if (light) { o[0] = 0.98 * sh; o[1] = 0.95 * sh; o[2] = 0.86 * sh; }
    else { var tx = 0.1 + 0.05 * AF.fbm(px * 0.12, py * 0.12 + t * 0.1, 3); o[0] = tx * sh * 0.9; o[1] = tx * sh; o[2] = tx * sh * 1.35; }
  }, { stillAt: 2, fps: 15 });

  // 808s v2
  S.heart = shader(96, 48, function (x, y, t, o, W, H) {
    var beat = 1 + 0.05 * pow(max(0, sin(t * 2.2)), 8) + 0.03 * pow(max(0, sin(t * 2.2 - 0.5)), 8);
    var sep = 0.5 + 2.6 * pow(max(0, sin(t * 0.4)), 2), wx = x - W / 2, wy = y - H / 2 + 2;
    for (var side = -1; side <= 1; side += 2) {
      var lx = wx - side * sep, ly = wy - (side > 0 ? sep * 0.4 : 0), hx = lx / (30 * beat), hy = -ly / (30 * beat) + 0.12;
      var crack = 0.045 * (abs(frac(hy * 3.3) - 0.5) * 4 - 1); if ((hx - crack) * side < 0) continue;
      var a = hx * hx + hy * hy * 1.15 - 1, f = a * a * a - hx * hx * hy * hy * hy * 1.25; if (f >= 0) continue;
      var e = 0.01, a2 = (hx + e) * (hx + e) + hy * hy * 1.15 - 1, gx = (a2 * a2 * a2 - (hx + e) * (hx + e) * hy * hy * hy * 1.25 - f) / e;
      var a3 = hx * hx + (hy + e) * (hy + e) * 1.15 - 1, gy = (a3 * a3 * a3 - hx * hx * pow(hy + e, 3) * 1.25 - f) / e;
      var depth = clamp(-f * 5, 0, 1), gl = hyp(gx, gy) || 1, nxx = gx / gl * (1 - depth), nyy = -gy / gl * (1 - depth), nz = Math.sqrt(max(0, 1 - nxx * nxx - nyy * nyy));
      var dif = max(0, nxx * -0.45 + nyy * -0.6 + nz * 0.66), sp = pow(max(0, nxx * -0.25 + nyy * -0.35 + nz * 0.9), 26);
      var hot = abs(hx - crack) < 0.03 ? sm(2.2, 0.6, sep) : 0;
      o[0] = 0.28 + dif * 0.95 + sp * 0.7 + hot; o[1] = 0.03 + dif * 0.3 + sp * 0.7 + hot; o[2] = 0.08 + dif * 0.38 + sp * 0.7 + hot; return;
    }
  }, { stillAt: 2 });

  // WATCH: shows your actual time
  S.watch = shader(90, 48, function (x, y, t, o, W, H) {
    var dx = x - W / 2, dy = y - H / 2, r = hyp(dx, dy), R0 = 30;
    if (r > R0 + 4.5) {
      if (abs(dx) < 15 - max(0, (abs(dy) - 38)) * 0.3 && abs(dy) > R0) { var st = 0.13 + 0.05 * (frac(dy / 3) < 0.5 ? 1 : 0) + 0.06 * (1 - abs(dx) / 15); o[0] = st * 1.3; o[1] = st * 0.8; o[2] = st * 0.5; }
      else if (dx > R0 + 4 && dx < R0 + 7.5 && abs(dy) < 2.6) { o[0] = 0.6; o[1] = 0.62; o[2] = 0.68; }
      return;
    }
    if (r > R0) { var bz = 0.35 + 0.55 * pow(abs(sin(Math.atan2(dy, dx) * 1 + 2.2)), 3) + (r > R0 + 3.6 || r < R0 + 0.6 ? -0.15 : 0); o[0] = bz * 0.85; o[1] = bz * 0.88; o[2] = bz * 0.95; return; }
    var a = Math.atan2(dx, -dy); if (a < 0) a += TAU;
    var hr = S.watch.h, mn = S.watch.m, sc = S.watch.s;
    o[0] = 0.035; o[1] = 0.045; o[2] = 0.07 + 0.03 * (1 - r / R0);
    var tick = frac(a / TAU * 12 + 0.5) - 0.5, tk5 = frac(a / TAU * 60 + 0.5) - 0.5;
    if (r > R0 * 0.8 && r < R0 * 0.93 && abs(tick) * TAU / 12 * r < 0.75) { o[0] = 0.2; o[1] = 1.05; o[2] = 0.85; }
    else if (r > R0 * 0.88 && r < R0 * 0.93 && abs(tk5) * TAU / 60 * r < 0.3) { o[0] = 0.5; o[1] = 0.52; o[2] = 0.58; }
    function hand(ang, len, wid, tail) { var d = a - ang; d = Math.atan2(sin(d), cos(d)); var along = cos(d) * r, across = abs(sin(d)) * r; return along > -tail && along < len && across < wid * (1 - 0.5 * max(0, along) / len); }
    if (hand(hr, R0 * 0.52, 1.5, 2)) { o[0] = 0.95; o[1] = 0.96; o[2] = 1; }
    if (hand(mn, R0 * 0.8, 1.1, 2)) { o[0] = 0.95; o[1] = 0.96; o[2] = 1; }
    if (hand(sc, R0 * 0.86, 0.5, 6)) { o[0] = 1.25; o[1] = 0.45; o[2] = 0.18; }
    if (r < 1.6) { o[0] = 1.2; o[1] = 0.5; o[2] = 0.2; }
    var glare = exp(-pow((dx + dy) / 9 + 1.6, 2)) * 0.07; o[0] += glare; o[1] += glare; o[2] += glare;
  }, { stillAt: 1, pre: function () { var d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60; S.watch.s = s / 60 * TAU; S.watch.m = m / 60 * TAU; S.watch.h = h / 12 * TAU; } });

  // LAVA LAMP
  S.lava = shader(96, 50, function (x, y, t, o, W, H) {
    var f = 0, fo = 0, gx = 0, gy = 0;
    for (var k = 0; k < 7; k++) {
      var bx = W / 2 + sin(t * (0.21 + k * 0.05) + k * 2.1) * 26, by = H / 2 + sin(t * (0.17 + k * 0.04) + k * 1.3) * 38, rr = 8 + (k % 3) * 2.5;
      var dx = x - bx, dy = y - by, d2 = dx * dx + dy * dy + 0.01, v = rr * rr / d2; f += v; if (k % 2) fo += v; gx += dx * v / d2; gy += dy * v / d2;
    }
    if (f < 1) { var gl = sm(0.45, 1, f) * 0.18; o[0] = gl; o[1] = gl * 0.5; o[2] = gl * 0.35; return; }
    var gl2 = hyp(gx, gy) || 1, edge = clamp((f - 1) * 1.3, 0, 1), nx = gx / gl2 * (1 - edge), ny = gy / gl2 * (1 - edge), nz = Math.sqrt(max(0, 1 - nx * nx - ny * ny));
    var dif = max(0, nx * -0.4 + ny * -0.6 + nz * 0.7), sp = pow(max(0, nx * -0.2 + ny * -0.35 + nz * 0.92), 30), w = clamp(fo / f, 0, 1);
    o[0] = mix(0.0, 1.05, w) * (0.3 + dif * 0.8) + sp * 0.8; o[1] = mix(0.85, 0.4, w) * (0.3 + dif * 0.8) + sp * 0.8; o[2] = mix(0.68, 0.16, w) * (0.3 + dif * 0.8) + sp * 0.8;
  }, { stillAt: 3, fps: 15 });

  // GALAXY
  S.galaxy = shader(120, 50, function (x, y, t, o, W, H) {
    var dx = x - W / 2, dy = (y - H / 2) / 0.55, tl = 0.35, rx = dx * cos(tl) + dy * sin(tl), ry = -dx * sin(tl) + dy * cos(tl), r = hyp(rx, ry) + 0.01, a = Math.atan2(ry, rx);
    var arm = pow(0.5 + 0.5 * cos(2 * (a - Math.log(r) * 2.6 - t * 0.08)), 3), fall = exp(-r / 26), core = exp(-r * r / 28);
    var dust = AF.fbm(rx * 0.12 + 3, ry * 0.12, 4), grain = AF.hash(floor(x * 2), floor(y * 2), 3) < 0.25 * arm * fall + 0.01 ? 1 : 0.35;
    var I = (arm * (0.35 + 0.9 * dust) * fall * 1.5) * grain;
    o[0] = I * 0.45 + core * 1.3; o[1] = I * 0.68 + core * 1.05; o[2] = I * 1.0 + core * 0.75;
    var knot = arm > 0.7 && AF.hash(floor(x), floor(y), 9) < 0.03 * fall * 3; if (knot) { o[0] += 0.9; o[1] += 0.3; o[2] += 0.45; }
    if (o[0] + o[1] + o[2] < 0.06) star(o, x, y, t, 0.01);
  }, { stillAt: 3, fps: 12 });

  // RINGS: a sound leaving
  S.rings = shader(96, 46, function (x, y, t, o, W, H) {
    var r = hyp(x - W / 2, y - H / 2), I = 0;
    for (var k = 0; k < 4; k++) { var age = frac(t / 5 + k / 4), rad = age * 46, w = 0.5 + age * 1.6; I += exp(-pow((r - rad) / w, 2)) * pow(1 - age, 1.6); }
    var c = exp(-r * r / 3) * (0.8 + 0.4 * sin(t * 2.5));
    o[0] = I * 0.25 + c * 1.2; o[1] = I * 0.95 + c * 0.5; o[2] = I * 0.8 + c * 0.2;
  }, { stillAt: 2, fps: 18 });

  // WALEED, poured full of moving colour
  (function () {
    var F = { W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'], A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
      E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'] }, WORD = 'WALEED';
    S.name = shader(150, 32, function (x, y, t, o, W, H) {
      var px = 3.4, py = 6.4, x0 = (W - (WORD.length * 6 - 1) * px) / 2, y0 = (H - 7 * py) / 2, cxp = (x - x0) / px, cyp = (y - y0) / py;
      if (cxp < 0 || cyp < 0 || cyp >= 7) return; var li = floor(cxp / 6), c = floor(cxp) - li * 6; if (li >= WORD.length || c > 4) return;
      if (F[WORD.charAt(li)][floor(cyp)].charAt(c) !== '#') return;
      var n = AF.fbm(x * 0.035 + t * 0.12, y * 0.05 - t * 0.07, 3), n2 = AF.fbm(x * 0.05 - t * 0.09, y * 0.07 + 5, 8), k = sm(0.35, 0.65, n);
      var sheen = pow(max(0, sin((x + y) * 0.18 - t * 1.2)), 14) * 0.5, v = 0.6 + 0.55 * n2;
      o[0] = mix(ORANGE[0], TEAL[0], k) * v + sheen; o[1] = mix(ORANGE[1], TEAL[1], k) * v + sheen; o[2] = mix(ORANGE[2], TEAL[2], k) * v + sheen;
    }, { stillAt: 2, fps: 15 });
  })();

  /* ─────────────────────────── PLOTTED ─────────────────────────── */

  // OSCILLOSCOPE
  S.scope = plotter(120, 44, function (plot, t, W, H) {
    var a = 3 + sin(t * 0.07) * 0.02, b = 2, ph = t * 0.35;
    for (var k = 0; k < 900; k++) { var s = t * 3 + k * 0.012; plot(W / 2 + sin(a * s + ph) * 44 * (0.85 + 0.15 * sin(s * 0.31)), H / 2 + sin(b * s) * 34, 0.02, 0.2, 0.14); }
    for (var x = 0; x < W; x += 10) for (var y = 2; y < H; y += 2) plot(x + 5, y, 0.004, 0.012, 0.012);
    for (var yy = 4; yy < H; yy += 10) for (var xx = 0; xx < W; xx += 1.5) plot(xx, yy, 0.004, 0.012, 0.012);
  }, { decay: 0.8, stillAt: 2 });

  // LORENZ: two wings, one path, never the same twice
  (function () {
    var P = [], x = 0.1, y = 0, z = 0, i;
    for (i = 0; i < 5200; i++) { var dt = 0.006, dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - 8 / 3 * z; x += dx * dt; y += dy * dt; z += dz * dt; if (i > 200) P.push([x, y, z - 25]); }
    S.lorenz = plotter(110, 50, function (plot, t, W, H) {
      var c = cos(t * 0.25), s = sin(t * 0.25), head = floor(t * 160) % P.length;
      for (var k = 0; k < P.length; k += 2) {
        var p = P[k], rx = p[0] * c - p[1] * s, rz = p[0] * s + p[1] * c, dep = 0.55 + rz * 0.012, w = p[0] > 0 ? 1 : 0;
        plot(W / 2 + rx * 2.5, H / 2 - p[2] * 1.9, (w ? 0.3 : 0.0) * dep, (w ? 0.13 : 0.25) * dep, (w ? 0.06 : 0.2) * dep);
      }
      for (var h = 0; h < 30; h++) { var q = P[(head - h * 3 + P.length) % P.length], hx = q[0] * c - q[1] * s; plot(W / 2 + hx * 2.5, H / 2 - q[2] * 1.9, 0.9, 0.9, 0.85); }
    }, { decay: 0.55, stillAt: 3 });
  })();

  // DNA
  S.dna = plotter(150, 40, function (plot, t, W, H) {
    for (var x = 0; x < W; x += 0.25) {
      var a = x * 0.13 + t * 0.9, y1 = H / 2 + sin(a) * 26, y2 = H / 2 - sin(a) * 26, d1 = cos(a), th = 1.2;
      if (floor(x * 4) % 14 === 0) { var steps = 50; for (var k = 0; k <= steps; k++) { var u = k / steps, yy = mix(y1, y2, u), cc = u < 0.5 ? ORANGE : TEAL, br = 0.14 * (0.5 + 0.5 * abs(d1)); plot(x, yy, cc[0] * br, cc[1] * br, cc[2] * br); } }
      for (var w = -th; w <= th; w += 0.5) { var b1 = 0.22 + 0.5 * (d1 + 1) / 2, b2 = 0.22 + 0.5 * (1 - d1) / 2; plot(x, y1 + w, ORANGE[0] * b1, ORANGE[1] * b1, ORANGE[2] * b1); plot(x, y2 + w, TEAL[0] * b2, TEAL[1] * b2, TEAL[2] * b2); }
    }
  }, { decay: 0, stillAt: 2 });

  // WARP
  (function () {
    var ST = [], rnd = AF.rng(3); for (var i = 0; i < 260; i++) ST.push([rnd() * TAU, rnd(), 0.3 + rnd() * 0.9, rnd()]);
    S.warp = plotter(120, 44, function (plot, t, W, H) {
      for (var k = 0; k < ST.length; k++) {
        var s = ST[k], z = frac(s[1] + t * 0.22 * s[2]), r0 = pow(z, 2.4) * 80, r1 = pow(max(0, z - 0.035), 2.4) * 80, b = 0.15 + z * 0.9, c = s[3] < 0.15 ? ORANGE : s[3] < 0.3 ? TEAL : [0.8, 0.85, 1];
        plot.line(W / 2 + cos(s[0]) * r1, H / 2 + sin(s[0]) * r1, W / 2 + cos(s[0]) * r0, H / 2 + sin(s[0]) * r0, c[0] * b * 0.4, c[1] * b * 0.4, c[2] * b * 0.4);
      }
    }, { decay: 0.5, stillAt: 2 });
  })();

  // LIFE: Conway's game, coloured by how long each cell has lived
  S.life = function (canvas) {
    var GW = 120, GH = 88, A = new Uint16Array(GW * GH), B = new Uint16Array(GW * GH), last = -1, gen = 0;
    function seed() { for (var i = 0; i < A.length; i++) A[i] = Math.random() < 0.28 ? 1 : 0; gen = 0; }
    seed();
    return AC.run(canvas, 120, 44, function (g, t) {
      var step = floor(t / 0.11);
      if (step !== last) {
        last = step; var alive = 0;
        for (var y = 0; y < GH; y++) for (var x = 0; x < GW; x++) {
          var n = 0; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if (dx || dy) n += A[((y + dy + GH) % GH) * GW + (x + dx + GW) % GW] ? 1 : 0;
          var a = A[y * GW + x]; B[y * GW + x] = a ? (n === 2 || n === 3 ? min(a + 1, 999) : 0) : (n === 3 ? 1 : 0); if (B[y * GW + x]) alive++;
        }
        var T = A; A = B; B = T; if (++gen > 420 || alive < 200) seed();
      }
      for (var j = 0; j < g.H; j++) for (var i = 0; i < g.W; i++) {
        var age = A[floor(j / 2) * GW + floor(i / 2)]; if (!age) continue;
        var k = sm(1, 14, age), v = age === 1 ? 1.3 : 0.95 - k * 0.35;
        g.px(i, j, mix(1, 0, k) * v, mix(0.5, 0.8, k) * v, mix(0.2, 0.66, k) * v, 0);
      }
    }, { stillAt: 2, fps: 12 });
  };

  // CIRCUIT: signals finding their way out from the chip
  (function () {
    var rnd = AF.rng(21), TR = [], cx = 75, cy = 40, CW = 13, CH = 9, side, n;
    for (side = 0; side < 4; side++) for (n = 0; n < 9; n++) {
      var horiz = side < 2, sgn = side % 2 ? 1 : -1, off = (n - 4) * (horiz ? 2 : 2.8);
      var p = horiz ? [cx + sgn * CW, cy + off] : [cx + off, cy + sgn * CH], pts = [p.slice()], dir = horiz ? [sgn, 0] : [0, sgn];
      for (var seg = 0; seg < 4; seg++) {
        var len = 4 + rnd() * (horiz ? 16 : 8), d = dir;
        if (seg % 2) d = horiz ? [sgn * 0.7, (off >= 0 ? 0.7 : -0.7)] : [(off >= 0 ? 0.7 : -0.7), sgn * 0.7];
        p = [p[0] + d[0] * len, p[1] + d[1] * len]; pts.push(p.slice());
      }
      TR.push({ pts: pts, ph: rnd(), sp: 0.25 + rnd() * 0.3 });
    }
    S.circuit = plotter(150, 40, function (plot, t, W, H) {
      for (var k = 0; k < TR.length; k++) {
        var T = TR[k], total = 0, i, L = [];
        for (i = 0; i < T.pts.length - 1; i++) { var l = hyp(T.pts[i + 1][0] - T.pts[i][0], T.pts[i + 1][1] - T.pts[i][1]); L.push(l); total += l; plot.line(T.pts[i][0], T.pts[i][1], T.pts[i + 1][0], T.pts[i + 1][1], 0.0, 0.16, 0.13); }
        var e = T.pts[T.pts.length - 1]; plot(e[0], e[1], 0.5, 0.55, 0.5); plot(e[0] + 0.5, e[1], 0.5, 0.55, 0.5); plot(e[0], e[1] + 0.5, 0.5, 0.55, 0.5); plot(e[0] + 0.5, e[1] + 0.5, 0.5, 0.55, 0.5);
        var u = frac(t * T.sp + T.ph) * total * 1.4;
        for (i = 0; i < L.length; i++) { if (u <= L[i]) { var f = u / L[i]; for (var q = 0; q < 3; q++) plot(mix(T.pts[i][0], T.pts[i + 1][0], f) + (q & 1) * 0.5, mix(T.pts[i][1], T.pts[i + 1][1], f) + (q >> 1) * 0.5, 1.3, 0.6, 0.25); break; } u -= L[i]; }
      }
      for (var y = cy - CH; y <= cy + CH; y += 0.5) for (var x = cx - CW; x <= cx + CW; x += 0.5) { var ed = abs(x - cx) > CW - 0.8 || abs(y - cy) > CH - 0.8; plot(x, y, ed ? 0.3 : 0.05, ed ? 0.32 : 0.06, ed ? 0.38 : 0.08); }
      var pulse = 0.5 + 0.5 * sin(t * 3); for (var a = 0; a < TAU; a += 0.2) plot(cx + cos(a) * 3, cy + sin(a) * 3, 1.0 * pulse, 0.45 * pulse, 0.2 * pulse);
    }, { decay: 0, stillAt: 2 });
  })();

  // CURRENTS: free will v2, the one orange point in a field of teal ones
  (function () {
    var PT = [], rnd = AF.rng(2); for (var i = 0; i < 420; i++) PT.push([rnd() * 150, rnd() * 88]);
    S.currents = plotter(150, 44, function (plot, t, W, H) {
      for (var k = 0; k < PT.length; k++) {
        var p = PT[k], a = AF.fbm(p[0] * 0.018, p[1] * 0.018 + t * 0.03, 5) * TAU * 2;
        if (k === 0) a += sin(t * 0.5) * 1.6;                        // this one leans its own way
        p[0] += cos(a) * 0.55; p[1] += sin(a) * 0.55;
        if (p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) { p[0] = rnd() * W; p[1] = rnd() * H; }
        if (k === 0) { for (var q = 0; q < 4; q++) plot(p[0] + (q & 1) * 0.5, p[1] + (q >> 1) * 0.5, 1.2, 0.5, 0.2); } else plot(p[0], p[1], 0.0, 0.2, 0.17);
      }
    }, { decay: 0.94, stillAt: 3, fps: 20 });
  })();

  // ROOTS: what grows up, and what it grows out of
  S.roots = plotter(110, 50, function (plot, t, W, H) {
    var cyc = t % 12, grow = sm(0, 7, cyc), fade = 1 - sm(10, 12, cyc), gy = H * 0.48, seed = floor(t / 12) * 17;
    function branch(x, y, a, len, w, depth, col, id) {
      var reach = clamp(grow * 6.5 - depth, 0, 1); if (reach <= 0 || depth > 6) return;
      var x1 = x + cos(a) * len * reach, y1 = y + sin(a) * len * reach, b = (0.1 + 0.12 * w) * fade;
      for (var q = -w; q <= w; q += 0.5) plot.line(x + q * sin(a) * 0.5, y - q * cos(a) * 0.5, x1 + q * sin(a) * 0.5, y1 - q * cos(a) * 0.5, col[0] * b, col[1] * b, col[2] * b);
      if (reach < 1) return;
      var r1 = AF.hash(id, depth, seed), r2 = AF.hash(id, depth, seed + 5);
      branch(x1, y1, a - 0.35 - r1 * 0.4, len * (0.68 + r2 * 0.12), w * 0.62, depth + 1, col, id * 2 + 1);
      branch(x1, y1, a + 0.3 + r2 * 0.45, len * (0.66 + r1 * 0.14), w * 0.62, depth + 1, col, id * 2 + 2);
    }
    branch(W / 2, gy, -PI / 2, 13, 2.2, 0, [0.75, 1.0, 0.9], 1);
    branch(W / 2, gy, PI / 2, 12, 2.2, 0, [1.0, 0.45, 0.2], 3);
    for (var x = 8; x < W - 8; x += 0.5) plot(x, gy, 0.1 * fade, 0.1 * fade, 0.12 * fade);
  }, { decay: 0, stillAt: 8 });

  global.LabBatch = S;
})(window);
