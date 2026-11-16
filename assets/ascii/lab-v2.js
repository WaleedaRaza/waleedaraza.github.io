/* ═══════════════════════════════════════════════════════════════════════
   LAB V2: showpieces on the v2 renderer (ascii-canvas.js).
   LabV2.<name>(canvas) -> { toggle(), g }
   World units: a cell is 1 x 2; sub-pixel (i, j) sits at ((i+.5)/2, (j+.5)/2).
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var AF = global.AsciiField, AC = global.AsciiCanvas;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(e0, e1, v) { var t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function frac(v) { return v - Math.floor(v); }
  function mix(a, b, u) { return a + (b - a) * u; }
  function stars(g, t, seed, dens) {
    for (var y = 0; y < g.rows; y++) for (var x = 0; x < g.cols; x++) {
      var h = AF.hash(x, y, seed);
      if (h < dens) { var tw = 0.35 + 0.3 * Math.sin(t * 1.3 + h * 4000), big = h < dens * 0.25; g.px(x * 2 + (h * 977 & 1), y * 4 + (h * 3571 & 3), tw * (big ? 1.4 : 0.8), tw * (big ? 1.4 : 0.8), tw * (big ? 1.6 : 1), 1); }
    }
  }

  /* ── GARGANTUA: the disc, and the far side of it bent up over the top ── */
  function gargantua(canvas) {
    var C = 150, R = 46;
    function fill(g, t) {
      stars(g, t, 5, 0.012);
      var cx = C / 2, cy = R - 1, RS = 13.5, K = 0.17, RIN = 17, ROUT = 62;
      for (var j = 0; j < g.H; j++) for (var i = 0; i < g.W; i++) {
        var dx = (i + 0.5) / 2 - cx, dy = (j + 0.5) / 2 - cy, r = Math.hypot(dx, dy);
        var cr = 0, cg = 0, cb = 0, hit = false;
        // the halo: light from the far side of the disc, wrapped round the shadow
        if (r > RS && r < RS + 34) {
          var a = Math.atan2(dy, dx), up = dy < 0 ? 1 : 0.5;
          var w = dy < 0 ? 5.5 : 2.6, h = Math.exp(-(r - RS) / w) * up;
          var st = 0.65 + 0.35 * Math.sin(a * 9 + Math.log(r) * 16 - t * 1.4) * Math.sin(a * 4 - t * 0.5);
          var dop = 1 + 0.55 * Math.cos(a - Math.PI);                // the side turning toward us is brighter
          var ring = Math.exp(-Math.pow((r - RS - 0.5) / 0.55, 2)) * 1.1;
          var I = (h * st * 1.25 + ring) * dop;
          if (I > 0.02) { cr += I * 1.0; cg += I * (0.5 + 0.35 * h); cb += I * (0.16 + 0.3 * h * h); hit = true; }
        }
        // the disc itself, nearly edge-on; the near half crosses in front of the shadow
        if (dy > ROUT * K || dy < -ROUT * K) { if (hit) g.px(i, j, cr, cg, cb); continue; }
        var v = dy / K, rd = Math.hypot(dx, v);
        if (rd > RIN && rd < ROUT && (dy > 0 || r > RS)) {
          var ad = Math.atan2(v, dx);
          var fall = Math.pow(1 - (rd - RIN) / (ROUT - RIN), 1.6) * smooth(RIN, RIN + 2.5, rd);
          var st2 = 0.55 + 0.45 * Math.sin(ad * 5 + Math.log(rd) * 12 - t * 0.9) * Math.sin(ad * 11 - Math.log(rd) * 20 - t * 1.6);
          var dop2 = 1 + 0.6 * Math.cos(ad - Math.PI);
          var thick = Math.exp(-Math.pow(dy / (1.2 + rd * 0.035), 2) * 0.0);
          var I2 = fall * st2 * dop2 * 1.5 * thick;
          var hot = clamp(1 - (rd - RIN) / 22, 0, 1);
          cr += I2 * 1.0; cg += I2 * mix(0.38, 0.86, hot); cb += I2 * mix(0.1, 0.6, hot * hot); hit = true;
        }
        if (hit) g.px(i, j, cr, cg, cb);
      }
    }
    return AC.run(canvas, C, R, fill, { stillAt: 3, fps: 20, ramp: ' .,:;~=+*x#%@' });
  }

  /* ── SEVEN-STAR BALL, as glass ── */
  function ball(canvas) {
    var C = 96, R = 48, SR = 34;
    var S3 = [[0, 0, 0]], q;
    for (q = 0; q < 6; q++) S3.push([Math.cos(q / 6 * 6.283 + 0.5) * 0.46, Math.sin(q / 6 * 6.283 + 0.5) * 0.46, (q % 2 ? 0.12 : -0.12)]);
    function fill(g, t) {
      var cx = C / 2, cy = R - 2 + Math.sin(t * 1.1) * 1.2, yaw = Math.sin(t * 0.3) * 0.7, cyw = Math.cos(yaw), syw = Math.sin(yaw);
      var P = [];
      for (q = 0; q < 7; q++) { var s = S3[q]; P.push([s[0] * cyw + s[2] * syw, s[1], -s[0] * syw + s[2] * cyw]); }
      for (var j = 0; j < g.H; j++) for (var i = 0; i < g.W; i++) {
        var dx = ((i + 0.5) / 2 - cx) / SR, dy = ((j + 0.5) / 2 - cy) / SR, d2 = dx * dx + dy * dy;
        if (d2 > 1) {
          // light that has passed through the ball, pooled underneath it
          var fx = dx * 0.9 - 0.12, fy = (dy - 1.22) * 3.2, fl = Math.exp(-(fx * fx + fy * fy) * 3);
          if (fl > 0.05) g.px(i, j, fl * 0.9, fl * 0.42, fl * 0.08);
          continue;
        }
        var nz = Math.sqrt(1 - d2);
        // glass glows brightest on the side away from the light
        var through = clamp(0.5 + 0.55 * (dx * 0.55 + dy * 0.75), 0, 1);
        var fres = Math.pow(1 - nz, 2.2);
        var cr = 0.55 + 0.5 * through + fres * 0.3, cg = 0.2 + 0.52 * through * through + fres * 0.25, cb = 0.02 + 0.16 * through * through * through + fres * 0.1;
        // stars float inside; the glass magnifies them toward the middle
        var mx = dx * (0.78 + 0.22 * nz), my = dy * (0.78 + 0.22 * nz);
        for (q = 0; q < 7; q++) {
          var sx = mx - P[q][0], sy = my - P[q][1], sd = Math.hypot(sx, sy);
          if (sd > 0.17) continue;
          var sa = Math.atan2(sy, sx) + Math.PI / 2, k = Math.abs(frac(sa / 1.2566) - 0.5) * 2;
          var rad = 0.155 * (1 - 0.58 * k) * (1 + P[q][2] * 0.35);
          if (sd < rad) { var e = sd / rad; cr = 0.86 - e * 0.2; cg = 0.07 + (1 - e) * 0.08; cb = 0.06; }
        }
        var hs = Math.hypot(dx + 0.4, dy + 0.44);
        var spec = Math.exp(-hs * hs * 90) * 1.6 + Math.exp(-Math.pow(Math.hypot(dx + 0.34, dy + 0.38), 2) * 9) * 0.22;
        var win = (dx > -0.62 && dx < -0.18 && dy > -0.72 && dy < -0.5 && nz > 0.3) ? 0.16 : 0;
        g.px(i, j, cr * 0.82 + spec + win, cg * 0.82 + spec + win, cb * 0.82 + spec + win);
      }
    }
    return AC.run(canvas, C, R, fill, { stillAt: 2, ramp: ' .:;=+*x#%@@' });
  }

  /* ── HELMET: chrome that actually reflects, a road in the visor ── */
  function helmet(canvas) {
    var C = 96, R = 50;
    function env(rx, ry, rz, t) {
      // what the chrome sees: dusk above, a hot band at the horizon, dark road below, two strip lights
      var cr, cg, cb;
      if (ry < -0.02) { var u = clamp(-ry, 0, 1); cr = mix(1.0, 0.05, Math.pow(u, 0.45)); cg = mix(0.45, 0.1, Math.pow(u, 0.4)); cb = mix(0.22, 0.24, Math.pow(u, 0.6)); }
      else { var d = clamp(ry * 2.2, 0, 1); cr = mix(0.5, 0.03, Math.pow(d, 0.35)); cg = mix(0.2, 0.035, Math.pow(d, 0.35)); cb = mix(0.12, 0.05, Math.pow(d, 0.35)); }
      var strip = Math.exp(-Math.pow((rx - 0.55 * Math.sin(t * 0.5)) * 7, 2)) * (ry < 0 ? 1 : 0.25);
      var strip2 = Math.exp(-Math.pow((rx + 0.75) * 9, 2)) * 0.5 * (ry < 0.1 ? 1 : 0.2);
      var teal = Math.exp(-Math.pow((rx - 0.8) * 5, 2)) * 0.5;
      return [cr + strip * 1.2 + strip2, cg + strip * 1.2 + strip2 + teal * 0.8, cb + strip * 1.25 + strip2 + teal * 0.65];
    }
    function fill(g, t) {
      var cx = C / 2, cy = R + 1, HW = 31, HH = 41;
      var vy = cy + 4, VH = 10.5, VW = 26;
      for (var j = 0; j < g.H; j++) for (var i = 0; i < g.W; i++) {
        var wx = (i + 0.5) / 2, wy = (j + 0.5) / 2, dx = wx - cx, dy = wy - cy;
        var sx = dx / HW, sy = dy / HH * (dy > 0 ? 1.12 : 1);
        var f = Math.pow(Math.abs(sx), 2.5) + Math.pow(Math.abs(sy), 2.5);
        if (f > 1) continue;
        var inVis = Math.pow(Math.abs(dx / VW), 5) + Math.pow(Math.abs((wy - vy) / VH), 5) < 1;
        if (inVis) {
          var hor = vy - 2.5, cr, cg, cb;
          if (wy < hor) {
            var up = (hor - wy) / 8, sd = Math.hypot(dx, (wy - hor) * 1.1);
            cr = mix(1.0, 0.16, Math.pow(up, 0.6)); cg = mix(0.42, 0.05, Math.pow(up, 0.5)); cb = mix(0.2, 0.3, Math.pow(up, 0.8));
            if (sd < 4.6) { var band = frac(wy * 0.9) < 0.72 || wy < hor - 2.6; if (band) { cr = 1.25; cg = 0.78; cb = 0.35; } }
          } else {
            var depth = (wy - hor) + 0.25, lx = dx / depth, z = 7 / depth;
            var edge = Math.abs(Math.abs(lx) - 2.3) < 0.1 + 0.02 * depth, mid = Math.abs(lx) < 0.07 + 0.006 * depth && frac(z + t * 1.6) < 0.5;
            var grid = Math.abs(lx) > 2.3 && (frac(z + t * 1.6) < 0.08 || frac(lx * 0.8) < 0.06);
            cr = 0.035; cg = 0.035; cb = 0.05;
            if (edge) { cr = 0.0; cg = 0.95; cb = 0.78; } else if (mid) { cr = 1.1; cg = 0.9; cb = 0.35; } else if (grid) { cr = 0.55; cg = 0.12; cb = 0.4; }
            var fade = clamp(depth / 2.2, 0.25, 1); cr *= fade; cg *= fade; cb *= fade;
            var glowH = Math.exp(-(wy - hor) * 0.9) * 0.5; cr += glowH; cg += glowH * 0.4; cb += glowH * 0.2;
          }
          var sweep = Math.exp(-Math.pow((dx * 0.8 + (wy - vy)) / 3 - Math.sin(t * 0.5) * 6, 2)) * 0.12;
          g.px(i, j, cr + sweep, cg + sweep, cb + sweep, 1);
          continue;
        }
        // the shell: a rounded normal, mirrored into the surroundings
        var nz = Math.sqrt(Math.max(0, 1 - Math.pow(f, 0.8))), nx = sx * 0.95, ny = sy * 0.95;
        var nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        var rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1;
        var e = env(rx, ry, rz, t), fres = Math.pow(1 - nz, 3) * 0.5;
        var rim = Math.abs(Math.pow(Math.abs(dx / (VW + 1.6)), 5) + Math.pow(Math.abs((wy - vy) / (VH + 1.6)), 5) - 1) < 0.25 ? 0.45 : 1;
        g.px(i, j, (e[0] * 0.9 + fres) * rim, (e[1] * 0.9 + fres) * rim, (e[2] * 0.95 + fres) * rim);
      }
    }
    return AC.run(canvas, C, R, fill, { stillAt: 2, ramp: ' .:;=+*x#%@@' });
  }

  /* ── SEXTAPE v2: under the surface ── */
  function underwater(canvas) {
    var C = 150, R = 46;
    var bub = [], rnd = AF.rng(8);
    for (var b = 0; b < 30; b++) bub.push([rnd() * C, rnd() * 80, 0.5 + rnd() * 1.2, rnd() * 6]);
    function caustic(x, y, t) {
      // folded ripples: warp the plane a few times, then keep only the thin seams
      var px = x, py = y;
      for (var n = 1; n <= 3; n++) {
        var qx = px + Math.sin(py * 1.3 + t * (0.6 + n * 0.17) + n) * 0.75;
        var qy = py + Math.cos(px * 1.1 - t * (0.5 + n * 0.13) + n * 2) * 0.75;
        px = qx; py = qy;
      }
      var v = 1 - Math.abs(Math.sin(px * 1.6) + Math.sin(py * 1.6)) * 0.5;
      return Math.pow(v, 7);
    }
    function fill(g, t) {
      var HT = R * 2;
      for (var j = 0; j < g.H; j++) {
        var wy = (j + 0.5) / 2, depth = wy / HT;
        for (var i = 0; i < g.W; i++) {
          var wx = (i + 0.5) / 2;
          var surf = 3.5 + Math.sin(wx * 0.12 + t * 0.8) * 1.2 + Math.sin(wx * 0.05 - t * 0.45) * 1.4;
          if (wy < surf) { var sv = 0.5 + 0.5 * Math.sin(wx * 0.5 + wy * 1.4 + t * 2); g.px(i, j, 0.25 + sv * 0.3, 0.5 + sv * 0.3, 0.6 + sv * 0.25); continue; }
          var sx = wx - wy * 0.42 + Math.sin(t * 0.25) * 5;
          var ray = Math.pow(clamp(AF.noise(sx * 0.07, t * 0.12, 3) * 1.5 - 0.35, 0, 1), 2) * Math.pow(1 - depth, 1.3);
          var cz = (depth < 0.45 || depth > 0.74) ? caustic(wx * 0.2, wy * 0.26, t * 0.7) : 0;
          var cTop = cz * Math.pow(clamp(1 - depth * 2.3, 0, 1), 1.3) * 0.55, cFloor = cz * smooth(0.76, 0.98, depth) * 0.6;
          var base = 0.04 + 0.2 * Math.pow(1 - depth, 2);
          var v = base + ray * 0.5 + cTop + cFloor;
          var sand = smooth(0.9, 1, depth + AF.noise(wx * 0.05, 1, 9) * 0.06) * 0.12;
          g.px(i, j, v * 0.16 + cFloor * 0.5 + sand * 0.9, v * 0.62 + cTop * 0.3 + cFloor * 0.4 + sand * 0.8, v * 0.8 + sand * 0.5 + 0.03);
        }
      }
      for (var k = 0; k < bub.length; k++) {
        var B = bub[k], yy = HT + 4 - ((t * B[2] * 4 + B[1]) % (HT + 8)), xx = B[0] + Math.sin(t * 1.4 + B[3]) * 1.2;
        var bi = Math.floor(xx * 2), bj = Math.floor(yy * 2);
        g.px(bi, bj, 1.2, 1.3, 1.3, 1); g.px(bi + 1, bj, 0.9, 1.1, 1.1, 1); if (B[2] > 1.2) { g.px(bi, bj + 1, 0.8, 1, 1, 1); g.px(bi + 1, bj + 1, 0.7, 0.9, 0.9, 1); }
      }
    }
    return AC.run(canvas, C, R, fill, { stillAt: 3, fps: 18, ramp: ' .,:;~=+*x#%@', glowAlpha: 0.6 });
  }


  /* ── WARMPOP v2: two dragons with lit, scaled bodies round a fire ── */
  function dragons(canvas) {
    var C = 150, R = 50, W = C * 2, H = R * 4, WH = R * 2, N = 110, ORBIT = 34, SZ = W * H;
    var PAL = {
      o: { base: [1.0, 0.38, 0.12], dark: [0.42, 0.08, 0.02], hi: [1.0, 0.86, 0.55], belly: [1.0, 0.74, 0.42], fin: [0.95, 0.2, 0.05] },
      t: { base: [0.0, 0.78, 0.62], dark: [0.0, 0.22, 0.2], hi: [0.8, 1.0, 0.95], belly: [0.62, 1.0, 0.88], fin: [0.0, 0.55, 0.6] }
    };
    function layer() { return { r: new Float32Array(SZ), g: new Float32Array(SZ), b: new Float32Array(SZ), dep: new Float32Array(SZ), on: new Uint8Array(SZ), edge: new Uint8Array(SZ) }; }
    var LY = [layer(), layer()];
    var bn = new Float32Array(SZ), bs = new Float32Array(SZ), bex = new Float32Array(SZ), bey = new Float32Array(SZ), bdep = new Float32Array(SZ), bsd = new Int8Array(SZ);
    var LX = -0.45, LYY = -0.65, LZ = 0.61;                          // light: upper left, toward the viewer
    var HX = -0.26, HY = -0.37, HZ = 0.89;                           // half vector for the highlight
    var cx = C / 2, cy = WH * 0.5;

    function spine(t, phase) {
      var pts = [], a0 = t * Math.PI * 2 / ORBIT + phase, tilt = phase ? -0.2 : 0.2, co = Math.cos(tilt), so = Math.sin(tilt);
      for (var i = 0; i < N; i++) {
        var s = i / (N - 1), ang = a0 - s * 2.35;
        var rx = 52 - (phase ? 7 : 0), ry = 24;
        var lift = Math.sin(ang * 2 + t * 0.4 + phase) * 4.5, wave = Math.sin(s * 13 - t * 2.2 + phase) * (0.8 + 2.8 * s);
        var ox = Math.cos(ang), oy = Math.sin(ang), nl = Math.hypot(ox / rx, oy / ry), nx = ox / rx / nl, ny = oy / ry / nl;
        var ex0 = ox * rx + nx * wave, ey0 = oy * ry + lift + ny * wave, depth = Math.sin(ang);
        pts.push({ x: cx + ex0 * co - ey0 * so, y: cy + ex0 * so + ey0 * co, depth: depth, sc: 1 + 0.25 * depth, s: s, nx: nx * co - ny * so, ny: nx * so + ny * co });
      }
      return pts;
    }
    function radius(s) { return s < 0.18 ? 3.3 + (s / 0.18) * 1.3 : 4.6 * Math.pow((1 - s) / 0.82, 0.8) + 0.25; }

    function put(Ly, j, r, g, b, dep, edge) { Ly.r[j] = r; Ly.g[j] = g; Ly.b[j] = b; Ly.dep[j] = dep; Ly.on[j] = 1; Ly.edge[j] = edge ? 1 : 0; }

    // a tapered round tube through world points [x, y, radius], lit as a cylinder
    function tube(Ly, pts, col, hi, dep, gain) {
      for (var k = 0; k < pts.length - 1; k++) {
        var p = pts[k], q = pts[k + 1], rr = Math.max(p[2], q[2]);
        var i0 = Math.max(0, Math.floor((Math.min(p[0], q[0]) - rr) * 2)), i1 = Math.min(W - 1, Math.ceil((Math.max(p[0], q[0]) + rr) * 2));
        var j0 = Math.max(0, Math.floor((Math.min(p[1], q[1]) - rr) * 2)), j1 = Math.min(H - 1, Math.ceil((Math.max(p[1], q[1]) + rr) * 2));
        var sx = q[0] - p[0], sy = q[1] - p[1], sl = sx * sx + sy * sy || 1;
        for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
          var wx = (i + 0.5) / 2, wy = (j + 0.5) / 2;
          var u = clamp(((wx - p[0]) * sx + (wy - p[1]) * sy) / sl, 0, 1);
          var ex = wx - (p[0] + sx * u), ey = wy - (p[1] + sy * u), d = Math.hypot(ex, ey), r = p[2] + (q[2] - p[2]) * u;
          if (d > r || d > Math.max(r, 0.36)) { if (!(r < 0.36 && d < 0.36)) continue; }
          var n = Math.min(1, d / Math.max(r, 0.36)), z = Math.sqrt(1 - n * n), nxx = d ? ex / d * n : 0, nyy = d ? ey / d * n : 0;
          var diff = Math.max(0, nxx * LX + nyy * LYY + z * LZ), sp = Math.pow(Math.max(0, nxx * HX + nyy * HY + z * HZ), 20);
          var a = (0.3 + 0.8 * diff) * gain;
          put(Ly, j * W + i, col[0] * a + hi[0] * sp * 0.7, col[1] * a + hi[1] * sp * 0.7, col[2] * a + hi[2] * sp * 0.7, dep, n > 0.75);
        }
      }
    }

    function body(Ly, pts, P, t) {
      bn.fill(9);
      for (var k = 0; k < N - 1; k++) {
        var p = pts[k], q = pts[k + 1], r = radius(p.s) * p.sc, reach = r * 1.75 + 1;
        var i0 = Math.max(0, Math.floor((Math.min(p.x, q.x) - reach) * 2)), i1 = Math.min(W - 1, Math.ceil((Math.max(p.x, q.x) + reach) * 2));
        var j0 = Math.max(0, Math.floor((Math.min(p.y, q.y) - reach) * 2)), j1 = Math.min(H - 1, Math.ceil((Math.max(p.y, q.y) + reach) * 2));
        var sx = q.x - p.x, sy = q.y - p.y, sl = sx * sx + sy * sy || 1;
        for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
          var wx = (i + 0.5) / 2, wy = (j + 0.5) / 2;
          var u = clamp(((wx - p.x) * sx + (wy - p.y) * sy) / sl, 0, 1);
          var ex = wx - (p.x + sx * u), ey = wy - (p.y + sy * u), d = Math.hypot(ex, ey), n = d / r, o = j * W + i;
          if (n < bn[o]) { bn[o] = n; bs[o] = p.s + u / (N - 1); bex[o] = d ? ex / d : 0; bey[o] = d ? ey / d : 0; bdep[o] = p.depth; bsd[o] = (ex * p.nx + ey * p.ny) > 0 ? 1 : -1; }
        }
      }
      for (var o2 = 0; o2 < SZ; o2++) {
        var n2 = bn[o2]; if (n2 > 2.8) continue;
        var s = bs[o2], side = bsd[o2], dep = bdep[o2], dim = 0.72 + 0.28 * (dep + 1) / 2;
        if (n2 < 1) {
          var z = Math.sqrt(1 - n2 * n2), nx = bex[o2] * n2, ny = bey[o2] * n2;
          var diff = Math.max(0, nx * LX + ny * LYY + z * LZ), sp = Math.pow(Math.max(0, nx * HX + ny * HY + z * HZ), 26);
          var across = side * n2, cr, cg, cb;
          if (across < -0.42) {                      // belly plates
            var plate = frac(s * 95), pl = 0.75 + 0.25 * smooth(0.0, 0.25, plate) * smooth(1, 0.8, plate);
            var a = (0.28 + 0.8 * diff) * pl * dim;
            cr = P.belly[0] * a; cg = P.belly[1] * a; cb = P.belly[2] * a;
          } else {                                    // overlapping scales, offset row by row
            var v = across * 2.6 + 4, row = Math.floor(v), uu = frac(s * 58 + (row & 1) * 0.5 - t * 0.0), vv = frac(v);
            var e = Math.max(Math.abs(uu - 0.5) * 2, Math.abs(vv - 0.5) * 2), shade = 1 - 0.42 * smooth(0.55, 1, e), tip = smooth(0.5, 0.0, uu) * 0.12;
            var a2 = (0.2 + 0.9 * diff) * shade * dim;
            cr = mix(P.dark[0], P.base[0], a2) + P.hi[0] * (sp * 0.85 + tip * diff);
            cg = mix(P.dark[1], P.base[1], a2) + P.hi[1] * (sp * 0.85 + tip * diff);
            cb = mix(P.dark[2], P.base[2], a2) + P.hi[2] * (sp * 0.85 + tip * diff);
            cr *= 0.35 + 0.65 * Math.min(1, a2 + 0.35); cg *= 0.35 + 0.65 * Math.min(1, a2 + 0.35); cb *= 0.35 + 0.65 * Math.min(1, a2 + 0.35);
          }
          put(Ly, o2, cr, cg, cb, dep, n2 > 0.8);
        } else if (side > 0 && s > 0.02 && s < 0.9) {  // dorsal fins: a row of swept spines, glowing at the root
          var f = frac(s * 34), fh = (1 - f * 0.9) * 0.75 * (1 - s * 0.55), hgt = n2 - 1;
          if (hgt < fh) { var gl = (1 - hgt / fh) * dim; put(Ly, o2, P.fin[0] * (0.35 + 0.8 * gl), P.fin[1] * (0.35 + 0.8 * gl) + 0.1 * gl, P.fin[2] * (0.35 + 0.8 * gl), dep - 0.01, false); }
        } else if (s >= 0.88) {                        // tail plume
          var pl2 = (s - 0.88) / 0.12 * 1.7 * (0.55 + 0.6 * AF.noise(s * 60 - t * 3, side * n2 * 3, 4));
          if (n2 - 1 < pl2) { var gg = 1 - (n2 - 1) / pl2; put(Ly, o2, P.hi[0] * gg * 0.9, P.hi[1] * gg * 0.75, P.hi[2] * gg * 0.6, dep, false); }
        }
      }
    }

    function legs(Ly, pts, P, t, far) {
      [0.2, 0.52].forEach(function (ls, li) {
        var k = Math.round(ls * (N - 1)) + (far ? 3 : 0), p = pts[k], q = pts[k + 3];
        var tx = q.x - p.x, ty = q.y - p.y, tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;      // toward the tail
        var r = radius(ls) * p.sc, sw = Math.sin(t * 2.2 + li * 2.4 + (far ? 1.6 : 0)) * 0.6;
        var hip = [p.x - p.nx * r * 0.55, p.y - p.ny * r * 0.55];
        var knee = [hip[0] - p.nx * 3.6 * p.sc + tx * (1.2 + sw) * p.sc, hip[1] - p.ny * 3.6 * p.sc + ty * (1.2 + sw) * p.sc];
        var foot = [knee[0] - p.nx * 2.2 * p.sc - tx * (2.6 - sw) * p.sc, knee[1] - p.ny * 2.2 * p.sc - ty * (2.6 - sw) * p.sc];
        var gain = far ? 0.45 : 1, col = far ? P.dark : P.base, dep = p.depth + (far ? -0.03 : 0.02);
        tube(Ly, [[hip[0], hip[1], 1.7 * p.sc], [knee[0], knee[1], 1.15 * p.sc], [foot[0], foot[1], 0.8 * p.sc]], col, P.hi, dep, gain);
        for (var c = -1; c <= 1; c++) {
          var ca = Math.atan2(-p.ny - ty * 0.8, -p.nx - tx * 0.8) + c * 0.55;
          tube(Ly, [[foot[0], foot[1], 0.55 * p.sc], [foot[0] + Math.cos(ca) * 2.2 * p.sc, foot[1] + Math.sin(ca) * 2.2 * p.sc, 0.12]], P.hi, P.hi, dep, gain * 0.9);
        }
      });
    }

    function head(Ly, pts, P, t, key) {
      var p = pts[0], q = pts[5], sc = p.sc * 1.5;
      var tx = p.x - q.x, ty = p.y - q.y, tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      var nx = -ty, ny = tx; if (nx * p.nx + ny * p.ny < 0) { nx = -nx; ny = -ny; }
      var dep = p.depth + 0.06, dim = 0.72 + 0.28 * (p.depth + 1) / 2;
      function Wd(a, b) { return [p.x + (tx * a + nx * b) * sc, p.y + (ty * a + ny * b) * sc]; }
      var jaw = 0.18 + 0.5 * Math.pow(Math.max(0, Math.sin(t * 0.7 + (key === 'o' ? 0 : 2))), 3);
      // mane first, so the skull sits over it
      var reach = 15 * sc;
      var i0 = Math.max(0, Math.floor((p.x - reach) * 2)), i1 = Math.min(W - 1, Math.ceil((p.x + reach) * 2));
      var j0 = Math.max(0, Math.floor((p.y - reach) * 2)), j1 = Math.min(H - 1, Math.ceil((p.y + reach) * 2));
      for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
        var wx = (i + 0.5) / 2 - p.x, wy = (j + 0.5) / 2 - p.y;
        var a = (wx * tx + wy * ty) / sc, b = (wx * nx + wy * ny) / sc, o = j * W + i;
        var cr = -1, cg = 0, cb = 0, edge = false;
        function blob(ca, cb2, ra, rb, lift) {     // shaded ellipsoid; returns light or -1
          var u = (a - ca) / ra, v = (b - cb2) / rb, e = u * u + v * v;
          if (e > 1) return -1;
          var z = Math.sqrt(1 - e), lx = u * tx + v * nx, ly = u * ty + v * ny;
          edge = e > 0.72;
          return Math.max(0, lx * LX + ly * LYY + z * LZ) * 0.9 + 0.22 + (lift || 0) + Math.pow(Math.max(0, lx * HX + ly * HY + z * HZ), 22) * 0.8;
        }
        var L;
        // lower jaw, hinged open
        L = blob(4.4, -1.75 - jaw * 2.0, 4.0, 0.95);
        if (L >= 0) { cr = P.base[0] * L * 0.85; cg = P.base[1] * L * 0.85; cb = P.base[2] * L * 0.85; }
        // inside of the mouth
        if (a > 1.6 && a < 8.6 && b < -0.7 && b > -1.6 - jaw * 2.0 && cr < 0) { cr = 0.45; cg = 0.03; cb = 0.05; }
        // skull and snout
        var L1 = blob(0.9, 0.55, 4.7, 3.5), e1 = edge, L2 = blob(5.9, 0.25, 4.2, 2.05), e2 = edge;
        L = Math.max(L1, L2); edge = L1 >= L2 ? e1 : e2;
        if (L >= 0) {
          var m = Math.min(1, L);
          cr = mix(P.dark[0], P.base[0], m) + P.hi[0] * Math.max(0, L - 0.95); cg = mix(P.dark[1], P.base[1], m) + P.hi[1] * Math.max(0, L - 0.95); cb = mix(P.dark[2], P.base[2], m) + P.hi[2] * Math.max(0, L - 0.95);
          // brow ridge and cheek plates
          if (Math.pow((a - 2.9) / 2.2, 2) + Math.pow((b - 2.75) / 0.6, 2) < 1) { cr *= 0.5; cg *= 0.5; cb *= 0.5; }
          var ed = Math.hypot(a - 2.9, (b - 1.55) * 1.25);
          if (ed < 1.0) { if (Math.abs(a - 2.95) < 0.2) { cr = 0.02; cg = 0.02; cb = 0.02; } else { var yb = 1.5 - ed * 0.5; cr = 1.3 * yb; cg = 1.15 * yb; cb = 0.45 * yb; } }
          else if (ed < 1.3) { cr *= 0.35; cg *= 0.35; cb *= 0.35; }
          if (Math.hypot(a - 8.9, b - 1.1) < 0.45) { cr *= 0.2; cg *= 0.2; cb *= 0.2; }
          // upper teeth along the lip
          if (b < -1.2 && a > 3.2 && a < 9.4 && frac(a * 0.85) < 0.42) { cr = 1.1; cg = 1.05; cb = 0.92; }
        } else if (cr < 0 || (b > -1.75 && b < -0.9)) {
          // lower teeth, standing up from the jaw
          var jb = -1.0 - jaw * 2.0;
          if (a > 3.4 && a < 8 && b > jb - 0.15 && b < jb + 0.55 && frac(a * 0.85 + 0.5) < 0.4) { cr = 1.05; cg = 1.0; cb = 0.88; }
        }
        if (cr < 0) {
          // mane: flame-like strands streaming back from the skull
          if (a < 1.5 && a > -9) {
            var fl = AF.noise(a * 0.55 + t * 2.4, b * 1.5 + (key === 'o' ? 0 : 7), 6) - 0.34 - Math.abs(b - 0.6) * 0.09 - (-a) * 0.045;
            if (fl > 0) { var gm = Math.min(1, fl * 4); put(Ly, o, mix(P.fin[0], P.hi[0], gm) * (0.5 + gm * 0.6) * dim, mix(P.fin[1], P.hi[1], gm) * (0.5 + gm * 0.6) * dim, mix(P.fin[2], P.hi[2], gm) * (0.5 + gm * 0.6) * dim, dep - 0.02, false); }
          }
          continue;
        }
        put(Ly, o, cr * dim, cg * dim, cb * dim, dep, edge);
      }
      // horns: two tapered, back-swept
      function chain(fn, n) { var out = []; for (var k = 0; k <= n; k++) { var c = fn(k / n), w = Wd(c[0], c[1]); out.push([w[0], w[1], c[2] * sc]); } return out; }
      var bone = [P.hi[0] * 0.9, P.hi[1] * 0.85, P.hi[2] * 0.75];
      tube(Ly, chain(function (u) { return [0.2 - u * 7.5, 3.3 + u * 3.2 + Math.sin(u * 3) * 1.0, 0.95 * (1 - u) + 0.12]; }, 10), bone, P.hi, dep + 0.01, dim);
      tube(Ly, chain(function (u) { return [1.4 - u * 5.0, 3.5 + u * 4.6, 0.75 * (1 - u) + 0.1]; }, 8), bone, P.hi, dep + 0.01, dim * 0.8);
      // whiskers: long, slow, trailing
      for (var wsk = -1; wsk <= 1; wsk += 2) {
        tube(Ly, chain(function (u) { return [9.0 - u * 15 + (wsk < 0 ? -0.5 : 0), (wsk > 0 ? 0.9 : -0.9) + wsk * u * 4.2 + Math.sin(u * 5 - t * 2.6 + wsk) * 1.5 * u, 0.42 * (1 - u * 0.85)]; }, 22), P.hi, P.hi, dep + 0.02, dim * 0.95);
      }
    }

    function fill(g, t) {
      var d = [spine(t, 0), spine(t, Math.PI)], keys = ['o', 't'];
      for (var li = 0; li < 2; li++) {
        var Ly = LY[li], P = PAL[keys[li]];
        Ly.on.fill(0);
        legs(Ly, d[li], P, t, true);
        body(Ly, d[li], P, t);
        legs(Ly, d[li], P, t, false);
        head(Ly, d[li], P, t, keys[li]);
      }
      var A0 = LY[0], B0 = LY[1], fcx = cx, fcy = cy + 26;
      for (var j = 0; j < H; j++) {
        var wy = (j + 0.5) / 2;
        for (var i = 0; i < W; i++) {
          var o = j * W + i, a = A0.on[o], b = B0.on[o], wx = (i + 0.5) / 2;
          // firelight on whatever is near the middle
          var fd = Math.hypot(wx - fcx, (wy - fcy + 6) * 1.3), warm = Math.exp(-fd * fd / 900) * (0.75 + 0.25 * Math.sin(t * 9 + Math.sin(t * 3.7) * 2));
          if (a || b) {
            var F = a && b ? (A0.dep[o] >= B0.dep[o] ? A0 : B0) : (a ? A0 : B0);
            var r = F.r[o], gg = F.g[o], bb = F.b[o];
            if (a && b && F.edge[o]) { r = r * 0.4 + 1.1; gg = gg * 0.4 + 1.05; bb = bb * 0.4 + 0.95; }     // where they cross, white
            g.px(i, j, r * 0.84 + warm * 0.16, gg * 0.84 + warm * 0.07, bb * 0.84 + warm * 0.02);
            continue;
          }
          // the fire
          var fx = (wx - fcx) / 6, fy = (fcy - wy) / 19;
          if (fy > -0.05 && fy < 1.2 && Math.abs(fx) < 1.6) {
            var fl = AF.noise(wx * 0.42, wy * 0.3 + t * 4.2, 2) * 0.8 + AF.noise(wx * 0.9, wy * 0.6 + t * 6, 3) * 0.35 - Math.abs(fx) * (0.55 + fy * 0.9) - fy * 0.62 + 0.2;
            if (fl > 0) { var q = Math.min(1, fl * 3.2); g.px(i, j, 0.75 + q * 0.6, 0.18 + q * q * 1.0, 0.03 + q * q * q * 0.75); continue; }
          }
          // the clearing floor, lit by it
          var gx = (wx - fcx) / 44, gy = (wy - fcy - 1.5) / 7.5, ge = gx * gx + gy * gy;
          if (ge < 1) {
            var gl = Math.pow(1 - ge, 1.6) * (0.75 + 0.25 * warm) * (0.5 + 0.5 * AF.noise(wx * 0.8, wy * 1.5, 12));
            if (gl > 0.035) { g.px(i, j, gl * 0.62, gl * 0.26, gl * 0.07); continue; }
          }
        }
      }
      // sparks, then stars behind everything that is still empty
      for (var s = 0; s < 26; s++) {
        var life = frac(t * 0.33 + s * 0.137), sx = fcx + Math.sin(s * 7.3 + life * 5) * (2 + life * 9), sy = fcy - 8 - life * 40;
        var si = Math.floor(sx * 2), sj = Math.floor(sy * 2);
        if (si >= 0 && sj >= 0 && si < W && sj < H && !A0.on[sj * W + si] && !B0.on[sj * W + si]) g.px(si, sj, 1.2 * (1 - life), 0.6 * (1 - life), 0.15 * (1 - life), 1);
      }
      for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) {
        var h = AF.hash(x, y, 7);
        if (h < 0.012) { var pi = x * 2 + (h * 977 & 1), pj = y * 4 + (h * 3571 & 3), k = (pj * W + pi) * 3; if (g.buf[k] + g.buf[k + 1] + g.buf[k + 2] < 0.03) { var tw = 0.3 + 0.3 * Math.sin(t * 1.3 + h * 4000); g.px(pi, pj, tw, tw, tw * 1.25, 1); } }
      }
    }
    return AC.run(canvas, C, R, fill, { stillAt: 6, fps: 20, ramp: ' .:;=+*x#%@@' });
  }

  global.LabV2 = { dragons: dragons, gargantua: gargantua, ball: ball, helmet: helmet, underwater: underwater };
})(window);
