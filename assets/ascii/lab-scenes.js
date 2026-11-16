/* ═══════════════════════════════════════════════════════════════════════
   LAB SCENES — first prototypes from the reference bank
   ───────────────────────────────────────────────────────────────────────
   Each scene: LabScenes.<name>(preElement) -> { toggle(), ... }
   All built on AsciiField (ascii-field.js). Reduced-motion visitors get a
   single still frame.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var AF = global.AsciiField;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* Shared runner: fill(buf, t) draws a frame. Click toggles pause. */
  function run(el, cols, rows, palette, fill, opts) {
    opts = opts || {};
    var field = AF.create(el, { cols: cols, rows: rows, palette: palette, typing: opts.typing });
    var buf = field.buffer();
    var paused = false, tPaused = 0, offset = 0, lastT = 0;
    function frame(t) {
      buf.clear();
      fill(buf, t);
      field.draw(buf);
    }
    if (AF.reducedMotion) { frame(opts.stillAt || 4); return { toggle: function () {}, field: field }; }
    AF.animate(el, function (t) {
      lastT = t;
      if (paused) return;
      frame(t - offset);
    }, { fps: opts.fps || 24 });
    return {
      field: field,
      toggle: function () {
        paused = !paused;
        if (paused) tPaused = lastT; else offset += lastT - tPaused;
        return paused;
      }
    };
  }

  /* ── 1. WARMPOP — two dragons, orange and teal, orbiting a dark clearing ── */
  function dragons(el) {
    var C = 150, R = 52, A = 1.83, H = R * A, N = 96, ORBIT = 30;
    var pal = {
      o1: { color: '#ffc27a', glow: 0.75, blur: 8 }, o2: { color: '#ff6b35', glow: 0.55 }, o3: { color: '#a8380f', glow: 0.3 }, o4: { color: '#5a1c06', glow: 0.1 },
      t1: { color: '#9cf7e3', glow: 0.75, blur: 8 }, t2: { color: '#00d4aa', glow: 0.55 }, t3: { color: '#00806a', glow: 0.3 }, t4: { color: '#003a30', glow: 0.1 },
      mix: { color: '#fff6e6', glow: 0.95, blur: 10 }, eye: { color: '#ffffff', glow: 1, blur: 8 },
      star: { color: '#c8d0f0', glow: 0.5 }, dim: { color: '#3a4058', glow: 0 }, ground: { color: '#2a302e', glow: 0 },
      ember: { color: '#ffe2b0', glow: 0.9, blur: 12 }
    };
    var cx = C / 2, cy = H * 0.5;
    var size = C * R;
    // one layer per dragon: glyph, colour key, depth, and whether it is an outline cell
    function layer() { return { ch: new Array(size), key: new Array(size), dep: new Float32Array(size), edge: new Uint8Array(size), n: new Float32Array(size) }; }
    var L = [layer(), layer()];

    function spine(t, phase) {
      var pts = [], a0 = t * Math.PI * 2 / ORBIT + phase, tiltO = phase ? -0.2 : 0.2, co = Math.cos(tiltO), so = Math.sin(tiltO);
      for (var i = 0; i < N; i++) {
        var s = i / (N - 1);
        var ang = a0 - s * 2.3;
        var rx = 50 - (phase ? 6 : 0), ry = 22;
        var lift = Math.sin(ang * 2 + t * 0.45 + phase) * 4;
        var wave = Math.sin(s * 13 - t * 2.4 + phase) * (1.0 + 2.6 * s);
        var ox = Math.cos(ang), oy = Math.sin(ang);
        var nl = Math.hypot(ox / rx, oy / ry);
        var nx = ox / rx / nl, ny = oy / ry / nl;
        var depth = Math.sin(ang);
        var ex0 = ox * rx + nx * wave, ey0 = oy * ry + lift + ny * wave;
        var nx2 = nx * co - ny * so, ny2 = nx * so + ny * co; nx = nx2; ny = ny2;
        pts.push({ x: cx + ex0 * co - ey0 * so, y: cy + ex0 * so + ey0 * co,
                   depth: depth, sc: 1 + 0.24 * depth, s: s, nx: nx, ny: ny });
      }
      return pts;
    }
    function radius(s) { return s < 0.2 ? 3.0 + (s / 0.2) * 1.2 : 4.2 * Math.pow((1 - s) / 0.8, 0.8) + 0.3; }
    function frac(v) { return v - Math.floor(v); }

    function put(Ly, x, y, ch, key, dep, edge, n) {
      if (x < 0 || y < 0 || x >= C || y >= R) return;
      var i = y * C + x;
      if (Ly.key[i] && Ly.dep[i] > dep) return;
      Ly.ch[i] = ch; Ly.key[i] = key; Ly.dep[i] = dep; Ly.edge[i] = edge ? 1 : 0; Ly.n[i] = n;
    }

    function drawBody(Ly, pts, k, t) {
      var best = new Float32Array(size).fill(9), bs = new Float32Array(size), bside = new Int8Array(size), bdep = new Float32Array(size);
      for (var i = 0; i < N - 1; i++) {
        var p = pts[i], q = pts[i + 1];
        var r = radius(p.s) * p.sc, reach = r + 2.4 * p.sc;
        var x0 = Math.max(0, Math.floor(Math.min(p.x, q.x) - reach)), x1 = Math.min(C - 1, Math.ceil(Math.max(p.x, q.x) + reach));
        var y0 = Math.max(0, Math.floor((Math.min(p.y, q.y) - reach) / A)), y1 = Math.min(R - 1, Math.ceil((Math.max(p.y, q.y) + reach) / A));
        var sx = q.x - p.x, sy = q.y - p.y, sl = sx * sx + sy * sy || 1;
        for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
          var wx = x + 0.5, wy = (y + 0.5) * A;
          var u = clamp(((wx - p.x) * sx + (wy - p.y) * sy) / sl, 0, 1);
          var ex = wx - (p.x + sx * u), ey = wy - (p.y + sy * u);
          var n = Math.hypot(ex, ey) / r;
          var j = y * C + x;
          if (n < best[j]) { best[j] = n; bs[j] = p.s + u / (N - 1); bside[j] = (ex * p.nx + ey * p.ny) > 0 ? 1 : -1; bdep[j] = p.depth; }
        }
      }
      for (var j = 0; j < size; j++) {
        var n = best[j]; if (n > 3) continue;
        var s = bs[j], side = bside[j], x = j % C, y = (j / C) | 0, ch = null, key, edge = false;
        if (n < 1) {
          if (n > 0.82) { ch = '░'; key = k + '3'; edge = true; }
          else if (side < 0 && n > 0.25) {            // belly: plated bands
            ch = (Math.floor(s * 110) % 2) ? '=' : '█'; key = k + '2';
          } else {                                     // back: scales that shimmer down the body
            var sc = frac(s * 70 + (side > 0 ? 0.5 : 0) - t * 0.6);
            ch = n < 0.35 ? (sc < 0.5 ? '█' : '▓') : (sc < 0.5 ? '▓' : '▒');
            key = n < 0.45 ? k + '1' : k + '2';
          }
        } else if (side > 0 && s > 0.03 && s < 0.9) {  // dorsal fins, saw-toothed
          var f = frac(s * 30), fh = (1 - f) * 0.9 * (1 - s * 0.6);
          if (n - 1 < fh) { ch = n - 1 < fh * 0.5 ? '▲' : '^'; key = k + '3'; }
        } else if (s >= 0.9) {                         // tail plume
          var plume = (s - 0.9) / 0.1 * 1.6;
          if (n - 1 < plume && AF.hash(x, y, 11) < 0.7) { ch = AF.hash(x, y, 12) < 0.5 ? '≈' : '~'; key = k + '3'; }
        }
        if (ch) put(Ly, x, y, ch, key, bdep[j], edge, n);
      }
      // legs: two pairs, short and clawed, pointing back along the body
      [0.2, 0.5].forEach(function (ls) {
        var i = Math.round(ls * (N - 1)), p = pts[i], q = pts[i + 3];
        var tx = q.x - p.x, ty = q.y - p.y, tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        var r = radius(ls) * p.sc, swing = Math.sin(t * 2.4 + ls * 9) * 0.5;
        for (var pair = 0; pair < 2; pair++) {          // near leg, and the far one a step behind and dimmer
          var off = pair * 2.2 * p.sc;
          var bx = p.x - p.nx * r * 0.6 + tx * off, by = p.y - p.ny * r * 0.6 + ty * off;
          var dx = -p.nx * 0.8 + tx * (0.6 + swing), dy = -p.ny * 0.8 + ty * (0.6 + swing);
          var len = 5 * p.sc, gl = AF.lineChar(dx, dy), dp = p.depth - pair * 0.03 - 0.01;
          for (var u = 0; u <= len; u += 0.5) put(Ly, Math.floor(bx + dx * u), Math.floor((by + dy * u) / A), gl, k + (pair ? '4' : '2'), dp, false, 0.9);
          put(Ly, Math.floor(bx + dx * len + tx), Math.floor((by + dy * len + ty) / A), 'w', k + (pair ? '3' : '1'), dp, false, 0.9);
        }
      });
    }

    function drawHead(Ly, pts, k, t) {
      var p = pts[0], q = pts[4], sc = p.sc * 1.45;
      var tx = p.x - q.x, ty = p.y - q.y, tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      var nx = -ty, ny = tx; if (nx * p.nx + ny * p.ny < 0) { nx = -nx; ny = -ny; }   // b axis points outward (dorsal)
      var dep = p.depth + 0.05, reach = 20 * sc;
      function W(a, b) { return [p.x + (tx * a + nx * b) * sc, p.y + (ty * a + ny * b) * sc]; }
      var jaw = 0.25 + 0.2 * Math.max(0, Math.sin(t * 0.8));
      var EW = W(2.6, 1.5), eyeX = Math.floor(EW[0]), eyeY = Math.floor(EW[1] / A);
      var x0 = Math.max(0, Math.floor(p.x - reach)), x1 = Math.min(C - 1, Math.ceil(p.x + reach));
      var y0 = Math.max(0, Math.floor((p.y - reach) / A)), y1 = Math.min(R - 1, Math.ceil((p.y + reach) / A));
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
        var wx = x + 0.5 - p.x, wy = (y + 0.5) * A - p.y;
        var a = (wx * tx + wy * ty) / sc, b = (wx * nx + wy * ny) / sc;
        var skull = Math.pow((a - 0.6) / 4.4, 2) + Math.pow((b - 0.5) / 3.3, 2);
        var snout = Math.pow((a - 5.6) / 3.8, 2) + Math.pow((b - 0.4) / 1.8, 2);
        var jawE = Math.pow((a - 4.4) / 3.6, 2) + Math.pow((b + 1.6 + jaw * 2) / 1.0, 2);
        var brow = Math.pow((a - 2.4) / 2.0, 2) + Math.pow((b - 2.7) / 0.7, 2);
        var gap = a > 2.2 && a < 9 && b < -0.9 && b > -1.6 - jaw * 1.4 && jawE > 1;
        var ch = null, key, edge = false;
        if (x === eyeX && y === eyeY) { ch = '●'; key = 'eye'; }
        else if (Math.hypot(a - 2.6, b - 1.5) < 0.9) { ch = '▓'; key = k + '4'; }
        else if (Math.hypot(a - 8.4, b - 1.0) < 0.5) { ch = '·'; key = k + '4'; }
        else if (brow < 1) { ch = '▀'; key = k + '2'; }
        else if (gap) { if (a > 3 && frac(a * 0.9) < 0.35) { ch = b > -1.2 ? 'v' : '^'; key = k + '1'; } }
        else if (skull < 1 || snout < 1) {
          var m = Math.min(skull, snout);
          if (m > 0.72) { ch = '▓'; key = k + '2'; edge = true; } else { ch = b > 0.3 ? '█' : '▓'; key = b > 0.3 ? k + '1' : k + '2'; }
        } else if (jawE < 1) { ch = jawE > 0.6 ? '▒' : '▓'; key = k + '2'; }
        else if (a < 0.5 && a > -6.5 && Math.abs(b) < 4.2 + a * -0.2) {   // mane streaming back
          var strand = AF.noise(a * 0.7 + t * 1.5, b * 1.3 + (k === 'o' ? 0 : 9));
          if (strand > 0.58) { ch = strand > 0.7 ? '≈' : '~'; key = k + '3'; }
        }
        if (ch) put(Ly, x, y, ch, key, dep, edge, 0.5);
      }
      // horns and whiskers, drawn as lines
      function line(pa, pb, key, steps) {
        var A0 = W(pa[0], pa[1]), B0 = W(pb[0], pb[1]);
        var g = AF.lineChar(B0[0] - A0[0], B0[1] - A0[1]);
        for (var i = 0; i <= steps; i++) { var u = i / steps; put(Ly, Math.floor(A0[0] + (B0[0] - A0[0]) * u), Math.floor((A0[1] + (B0[1] - A0[1]) * u) / A), g, key, dep + 0.01, false, 0.5); }
      }
      line([-0.4, 3.0], [-5.0, 5.6], k + '1', 14);
      line([0.8, 3.2], [-2.6, 6.4], k + '2', 12);
      for (var w = -1; w <= 1; w += 2) {
        var prev = null;
        for (var u = 0; u <= 11; u += 0.3) {
          var a = 8.6 - u * 0.8, b = (w > 0 ? 0.6 : -1.0) + w * u * 0.32 + Math.sin(u * 0.45 - t * 3 + w) * 1.3;
          var P = W(a, b);
          if (prev) put(Ly, Math.floor(P[0]), Math.floor(P[1] / A), u < 6 ? '~' : '·', u < 6 ? k + '2' : k + '3', dep, false, 0.5);
          prev = P;
        }
      }
    }

    function fill(buf, t) {
      var d = [spine(t, 0), spine(t, Math.PI)];
      for (var li = 0; li < 2; li++) { L[li].key.fill(undefined); }
      drawBody(L[0], d[0], 'o', t); drawHead(L[0], d[0], 'o', t);
      drawBody(L[1], d[1], 't', t); drawHead(L[1], d[1], 't', t);
      var ember = 0.6 + 0.4 * Math.sin(t * 1.7);
      for (var y = 0; y < R; y++) {
        var wy = (y + 0.5) * A;
        for (var x = 0; x < C; x++) {
          var i = y * C + x, wx = x + 0.5;
          var a = L[0].key[i], b = L[1].key[i];
          if (a || b) {
            var Fr = null, Bk = null;
            if (a && b) { Fr = L[0].dep[i] >= L[1].dep[i] ? L[0] : L[1]; Bk = Fr === L[0] ? L[1] : L[0]; }
            else Fr = a ? L[0] : L[1];
            // where the two cross, the front one's outline turns white
            if (Bk && Fr.edge[i] && Bk.n[i] < 1) buf.set(x, y, '█', 'mix');
            else buf.set(x, y, Fr.ch[i], Fr.key[i]);
            continue;
          }
          // the clearing: a faint ring of ground and a small fire at its centre
          var ex = (wx - cx) / 36, ey = (wy - (cy + 20)) / 6.5, e = ex * ex + ey * ey;
          var cd = Math.hypot((wx - cx) / 1.0, (wy - (cy + 18)) / 1.2);
          if (cd < 2.6 * ember) { buf.set(x, y, cd < 1.2 ? '▲' : '^', 'ember'); continue; }
          if (cd < 7) { var g = AF.hash(x, y, Math.floor(t * 6)); if (g < 0.12 * (1 - cd / 7)) { buf.set(x, y, '.', 'ember'); continue; } }
          if (e > 0.85 && e < 1.25 && AF.hash(x, y, 3) < 0.45) { buf.set(x, y, AF.hash(x, y, 4) < 0.5 ? ',' : '`', 'ground'); continue; }
          var h = AF.hash(x, y, 7);
          if (h < 0.012) buf.set(x, y, h < 0.004 ? '+' : '.', Math.sin(t * 1.3 + h * 999) > 0 ? 'star' : 'dim');
        }
      }
    }
    return run(el, C, R, pal, fill, { stillAt: 6 });
  }

  /* ── 2. LUCKYBLOCK.EXE — a dropped item: spinning, bobbing, suspicious ── */
  function luckyBlock(el) {
    var C = 112, R = 50, A = 1.83;
    var pal = {
      y1: { color: '#fff07a', glow: 0.65, blur: 8 }, y2: { color: '#f5c518', glow: 0.45 }, y3: { color: '#b8860b', glow: 0.25 }, y4: { color: '#6e4e06', glow: 0.1 },
      q1: { color: '#ffffff', glow: 0.8, blur: 6 }, q2: { color: '#e9e2c8', glow: 0.4 }, q3: { color: '#9a9070', glow: 0.15 },
      s1: { color: '#8a5d05', glow: 0.1 },
      shadow: { color: '#26261e', glow: 0 }, label: { color: '#ff6b35', glow: 0.5 },
      bit: { color: '#fff07a', glow: 0.7, blur: 6 }, bitT: { color: '#00d4aa', glow: 0.7, blur: 6 }
    };
    // 12x12 face: B rim, Y fill, Q question mark, S its drop shadow
    var TEX = [
      'BBBBBBBBBBBB',
      'BYYYYYYYYYYB',
      'BYYYQQQQYYYB',
      'BYYQQSSSQQYB',
      'BYYQQSYYQQSB',
      'BYYYSSYQQSYB',
      'BYYYYYQQSYYB',
      'BYYYYYQQSYYB',
      'BYYYYYYSSYYB',
      'BYYYYYQQYYYB',
      'BYYYYYQQSYYB',
      'BBBBBBBBBBBB'
    ];
    var LIGHT = norm([-0.45, -0.75, -0.5]);   // towards the light: upper left, in front (view space, y down)
    function norm(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
    var popped = false, popT = 0, bits = [];
    function fill(buf, t) {
      var S = 17;
      var yaw = t * 0.8, tilt = 0.42 + Math.sin(t * 0.5) * 0.05;
      var bob = Math.sin(t * 2.0) * 1.8;
      var cxw = C / 2, cyw = R * A * 0.42 + bob, floorY = R * A * 0.84;
      var cyy = Math.cos(yaw), syy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
      // M = Rx(tilt) * Ry(yaw) maps cube-local to view; we need M^T for rays
      function toView(v) {   // Ry then Rx
        var x = v[0] * cyy + v[2] * syy, z = -v[0] * syy + v[2] * cyy, y = v[1];
        return [x, y * ct - z * st, y * st + z * ct];
      }
      function toLocal(v) {  // inverse: Rx^T then Ry^T
        var y = v[1] * ct + v[2] * st, z = -v[1] * st + v[2] * ct, x = v[0];
        return [x * cyy - z * syy, y, x * syy + z * cyy];
      }
      var d = toLocal([0, 0, 1]);
      var squash = popped ? 0 : 1;
      for (var y = 0; y < R; y++) {
        for (var x = 0; x < C; x++) {
          var px = x + 0.5 - cxw, wy = (y + 0.5) * A, py = wy - cyw;
          var fy = wy - floorY, shw = (px * px) / (22 * 22) + (fy * fy) / (2.4 * 2.4) * (1 + bob * 0.05);
          if (shw < 1 && squash) buf.set(x, y, shw < 0.45 ? '▒' : '░', 'shadow');
          if (!squash) continue;
          var o = toLocal([px, py, -200]);
          var hit = slab(o, d, S);
          if (!hit) continue;
          var nv = toView(hit.n);
          var lum = 0.32 + 0.68 * Math.max(0, nv[0] * LIGHT[0] + nv[1] * LIGHT[1] + nv[2] * LIGHT[2]);
          var lv = lum > 0.8 ? 0 : lum > 0.58 ? 1 : lum > 0.42 ? 2 : 3;
          var tx = clamp(Math.floor(hit.u * 12), 0, 11), ty = clamp(Math.floor(hit.v * 12), 0, 11);
          var tex = TEX[ty][tx], ch = '█', key;
          if (tex === 'Q') key = 'q' + Math.min(3, lv + 1);
          else if (tex === 'S') key = 's1';
          else if (tex === 'B') key = 'y' + Math.min(4, lv + 2);
          else { key = 'y' + (lv + 1); if (AF.hash(Math.floor(hit.u * 24), Math.floor(hit.v * 24), hit.f) < 0.07) ch = '▓'; }
          // edges between faces read as a darker seam
          var eu = Math.min(hit.u, 1 - hit.u), ev = Math.min(hit.v, 1 - hit.v);
          if (Math.min(eu, ev) < 0.018) { ch = '▓'; key = 'y4'; }
          buf.set(x, y, ch, key);
        }
      }
      var label = 'LUCKYBLOCK.EXE';
      buf.stamp(Math.floor((C - label.length) / 2), R - 2, [label], 'label');
      if (popped) {
        if (popT < 0) popT = t;
        var dt = t - popT;
        for (var i = 0; i < bits.length; i++) {
          var b = bits[i];
          var bx = b.x + b.vx * dt, byy = b.y + b.vy * dt + 26 * dt * dt;
          if (byy > floorY) byy = floorY;
          buf.set(Math.floor(bx), Math.floor(byy / A), b.ch, b.key);
        }
        if (dt > 3.4) popped = false;
      }
    }
    // ray vs cube [-S,S]^3 in local space; returns outward normal, face id and upright uv
    function slab(o, d, S) {
      var tmin = -1e9, tmax = 1e9, axis = -1, sgn = 0;
      for (var a = 0; a < 3; a++) {
        if (Math.abs(d[a]) < 1e-9) { if (o[a] < -S || o[a] > S) return null; continue; }
        var t1 = (-S - o[a]) / d[a], t2 = (S - o[a]) / d[a], s = -1;
        if (t1 > t2) { var tmp = t1; t1 = t2; t2 = tmp; s = 1; }
        if (t1 > tmin) { tmin = t1; axis = a; sgn = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return null;
      }
      var p = [o[0] + d[0] * tmin, o[1] + d[1] * tmin, o[2] + d[2] * tmin];
      var n = [0, 0, 0]; n[axis] = sgn;
      // right vector on the face = up x n with up = (0,-1,0); v runs down the face (+y)
      var r, u, v;
      if (axis === 1) { u = (p[0] + S) / (2 * S); v = (p[2] + S) / (2 * S); if (sgn < 0) v = 1 - v; }
      else {
        r = [-n[2], 0, n[0]];   // (0,-1,0) x n
        u = ((p[0] * r[0] + p[2] * r[2]) + S) / (2 * S);
        v = (p[1] + S) / (2 * S);
      }
      return { n: n, u: u, v: v, f: axis * 2 + (sgn > 0 ? 1 : 0) };
    }
    var api = run(el, C, R, pal, fill, { stillAt: 0.6 });
    api.pop = function () {
      popped = true; popT = -1; bits = [];
      var cy = R * A * 0.42, glyphs = ['■', '▪', '◆', '*', '+', '?'];
      for (var i = 0; i < 70; i++) {
        var a = Math.random() * Math.PI * 2, sp = 8 + Math.random() * 30;
        bits.push({ x: C / 2 + Math.cos(a) * 6, y: cy + Math.sin(a) * 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 22, ch: glyphs[i % glyphs.length], key: i % 5 ? 'bit' : 'bitT' });
      }
    };
    return api;
  }

  /* ── 3. YIN YANG — breathing, with a boundary that never quite settles ── */
  function yinYang(el) {
    var C = 100, R = 50;
    var pal = {
      light: { color: '#f4f1e8', glow: 0.6, blur: 8 }, lightEdge: { color: '#b9b4a6', glow: 0.3 },
      dark: { color: '#2b2e3a', glow: 0 }, darkEdge: { color: '#454a5c', glow: 0 },
      rim: { color: '#00d4aa', glow: 0.5 }, dotL: { color: '#ff6b35', glow: 0.7, blur: 8 }, dotD: { color: '#141620', glow: 0 }
    };
    var A = 1.83;
    // light half: right side, plus the upper small disc, minus the lower one
    function side(px, py, h) {
      if (Math.hypot(px, py + h) < h) return true;
      if (Math.hypot(px, py - h) < h) return false;
      return px > 0;
    }
    function fill(buf, t) {
      var cx = C / 2, cy = R * A / 2;
      var Rr = 39 * (1 + 0.025 * Math.sin(t * 0.9));       // breath
      var rot = t * 0.12;
      var cr = Math.cos(rot), sr = Math.sin(rot);
      for (var y = 0; y < R; y++) {
        for (var x = 0; x < C; x++) {
          var dx = x + 0.5 - cx, dy = (y + 0.5) * A - cy;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > Rr + 1.2) continue;
          if (d > Rr - 0.4) { buf.set(x, y, '·', 'rim'); continue; }
          var px = dx * cr + dy * sr, py = -dx * sr + dy * cr;
          // the imperfect boundary: a slow wave along the S-curve, area stays balanced
          px += Math.sin(py / Rr * 5 + t * 0.7) * Rr * 0.035;
          var h = Rr / 2;
          var dTop = Math.hypot(px, py + h), dBot = Math.hypot(px, py - h);
          var light = side(px, py, h);
          var ch, key;
          if (dTop < Rr / 8) { ch = '█'; key = 'dotD'; }
          else if (dBot < Rr / 8) { ch = '█'; key = 'dotL'; }
          else if (light) {
            var edge = !side(px + 1.2, py, h) || !side(px - 1.2, py, h) || !side(px, py + 1.4, h) || !side(px, py - 1.4, h);
            ch = edge ? '▓' : '█'; key = edge ? 'lightEdge' : 'light';
          } else {
            ch = AF.hash(x, y, 5) < 0.5 ? '▒' : '░'; key = 'dark';
          }
          buf.set(x, y, ch, key);
        }
      }
    }
    return run(el, C, R, pal, fill, { stillAt: 2 });
  }

  /* ── 4. PATHS — image to ASCII from pics/Paths.png, light that breathes ── */
  function paths(el) {
    var L = global.PATHS_LUMA;
    var raw = atob(L.data), lum = new Float32Array(raw.length);
    for (var i = 0; i < raw.length; i++) lum[i] = raw.charCodeAt(i) / 255;
    var C = L.cols, R = L.rows;
    var pal = {
      w1: { color: '#ffffff', glow: 0.85, blur: 9 }, w2: { color: '#d9e8ff', glow: 0.5 },
      w3: { color: '#8c97ad', glow: 0.2 }, w4: { color: '#4a5266', glow: 0 }, w5: { color: '#272c3a', glow: 0 },
      fig: { color: '#ff6b35', glow: 0.6 }
    };
    var RAMP = ' .,:;-=+*#%▒▓█';
    function fill(buf, t) {
      for (var y = 0; y < R; y++) {
        for (var x = 0; x < C; x++) {
          var v = lum[y * C + x];
          // the light column and its tendrils pulse upward; the dark stays still
          if (v > 0.45) v *= 0.9 + 0.12 * Math.sin(t * 1.6 - y * 0.35 + AF.noise(x * 0.2, y * 0.2, 4) * 6);
          // stars: isolated bright cells twinkle
          var nb = (lum[y * C + Math.max(0, x - 1)] + lum[y * C + Math.min(C - 1, x + 1)]) / 2;
          if (v > 0.3 && nb < 0.2) v = v * (0.6 + 0.4 * Math.sin(t * 2 + x * 7.1 + y * 3.3));
          v = clamp(v, 0, 1);
          if (v < 0.08) continue;
          var ch = RAMP.charAt(Math.min(RAMP.length - 1, Math.floor(Math.pow(v, 1.1) * RAMP.length)));
          var key = v > 0.85 ? 'w1' : v > 0.65 ? 'w2' : v > 0.42 ? 'w3' : v > 0.22 ? 'w4' : 'w5';
          buf.set(x, y, ch, key);
        }
      }
      // the figure at the foot of the light, kept still and marked in orange
      var fx = Math.round(C * 0.497), fy = Math.round(R * 0.76);
      buf.set(fx, fy, '▲', 'fig'); buf.set(fx, fy + 1, '█', 'fig'); buf.set(fx, fy + 2, '▌', 'fig');
    }
    return run(el, C, R, pal, fill, { stillAt: 1 });
  }

  global.LabScenes = { dragons: dragons, luckyBlock: luckyBlock, yinYang: yinYang, paths: paths };
})(window);
