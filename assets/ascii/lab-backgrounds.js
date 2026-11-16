/* ═══════════════════════════════════════════════════════════════════════
   LAB BACKGROUNDS: wide, slow, low-contrast scenes meant to sit behind
   text (needs ascii-field.js and lab-scenes.js).
   LabBackgrounds.<name>(pre) -> { toggle(), field }
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var AF = global.AsciiField, run = global.LabScenes.run, A = 1.83;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(e0, e1, v) { var t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function frac(v) { return v - Math.floor(v); }
  var C = 150, R = 46;

  /* ── SEXTAPE: under the surface, light coming down in sheets ── */
  function underwater(el) {
    var pal = {
      s1: { color: '#bff4ff', glow: 0.7, blur: 9 }, s2: { color: '#5ec8e0', glow: 0.45 }, s3: { color: '#2a7c9c', glow: 0.25 }, s4: { color: '#123a52', glow: 0.1 }, s5: { color: '#0a1e2e', glow: 0 },
      bub: { color: '#dff8ff', glow: 0.6 }, surf: { color: '#e8fcff', glow: 0.8, blur: 8 }
    };
    var bubbles = [];
    for (var i = 0; i < 26; i++) bubbles.push({ x: Math.random() * C, s: 0.6 + Math.random() * 1.2, p: Math.random() * 40, w: Math.random() * 6 });
    function fill(buf, t) {
      for (var y = 0; y < R; y++) {
        var wy = (y + 0.5) * A, depth = y / R;
        for (var x = 0; x < C; x++) {
          var wx = x + 0.5;
          // surface: a bright wobbling band seen from below
          var surf = 3 + Math.sin(wx * 0.11 + t * 0.9) * 1.2 + Math.sin(wx * 0.05 - t * 0.5) * 1.5;
          if (wy < surf) { if (AF.hash(x, y, Math.floor(t * 5)) < 0.55) buf.set(x, y, Math.sin(wx * 0.4 + t * 2) > 0 ? '≈' : '~', 'surf'); continue; }
          // shafts slant down from the surface and sway
          var sx = wx - wy * 0.35;
          var shaft = Math.pow(Math.max(0, Math.sin(sx * 0.16 + AF.noise(sx * 0.03, t * 0.08, 3) * 6)), 8) * (1 - depth) * 0.9;
          // caustics: a warped grid of thin bright lines
          var cu = wx * 0.16 + AF.noise(wx * 0.05, wy * 0.07 + t * 0.25, 1) * 5, cv = wy * 0.22 + AF.noise(wx * 0.05 + t * 0.2, wy * 0.07, 2) * 5;
          var web = Math.max(0, 1 - Math.abs(Math.sin(cu)) * 5, 1 - Math.abs(Math.sin(cv)) * 5);
          var caus = web * (depth < 0.3 ? 0.55 * (1 - depth / 0.3) : depth > 0.82 ? (depth - 0.82) * 4.5 : 0);
          var v = shaft * 0.75 + caus + (1 - depth) * 0.08;
          if (depth > 0.86) v += 0.12;                          // the sandy floor
          var ch = v > 0.7 ? '▓' : v > 0.48 ? '▒' : v > 0.3 ? '░' : v > 0.16 ? ':' : v > 0.08 ? '.' : ' ';
          var key = v > 0.7 ? 's1' : v > 0.48 ? 's2' : v > 0.3 ? 's3' : v > 0.16 ? 's4' : 's5';
          if (ch !== ' ') buf.set(x, y, ch, key);
        }
      }
      for (var b = 0; b < bubbles.length; b++) {
        var B = bubbles[b], yy = (R + 4) - ((t * B.s * 3 + B.p) % (R + 6));
        buf.set(Math.floor(B.x + Math.sin(t * 1.5 + B.w) * 1.2), Math.floor(yy), B.s > 1.3 ? 'o' : '°', 'bub');
      }
    }
    return run(el, C, R, pal, fill, { stillAt: 3, fps: 20 });
  }

  /* ── ARRAKIS: dunes at dusk, sand coming off the crests, two moons ── */
  function dunes(el) {
    var pal = {
      sky1: { color: '#3a1e2a', glow: 0 }, sky2: { color: '#6a3022', glow: 0.1 }, moon: { color: '#f4e6cc', glow: 0.7, blur: 8 }, moon2: { color: '#c8b8a0', glow: 0.4 },
      lit1: { color: '#ffb36b', glow: 0.5 }, lit2: { color: '#d98040', glow: 0.3 }, sh1: { color: '#6a3018', glow: 0.05 }, sh2: { color: '#3a180c', glow: 0 },
      crest: { color: '#ffe0b0', glow: 0.7, blur: 6 }, blow: { color: '#e8b080', glow: 0.35 }, star: { color: '#c8b8b0', glow: 0.3 }
    };
    var LAYERS = [
      { base: 0.56, amp: 9, f: 0.045, ph: 1.0, sp: 0.4 },
      { base: 0.70, amp: 12, f: 0.032, ph: 4.0, sp: 0.6 },
      { base: 0.88, amp: 15, f: 0.022, ph: 7.0, sp: 0.9 }
    ];
    function crestY(L, wx, t) {
      var u = wx * L.f + L.ph + t * 0.004 * L.sp;
      return R * A * L.base - L.amp * (0.5 + 0.5 * Math.sin(u) + 0.35 * Math.sin(u * 2.3 + 1.7) + 0.15 * Math.sin(u * 5.1));
    }
    function fill(buf, t) {
      var worm = frac(t / 40), wormX = -20 + worm * (C + 40);
      for (var x = 0; x < C; x++) {
        var wx = x + 0.5, cyL = [];
        for (var l = 0; l < 3; l++) cyL.push(crestY(LAYERS[l], wx, t));
        // the worm: a long low bulge passing under the nearest dune every 40 s
        var wb = Math.exp(-Math.pow((wx - wormX) / 9, 2)) * 2.4;
        cyL[2] -= wb;
        for (var y = 0; y < R; y++) {
          var wy = (y + 0.5) * A, ch = null, key;
          var layer = -1;
          for (var l2 = 2; l2 >= 0; l2--) if (wy > cyL[l2]) { layer = l2; break; }
          if (layer < 0) {
            var sky = y / (R * 0.5);
            if (AF.hash(x, y, 4) < 0.006 * (1 - sky)) { ch = '.'; key = 'star'; }
            else if (sky > 0.55 && AF.hash(x, y, 5) < (sky - 0.55) * 0.5) { ch = '·'; key = sky > 0.8 ? 'sky2' : 'sky1'; }
            // two moons
            var m1 = Math.hypot(wx - 112, (wy - 14) ), m2 = Math.hypot(wx - 124, (wy - 8));
            if (m1 < 5) { ch = m1 < 4 ? '█' : '▓'; key = 'moon'; }
            else if (m2 < 2.4) { ch = '▓'; key = 'moon2'; }
            // sand lifting off the crests in the wind
            for (var l3 = 0; l3 < 3; l3++) {
              var above = cyL[l3] - wy;
              if (above > 0 && above < 5 && AF.noise(wx * 0.3 - t * (2 + l3), wy * 0.5, l3) > 0.62 + above * 0.06) { ch = '`'; key = 'blow'; }
            }
            if (ch) buf.set(x, y, ch, key);
            continue;
          }
          var slope = crestY(LAYERS[layer], wx + 0.8, t) - crestY(LAYERS[layer], wx - 0.8, t);
          var d = wy - cyL[layer];
          var shadow = slope < 0 && d < 2 + Math.abs(slope) * 10;    // the lee side, just under the crest
          var rip = Math.sin(wx * 0.7 + d * 1.1 + layer * 2) > 0.7;
          var tone = layer + (d < 4 ? 1 : 0);
          if (d < 1.2) { ch = '▀'; key = slope > 0 ? 'crest' : 'lit1'; }
          else if (shadow) { ch = '░'; key = 'sh2'; }
          else { ch = rip ? '≈' : (tone >= 2 ? '▒' : '░'); key = tone >= 3 ? 'lit1' : tone >= 2 ? 'lit2' : 'sh1'; }
          buf.set(x, y, ch, key);
        }
      }
    }
    return run(el, C, R, pal, fill, { stillAt: 5, fps: 15 });
  }

  /* ── HEAVEN OR LAS VEGAS: city lights out of focus, rain on the glass ── */
  function neonGlass(el) {
    var pal = {
      pk: { color: '#ff7ac8', glow: 0.6, blur: 10 }, pkD: { color: '#7a2a5e', glow: 0.2 }, pu: { color: '#a98bff', glow: 0.6, blur: 10 }, puD: { color: '#3e2c78', glow: 0.2 },
      or: { color: '#ffb066', glow: 0.6, blur: 10 }, orD: { color: '#7a4220', glow: 0.2 }, te: { color: '#6ff0d4', glow: 0.6, blur: 10 }, teD: { color: '#1e5e52', glow: 0.2 },
      drop: { color: '#ffffff', glow: 0.8 }, trail: { color: '#9aa0b8', glow: 0.2 }
    };
    var HUES = ['pk', 'pu', 'or', 'te'];
    var rnd = AF.rng(11), LIGHTS = [];
    for (var i = 0; i < 34; i++) LIGHTS.push({ x: rnd() * C, y: (0.2 + rnd() * 0.75) * R * A, r: 4 + rnd() * 9, h: HUES[Math.floor(rnd() * 4)], ph: rnd() * 6, sp: (rnd() - 0.5) * 0.6 });
    var DROPS = [];
    for (var j = 0; j < 30; j++) DROPS.push({ x: rnd() * C, y: rnd() * R, v: 0, wait: rnd() * 6 });
    var lastT = 0;
    function fill(buf, t) {
      var dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
      for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) {
        var wx = x + 0.5, wy = (y + 0.5) * A, best = 0, hk = null;
        for (var k = 0; k < LIGHTS.length; k++) {
          var L = LIGHTS[k], lx = (L.x + t * L.sp + C) % C;
          var d = Math.hypot(wx - lx, wy - L.y) / L.r;
          if (d < 1) {
            var v = (0.6 + 0.4 * Math.sin(t * 0.7 + L.ph)) * (d > 0.88 ? 1.2 : 0.8 - d * 0.3);   // bokeh discs have a brighter rim
            if (v > best) { best = v; hk = L.h; }
          }
        }
        if (hk) buf.set(x, y, best > 0.9 ? '▒' : '░', best > 0.9 ? hk : hk + 'D');
      }
      // drops sit still, then run, leaving a short trail
      for (var m = 0; m < DROPS.length; m++) {
        var D = DROPS[m];
        if (D.wait > 0) D.wait -= dt; else { D.v = Math.min(9, D.v + dt * 6); D.y += D.v * dt; }
        if (D.y > R + 1) { D.y = -1 - rnd() * 6; D.x = rnd() * C; D.v = 0; D.wait = 1 + rnd() * 6; }
        var dx = Math.floor(D.x), dy = Math.floor(D.y);
        buf.set(dx, dy, D.v > 0 ? 'o' : '·', 'drop');
        if (D.v > 0) for (var s = 1; s < 4; s++) buf.set(dx, dy - s, '¦', 'trail');
      }
    }
    return run(el, C, R, pal, fill, { stillAt: 2, fps: 20 });
  }

  /* ── CHANNEL ORANGE: a dark hallway, an orange room at the end ── */
  function orangeRoom(el) {
    var pal = {
      o1: { color: '#ffb066', glow: 0.8, blur: 12 }, o2: { color: '#ff8a2a', glow: 0.6 }, o3: { color: '#c85a14', glow: 0.35 },
      w1: { color: '#6a3a1e', glow: 0.1 }, w2: { color: '#3a2214', glow: 0 }, w3: { color: '#1e140e', glow: 0 },
      fr: { color: '#2a1a10', glow: 0 }
    };
    function fill(buf, t) {
      var vx = C / 2, vy = R * A * 0.52, W = 1, H = 0.62;
      var ew = 14, eh = ew * H;                               // the far doorway, in world units on screen
      var flick = 0.92 + 0.08 * Math.sin(t * 0.9) + (AF.hash(Math.floor(t * 8), 1, 1) > 0.97 ? -0.15 : 0);
      for (var y = 0; y < R; y++) for (var x = 0; x < C; x++) {
        var dx = x + 0.5 - vx, dy = (y + 0.5) * A - vy;
        var sx = Math.abs(dx) / (ew * W), sy = Math.abs(dy) / eh, s = Math.max(sx, sy);
        var ch, key;
        if (s < 1) {
          // inside the room: warm light, a floor line and a window frame
          var floor = dy > eh * 0.35;
          var win = Math.abs(dx + 4) < 4 && dy > -eh * 0.7 && dy < -eh * 0.1;
          var v = (floor ? 0.65 : 0.9) * flick;
          ch = win ? (Math.abs(dx + 4) < 0.5 || Math.abs(dy + eh * 0.4) < 0.9 ? '█' : '▓') : (v > 0.8 ? '█' : '▓');
          key = win ? 'o1' : v > 0.8 ? 'o2' : 'o3';
          if (floor && Math.abs(dy - eh * 0.35) < 1) { ch = '▀'; key = 'o1'; }
          buf.set(x, y, ch, key); continue;
        }
        var z = 1 / s;                                            // 1 at the doorway, falling toward the viewer
        var wall = sx > sy, along = 1 / z;                       // distance from the doorway
        var light = Math.pow(z, 1.4) * flick;
        if (!wall && dy > 0) light *= 1.25;                      // spill on the floor
        var ring = frac(along * 1.2) < 0.06 * along;             // door frames every so often
        if (ring && along > 1.15) { buf.set(x, y, wall ? '│' : '─', 'fr'); continue; }
        var tex = wall ? (frac(dy / along * 0.25) < 0.5) : (frac(dx / along * 0.12) < 0.5);
        if (light > 0.55) { ch = tex ? '▓' : '▒'; key = 'w1'; }
        else if (light > 0.28) { ch = tex ? '▒' : '░'; key = 'w2'; }
        else if (light > 0.1) { ch = tex ? '░' : '.'; key = 'w3'; }
        else continue;
        buf.set(x, y, ch, key);
      }
    }
    return run(el, C, R, pal, fill, { stillAt: 2, fps: 15 });
  }

  /* ── KID A: sharp ridgeline, red weather moving over it ── */
  function ridgeline(el) {
    var pal = {
      ice1: { color: '#eef6ff', glow: 0.55, blur: 7 }, ice2: { color: '#a8bed6', glow: 0.25 }, ice3: { color: '#55687e', glow: 0.05 }, ice4: { color: '#28323e', glow: 0 },
      red1: { color: '#ff4a3a', glow: 0.55, blur: 10 }, red2: { color: '#a8241c', glow: 0.25 }, red3: { color: '#4e1210', glow: 0 },
      snow: { color: '#ffffff', glow: 0.5 }
    };
    function ridge(wx) {
      // ridged noise: peaks come to points instead of rounding off
      var h = 0, amp = 1, f = 0.02;
      for (var o = 0; o < 4; o++) { h += (1 - Math.abs(AF.noise(wx * f, o * 7.3, 5) * 2 - 1)) * amp; amp *= 0.5; f *= 2.1; }
      return h / 1.9;
    }
    var snow = [];
    for (var i = 0; i < 60; i++) snow.push({ x: Math.random() * C, y: Math.random() * R, s: 0.4 + Math.random() * 0.8 });
    function fill(buf, t) {
      for (var x = 0; x < C; x++) {
        var wx = x + 0.5;
        var top1 = R * A * (0.72 - ridge(wx) * 0.42), top2 = R * A * (0.84 - ridge(wx + 300) * 0.3);
        for (var y = 0; y < R; y++) {
          var wy = (y + 0.5) * A;
          if (wy < top1 && wy < top2) {
            // the stain: slow red clouds over the peaks
            var c = AF.noise(wx * 0.03 - t * 0.04, wy * 0.05, 8) + AF.noise(wx * 0.07 - t * 0.07, wy * 0.1, 9) * 0.5;
            var v = (c - 0.75) * 2 * (1 - wy / (R * A));
            if (v > 0.45) buf.set(x, y, '▓', 'red1');
            else if (v > 0.3) buf.set(x, y, '▒', 'red2');
            else if (v > 0.17) buf.set(x, y, '░', 'red3');
            continue;
          }
          var front = wy >= top2, top = front ? top2 : top1, d = wy - top;
          var slope = front ? (ridge(wx + 300.8) - ridge(wx + 299.2)) : (ridge(wx + 0.8) - ridge(wx - 0.8));
          var lit = slope > 0;
          var ch, key;
          if (d < 1.4) { ch = lit ? '▄' : '_'; key = lit ? 'ice1' : 'ice2'; }
          else if (lit) { ch = d < 8 ? '▓' : '▒'; key = d < 8 ? 'ice1' : 'ice2'; }
          else { ch = d < 8 ? '▒' : '░'; key = front ? 'ice3' : 'ice4'; }
          if (AF.hash(x, y, 2) < 0.08) ch = '/';
          buf.set(x, y, ch, key);
        }
      }
      for (var s = 0; s < snow.length; s++) {
        var S = snow[s], yy = (S.y + t * S.s * 1.2) % R;
        buf.set(Math.floor((S.x + Math.sin(t * 0.5 + s) * 2 + C) % C), Math.floor(yy), '·', 'snow');
      }
    }
    return run(el, C, R, pal, fill, { stillAt: 6, fps: 15 });
  }

  global.LabBackgrounds = { underwater: underwater, dunes: dunes, neonGlass: neonGlass, orangeRoom: orangeRoom, ridgeline: ridgeline };
})(window);
