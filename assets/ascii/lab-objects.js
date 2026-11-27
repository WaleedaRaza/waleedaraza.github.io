/* ═══════════════════════════════════════════════════════════════════════
   LAB OBJECTS: standalone pieces on black (needs ascii-field.js and
   lab-scenes.js). Each: LabObjects.<name>(pre) -> { toggle(), field }.
   Coordinates: x in columns, y in rows * A, so circles stay round.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var AF = global.AsciiField, run = global.LabScenes.run, A = 1.83;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(e0, e1, v) { var t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function frac(v) { return v - Math.floor(v); }
  function pip(px, py, poly) {   // point in polygon, poly = [[x,y],...]
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function heart(x, y) {         // < 0 inside; x,y about unit size, y up
    var a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y;
  }
  function line(buf, x0, y0, x1, y1, key, ch) {   // world coords
    var dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy) / A) * 1.5) || 1;
    var g = ch || AF.lineChar(dx, dy); if (g === '-') g = '─'; else if (g === '|') g = '│';
    for (var i = 0; i <= n; i++) buf.set(Math.floor(x0 + dx * i / n), Math.floor((y0 + dy * i / n) / A), g, key);
  }

  /* ── VINYL: 33⅓, the label turning, the shine staying put ── */
  function vinyl(el) {
    var C = 96, R = 44;
    var pal = {
      g1: { color: '#2c2c36', glow: 0 }, g2: { color: '#1c1c24', glow: 0 }, g3: { color: '#44445a', glow: 0.1 },
      spec: { color: '#c8cce0', glow: 0.5, blur: 6 }, spec2: { color: '#7a7e96', glow: 0.2 },
      lo: { color: '#ff6b35', glow: 0.55 }, lt: { color: '#00d4aa', glow: 0.55 }, ink: { color: '#120a06', glow: 0 },
      rim: { color: '#0c0c10', glow: 0 }, arm: { color: '#d6d6e0', glow: 0.35 }, head: { color: '#ff6b35', glow: 0.5 }, dust: { color: '#fff', glow: 0.6 }
    };
    var Rv = 40, TILT = 0.5;
    function fill(buf, t) {
      var cx = C / 2 - 4, cy = R * A / 2 + 2, rot = t * 3.49;
      for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) {
        var dx = x + 0.5 - cx, dyw = (y + 0.5) * A - cy;
        var v = dyw / TILT, r = Math.hypot(dx, v);
        var vr = (dyw - 2.2) / TILT, rr = Math.hypot(dx, vr);   // the record's edge, a little lower
        if (r > Rv) { if (rr < Rv) buf.set(x, y, '▄', 'rim'); continue; }
        var phi = Math.atan2(v, dx), rel = phi - rot;
        var ch, key;
        if (r < 1.3) { ch = '·', key = 'ink'; }
        else if (r < 12) {
          var half = Math.sin(rel) > 0;
          ch = r > 11 ? '▓' : '█'; key = half ? 'lo' : 'lt';
          if (r > 4 && r < 9 && Math.abs(Math.sin(rel * 3)) < 0.12) { ch = '▒'; key = 'ink'; }
        } else {
          var groove = Math.floor(r * 1.4) % 2, band = r > 16.5 && r < 17.5 || r > 25 && r < 26 || r > 33 && r < 33.8;
          var s = Math.pow(Math.max(0, Math.cos(2 * (phi + 0.7))), 18);
          if (band) { ch = '░'; key = 'g2'; }
          else if (s > 0.5) { ch = groove ? '▓' : '▒'; key = 'spec'; }
          else if (s > 0.12) { ch = '▒'; key = 'spec2'; }
          else { ch = groove ? '▒' : '░'; key = groove ? 'g1' : 'g3'; }
          if (AF.hash(Math.floor(r * 2), Math.floor(frac((rel) / 6.283) * 90), 5) > 0.997) { ch = '·'; key = 'dust'; }
        }
        buf.set(x, y, ch, key);
      }
      // tonearm, resting in a groove that creeps inward
      var px = cx + 44, py = cy - 18, ang = -0.35;
      var sr = 34 - 14 * frac(t / 40), sx = cx + Math.cos(ang) * sr, sy = cy + Math.sin(ang) * sr * TILT;
      line(buf, px, py, px - 1, py + 14, 'arm');
      line(buf, px - 1, py + 14, sx + 3, sy - 2, 'arm');
      buf.set(Math.floor(sx + 2), Math.floor((sy - 2) / A), '▙', 'head'); buf.set(Math.floor(sx + 3), Math.floor((sy - 2) / A), '▖', 'head');
      buf.set(Math.floor(px), Math.floor(py / A), '◉', 'arm');
    }
    return run(el, C, R, pal, fill, { stillAt: 1 });
  }

  /* ── SEVEN-STAR DRAGON BALL ── */
  function dragonBall(el) {
    var C = 100, R = 48;
    var pal = {
      b1: { color: '#ffd28a', glow: 0.7, blur: 9 }, b2: { color: '#ffa53a', glow: 0.55 }, b3: { color: '#e0701c', glow: 0.35 }, b4: { color: '#8a3a0c', glow: 0.15 },
      st: { color: '#e8202a', glow: 0.6, blur: 6 }, st2: { color: '#8e1016', glow: 0.25 },
      sp: { color: '#ffffff', glow: 1, blur: 10 }, win: { color: '#fff2d0', glow: 0.5 }, glowr: { color: '#ff8a2a', glow: 0.3 }
    };
    var SR = 37, L = [-0.5, -0.7, 0.5], ll = Math.hypot(L[0], L[1], L[2]); L = [L[0] / ll, L[1] / ll, L[2] / ll];
    // seven stars: one in the middle, six round it, on the sphere's surface
    var STARS = [[0, 0]];
    for (var i = 0; i < 6; i++) STARS.push([Math.cos(i / 6 * 6.283 + 0.52) * 0.44, Math.sin(i / 6 * 6.283 + 0.52) * 0.44]);
    function fill(buf, t) {
      var cx = C / 2, cy = R * A / 2 + Math.sin(t * 1.2) * 1.5, yaw = Math.sin(t * 0.35) * 0.5;
      var cyw = Math.cos(yaw), syw = Math.sin(yaw);
      for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) {
        var dx = (x + 0.5 - cx) / SR, dy = ((y + 0.5) * A - cy) / SR, d2 = dx * dx + dy * dy;
        if (d2 > 1) {
          if (d2 < 1.25 && AF.hash(x, y, Math.floor(t * 4)) < (1.25 - d2) * 1.2) buf.set(x, y, '·', 'glowr');
          continue;
        }
        var nz = Math.sqrt(1 - d2);
        var lam = Math.max(0, dx * L[0] + dy * L[1] + nz * L[2]);
        var rimL = Math.pow(1 - nz, 2) * 0.6;          // light passing through the glass to the far edge
        var lum = 0.18 + 0.7 * lam + rimL * (dx > 0 ? 1 : 0.4);
        var ch = lum > 0.8 ? '█' : lum > 0.55 ? '▓' : lum > 0.35 ? '▒' : '░';
        var key = lum > 0.8 ? 'b1' : lum > 0.55 ? 'b2' : lum > 0.35 ? 'b3' : 'b4';
        // stars sit just under the surface: rotate the normal back into ball space
        var bx = dx * cyw - nz * syw, bz = dx * syw + nz * cyw;
        if (bz > 0.3) {
          for (var s = 0; s < 7; s++) {
            var sx = bx - STARS[s][0], sy = dy - STARS[s][1];
            var sa = Math.atan2(sy, sx) + Math.PI / 2, sd = Math.hypot(sx, sy);
            var k = Math.abs(frac(sa / (Math.PI * 2 / 5)) - 0.5) * 2;   // 0 at a point, 1 between
            var rad = 0.16 * (1 - 0.6 * k);
            if (sd < rad) { ch = sd < rad * 0.6 ? '█' : '▓'; key = lam > 0.3 ? 'st' : 'st2'; break; }
          }
        }
        // highlights: a hot spot and a soft window shape
        var hs = Math.hypot(dx + 0.38, dy + 0.42);
        if (hs < 0.09) { ch = '█'; key = 'sp'; }
        else if (dy < -0.55 && dy > -0.75 && dx > -0.3 && dx < 0.25 && nz > 0.45) { ch = '▒'; key = 'win'; }
        buf.set(x, y, ch, key);
      }
    }
    return run(el, C, R, pal, fill, { stillAt: 2 });
  }

  /* ── POKER CHIP: spins on edge, a hand history round the rim ── */
  function pokerChip(el) {
    var C = 90, R = 46, CR = 30, TH = 3.2;
    var pal = {
      eo: { color: '#ff6b35', glow: 0.55 }, ew: { color: '#f2efe6', glow: 0.5 }, gap: { color: '#3a1a10', glow: 0 },
      face: { color: '#b8421a', glow: 0.3 }, txt: { color: '#ffe0cc', glow: 0.5 }, core: { color: '#00d4aa', glow: 0.55 }, coreD: { color: '#00715c', glow: 0.25 },
      suit: { color: '#05140f', glow: 0 }, side: { color: '#7a2a10', glow: 0.15 }, sideW: { color: '#a8a49a', glow: 0.15 }, shade: { color: '#5a1e0a', glow: 0 }
    };
    var HAND = 'UTG raise 3bb · BTN 3bet 9bb · UTG call · flop A♠ K♦ 7♣ · check · bet 1/3 · call';
    function fill(buf, t) {
      var cx = C / 2, cy = R * A / 2 - 4, rot = t * 0.7, c = Math.cos(rot), w = Math.max(0.035, Math.abs(c));
      var back = c < 0, off = Math.sin(rot) * TH;
      for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) {
        var px = x + 0.5 - cx, py = (y + 0.5) * A - cy;
        // the edge band between the two faces
        var inBand = false;
        for (var k = 0; k <= 4; k++) {
          var ux = (px - off * (k / 4 - 0.5) * 2) / w;
          if (Math.hypot(ux, py) < CR) { inBand = true; break; }
        }
        var u = (px - off) / w, r = Math.hypot(u, py);
        if (r >= CR) {
          if (inBand) buf.set(x, y, '▌', Math.floor((py + CR) / 5) % 2 ? 'side' : 'sideW');
          continue;
        }
        if (back) u = -u;
        var phi = Math.atan2(py, u), n = r / CR, ch = '█', key;
        if (n > 0.86) key = Math.floor((phi + 3.1416) / 6.2832 * 16) % 2 ? 'eo' : 'ew';
        else if (n > 0.82) { ch = '▒'; key = 'gap'; }
        else if (n > 0.62) {
          key = 'face'; ch = '▓';
          if (n > 0.7 && n < 0.76 && Math.floor((phi + 3.1416) / 6.2832 * 24) % 2) { ch = '▒'; key = 'txt'; }
        } else {
          ch = n < 0.56 ? '▓' : '▒'; key = n < 0.56 ? 'core' : 'coreD';
          if (n < 0.3 && w > 0.5) { ch = n < 0.2 ? '█' : '▓'; key = 'suit'; }
        }
        if (w < 0.3 && ch === '█') key = key === 'ew' ? 'sideW' : key === 'eo' ? 'side' : key;   // edge-on: darker
        buf.set(x, y, ch, key);
      }
      // the hand, typed out underneath, one action at a time
      var acts = HAND.split('·'), k2 = Math.floor(t / 1.6) % acts.length, line2 = '';
      for (var q = 0; q <= k2; q++) line2 += (q ? ' ·' : '') + acts[q];
      line2 = line2.trim(); if (line2.length > C - 4) line2 = '…' + line2.slice(line2.length - (C - 5));
      buf.stamp(Math.floor((C - line2.length) / 2), R - 2, [line2], 'txt');
    }
    return run(el, C, R, pal, fill, { stillAt: 0.4 });
  }

  /* ── 808s: a heart in two halves, drifting apart and back ── */
  function heart808(el) {
    var C = 84, R = 42;
    var pal = {
      h1: { color: '#ffb3bd', glow: 0.7, blur: 9 }, h2: { color: '#ff6f86', glow: 0.5 }, h3: { color: '#c23a54', glow: 0.3 }, h4: { color: '#5e1626', glow: 0.1 },
      crack: { color: '#ffffff', glow: 0.8, blur: 8 }, str: { color: '#8a8a96', glow: 0.1 }
    };
    var HS = 26;
    function fill(buf, t) {
      var cx = C / 2, cy = R * A / 2 - 1;
      var sep = 1 + 3.2 * Math.pow(Math.max(0, Math.sin(t * 0.45)), 2), sag = sep * 0.5;
      for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) {
        var wx = x + 0.5 - cx, wy = (y + 0.5) * A - cy;
        for (var side = -1; side <= 1; side += 2) {
          var ang = side * sep * 0.03;
          var lx = wx - side * sep, ly = wy - sag * (side > 0 ? 1 : 0.4);
          var rx = lx * Math.cos(ang) + ly * Math.sin(ang), ry = -lx * Math.sin(ang) + ly * Math.cos(ang);
          var hx = rx / HS, hy = -ry / HS + 0.1;
          var crack = 0.05 * (Math.abs(frac(hy * 3.2) - 0.5) * 4 - 1);   // zigzag down the middle
          if ((hx - crack) * side < 0) continue;
          var f = heart(hx * 1.0, hy * 1.08);
          if (f >= 0) continue;
          var edge = Math.min(1, -f * 6), lit = clamp(0.55 - hx * 0.35 + hy * 0.4, 0, 1) * edge + (1 - edge) * 0.15;
          var nearCrack = Math.abs(hx - crack) < 0.035;
          var ch, key;
          if (nearCrack && sep < 1.6) { ch = '│'; key = 'crack'; }
          else { ch = lit > 0.62 ? '█' : lit > 0.42 ? '▓' : lit > 0.22 ? '▒' : '░'; key = lit > 0.62 ? 'h1' : lit > 0.42 ? 'h2' : lit > 0.22 ? 'h3' : 'h4'; }
          buf.set(x, y, ch, key);
          break;
        }
      }
      // the balloon's string, slack
      var by = cy + HS * 1.05;
      for (var i = 0; i < 9; i++) buf.set(Math.floor(cx + Math.sin(i * 0.7 + t) * 1.2), Math.floor(by / A) + i, i % 2 ? '(' : ')', 'str');
    }
    return run(el, C, R, pal, fill, { stillAt: 2 });
  }

  /* ── LIGHTNING → BATTERY: five strikes to full ── */
  function lightning(el) {
    var C = 70, R = 46;
    var pal = {
      bolt: { color: '#ffffff', glow: 1, blur: 12 }, bolt2: { color: '#fff3a0', glow: 0.7 }, case: { color: '#9aa0b4', glow: 0.2 },
      cell: { color: '#00d4aa', glow: 0.6, blur: 7 }, cellF: { color: '#9cf7e3', glow: 0.9, blur: 10 }, empty: { color: '#1e2a28', glow: 0 },
      flash: { color: '#3a3a4a', glow: 0 }, spark: { color: '#ff6b35', glow: 0.8 }
    };
    var CYCLE = 12, STRIKE = 1.5;
    function fill(buf, t) {
      var ct = t % CYCLE, strikes = Math.min(5, Math.floor(ct / STRIKE)), since = ct - strikes * STRIKE;
      var full = ct > 5 * STRIKE, draining = ct > CYCLE - 1.5;
      var level = draining ? 5 * (CYCLE - ct) / 1.5 : strikes;
      var cx = C / 2, top = 20 * A, bw = 13, bh = 22;          // battery body, rows 20..42
      // case
      for (var y = 20; y < 44; y++) for (var x = Math.floor(cx - bw - 1); x <= Math.ceil(cx + bw); x++) {
        var wx = x + 0.5 - cx, edgeX = Math.abs(wx) > bw - 0.5, edgeY = y === 20 || y === 43;
        if (edgeX || edgeY) { buf.set(x, y, edgeY ? '═' : '║', 'case'); continue; }
        var seg = Math.floor((42 - y) / 4.4);                  // 5 cells from the bottom
        var inGap = (42 - y) % 4.4 < 0.9;
        if (inGap) continue;
        buf.set(x, y, seg < level ? '█' : '░', seg < level ? (full && !draining ? 'cellF' : 'cell') : 'empty');
      }
      for (var x2 = Math.floor(cx - 4); x2 <= Math.ceil(cx + 3); x2++) { buf.set(x2, 19, '▄', 'case'); buf.set(x2, 18, '▁', 'case'); }
      // the strike: a fresh jagged path each time, visible for a moment
      if (!full && since < 0.32 && ct > 0.2) {
        var rnd = AF.rng(Math.floor(t / STRIKE) * 977 + 3), px = cx + (rnd() - 0.5) * 30, py = 0;
        var flick = since < 0.08 || (since > 0.14 && since < 0.2);
        while (py < 18 * A) {
          var nx = px + (rnd() - 0.5) * 9 + (cx - px) * 0.25, ny = py + 3 + rnd() * 4;
          if (ny > 18 * A) { ny = 18 * A; nx = cx; }
          line(buf, px, py, nx, ny, flick ? 'bolt' : 'bolt2');
          if (rnd() < 0.3) { var fx = nx + (rnd() - 0.5) * 12, fy = ny + 4; line(buf, nx, ny, fx, fy, 'bolt2'); }
          px = nx; py = ny;
        }
        for (var s = 0; s < 6; s++) buf.set(Math.floor(cx + (rnd() - 0.5) * 10), 17 - Math.floor(rnd() * 2), '*', 'spark');
      }
    }
    return run(el, C, R, pal, fill, { stillAt: 6.4 });
  }

  /* ── 1 + 1 → 11 ── */
  function elevenSum(el) {
    var C = 100, R = 30;
    var ONE = ['..#..', '.##..', '#.#..', '..#..', '..#..', '..#..', '#####'];
    var PLUS = ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'];
    var pal = { dim: { color: '#3a3a44', glow: 0 }, plus: { color: '#ffffff', glow: 0.6 } };
    var PX = 3, PY = 2;
    function glyph(buf, bm, gx, gy, key, keep) {
      for (var r = 0; r < 7; r++) for (var c = 0; c < 5; c++) {
        if (bm[r].charAt(c) !== '#') continue;
        for (var i = 0; i < PX; i++) for (var j = 0; j < PY; j++) {
          var x = Math.round(gx) + c * PX + i, y = gy + r * PY + j;
          if (keep < 1 && AF.hash(x, y, 2) > keep) continue;
          buf.set(x, y, '█', key);
        }
      }
    }
    function fill(buf, t) {
      var ct = t % 9, gy = Math.floor((R - 14) / 2);
      var plusKeep = 1 - smooth(1.8, 2.8, ct);
      var slide = smooth(2.8, 4.2, ct), all = 1 - smooth(8, 8.8, ct);
      var a = C / 2 - 34 + slide * 16, b = C / 2 + 19 - slide * 15;
      glyph(buf, ONE, a, gy, AF.TYPING, all);
      if (plusKeep > 0) glyph(buf, PLUS, C / 2 - 7.5, gy, 'plus', plusKeep * all);
      glyph(buf, ONE, b, gy, AF.TYPING, all);
      if (ct > 4.6 && ct < 8.4) buf.stamp(Math.floor(C / 2 - 6), gy + 17, ['1 + 1 → 11'], 'dim');
    }
    return run(el, C, R, pal, fill, { stillAt: 5 });
  }

  /* ── ENSŌ: one brushstroke, drawn, held, let go ── */
  function enso(el) {
    var C = 84, R = 42;
    var pal = {
      i1: { color: '#f1ebdc', glow: 0.55, blur: 7 }, i2: { color: '#bdb6a4', glow: 0.3 }, i3: { color: '#6e695e', glow: 0.1 },
      seal: { color: '#e8452a', glow: 0.55 }, sealI: { color: '#5a140a', glow: 0 }
    };
    var CYC = 10, R0 = 28, START = -2.1, SWEEP = 5.6;
    function fill(buf, t) {
      var ct = t % CYC, drawn = smooth(0, 2.6, ct) * SWEEP, fade = 1 - smooth(6.5, 8.8, ct);
      var cx = C / 2 - 3, cy = R * A / 2;
      for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) {
        var dx = x + 0.5 - cx, dy = (y + 0.5) * A - cy, r = Math.hypot(dx, dy);
        if (r < R0 - 7 || r > R0 + 7) continue;
        var ang = Math.atan2(dy, dx) - START; ang = ((ang % 6.2832) + 6.2832) % 6.2832;
        if (ang > drawn) continue;
        var p = ang / SWEEP;                                     // 0 at the first press, 1 at the lift
        var thick = 5.2 * (1 - p * 0.75) + (p < 0.05 ? (0.05 - p) * 40 : 0);
        var centre = R0 + Math.sin(p * 9) * 0.6 - p * 1.5;
        var off = (r - centre) / thick;
        if (Math.abs(off) > 1) continue;
        // dry brush: bristle streaks that break up toward the end of the stroke
        var bristle = AF.noise(ang * 40, off * 6, 4);
        var dry = smooth(0.45, 1, p) * 0.75 + Math.abs(off) * 0.35;
        if (bristle < dry) continue;
        if (AF.hash(x, y, 9) > fade) continue;
        var dens = bristle - dry;
        buf.set(x, y, dens > 0.35 ? '█' : dens > 0.18 ? '▓' : '▒', dens > 0.35 ? 'i1' : dens > 0.18 ? 'i2' : 'i3');
      }
      // seal, bottom right, stays while the ink goes
      var sx = Math.floor(cx + R0 + 1), sy = Math.floor((cy + R0 * 0.75) / A);
      if (ct > 2.8) for (var j = 0; j < 4; j++) for (var i = 0; i < 6; i++) {
        var border = j === 0 || j === 3 || i === 0 || i === 5;
        buf.set(sx + i, sy + j, border ? '█' : (AF.hash(i, j, 3) < 0.5 ? '▚' : '▞'), border ? 'seal' : 'sealI');
      }
    }
    return run(el, C, R, pal, fill, { stillAt: 4 });
  }

  /* ── HTML-PAPER BOAT: a printout folded into a boat ── */
  function paperBoat(el) {
    var C = 110, R = 46;
    var pal = {
      p1: { color: '#f2efe6', glow: 0.35 }, p2: { color: '#b7b3a8', glow: 0.15 }, p3: { color: '#7c786e', glow: 0 },
      tag: { color: '#ff6b35', glow: 0.45 }, att: { color: '#00d4aa', glow: 0.4 }, fold: { color: '#4a4740', glow: 0 },
      w1: { color: '#3c6e8e', glow: 0.25 }, w2: { color: '#22405a', glow: 0.1 }, w3: { color: '#9cc8e0', glow: 0.5 }, refl: { color: '#3a3a36', glow: 0 }
    };
    var SRC = '<html><head><title>my page</title></head><body bgcolor="black"><h1>hello world</h1><p>this is my page. <a href="links.html">links</a></p><hr><img src="me.jpg"><table border="1"><tr><td>under construction</td></tr></table></body></html>';
    var HULL = [[-40, -4], [40, -4], [28, 9], [-28, 9]];
    var SAIL = [[-26, -4], [26, -4], [0, -42]];
    function fill(buf, t) {
      var cx = C / 2, wl = R * A * 0.7, bob = Math.sin(t * 1.1) * 1.2, tilt = Math.sin(t * 0.8) * 0.06;
      var drift = Math.sin(t * 0.13) * 6, ct = Math.cos(tilt), st = Math.sin(tilt);
      for (var y = 0; y < R; y++) {
        var wy = (y + 0.5) * A;
        for (var x = 0; x < C; x++) {
          var wx = x + 0.5;
          var waveH = Math.sin(wx * 0.18 + t * 1.4) * 0.9 + Math.sin(wx * 0.07 - t * 0.6) * 1.1;
          var lx = wx - cx - drift, ly = wy - (wl - 6) - bob;
          var bx = lx * ct + ly * st, by = -lx * st + ly * ct;
          var inSail = pip(bx, by, SAIL), inHull = pip(bx, by, HULL);
          if ((inSail || inHull) && (wy < wl + waveH + 1 || inSail)) {
            // the printout: text runs across the sheet in rows
            var row = Math.floor((by + 42) / A), col = Math.floor(bx + 40);
            var ch = SRC.charAt(((row * 61 + col) % SRC.length + SRC.length) % SRC.length);
            var light = inSail ? (bx < 0 ? 1 : 2) : (bx < -17 || bx > 17 ? 2 : 1);
            var foldLine = inSail ? Math.abs(bx) < 0.6 : (Math.abs(by + 4) < 0.9);
            var key = light === 1 ? 'p1' : 'p2';
            if (ch === '<' || ch === '>' || ch === '/') key = 'tag';
            else if (ch === '"' || ch === '=') key = 'att';
            if (ch === ' ') ch = light === 1 ? '·' : ' ';
            if (foldLine) { ch = inSail ? '│' : '─'; key = 'fold'; }
            if (ch !== ' ') buf.set(x, y, ch, key);
            continue;
          }
          if (wy > wl + waveH) {
            var depth = (wy - wl) / (R * A - wl);
            // a dim reflection of the boat under the surface
            var rby = (wl - (wy - wl)) - (wl - 6) - bob, rbx = lx;
            if (pip(rbx * ct + rby * st, -rbx * st + rby * ct, SAIL) && AF.hash(x, y, Math.floor(t * 3)) < 0.45) { buf.set(x, y, '░', 'refl'); continue; }
            var crest = Math.abs(wy - (wl + waveH)) < 1.2;
            var ripple = Math.sin(wx * 0.3 + wy * 0.9 - t * 2 + AF.noise(wx * 0.05, wy * 0.1 + t * 0.2) * 4);
            if (crest) buf.set(x, y, '~', 'w3');
            else if (ripple > 0.75) buf.set(x, y, depth < 0.4 ? '~' : '-', 'w1');
            else if (ripple > 0.3 && AF.hash(x, y, 1) < 0.5) buf.set(x, y, '-', 'w2');
          }
        }
      }
    }
    return run(el, C, R, pal, fill, { stillAt: 3 });
  }

  /* ── F-117: faceted, nearly invisible, one glint crossing ── */
  function nighthawk(el) {
    var C = 110, R = 42;
    var pal = {
      f1: { color: '#5a5e6e', glow: 0.1 }, f2: { color: '#3a3d48', glow: 0 }, f3: { color: '#24262e', glow: 0 }, f4: { color: '#16171c', glow: 0 },
      gl: { color: '#d8deef', glow: 0.7, blur: 8 }, edge: { color: '#ff6b35', glow: 0.35 }, cock: { color: '#00d4aa', glow: 0.35 }
    };
    // planform, nose up, in world units
    var BODY = [[0, -34], [36, 10], [28, 14], [15, 10], [11, 17], [0, 12], [-11, 17], [-15, 10], [-28, 14], [-36, 10]];
    var TAILS = [[[5, 6], [17, 23], [11, 8]], [[-5, 6], [-17, 23], [-11, 8]]];
    function facet(x, y) {          // which flat plate: centre spine, inner and outer panels
      var chine = Math.abs(x) - (y + 34) * 0.29;
      if (Math.abs(x) < 3 + (y + 34) * 0.08 && y < 2) return 0;
      if (chine < 0) return x < 0 ? 1 : 2;
      return x < 0 ? 3 : 4;
    }
    var BASE = [0.55, 0.42, 0.3, 0.22, 0.14];
    function fill(buf, t) {
      var cx = C / 2, cy = R * A / 2 + 2, rot = Math.sin(t * 0.25) * 0.5 + 1.57, cr = Math.cos(rot), sr = Math.sin(rot);
      var sweep = ((t * 22) % 160) - 80;
      for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) {
        var dx = x + 0.5 - cx, dy = (y + 0.5) * A - cy;
        var lx = dx * cr + dy * sr, ly = -dx * sr + dy * cr;   // into plane space
        lx = lx; var px = -ly, py = lx;                        // nose points right on screen
        var inBody = pip(px, py, BODY), inTail = pip(px, py, TAILS[0]) || pip(px, py, TAILS[1]);
        if (!inBody && !inTail) continue;
        var f = inTail ? 3 : facet(px, py);
        var lum = BASE[f] + (f === 1 || f === 3 ? 0.1 : 0) * Math.sin(t * 0.25);
        var g = Math.exp(-Math.pow((dx * 0.7 + dy * 0.7) - sweep, 2) / 10);
        lum += g * (f === 0 ? 0.6 : 0.45);
        var ch = lum > 0.7 ? '▓' : lum > 0.45 ? '▒' : lum > 0.25 ? '░' : '░';
        var key = lum > 0.7 ? 'gl' : lum > 0.45 ? 'f1' : lum > 0.28 ? 'f2' : lum > 0.18 ? 'f3' : 'f4';
        if (f === 0 && py > -24 && py < -14) { ch = '▒'; key = 'cock'; }
        // the edges catch a little orange, the way the leading edge would at dusk
        var e = !pip(px + 0.9, py, BODY) || !pip(px - 0.9, py, BODY) || !pip(px, py + 1.4, BODY) || !pip(px, py - 1.4, BODY);
        if (inBody && e && py < 8) { ch = '▪'; key = g > 0.3 ? 'gl' : 'edge'; }
        buf.set(x, y, ch, key);
      }
    }
    return run(el, C, R, pal, fill, { stillAt: 3.4 });
  }

  global.LabObjects = { vinyl: vinyl, dragonBall: dragonBall, pokerChip: pokerChip, heart808: heart808,
    lightning: lightning, elevenSum: elevenSum, enso: enso, paperBoat: paperBoat, nighthawk: nighthawk };
})(window);
