/* ═══════════════════════════════════════════════════════════════════════
   LAB HEADERS: essay headers where the picture is the argument, plus a few
   more standalone pieces (needs ascii-field.js and lab-scenes.js).
   LabHeaders.<name>(pre) -> { toggle(), field }
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var AF = global.AsciiField, run = global.LabScenes.run, A = 1.83;
  var C = 150, R = 40, H = R * A;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(e0, e1, v) { var t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function frac(v) { return v - Math.floor(v); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function plot(buf, wx, wy, ch, key) { buf.set(Math.floor(wx), Math.floor(wy / A), ch, key); }
  function line(buf, x0, y0, x1, y1, key, ch) {
    var dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy) / A) * 1.5) || 1;
    var g = ch || AF.lineChar(dx, dy); if (g === '-') g = '─'; else if (g === '|') g = '│';
    for (var i = 0; i <= n; i++) plot(buf, x0 + dx * i / n, y0 + dy * i / n, g, key);
  }
  function stars(buf, t, seed, density) {
    for (var y = 0; y < buf.rows; y++) for (var x = 0; x < buf.cols; x++) {
      var h = AF.hash(x, y, seed || 7);
      if (h < (density || 0.008)) buf.set(x, y, h < 0.002 ? '+' : '.', Math.sin(t * 1.1 + h * 900) > 0.2 ? 'star' : 'dim');
    }
  }
  var BASE = { star: { color: '#b8bfd8', glow: 0.4 }, dim: { color: '#3a3f52', glow: 0 }, txt: { color: '#8a8fa3', glow: 0 },
    o1: { color: '#ffb36b', glow: 0.7, blur: 8 }, o2: { color: '#ff6b35', glow: 0.5 }, o3: { color: '#8a3412', glow: 0.2 },
    t1: { color: '#9cf7e3', glow: 0.7, blur: 8 }, t2: { color: '#00d4aa', glow: 0.5 }, t3: { color: '#00664f', glow: 0.2 },
    w: { color: '#ffffff', glow: 0.8, blur: 6 } };
  function pal(extra) { var p = {}, k; for (k in BASE) p[k] = BASE[k]; for (k in (extra || {})) p[k] = extra[k]; return p; }

  /* ── WE WILL LIVE FOREVER. WE WILL NOT FEEL FOREVER. ──
     An orange line is drawn and fades within seconds; a teal copy redraws it
     on the right and stays. The feeling goes, the record remains. */
  function forever(el) {
    var LAG = 2.5, FEEL = 2.6, KEEP = 22;
    function P(s) { return [22 * Math.sin(0.7 * s) + 6 * Math.sin(2.3 * s), 14 * Math.sin(1.1 * s + 1) + 5 * Math.cos(3.1 * s)]; }
    function fill(buf, t) {
      stars(buf, t, 3, 0.004);
      var c1 = [C * 0.27, H * 0.5], c2 = [C * 0.73, H * 0.5];
      for (var s = t - KEEP; s <= t - LAG; s += 0.02) {     // the copy, slow to fade
        if (s < 0) continue;
        var p = P(s), age = (t - LAG - s) / KEEP;
        plot(buf, c2[0] + p[0], c2[1] + p[1], age < 0.15 ? '█' : age < 0.5 ? '▓' : '▒', age < 0.15 ? 't1' : age < 0.6 ? 't2' : 't3');
      }
      for (var s2 = t - FEEL; s2 <= t; s2 += 0.015) {       // the feeling, gone in seconds
        if (s2 < 0) continue;
        var q = P(s2), a2 = (t - s2) / FEEL;
        plot(buf, c1[0] + q[0], c1[1] + q[1], a2 < 0.1 ? '█' : a2 < 0.45 ? '▓' : a2 < 0.8 ? '▒' : '░', a2 < 0.2 ? 'o1' : a2 < 0.6 ? 'o2' : 'o3');
      }
      // the thread between them: what is being copied right now
      var from = P(t - LAG), fx = c1[0] + from[0], fy = c1[1] + from[1], tx = c2[0] + from[0], ty = c2[1] + from[1];
      for (var i = 1; i < 30; i++) if ((i + Math.floor(t * 12)) % 3 === 0) plot(buf, lerp(fx, tx, i / 30), lerp(fy, ty, i / 30), '·', 'dim');
      buf.stamp(Math.floor(C * 0.27 - 4), R - 2, ['FEEL'], 'o3');
      buf.stamp(Math.floor(C * 0.73 - 4), R - 2, ['LIVE'], 't3');
    }
    return run(el, C, R, pal(), fill, { stillAt: 14 });
  }

  /* ── CAMUS: the boulder, the hill, and a figure who keeps going ── */
  function sisyphus(el) {
    var p = pal({ hill: { color: '#4a3a30', glow: 0 }, hill2: { color: '#2a201a', glow: 0 }, ridge: { color: '#c89a70', glow: 0.3 },
      rock1: { color: '#d8d0c4', glow: 0.4 }, rock2: { color: '#8a8478', glow: 0.15 }, rock3: { color: '#4a463e', glow: 0 },
      man: { color: '#ff6b35', glow: 0.6 }, sun: { color: '#ffb36b', glow: 0.8, blur: 12 } });
    var X0 = 18, Y0 = H - 6, X1 = 128, Y1 = 16;   // slope from bottom-left to the summit
    function slopeY(x) { return x < X0 ? Y0 : x > X1 ? Y1 + (x - X1) * 0.9 : lerp(Y0, Y1, (x - X0) / (X1 - X0)); }
    function fill(buf, t) {
      var ct = t % 16, u;
      if (ct < 11) u = 0.08 + 0.8 * (1 - Math.pow(1 - ct / 11, 1.6));
      else if (ct < 13) u = 0.88 - 0.8 * Math.pow((ct - 11) / 2, 2);
      else u = 0.08;
      var bx = lerp(X0, X1, u), by = slopeY(bx), BR = 6.5;
      var cx = bx, cy = by - BR - 0.4, rot = -(bx - X0) / BR;
      // sun low behind the summit
      for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) {
        var wx = x + 0.5, wy = (y + 0.5) * A;
        var sd = Math.hypot(wx - 140, wy - 12);
        if (sd < 5) buf.set(x, y, sd < 4 ? '█' : '▓', 'sun');
        else if (AF.hash(x, y, 2) < 0.004) buf.set(x, y, '.', 'dim');
        var sy = slopeY(wx);
        if (wy > sy) {
          var d = wy - sy;
          buf.set(x, y, d < 1.4 ? '▀' : (AF.hash(x, y, 5) < 0.25 ? '.' : (d < 8 ? '▒' : '░')), d < 1.4 ? 'ridge' : d < 8 ? 'hill' : 'hill2');
        }
        var rd = Math.hypot(wx - cx, wy - cy);
        if (rd < BR) {
          var ang = Math.atan2(wy - cy, wx - cx) - rot, lit = (-(wx - cx) * 0.5 - (wy - cy) * 0.8) / BR;
          var crack = Math.abs(Math.sin(ang * 3 + rd * 0.4)) < 0.12;
          buf.set(x, y, crack ? '▒' : (lit > 0.2 ? '█' : '▓'), crack ? 'rock3' : lit > 0.2 ? 'rock1' : 'rock2');
        }
      }
      // the figure: pushing while the stone goes up, walking down after it
      var fx, pushing = ct < 11;
      if (ct < 11) fx = bx - BR - 1.6;
      else if (ct < 13) fx = lerp(X0, X1, 0.88) - BR - 1.6;
      else fx = lerp(lerp(X0, X1, 0.88) - BR - 1.6, X0 + 2, smooth(13, 16, ct));
      var fy = slopeY(fx), step = Math.floor(t * (pushing ? 3 : 5)) % 2;
      plot(buf, fx, fy - 5.5, 'o', 'man');
      plot(buf, fx + (pushing ? 0.6 : 0), fy - 3.7, pushing ? '/' : '|', 'man');
      plot(buf, fx + (pushing ? 1.6 : 0), fy - 4.3, pushing ? '=' : ' ', 'man');
      plot(buf, fx - 0.4, fy - 1.6, step ? '/' : '\\', 'man');
      plot(buf, fx + 0.6, fy - 1.6, step ? '\\' : '/', 'man');
      buf.stamp(2, R - 1, ['one must imagine'], 'txt');
    }
    return run(el, C, R, p, fill, { stillAt: 6 });
  }

  /* ── MUSIC AND SOFTWARE: one pattern, read as a grid and as code ── */
  function sequencer(el) {
    var p = pal({ on: { color: '#ff6b35', glow: 0.5 }, off: { color: '#24262e', glow: 0 }, head: { color: '#00d4aa', glow: 0.5 },
      hit: { color: '#ffffff', glow: 1, blur: 8 }, code: { color: '#c8ccd8', glow: 0.2 }, kw: { color: '#00d4aa', glow: 0.4 }, cur: { color: '#ffb36b', glow: 0.7 } });
    var TR = ['kick ', 'snare', 'hat  ', 'bass '];
    var PAT = [
      [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
      [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,0],
      [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,1,0]];
    var lastBar = -1, rnd = AF.rng(5);
    function fill(buf, t) {
      var stepF = t / 0.125, step = Math.floor(stepF) % 16, bar = Math.floor(stepF / 64);
      if (bar !== lastBar) {   // every four bars, one step changes in both views at once
        if (lastBar >= 0) { var r = Math.floor(rnd() * 4), c = Math.floor(rnd() * 16); PAT[r][c] = 1 - PAT[r][c]; }
        lastBar = bar;
      }
      var gx = 6, gy = 9;
      for (var r2 = 0; r2 < 4; r2++) {
        buf.stamp(gx, gy + r2 * 6, [TR[r2]], 'txt');
        for (var c2 = 0; c2 < 16; c2++) {
          var on = PAT[r2][c2], here = c2 === step, x0 = gx + 7 + c2 * 4 + Math.floor(c2 / 4);
          var key = here && on ? 'hit' : on ? 'on' : here ? 'head' : 'off';
          for (var dy = 0; dy < 4; dy++) for (var dx = 0; dx < 3; dx++) buf.set(x0 + dx, gy - 1 + r2 * 6 + dy, on ? '█' : (here ? '▒' : '░'), key);
        }
      }
      var cx = 88, cy = 9;
      buf.stamp(cx, cy - 4, ['const pattern = {'], 'kw');
      for (var r3 = 0; r3 < 4; r3++) {
        var s = '  ' + TR[r3].trim() + ': [';
        buf.stamp(cx, cy + r3 * 6, [s], 'code');
        for (var c3 = 0; c3 < 16; c3++) {
          var ch = PAT[r3][c3] ? '1' : '0', k = c3 === step ? 'cur' : PAT[r3][c3] ? 'on' : 'off';
          buf.set(cx + s.length + c3 * 2, cy + r3 * 6, ch, k);
          if (c3 < 15) buf.set(cx + s.length + c3 * 2 + 1, cy + r3 * 6, ',', 'off');
        }
        buf.stamp(cx + s.length + 31, cy + r3 * 6, ['],'], 'code');
      }
      buf.stamp(cx, cy + 22, ['};'], 'kw');
      buf.stamp(cx, cy + 25, ['play(pattern, { bpm: 120 });'], 'txt');
    }
    return run(el, C, R, p, fill, { stillAt: 3 });
  }

  /* ── POKER: one action, many rivers ── */
  function rivers(el) {
    var p = pal({ br: { color: '#2e3a3a', glow: 0 }, lit: { color: '#00d4aa', glow: 0.6 }, act: { color: '#ff6b35', glow: 0.6 },
      card: { color: '#c8ccd8', glow: 0.15 }, cardR: { color: '#ff5a6e', glow: 0.3 }, cardL: { color: '#ffffff', glow: 0.9, blur: 6 } });
    var RANKS = '23456789TJQKA', SUITS = '♠♥♦♣';
    var rnd = AF.rng(9), CARDS = [];
    for (var i = 0; i < 16; i++) CARDS.push(RANKS.charAt(Math.floor(rnd() * 13)) + SUITS.charAt(Math.floor(rnd() * 4)));
    var X = [16, 46, 76, 104, 128];
    function nodeY(level, idx) { var n = Math.pow(2, level); return H * 0.5 + (idx - (n - 1) / 2) * (H * 0.9 / Math.max(1, n)); }
    function fill(buf, t) {
      var cyc = Math.floor(t / 3.2), ph = frac(t / 3.2), path = [];
      var rr = AF.rng(cyc * 31 + 7), idx = 0;
      for (var l = 1; l <= 4; l++) { idx = idx * 2 + (rr() < 0.5 ? 0 : 1); path.push(idx); }
      for (var lv = 0; lv < 4; lv++) {
        var n = Math.pow(2, lv);
        for (var k = 0; k < n; k++) for (var ch = 0; ch < 2; ch++) {
          var ci = k * 2 + ch, onPath = (lv === 0 || path[lv - 1] === k) && path[lv] === ci;
          var x0 = X[lv], y0 = nodeY(lv, k), x1 = X[lv + 1], y1 = nodeY(lv + 1, ci);
          var reach = clamp(ph * 5 - lv, 0, 1);
          // elbow: across, then a diagonal to the child
          var mx = lerp(x0, x1, 0.35);
          line(buf, x0, y0, mx, y0, 'br', '─'); line(buf, mx, y0, x1 - 2, y1, 'br'); line(buf, x1 - 2, y1, x1, y1, 'br', '─');
          if (onPath && reach > 0) {
            var segs = [[x0, y0, mx, y0], [mx, y0, x1 - 2, y1], [x1 - 2, y1, x1, y1]];
            for (var sgi = 0; sgi < 3; sgi++) {
              var sg = segs[sgi], f = clamp(reach * 3 - sgi, 0, 1);
              if (f > 0) line(buf, sg[0], sg[1], lerp(sg[0], sg[2], f), lerp(sg[1], sg[3], f), 'lit', sgi === 0 || sgi === 2 ? '─' : null);
            }
          }
        }
      }
      buf.stamp(2, Math.floor(H * 0.5 / A), ['BET ▶'], 'act');
      for (var c = 0; c < 16; c++) {
        var cyy = Math.floor(nodeY(4, c) / A), red = /[♥♦]/.test(CARDS[c].charAt(1));
        buf.stamp(X[4] + 2, cyy, ['[' + CARDS[c] + ']'], c === path[3] && ph > 0.8 ? 'cardL' : red ? 'cardR' : 'card');
      }
    }
    return run(el, C, R, p, fill, { stillAt: 2.8 });
  }

  /* ── SIMULATION: frames inside frames, none of them marked real ── */
  function simulation(el) {
    var p = pal({ f1: { color: '#c8ccd8', glow: 0.3 }, f2: { color: '#6a6f84', glow: 0.1 }, f3: { color: '#33374a', glow: 0 }, cur: { color: '#00d4aa', glow: 0.7 } });
    function fill(buf, t) {
      var z = frac(t / 5), cx = C / 2, cy = H / 2;
      for (var k = -1; k < 10; k++) {
        var s = Math.pow(0.72, k - z);
        var hw = C * 0.48 * s, hh = H * 0.46 * s;
        if (hw < 2 || hw > C) continue;
        var key = s > 0.6 ? 'f1' : s > 0.25 ? 'f2' : 'f3';
        // the same handful of stars, at every scale
        for (var i = 0; i < 14; i++) {
          var sx = (AF.hash(i, 1, 3) - 0.5) * 1.8, sy = (AF.hash(i, 2, 3) - 0.5) * 1.8;
          var px = cx + sx * hw * 0.5, py = cy + sy * hh * 0.5;
          if (Math.abs(px - cx) < hw * 0.6 * 0.72 && Math.abs(py - cy) < hh * 0.6 * 0.72) continue;
          plot(buf, px, py, i % 5 ? '.' : '+', s > 0.4 ? 'star' : 'dim');
        }
        var x0 = cx - hw, x1 = cx + hw, y0 = cy - hh, y1 = cy + hh;
        line(buf, x0, y0, x1, y0, key, '─'); line(buf, x0, y1, x1, y1, key, '─');
        line(buf, x0, y0, x0, y1, key, '│'); line(buf, x1, y0, x1, y1, key, '│');
        plot(buf, x0, y0, '┌', key); plot(buf, x1, y0, '┐', key); plot(buf, x0, y1, '└', key); plot(buf, x1, y1, '┘', key);
        if (hw > 14) buf.stamp(Math.floor(x0 + 2), Math.floor(y0 / A), ['?'], key);
      }
      if (Math.floor(t * 2) % 2) buf.set(Math.floor(cx), Math.floor(cy / A), '▌', 'cur');
    }
    return run(el, C, R, p, fill, { stillAt: 2 });
  }

  /* ── NVIDIA: everything crosses by one narrow bridge ── */
  function bridge(el) {
    var p = pal({ rock: { color: '#3a3d48', glow: 0 }, rock2: { color: '#22242c', glow: 0 }, edge: { color: '#8a8fa3', glow: 0.1 },
      br: { color: '#76b900', glow: 0.7, blur: 8 }, dot: { color: '#9cf7e3', glow: 0.5 }, dotB: { color: '#d8ffa0', glow: 0.8 } });
    var GL = 58, GR = 92, TOP = H * 0.55, BY = TOP - 0.5;
    var parts = [], rnd = AF.rng(4);
    for (var i = 0; i < 140; i++) parts.push({ a: [4 + rnd() * (GL - 10), 6 + rnd() * (TOP - 12)], b: [GR + 6 + rnd() * (C - GR - 10), 6 + rnd() * (TOP - 12)], ph: rnd(), sp: 0.05 + rnd() * 0.03 });
    function fill(buf, t) {
      for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) {
        var wx = x + 0.5, wy = (y + 0.5) * A;
        if (wy > TOP && (wx < GL || wx > GR)) {
          var d = wy - TOP;
          buf.set(x, y, d < 1.4 ? '▀' : (AF.hash(x, y, 1) < 0.3 ? '▒' : '░'), d < 1.4 ? 'edge' : d < 10 ? 'rock' : 'rock2');
        }
      }
      line(buf, GL, BY, GR, BY, 'br', '═');
      for (var k = 0; k < parts.length; k++) {
        var P = parts[k], u = frac(t * P.sp + P.ph), x, y;
        // gather to the left lip, cross single file, spread out on the far side
        if (u < 0.4) { var f = smooth(0, 0.4, u); x = lerp(P.a[0], GL - 1, f); y = lerp(P.a[1], BY - 1.5, f); }
        else if (u < 0.6) { x = lerp(GL - 1, GR + 1, (u - 0.4) / 0.2); y = BY - 1.5; }
        else { var g = smooth(0.6, 1, u); x = lerp(GR + 1, P.b[0], g); y = lerp(BY - 1.5, P.b[1], g); }
        plot(buf, x, y, u > 0.4 && u < 0.6 ? '•' : '·', u > 0.4 && u < 0.6 ? 'dotB' : 'dot');
      }
    }
    return run(el, C, R, p, fill, { stillAt: 5 });
  }

  /* ── AI AGENTS: an org chart that lights up and rearranges itself ── */
  function agents(el) {
    var p = pal({ box: { color: '#6a6f84', glow: 0.1 }, boxL: { color: '#00d4aa', glow: 0.6 }, root: { color: '#ff6b35', glow: 0.6 }, edge: { color: '#2e3240', glow: 0 }, msg: { color: '#ffffff', glow: 0.9, blur: 6 } });
    var WORK = ['search', 'code', 'test', 'review', 'write', 'plan', 'fetch', 'check', 'fix'];
    function layout(seed) {
      var r = AF.rng(seed), order = WORK.slice(), i, j, tmp;
      for (i = order.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
      var split = [2 + Math.floor(r() * 2), 0, 0]; split[1] = 2 + Math.floor(r() * 2); split[2] = 9 - split[0] - split[1];
      var nodes = { lead: [C / 2, 8] }, edges = [], w = 0;
      ['mgr-a', 'mgr-b', 'mgr-c'].forEach(function (m, mi) {
        var xs = 0;
        for (var q = 0; q < split[mi]; q++, w++) {
          var wx = C * (0.09 + w * 0.104); xs += wx;
          nodes[order[w]] = [wx, 54]; edges.push([m, order[w]]);
        }
        nodes[m] = [xs / split[mi], 30]; edges.push(['lead', m]);
      });
      return { nodes: nodes, edges: edges };
    }
    function fill(buf, t) {
      var era = Math.floor(t / 9), f = smooth(0, 1.5, t - era * 9);
      var prev = layout(2000 + Math.max(0, era - 1)), cur = layout(2000 + era), pos = {}, k;
      for (k in cur.nodes) pos[k] = [lerp(prev.nodes[k][0], cur.nodes[k][0], f), lerp(prev.nodes[k][1], cur.nodes[k][1], f)];
      cur.edges.forEach(function (e, i) {
        var a = pos[e[0]], b = pos[e[1]], my = (a[1] + b[1]) / 2;
        line(buf, a[0], a[1] + 2, a[0], my, 'edge', '│'); line(buf, a[0], my, b[0], my, 'edge', '─'); line(buf, b[0], my, b[0], b[1] - 2, 'edge', '│');
        var u = frac(t * 0.6 + i * 0.37);                     // a message travelling down the edge
        var segs = [[a[0], a[1] + 2, a[0], my], [a[0], my, b[0], my], [b[0], my, b[0], b[1] - 2]];
        var si = Math.min(2, Math.floor(u * 3)), uu = u * 3 - si, sg = segs[si];
        if (f >= 1) plot(buf, lerp(sg[0], sg[2], uu), lerp(sg[1], sg[3], uu), '•', 'msg');
      });
      for (k in pos) {
        var label = '[' + k + ']', x = Math.round(pos[k][0] - label.length / 2), y = Math.floor(pos[k][1] / A);
        var active = AF.hash(Math.floor(t * 1.5), k.length * 13 + k.charCodeAt(0), 2) < 0.35;
        buf.stamp(x, y, [label], k === 'lead' ? 'root' : active ? 'boxL' : 'box');
      }
    }
    return run(el, C, R, p, fill, { stillAt: 4 });
  }

  /* ── PREDICTION MARKETS: a price looking for the truth ── */
  function market(el) {
    var p = pal({ ax: { color: '#3a3f52', glow: 0 }, grid: { color: '#1c1f2a', glow: 0 }, ln: { color: '#00d4aa', glow: 0.6 }, area: { color: '#0a3a30', glow: 0 },
      yes: { color: '#00d4aa', glow: 0.8, blur: 8 }, no: { color: '#ff6b35', glow: 0.8, blur: 8 } });
    var X0 = 12, X1 = 140, Y0 = 6, Y1 = H - 6, CYC = 14;
    function fill(buf, t) {
      var round = Math.floor(t / CYC), ct = t - round * CYC, prog = clamp(ct / 11, 0, 1);
      var outcome = AF.hash(round, 3, 3) < 0.5 ? 1 : 0;
      for (var g = 0; g <= 4; g++) {
        var gy = lerp(Y1, Y0, g / 4);
        for (var x = X0; x < X1; x += 2) plot(buf, x, gy, '·', 'grid');
        buf.stamp(1, Math.floor(gy / A), [(g * 25 + '¢').padStart(4, ' ')], 'ax');
      }
      var prevY = null;
      for (var i = 0; i <= 256 * prog; i++) {
        var u = i / 256;
        // a wander that is pulled toward the answer as the deadline nears
        var wander = 0.5 + 0.28 * (AF.noise(u * 9, round * 3.1, 2) - 0.5) * 2 + 0.12 * (AF.noise(u * 30, round, 4) - 0.5) * 2;
        var pr = lerp(wander, outcome, Math.pow(u, 3));
        var x2 = lerp(X0, X1, u), y2 = lerp(Y1, Y0, clamp(pr, 0.01, 0.99));
        for (var yy = y2 + 1.5; yy < Y1; yy += A) if (AF.hash(Math.floor(x2), Math.floor(yy), 1) < 0.35) plot(buf, x2, yy, '░', 'area');
        if (prevY !== null) line(buf, x2 - (X1 - X0) / 256, prevY, x2, y2, 'ln');
        prevY = y2;
      }
      if (ct > 11.3) {
        var msg = outcome ? 'RESOLVED  YES' : 'RESOLVED  NO';
        if (Math.floor(ct * 3) % 2 || ct > 12.2) buf.stamp(Math.floor(C / 2 - msg.length / 2), 2, [msg], outcome ? 'yes' : 'no');
      }
    }
    return run(el, C, R, p, fill, { stillAt: 8 });
  }

  /* ── FREE WILL: a current, and one point that bends it a little ── */
  function current(el) {
    var p = pal({ fl1: { color: '#3c6e8e', glow: 0.2 }, fl2: { color: '#1a3044', glow: 0 }, me: { color: '#ff6b35', glow: 0.8, blur: 8 }, meT: { color: '#8a3412', glow: 0.2 } });
    function flowY(x, lane, t) { return lane + Math.sin(x * 0.06 + lane * 0.3 - t * 0.4) * 3; }
    function fill(buf, t) {
      for (var l = 5; l < H - 2; l += 6.5) {
        for (var x = 0; x < C; x++) {
          var off = frac(x / 14 - t * 0.5 + l * 0.13);
          plot(buf, x + 0.5, flowY(x, l, t), off < 0.25 ? '~' : '─', off < 0.25 ? 'fl1' : 'fl2');
        }
      }
      // the orange point rides the current, then leans against it for a while
      for (var k = 0; k < 70; k++) {
        var s = t - k * 0.05, x2 = (s * 9) % (C + 20) - 10;
        var lean = Math.max(0, Math.sin(s * 0.35)) ;
        var lane = H * 0.55 - Math.pow(lean, 2) * 18;
        var y2 = flowY(x2, lane, s);
        plot(buf, x2, y2, k === 0 ? '●' : k < 14 ? '█' : '▒', k < 14 ? 'me' : 'meT');
      }
    }
    return run(el, C, R, p, fill, { stillAt: 6 });
  }

  /* ── UNSKIPPABLE CUTSCENE: WALEED IS EXPLAINING ── */
  function cutscene(el) {
    var CC = 96, RR = 30;
    var p = pal({ box: { color: '#c8ccd8', glow: 0.3 }, name: { color: '#ff6b35', glow: 0.6 }, say: { color: '#ffffff', glow: 0.4 }, arrow: { color: '#00d4aa', glow: 0.7 }, face: { color: '#00d4aa', glow: 0.4 }, warn: { color: '#ff6b35', glow: 0.7 } });
    var LINES = ['okay so basically.', 'no wait, hear me out.', 'it starts with poker, but it is not about poker.', 'this connects to Musashi, I promise.', 'which is why GPUs are a philosophy question.', '(press any key to continue)', 'that was not a real option.'];
    var skipT = -99;
    function fill(buf, t) {
      var x0 = 4, y0 = 13, x1 = CC - 5, y1 = RR - 3;
      for (var x = x0; x <= x1; x++) { buf.set(x, y0, '═', 'box'); buf.set(x, y1, '═', 'box'); }
      for (var y = y0; y <= y1; y++) { buf.set(x0, y, '║', 'box'); buf.set(x1, y, '║', 'box'); }
      buf.set(x0, y0, '╔', 'box'); buf.set(x1, y0, '╗', 'box'); buf.set(x0, y1, '╚', 'box'); buf.set(x1, y1, '╝', 'box');
      // portrait
      var face = ['┌──────┐', '│ ◕  ◕ │', '│  ▿   │', '│ ╰──╯ │', '└──────┘'];
      if (Math.floor(t * 4) % 2) face[3] = '│  ──  │';
      buf.stamp(x0 + 3, y0 + 3, face, 'face');
      buf.stamp(x0 + 3, y0 - 1, [' WALEED IS EXPLAINING '], 'name');
      var per = 3.4, li = Math.floor(t / per) % LINES.length, lt = t % per, txt = LINES[li];
      var shown = txt.slice(0, Math.floor(lt * 28));
      buf.stamp(x0 + 15, y0 + 4, [shown], 'say');
      if (shown.length === txt.length && Math.floor(t * 2.5) % 2) buf.set(x1 - 3, y1 - 2, '▼', 'arrow');
      buf.stamp(x1 - 12, y1 + 1, ['SKIP ▶▶'], t - skipT < 2 ? 'warn' : 'txt');
      if (t - skipT < 2) buf.stamp(Math.floor(CC / 2 - 15), 5, ['THIS CUTSCENE CANNOT BE SKIPPED'], 'warn');
      lastT = t;
    }
    var lastT = 0;
    var api = run(el, CC, RR, p, fill, { stillAt: 4 });
    api.onClick = function () { skipT = lastT; return true; };
    return api;
  }

  /* ── WARB: a small planet, and a note that keeps coming back round ── */
  function warb(el) {
    var CC = 96, RR = 44;
    var p = pal({ pl1: { color: '#9cf7e3', glow: 0.5 }, pl2: { color: '#00a88a', glow: 0.3 }, pl3: { color: '#0a4a3c', glow: 0.05 },
      ring: { color: '#ff6b35', glow: 0.5 }, ringD: { color: '#7a3416', glow: 0.1 }, note: { color: '#ffe066', glow: 0.5 }, noteL: { color: '#8a7a2a', glow: 0.1 } });
    function fill(buf, t) {
      stars(buf, t, 6, 0.01);
      var cx = CC / 2, cy = RR * A / 2, PR = 17, RT = 0.32;
      var na = t * 0.5, nx = cx + Math.cos(na) * 38, ny = cy + Math.sin(na) * 38 * RT - 4, noteFront = Math.sin(na) > 0;
      function drawNote() {
        for (var j = 0; j < 4; j++) for (var i = 0; i < 7; i++) buf.set(Math.floor(nx) - 3 + i, Math.floor(ny / A) - 1 + j, j === 0 ? '▀' : (j === 3 ? '▄' : (i > 0 && i < 6 && j === 1 ? '─' : '█')), j === 1 && i > 0 && i < 6 ? 'noteL' : 'note');
      }
      if (!noteFront) drawNote();
      for (var pass = 0; pass < 2; pass++) for (var y = 0; y < RR; y++) for (var x = 0; x < CC; x++) {
        var dx = x + 0.5 - cx, dy = (y + 0.5) * A - cy;
        var e = Math.hypot(dx / 1.0, dy / RT), inRing = e > 22 && e < 31, back = dy < 0;
        var inPl = Math.hypot(dx, dy) < PR;
        if (pass === 0 && inRing && back) buf.set(x, y, Math.floor(e) % 3 ? '─' : '═', 'ringD');
        if (pass === 0 && inPl) {
          var nz = Math.sqrt(1 - (dx * dx + dy * dy) / (PR * PR)), lit = (-dx * 0.6 - dy * 0.5) / PR + nz * 0.6;
          var band = Math.sin((dy / PR) * 7 + AF.noise(dx * 0.2 + t * 0.3, dy * 0.3, 2) * 2) > 0.3;
          buf.set(x, y, lit > 0.6 ? '█' : lit > 0.25 ? '▓' : '▒', lit > 0.6 ? (band ? 'pl1' : 'pl2') : lit > 0.25 ? 'pl2' : 'pl3');
        }
        if (pass === 1 && inRing && !back) buf.set(x, y, Math.floor(e) % 3 ? '─' : '═', e < 26 ? 'ring' : 'ringD');
      }
      if (noteFront) drawNote();
    }
    return run(el, CC, RR, p, fill, { stillAt: 2 });
  }

  /* ── HELMET: chrome, with a road running through the visor ── */
  function helmet(el) {
    var CC = 90, RR = 46;
    var p = pal({ ch1: { color: '#f4f6ff', glow: 0.7, blur: 8 }, ch2: { color: '#a8aec4', glow: 0.3 }, ch3: { color: '#4a4f62', glow: 0.05 }, ch4: { color: '#22252e', glow: 0 },
      vis: { color: '#06070a', glow: 0 }, sky1: { color: '#ff6b35', glow: 0.5 }, sky2: { color: '#b0306a', glow: 0.3 }, sky3: { color: '#2a1a4a', glow: 0.1 },
      road: { color: '#2a2c36', glow: 0 }, lane: { color: '#ffe066', glow: 0.6 }, edgeL: { color: '#00d4aa', glow: 0.5 }, sun: { color: '#ffb36b', glow: 0.8, blur: 8 } });
    function fill(buf, t) {
      var cx = CC / 2, cy = RR * A / 2 + 1, HW = 30, HH = 38;
      var vx0 = cx - 25, vx1 = cx + 25, vy0 = cy - 6, vy1 = cy + 14, hor = vy0 + 7;
      for (var y = 0; y < RR; y++) for (var x = 0; x < CC; x++) {
        var dx = x + 0.5 - cx, dy = (y + 0.5) * A - cy;
        var sx = dx / HW, sy = dy / HH * (dy > 0 ? 1.15 : 1);
        if (Math.pow(Math.abs(sx), 2.4) + Math.pow(Math.abs(sy), 2.4) > 1) continue;
        var wx = x + 0.5, wy = (y + 0.5) * A;
        var inVis = wx > vx0 && wx < vx1 && wy > vy0 && wy < vy1 && Math.pow(Math.abs(dx / 25), 6) + Math.pow(Math.abs((wy - (vy0 + vy1) / 2) / 10), 6) < 1;
        if (inVis) {
          // the road, reflected: horizon, sun, lanes rushing toward you
          if (wy < hor) {
            var sd = Math.hypot(wx - cx, (wy - hor) * 1.4);
            if (sd < 4.5 && wy < hor - 0.3) { buf.set(x, y, Math.floor(wy) % 2 ? '█' : '▀', 'sun'); continue; }
            var g = (hor - wy) / 7;
            buf.set(x, y, g < 0.35 ? '▒' : '░', g < 0.35 ? 'sky1' : g < 0.7 ? 'sky2' : 'sky3');
          } else {
            var depth = (wy - hor) + 0.4, lx = (wx - cx) / depth;
            var edge = Math.abs(Math.abs(lx) - 2.2) < 0.25, mid = Math.abs(lx) < 0.12 && frac(6 / depth + t * 1.5) < 0.5;
            if (edge) buf.set(x, y, lx < 0 ? '/' : '\\', 'edgeL');
            else if (mid) buf.set(x, y, '│', 'lane');
            else if (Math.abs(lx) < 2.2) buf.set(x, y, '░', 'road');
            else buf.set(x, y, AF.hash(x, y, Math.floor(t * 2)) < 0.05 ? '.' : ' ', 'sky3');
          }
          continue;
        }
        // chrome: a hard horizon in the reflection plus a moving glint
        var nx = sx, ny = sy, refl = ny < -0.15 ? 0.85 - ny * 0.2 : 0.3 + (ny + 0.15) * 0.4;
        var glint = Math.exp(-Math.pow((nx + ny * 0.5) - Math.sin(t * 0.6) * 0.8, 2) * 30);
        var v = refl * (1 - Math.abs(nx) * 0.6) + glint * 0.6;
        buf.set(x, y, v > 0.75 ? '█' : v > 0.5 ? '▓' : v > 0.3 ? '▒' : '░', v > 0.75 ? 'ch1' : v > 0.5 ? 'ch2' : v > 0.3 ? 'ch3' : 'ch4');
      }
    }
    return run(el, CC, RR, p, fill, { stillAt: 2 });
  }

  global.LabHeaders = { forever: forever, sisyphus: sisyphus, sequencer: sequencer, rivers: rivers, simulation: simulation,
    bridge: bridge, agents: agents, market: market, current: current, cutscene: cutscene, warb: warb, helmet: helmet };
})(window);
