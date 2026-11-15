/* ═══════════════════════════════════════════════════════════════════════
   FALLEN TREE — "If a tree falls in a forest and no one is around to
   hear it, does it make a sound?"
   ───────────────────────────────────────────────────────────────────────
   A procedural ASCII scene drawn with AsciiField (ascii-field.js).
   Night forest, crescent moon, an autumn oak. The scene types itself in
   like the hero name, the oak creaks, snaps and falls, leaves and dust
   scatter, and sound rings travel out across an empty forest and fade.

   Everything is geometry evaluated per character cell, so it re-renders
   at any width. The world is 150 units wide and 88 units tall (isotropic
   units: one unit = one character width at the widest layout).

   Mount:  FallenTree.mount(preElement, { onImpact, onSettled })
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var AF = global.AsciiField;

  /* ── Palette (site colours: orange #ff6b35, teal #00d4aa) ───────────── */
  var PALETTE = {
    star:     { color: '#d6defc', glow: 0.7, blur: 4 },
    starDim:  { color: '#4b5270', glow: 0 },
    moon:     { color: '#f7f1dc', glow: 0.75, blur: 10 },
    moonDim:  { color: '#bdb59a', glow: 0.35 },
    moonDark: { color: '#2a2c38', glow: 0 },
    far:      { color: '#18332f', glow: 0 },
    mid:      { color: '#25524a', glow: 0.15 },
    barkLit:  { color: '#ec8a5c', glow: 0.45 },
    bark:     { color: '#b5532f', glow: 0.32 },
    barkDark: { color: '#6e2a17', glow: 0.15 },
    groove:   { color: '#36120a', glow: 0 },
    knot:     { color: '#2a0d06', glow: 0 },
    heart:    { color: '#ffd9b5', glow: 0.7, blur: 7 },
    moss:     { color: '#00d4aa', glow: 0.55 },
    leaf1:    { color: '#a6ec84', glow: 0.55 },   // redwood foliage, moonlit
    leaf2:    { color: '#4cbf72', glow: 0.45 },
    leaf3:    { color: '#2a8358', glow: 0.3 },
    leaf4:    { color: '#16503a', glow: 0.1 },
    mtnFar:   { color: '#1d2538', glow: 0 },
    mtnNear:  { color: '#28324b', glow: 0 },
    ridge:    { color: '#465378', glow: 0.2 },
    snow:     { color: '#cdd8f2', glow: 0.4 },
    snowDim:  { color: '#6d7894', glow: 0.1 },
    milky:    { color: '#363b58', glow: 0 },
    grass:    { color: '#3a8f69', glow: 0.3 },
    grassDim: { color: '#22553f', glow: 0 },
    soil:     { color: '#5a4332', glow: 0 },
    soilDim:  { color: '#2e221a', glow: 0 },
    rock:     { color: '#6a6c76', glow: 0.1 },
    dust:     { color: '#c9b597', glow: 0.4 },
    ring1:    { color: '#ffffff', glow: 0.9, blur: 8 },
    ring2:    { color: '#a9b8d6', glow: 0.5 },
    ring3:    { color: '#4d5874', glow: 0.2 }
  };

  /* ── World constants ────────────────────────────────────────────────── */
  var WX = 150, WY = 82;
  var GROUND = 70;
  var SX = 24;                 // stump centre x
  var STOP = 54;               // stump top (break line)
  var PIV0 = { x: SX + 0.5, y: STOP };   // the break, where the oak pivots
  var L = 104;                 // trunk length above the break
  var R0 = 5.8, R1 = 1.3;      // trunk radius at base / tip
  var REST = { x: SX + 4, y: GROUND - R0 + 0.7 }; // where the butt end lands
  var LIGHT = norm(0.55, -0.83); // moonlight comes from upper right
  var MOON = { x: 124, y: 13, r: 7.5 };

  function norm(x, y) { var l = Math.sqrt(x * x + y * y) || 1; return { x: x / l, y: y / l }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function frac(v) { return v - Math.floor(v); }
  function trunkR(u) { return R0 + (R1 - R0) * clamp(u / L, 0, 1); }

  /* Ground height at x (y grows downwards). */
  function groundY(x) { return GROUND + 1.8 * (AF.fbm(x * 0.045, 0.5, 9) - 0.5); }

  /* Final resting angle: crown end lies on the ground. θ measured from
     vertical, clockwise (falls to the right). */
  var THETA_F = Math.PI / 2 + Math.asin((GROUND - 2.2 - STOP) / L);

  /* ── Tree structure in local coords (u along trunk, v across) ───────── */
  // At θ = 0 (standing): u points up, +v points right.
  // Fallen (θ ≈ 98°): u points right, +v points down into the ground.
  function buildTree() {
    var rnd = AF.rng(1987);
    var segs = [];   // { au, av, bu, bv, r0, r1 }
    var blobs = [];  // { u, v, R }

    /* Coast redwood: a long clear bole, then short, drooping limbs in the
       top ~45%, shortening toward the spire, each carrying flat sprays of
       foliage. Negative v = the side facing the sky once fallen. */
    function limb(u0, side, len, rad) {
      var a = side * (1.2 + rnd() * 0.3);   // near-perpendicular to the trunk
      var cu = u0, cv = side * trunkR(u0) * 0.7;
      var pts = [{ u: cu, v: cv }];
      for (var s = 0; s < 3; s++) {
        a -= side * (0.18 + rnd() * 0.12);  // droop back toward the base
        cu += Math.cos(a) * len / 3;
        cv += Math.sin(a) * len / 3;
        pts.push({ u: cu, v: cv });
      }
      for (var k = 0; k < 3; k++) {
        segs.push({ au: pts[k].u, av: pts[k].v, bu: pts[k + 1].u, bv: pts[k + 1].v,
          r0: rad * (1 - 0.3 * k), r1: rad * (1 - 0.3 * (k + 1)) });
      }
      // foliage sprays hang along the outer two thirds of the limb
      for (var f = 1; f <= 3; f++) {
        var pp = pts[f];
        blobs.push({ u: pp.u - 1.2, v: pp.v + side * 0.5, R: (2.6 + rnd() * 1.6) * (0.75 + 0.25 * f) });
      }
    }
    var N = 26;
    for (var i = 0; i < N; i++) {
      var t = i / (N - 1);
      var uu = L * (0.5 + 0.5 * t) + (rnd() - 0.5) * 2;
      var side = (i % 2 === 0) ? -1 : 1;
      if (rnd() < 0.18) side = -side;
      var len = (15 - 10 * t) * (0.75 + rnd() * 0.5);
      limb(uu, side, len, 1.0 - 0.5 * t);
    }
    // the spire
    blobs.push({ u: L + 1.5, v: 0, R: 3.2 });
    blobs.push({ u: L - 3, v: -1.5, R: 3.4 });
    blobs.push({ u: L - 3, v: 1.8, R: 3.0 });

    // burls and old branch scars on the bole
    var knots = [{ u: 9, v: -2.6, r: 1.8 }, { u: 22, v: 2.4, r: 1.2 }, { u: 34, v: -1.0, r: 1.0 },
                 { u: 44, v: 2.9, r: 0.9 }, { u: 50, v: -3.0, r: 0.8 }];

    // Bounding radius from pivot (for culling)
    var reach = L + 12;
    for (var b = 0; b < blobs.length; b++) {
      var d = Math.sqrt(blobs[b].u * blobs[b].u + blobs[b].v * blobs[b].v) + blobs[b].R + 2;
      if (d > reach) reach = d;
    }
    // Local bounding boxes for quick rejection
    var box = { u0: -2, u1: L + 2, v0: -R0, v1: R0 };
    for (var q = 0; q < segs.length; q++) {
      var sg = segs[q], m = Math.max(sg.r0, sg.r1) + 1;
      sg.u0 = Math.min(sg.au, sg.bu) - m; sg.u1 = Math.max(sg.au, sg.bu) + m;
      sg.v0 = Math.min(sg.av, sg.bv) - m; sg.v1 = Math.max(sg.av, sg.bv) + m;
      box.u1 = Math.max(box.u1, sg.u1); box.v0 = Math.min(box.v0, sg.v0); box.v1 = Math.max(box.v1, sg.v1);
    }
    for (var w = 0; w < blobs.length; w++) {
      var bb = blobs[w], rr = bb.R * 1.15;
      box.u1 = Math.max(box.u1, bb.u + rr); box.v0 = Math.min(box.v0, bb.v - rr); box.v1 = Math.max(box.v1, bb.v + rr);
    }
    return { segs: segs, blobs: blobs, knots: knots, reach: reach, box: box };
  }

  var TREE = buildTree();

  /* Static roots around the stump base (world coords). */
  var ROOTS = [
    [{ x: SX - 9, y: GROUND - 2.4 }, { x: SX - 14, y: GROUND - 0.6 }, { x: SX - 20, y: GROUND + 0.6 }],
    [{ x: SX - 4, y: GROUND - 1.2 }, { x: SX - 8, y: GROUND + 0.4 }],
    [{ x: SX + 9, y: GROUND - 2.6 }, { x: SX + 14, y: GROUND - 0.8 }, { x: SX + 19, y: GROUND + 0.5 }],
    [{ x: SX + 4, y: GROUND - 1.0 }, { x: SX + 9, y: GROUND + 0.6 }]
  ];

  /* Background pines: deterministic layout. */
  function buildPines() {
    var rnd = AF.rng(42);
    var list = [];
    var x;
    for (x = 2; x < WX; x += 7 + rnd() * 6) {
      list.push({ x: x, h: 24 + rnd() * 18, w: 5 + rnd() * 3, tiers: 4 + Math.floor(rnd() * 2), layer: 'far' });
    }
    var mids = [8, 52, 66, 84, 141];
    for (var i = 0; i < mids.length; i++) {
      x = mids[i] + (rnd() - 0.5) * 4;
      list.push({ x: x, h: 38 + rnd() * 14, w: 8 + rnd() * 3, tiers: 5, layer: 'mid' });
    }
    return list;
  }
  var PINES = buildPines();

  /* Little fern clumps (cell stamps, anchored at a world x on the ground). */
  var FERNS = [
    { x: 10, lines: ['\\ | /', ' \\|/ '] },
    { x: 47, lines: [' \\|/', '\\\\|//'] },
    { x: 118, lines: ['\\ |/', ' \\|/'] },
    { x: 139, lines: [' \\ /', '\\\\|/'] }
  ];

  /* ── Geometry helpers ───────────────────────────────────────────────── */
  function segDist(pu, pv, s) {
    var du = s.bu - s.au, dv = s.bv - s.av;
    var len2 = du * du + dv * dv;
    var t = len2 ? clamp(((pu - s.au) * du + (pv - s.av) * dv) / len2, 0, 1) : 0;
    var qu = s.au + du * t - pu, qv = s.av + dv * t - pv;
    return { d: Math.sqrt(qu * qu + qv * qv), t: t, qu: qu, qv: qv };
  }

  // Jagged break profile, shared by stump top and trunk base.
  function breakJag(x) {
    var k = Math.floor(x / 1.7);
    var amp = AF.hash(k, 3, 5) * 3.6;
    var f = frac(x / 1.7);
    return amp * (1 - Math.abs(f - 0.5) * 2);
  }

  /* Bark shading for a cylinder: s in [-1,1] across, u along, lightN = how
     much the +s side faces the light. Fissures are broken dashes along the
     grain, so the bark reads as texture instead of noise. */
  function barkCell(s, u, lightN, groove) {
    var b = 0.18 + 0.5 * Math.sqrt(Math.max(0, 1 - s * s)) + 0.45 * Math.max(0, s * lightN);
    // redwood bark: deep, long, fibrous furrows running with the grain
    var lane = Math.floor((s + 1) * 3.4);
    var fis = AF.noise(u * 0.09 + lane * 7.3, lane * 3.1, 3);
    if (fis > 0.6) return { ch: groove, key: b > 0.6 ? 'bark' : 'groove' };
    if (fis > 0.54) return { ch: groove, key: 'barkDark' };
    if (b > 0.74) return { ch: '█', key: 'barkLit' };
    if (b > 0.56) return { ch: '▓', key: 'barkLit' };
    if (b > 0.4) return { ch: '▓', key: 'bark' };
    if (b > 0.27) return { ch: '▒', key: 'bark' };
    return { ch: '░', key: 'barkDark' };
  }

  /* Half-block glyph for the outline on the side whose outward normal is (nx, ny). */
  function edgeGlyph(nx, ny) {
    if (Math.abs(ny) >= Math.abs(nx)) return ny < 0 ? '▄' : '▀';
    return nx < 0 ? '▐' : '▌';
  }

  /* ── Scene ──────────────────────────────────────────────────────────── */
  function mount(el, opts) {
    opts = opts || {};
    var cols = pickCols(el);
    var field = AF.create(el, { cols: cols, rows: 48, palette: PALETTE, typing: ['#ff6b35', '#00d4aa'] });
    var A = field.charAspect || 1.83;
    var S = WX / cols;
    var rows = Math.round(WY / (S * A));
    field.resize(cols, rows);
    var buf = field.buffer();
    var layer = new Uint8Array(cols * rows);

    var state, edgeNeg = '▐', edgePos = '▌';
    var PIV = { x: PIV0.x, y: PIV0.y };
    function reset() {
      PIV.x = PIV0.x; PIV.y = PIV0.y;
      state = { tSlide: -1,
        theta: 0, omega: 0, falling: false, landed: false, tImpact: -1,
        leaves: [], settled: [], dust: [], nextIdleLeaf: 0, captionFired: false, settledFired: false
      };
    }
    reset();

    // Timeline (seconds)
    var T_REVEAL = 1.9, T_CREAK = 2.0, T_FALL = 2.9;

    var SLIDE = 0.42; // seconds for the butt end to drop off the stump

    function step(t, dt) {
      if (t >= T_FALL && !state.landed) {
        state.falling = true;
        if (state.tSlide < 0) {
          // phase 1 — topple about the break: inverted pendulum θ'' = k sin θ
          var sub = 4, h = dt / sub;
          for (var i = 0; i < sub; i++) {
            state.omega += 5.4 * Math.sin(Math.max(state.theta, 0.04)) * h;
            state.theta += state.omega * h;
            if (state.theta >= THETA_F) {
              state.theta = THETA_F;
              state.tImpact = t; state.tSlide = t;
              impact();
              if (opts.onImpact) opts.onImpact();
              break;
            }
          }
        } else {
          // phase 2 — the butt end slides off the stump and thuds down flat
          var k = clamp((t - state.tSlide) / SLIDE, 0, 1);
          var e = k * k;
          PIV.x = PIV0.x + (REST.x - PIV0.x) * e;
          PIV.y = PIV0.y + (REST.y - PIV0.y) * e;
          state.theta = THETA_F + (Math.PI / 2 - THETA_F) * e;
          if (k >= 1) { state.landed = true; thud(); }
        }
      }
      updateParticles(t, dt);
    }

    function thud() {
      var rnd = AF.rng(99);
      for (var d = 0; d < 26; d++) {
        state.dust.push({ x: REST.x + rnd() * 14, y: GROUND - 0.5, vx: (rnd() - 0.6) * 22, vy: -2 - rnd() * 6, life: 0.6 + rnd() * 0.8, age: 0 });
      }
    }

    function crownWorld(b) { return localToWorld(b.u, b.v, state.theta); }

    function impact() {
      var rnd = AF.rng(7 + Math.floor(Math.random() * 1000));
      for (var i = 0; i < TREE.blobs.length; i++) {
        var w = crownWorld(TREE.blobs[i]);
        var n = 3;
        for (var k = 0; k < n; k++) {
          state.leaves.push({
            x: w.x + (rnd() - 0.5) * 8, y: Math.min(w.y, GROUND - 3) - rnd() * 6,
            vx: (rnd() - 0.3) * 14, vy: -6 - rnd() * 14, ph: rnd() * 6.28,
            key: ['leaf1', 'leaf2', 'leaf3'][Math.floor(rnd() * 3)]
          });
        }
      }
      // dust along the trunk where it meets the ground
      for (var d = 0; d < 70; d++) {
        var u = L * (0.35 + rnd() * 0.75);
        var p = localToWorld(u, 0, state.theta);
        state.dust.push({ x: p.x, y: GROUND - 0.5, vx: (rnd() - 0.5) * 30, vy: -3 - rnd() * 9, life: 0.8 + rnd() * 1.1, age: 0 });
      }
    }

    function updateParticles(t, dt) {
      var i;
      // drifting leaves
      for (i = state.leaves.length - 1; i >= 0; i--) {
        var lf = state.leaves[i];
        lf.ph += dt * 3.2;
        lf.vy = Math.min(lf.vy + 18 * dt, 6.5);           // gravity, terminal velocity
        lf.vx += (2.5 - lf.vx) * dt * 0.8;                // wind drifts right
        lf.x += (lf.vx + Math.sin(lf.ph) * 6) * dt;
        lf.y += lf.vy * dt;
        if (lf.y >= groundY(lf.x) - 0.6) {
          state.leaves.splice(i, 1);
          if (state.settled.length > 160) state.settled.shift();
          state.settled.push({ x: lf.x, key: lf.key, ch: Math.random() < 0.5 ? ',' : '.' });
        } else if (lf.x > WX + 4) {
          state.leaves.splice(i, 1);
        }
      }
      // dust
      for (i = state.dust.length - 1; i >= 0; i--) {
        var p = state.dust[i];
        p.age += dt;
        p.vy += 14 * dt; p.vx *= (1 - 2.2 * dt);
        p.x += p.vx * dt; p.y = Math.min(p.y + p.vy * dt, GROUND - 0.3);
        if (p.age > p.life) state.dust.splice(i, 1);
      }
      // the odd leaf still letting go of the fallen crown
      if (state.landed && t > state.nextIdleLeaf) {
        state.nextIdleLeaf = t + 0.9 + Math.random() * 1.6;
        var b = TREE.blobs[Math.floor(Math.random() * TREE.blobs.length)];
        var w = crownWorld(b);
        if (w.y < GROUND - 4) {
          state.leaves.push({ x: w.x, y: w.y - b.R * 0.5, vx: 1, vy: 0, ph: Math.random() * 6,
            key: ['leaf1', 'leaf2', 'leaf3'][Math.floor(Math.random() * 3)] });
        }
      }
    }

    /* ── per-cell scene evaluation ── */
    function localToWorld(u, v, th) {
      var dx = Math.sin(th), dy = -Math.cos(th);   // trunk direction
      var nx = Math.cos(th), ny = Math.sin(th);    // +v direction
      return { x: PIV.x + u * dx + v * nx, y: PIV.y + u * dy + v * ny };
    }

    /* Everything that does not move, computed once per layout (two
       versions: stump whole, stump broken). */
    var bgCache = {};
    function background(broken) {
      var k = broken ? 1 : 0;
      if (bgCache[k]) return bgCache[k];
      var bch = new Array(cols * rows), bkey = new Array(cols * rows), blay = new Uint8Array(cols * rows);
      for (var cy = 0; cy < rows; cy++) {
        var wy = (cy + 0.5) * S * A;
        for (var cx = 0; cx < cols; cx++) {
          var wx = (cx + 0.5) * S;
          var idx = cy * cols + cx;
          var ch = ' ', key = null, lay = 9;
          var gy = groundY(wx);

          if (wy >= gy) {
            /* ── ground & soil ── */
            var depth = (wy - gy) / (S * A); // in rows
            lay = 1;
            var rootHit = rootAt(wx, wy);
            if (rootHit) { ch = rootHit.ch; key = rootHit.key; }
            else if (depth < 1) {
              var hs = AF.hash(cx, 1, 11);
              ch = hs < 0.18 ? ',' : hs < 0.36 ? '.' : hs < 0.5 ? '`' : hs < 0.75 ? '_' : '\'';
              key = hs < 0.6 ? 'grass' : 'grassDim';
              if (AF.hash(cx, 2, 31) < 0.07) { ch = ','; key = AF.hash(cx, 3, 31) < 0.5 ? 'bark' : 'barkDark'; }
            } else {
              var n = AF.fbm(wx * 0.18, wy * 0.25, 4);
              if (depth < 2) { ch = n > 0.55 ? '▓' : '▒'; key = 'soil'; }
              else if (depth < 3.2) { ch = n > 0.5 ? '▒' : '░'; key = 'soilDim'; }
              else { var hh = AF.hash(cx, cy, 2); ch = hh < 0.25 ? '.' : hh < 0.35 ? ':' : hh < 0.42 ? '░' : ' '; key = 'soilDim'; }
            }
          } else {
            /* ── stump ── */
            if (lay === 9) {
              var st = stumpAt(wx, wy, broken, gy);
              if (st) { ch = st.ch; key = st.key; lay = 3; }
            }
            /* ── roots poking above ground ── */
            if (lay === 9) {
              var rh = rootAt(wx, wy);
              if (rh) { ch = rh.ch; key = rh.key; lay = 3; }
            }
            /* ── grass tufts & ferns, one/two rows above ground ── */
            if (lay === 9) {
              var above = (gy - wy) / (S * A);
              if (above < 1) {
                var tq = AF.hash(cx, 0, 21);
                if (tq < 0.42) {
                  ch = '"\',\'|/\\vw'.charAt(Math.floor(AF.hash(cx, 9, 3) * 9));
                  key = tq < 0.2 ? 'grass' : 'grassDim'; lay = 4;
                }
              }
            }
            /* ── background pines ── */
            if (lay === 9) {
              var pn = pineAt(wx, wy, gy);
              if (pn) { ch = pn.ch; key = pn.key; lay = 6; }
            }
            /* ── moon ── */
            if (lay === 9) {
              var mn = moonAt(wx, wy, cx, cy);
              if (mn) { ch = mn.ch; key = mn.key; lay = 7; }
            }
            /* ── mountains ── */
            if (lay === 9) {
              var mt = mountainAt(wx, wy, cx, cy);
              if (mt) { ch = mt.ch; key = mt.key; lay = 6; }
            }
            /* ── stars ── */
            if (lay === 9 && wy < GROUND - 22) {
              var hst = AF.hash(cx, cy, 77);
              var band = milkyWay(wx, wy);
              if (hst >= 0.016 && hst < 0.016 + band * 0.07) {
                ch = AF.hash(cx, cy, 79) < 0.7 ? '·' : '.'; key = band > 0.6 && AF.hash(cx, cy, 80) < 0.3 ? 'starDim' : 'milky'; lay = 8;
              } else if (hst < 0.016) {
                var big = AF.hash(cx, cy, 78);
                ch = big < 0.55 ? '.' : big < 0.8 ? '·' : big < 0.93 ? '+' : '*';
                key = 'star';
                lay = 8;
              }
            }
          }
          bch[idx] = ch; bkey[idx] = key; blay[idx] = lay;
        }
      }
      bgCache[k] = { ch: bch, key: bkey, lay: blay };
      return bgCache[k];
    }

    function render(t) {
      var th = state.theta;
      // creak: a shiver before the fall
      if (!state.falling && t > T_CREAK) th = 0.012 * Math.sin(t * 22) + 0.01 * (t - T_CREAK);
      var dx = Math.sin(th), dy = -Math.cos(th), nx = Math.cos(th), ny = Math.sin(th);
      var broken = th > 0.06;
      var reach2 = TREE.reach * TREE.reach;

      // segment screen directions for line glyphs (this frame)
      var segGlyph = [];
      for (var s = 0; s < TREE.segs.length; s++) {
        var sg = TREE.segs[s];
        var du = sg.bu - sg.au, dv = sg.bv - sg.av;
        segGlyph.push(AF.lineChar(du * dx + dv * nx, du * dy + dv * ny, false));
      }
      var trunkLine = AF.lineChar(dx, dy, false);
      var groove = trunkLine === '|' ? '║' : trunkLine === '-' ? '═' : trunkLine;
      var lightN = nx * LIGHT.x + ny * LIGHT.y; // how much +v faces the moon
      edgeNeg = edgeGlyph(-nx, -ny); edgePos = edgeGlyph(nx, ny);

      var bg = background(broken);
      for (var cy = 0; cy < rows; cy++) {
        var wy = (cy + 0.5) * S * A;
        for (var cx = 0; cx < cols; cx++) {
          var idx = cy * cols + cx;
          var ch = bg.ch[idx], key = bg.key[idx], lay = bg.lay[idx];
          if (lay !== 1) {
            /* ── the oak (rotating) ── */
            var px = (cx + 0.5) * S - PIV.x, py = wy - PIV.y;
            if (px * px + py * py < reach2) {
              var lu = px * dx + py * dy, lv = px * nx + py * ny;
              var hit = treeAt(lu, lv, broken, groove, segGlyph, lightN, dx, dy, nx, ny, cx, cy, A, S);
              if (hit) { ch = hit.ch; key = hit.key; lay = 2; }
            }
            if (lay === 8) { // twinkle
              var hst = AF.hash(cx, cy, 77);
              var tw = Math.sin(t * (0.8 + hst * 120) + hst * 900);
              if (tw < 0.2 && (ch === '+' || ch === '*')) ch = '·';
              key = tw > 0.1 ? 'star' : 'starDim';
            }
          }
          buf.ch[idx] = ch; buf.c[idx] = key; layer[idx] = lay;
        }
      }

      stampFerns();
      drawCrack(t, th);
      drawParticles();
      if (state.tImpact >= 0) drawRings(t - state.tImpact);
      applyReveal(t);
      field.draw(buf);
    }

    function cellOf(wx, wy) { return { cx: Math.floor(wx / S), cy: Math.floor(wy / (S * A)) }; }

    function treeAt(lu, lv, broken, groove, segGlyph, lightN, dx, dy, nx, ny, cx, cy, A, S) {
      var bx = TREE.box;
      if (lu < bx.u0 || lu > bx.u1 || lv < bx.v0 || lv > bx.v1) return null;
      // trunk
      if (lu > -1 && lu < L + 1.5) {
        var r = trunkR(lu);
        var base = broken ? breakJag(lv + 40) * 0.8 : 0;
        if (Math.abs(lv) < r && lu > base - 0.2) {
          if (broken && lu < base + 1.4) return { ch: AF.hash(cx, cy, 6) < 0.5 ? '/' : '\\', key: 'heart' };
          if (!broken && lu < 0.3) return null; // stump draws the seam
          var s = lv / r;
          // knots
          for (var k = 0; k < TREE.knots.length; k++) {
            var kn = TREE.knots[k];
            var kd = Math.sqrt((lu - kn.u) * (lu - kn.u) * 0.5 + (lv - kn.v) * (lv - kn.v) * 2);
            if (kd < kn.r) return { ch: kd < kn.r * 0.5 ? '@' : 'O', key: 'knot' };
          }
          // crisp pixel silhouette: half blocks on the outline
          if (Math.abs(s) > 0.84) return { ch: s < 0 ? edgeNeg : edgePos, key: 'barkDark' };
          // moss on the sky-facing (-v) flank
          if (s < -0.5 && lu < L * 0.65 && AF.fbm(lu * 0.25, s * 3, 12) > 0.6)
            return { ch: AF.hash(cx, cy, 13) < 0.5 ? ',' : '"', key: 'moss' };
          return barkCell(s, lu, lightN, groove);
        }
      }
      // limbs (thick first)
      var i, sg, q;
      for (i = 0; i < TREE.segs.length; i++) {
        sg = TREE.segs[i];
        var rr0 = Math.max(sg.r0, sg.r1);
        if (rr0 < 1.05 || lu < sg.u0 || lu > sg.u1 || lv < sg.v0 || lv > sg.v1) continue;
        q = segDist(lu, lv, sg);
        var rr = sg.r0 + (sg.r1 - sg.r0) * q.t;
        if (q.d < rr) {
          var sv = (q.qu * nx * 0 - q.qv) / rr; // signed across limb (rough)
          var lb = 0.5 + 0.5 * (-(q.qu * dx + q.qv * nx) * LIGHT.x - (q.qu * dy + q.qv * ny) * LIGHT.y) / rr;
          if (q.d > rr * 0.7) return { ch: segGlyph[i], key: 'barkDark' };
          return { ch: lb > 0.62 ? '▓' : '▒', key: lb > 0.62 ? 'barkLit' : 'bark' };
        }
      }
      // leaves
      var best = 0, bestB = null, bi = -1;
      for (i = 0; i < TREE.blobs.length; i++) {
        var bl = TREE.blobs[i];
        var du = lu - bl.u, dv = lv - bl.v;
        var d2 = du * du + dv * dv;
        if (d2 > bl.R * bl.R * 1.3) continue;
        var dens = 1 - Math.sqrt(d2) / bl.R;
        if (dens > best) { best = dens; bestB = bl; bi = i; }
      }
      if (bestB) {
        var nz = AF.fbm(lu * 0.42, lv * 0.42, 17) - 0.5;
        var dd = best + nz * 0.75;
        if (dd > 0.12) {
          var ou = lu - bestB.u, ov = lv - bestB.v;
          var wxo = ou * dx + ov * nx, wyo = ou * dy + ov * ny;
          var lit = 0.5 + 0.5 * (wxo * LIGHT.x + wyo * LIGHT.y) / bestB.R + nz * 0.5;
          var hsh = AF.hash(cx, cy, 19 + bi);
          var chs;
          if (dd > 0.55) chs = hsh < 0.3 ? '#' : hsh < 0.55 ? '%' : hsh < 0.8 ? '*' : '&';
          else if (dd > 0.3) chs = hsh < 0.35 ? '*' : hsh < 0.6 ? '^' : hsh < 0.8 ? '"' : ';';
          else chs = hsh < 0.3 ? '\'' : hsh < 0.55 ? ',' : hsh < 0.8 ? '.' : '`';
          var lk = lit > 0.72 ? 'leaf1' : lit > 0.5 ? 'leaf2' : lit > 0.3 ? 'leaf3' : 'leaf4';
          return { ch: chs, key: lk };
        }
      }
      // twigs: one-cell-wide lines (anisotropic distance)
      for (i = 0; i < TREE.segs.length; i++) {
        sg = TREE.segs[i];
        if (Math.max(sg.r0, sg.r1) >= 1.05 || lu < sg.u0 || lu > sg.u1 || lv < sg.v0 || lv > sg.v1) continue;
        q = segDist(lu, lv, sg);
        var ex = q.qu * dx + q.qv * nx, ey = q.qu * dy + q.qv * ny;
        var ad = Math.sqrt(ex * ex / (S * S) + ey * ey / (S * S * A * A));
        if (ad < 0.55) return { ch: segGlyph[i], key: 'bark' };
      }
      return null;
    }

    function stumpAt(wx, wy, broken, gy) {
      var flare = clamp((wy - (GROUND - 8)) / 8, 0, 1);
      var hw = 6.4 + 6.5 * flare * flare * (0.8 + 0.4 * AF.noise(wx * 0.4, 1, 21)); // buttress
      var off = wx - SX;
      if (Math.abs(off) > hw) return null;
      var top = STOP - (broken ? breakJag(off + 40) : 0);
      if (wy < top - 0.2) return null;
      var s = off / hw;
      if (broken && wy < top + S * A * 0.9) {
        // splintered heartwood along the break
        var sl = breakJag(off + 40 + 0.4) - breakJag(off + 40 - 0.4);
        return { ch: Math.abs(sl) < 0.4 ? '^' : sl > 0 ? '\\' : '/', key: 'heart' };
      }
      if (Math.abs(s) > 0.88) return { ch: s < 0 ? '▐' : '▌', key: 'barkDark' };
      if (s < -0.5 && AF.fbm(off * 0.6, wy * 0.3, 12) > 0.62) return { ch: '"', key: 'moss' };
      return barkCell(s, wy, LIGHT.x, '║');
    }

    function rootAt(wx, wy) {
      for (var r = 0; r < ROOTS.length; r++) {
        var pts = ROOTS[r];
        for (var k = 0; k < pts.length - 1; k++) {
          var a = pts[k], b = pts[k + 1];
          var q = segDist(wx, wy, { au: a.x, av: a.y, bu: b.x, bv: b.y });
          var rad = (k === 0 ? 1.7 : 0.9) * (1 - 0.5 * q.t);
          var ex = q.qu, ey = q.qv;
          var ad = Math.sqrt(ex * ex / (S * S) + ey * ey / (S * S * A * A));
          if (rad > 1.2 && q.d < rad) return { ch: '▓', key: 'bark' };
          if (ad < 0.6) {
            var c = AF.lineChar(b.x - a.x, b.y - a.y, true);
            return { ch: c === '-' ? '_' : c, key: 'barkDark' };
          }
        }
      }
      return null;
    }

    function pineAt(wx, wy, gy) {
      for (var p = 0; p < PINES.length; p++) {
        var pn = PINES[p];
        var base = gy - 2, top = base - pn.h;
        if (wy < top || wy > gy) continue;
        if (wy > base) { // trunk stub
          if (Math.abs(wx - pn.x) < 0.6 * S) return { ch: '|', key: pn.layer };
          continue;
        }
        var t = (wy - top) / pn.h;
        var f = frac(t * pn.tiers);
        var hw = pn.w * (0.12 + 0.88 * t) * (0.42 + 0.58 * f);
        var off = wx - pn.x;
        if (Math.abs(off) > hw) continue;
        if (f > 0.9 && pn.layer === 'mid') return { ch: '_', key: pn.layer };
        if (off < 0 && off > -hw + S) {/* interior */}
        if (off <= -hw + S) return { ch: '/', key: pn.layer };
        if (off >= hw - S) return { ch: '\\', key: pn.layer };
        var h = AF.hash(Math.floor(wx / S), Math.floor(wy), p);
        if (pn.layer === 'far') return h < 0.5 ? { ch: '.', key: 'far' } : { ch: ' ', key: null };
        return { ch: h < 0.25 ? '^' : h < 0.45 ? ':' : h < 0.6 ? '\'' : '.', key: 'mid' };
      }
      return null;
    }

    /* Two mountain ranges behind the forest: ridgelines from fractal
       noise, snow on the high slopes, faint texture on the faces. */
    // Peaks as (x, height above ground, slope); ridge = upper envelope + jag
    var PEAKS_FAR = [[6, 42, 1.0], [34, 56, 0.85], [62, 44, 1.1], [86, 60, 0.8], [112, 46, 1.0], [146, 50, 0.9]];
    var PEAKS_NEAR = [[18, 36, 1.3], [48, 40, 1.1], [74, 33, 1.4], [98, 38, 1.2], [136, 35, 1.3]];
    function ridgeY(x, far) {
      var P = far ? PEAKS_FAR : PEAKS_NEAR, best = 0;
      for (var i = 0; i < P.length; i++) best = Math.max(best, P[i][1] - Math.abs(x - P[i][0]) * P[i][2]);
      var jag = (AF.fbm(x * 0.22, far ? 3 : 7, far ? 31 : 37) - 0.5) * 4;
      return GROUND - Math.max(far ? 26 : 22, best + jag);
    }
    function mountainAt(wx, wy, cx, cy) {
      var near = ridgeY(wx, false), far = ridgeY(wx, true);
      var ry, isFar;
      if (wy >= near) { ry = near; isFar = false; }
      else if (wy >= far) { ry = far; isFar = true; }
      else return null;
      var row = S * A;
      var h = AF.hash(cx, cy, isFar ? 91 : 92);
      if (wy - ry < row) { // the ridgeline
        var sl = (ridgeY(wx + S * 0.5, isFar) - ridgeY(wx - S * 0.5, isFar)) / S; // dy per column
        var peakHere = ry <= ridgeY(wx - S, isFar) && ry <= ridgeY(wx + S, isFar);
        var ch = peakHere ? '^' : Math.abs(sl) < 0.35 ? '_' : sl > 0 ? '\\' : '/';
        var snowy = ry < (isFar ? GROUND - 46 : GROUND - 33);
        return { ch: ch, key: snowy ? 'snow' : 'ridge' };
      }
      var snowLine = isFar ? GROUND - 44 : GROUND - 31;
      if (wy < snowLine && wy - ry < 6 + 4 * AF.noise(wx * 0.3, 1, 93)) { // snow caps, streaked
        var streak = AF.noise(wx * 0.9, wy * 0.15, 94);
        if (streak > 0.38) return { ch: streak > 0.62 ? ':' : '.', key: streak > 0.55 ? 'snow' : 'snowDim' };
        return { ch: ' ', key: null };
      }
      // rock faces: faint diagonal strata and grit
      var strata = frac(wx * 0.11 + wy * 0.16 + 0.6 * AF.noise(wx * 0.08, wy * 0.08, 95));
      if (!isFar && strata < 0.07 && h < 0.7) return { ch: '/', key: 'mtnNear' };
      if (h < (isFar ? 0.2 : 0.26)) return { ch: h < 0.04 ? ':' : '.', key: isFar ? 'mtnFar' : 'mtnNear' };
      return { ch: ' ', key: null };
    }
    // A faint band of the Milky Way across the sky
    function milkyWay(wx, wy) {
      var d = (wy - (4 + wx * 0.32)) / 9;
      return Math.exp(-d * d) * (0.4 + 0.9 * AF.fbm(wx * 0.06, wy * 0.12, 61));
    }

    function moonAt(wx, wy, cx, cy) {
      var ox = wx - MOON.x, oy = wy - MOON.y;
      var d = Math.sqrt(ox * ox + oy * oy);
      if (d > MOON.r) return null;
      var sx = ox + 3.4, sy = oy + 1.2;           // shadow disc
      var inShadow = Math.sqrt(sx * sx + sy * sy) < MOON.r * 0.92;
      if (inShadow) return AF.hash(cx, cy, 55) < 0.35 ? { ch: '░', key: 'moonDark' } : null;
      var crater = AF.fbm(wx * 0.5, wy * 0.5, 88);
      if (d > MOON.r - 1.1) return { ch: '▒', key: 'moonDim' };
      if (crater > 0.66) return { ch: '▓', key: 'moonDim' };
      return { ch: '█', key: 'moon' };
    }

    function stampFerns() {
      for (var f = 0; f < FERNS.length; f++) {
        var fe = FERNS[f];
        var gy = groundY(fe.x);
        var c = cellOf(fe.x, gy);
        var x0 = c.cx - Math.floor(fe.lines[0].length / 2);
        for (var r = 0; r < fe.lines.length; r++) {
          var y = c.cy - fe.lines.length + r;
          for (var k = 0; k < fe.lines[r].length; k++) {
            var ch = fe.lines[r][k];
            var xx = x0 + k;
            if (ch === ' ' || xx < 0 || xx >= cols || y < 0) continue;
            var i = y * cols + xx;
            if (layer[i] >= 4) { buf.ch[i] = ch; buf.c[i] = 'grass'; layer[i] = 4; }
          }
        }
      }
    }

    function drawCrack(t, th) {
      if (t < T_CREAK || th > 0.5) return;
      if (Math.sin(t * 30) < 0) return;
      var r = R0 + 1.4;
      var cl = cellOf(PIV.x - r, PIV.y - 1), cr = cellOf(PIV.x + r, PIV.y - 1);
      buf.set(cl.cx, cl.cy, '>', 'heart');
      buf.set(cr.cx, cr.cy, '<', 'heart');
    }

    function drawParticles() {
      var i, c;
      for (i = 0; i < state.settled.length; i++) {
        var st = state.settled[i];
        c = cellOf(st.x, groundY(st.x) - 0.1);
        buf.set(c.cx, c.cy, st.ch, st.key);
      }
      for (i = 0; i < state.dust.length; i++) {
        var p = state.dust[i];
        var k = p.age / p.life;
        c = cellOf(p.x, p.y);
        var idx = c.cy * cols + c.cx;
        if (c.cx < 0 || c.cx >= cols || c.cy < 0 || c.cy >= rows || layer[idx] === 2) continue;
        buf.set(c.cx, c.cy, k < 0.3 ? '*' : k < 0.6 ? ':' : '.', 'dust');
      }
      var spin = ['\'', '`', ',', '.', '*', ','];
      for (i = 0; i < state.leaves.length; i++) {
        var lf = state.leaves[i];
        c = cellOf(lf.x, lf.y);
        buf.set(c.cx, c.cy, spin[Math.floor(Math.abs(lf.ph) * 1.4) % spin.length], lf.key);
      }
    }

    function drawRings(dt) {
      // The sound: three rings leave the point of impact and fade into an
      // empty forest. Nothing is there to receive them.
      var src = { x: PIV0.x + L * 0.5, y: GROUND - 6 };
      for (var n = 0; n < 3; n++) {
        var age = dt - n * 0.45;
        if (age < 0) continue;
        var rad = 6 + age * 24;
        var fade = age / 3.2;
        if (fade >= 1) continue;
        var key = fade < 0.3 ? 'ring1' : fade < 0.62 ? 'ring2' : 'ring3';
        var steps = Math.floor(rad * 4);
        for (var k = 0; k <= steps; k++) {
          var a = Math.PI * (k / steps);          // upper half only
          var x = src.x + Math.cos(a) * rad;
          var y = src.y - Math.sin(a) * rad * 0.72;
          var c = cellOf(x, y);
          if (c.cx < 0 || c.cx >= cols || c.cy < 0 || c.cy >= rows) continue;
          var idx = c.cy * cols + c.cx;
          if (layer[idx] < 4) continue;               // pass behind the oak, over open air
          if (AF.hash(c.cx, c.cy, n + 101) < fade * fade * 1.1) continue; // dissolve
          // tangent of the ellipse at a, in screen space
          var tx = -Math.sin(a) * rad, ty = -Math.cos(a) * rad * 0.72;
          var ch = AF.lineChar(tx, ty, false);
          if (ch === '|') ch = Math.cos(a) > 0 ? ')' : '(';
          buf.ch[idx] = ch; buf.c[idx] = key;
        }
      }
    }

    function applyReveal(t) {
      if (t > T_REVEAL + 0.6) return;
      for (var cy = 0; cy < rows; cy++) {
        for (var cx = 0; cx < cols; cx++) {
          var i = cy * cols + cx;
          // sweep left to right with sparkle, like the name typing in
          var tr = 0.15 + 1.35 * (cx / cols) * 0.75 + 0.45 * AF.hash(cx, cy, 63);
          if (t < tr) { buf.ch[i] = ' '; buf.c[i] = null; }
          else if (t < tr + 0.38 && buf.ch[i] !== ' ') { buf.c[i] = AF.TYPING; }
        }
      }
    }

    /* ── run ── */
    function finalFrame() {
      state.theta = Math.PI / 2; state.landed = true; state.falling = true; state.tImpact = -1;
      PIV.x = REST.x; PIV.y = REST.y;
      var rnd = AF.rng(3);
      for (var i = 0; i < 90; i++) {
        var x = PIV.x + 10 + rnd() * 100;
        state.settled.push({ x: x, key: ['leaf1', 'leaf2', 'leaf3'][Math.floor(rnd() * 3)], ch: rnd() < 0.5 ? ',' : '.' });
      }
      render(99);
    }

    var runner = null;
    if (AF.reducedMotion || opts.still) {
      finalFrame();
      if (opts.onImpact) opts.onImpact();
    } else {
      runner = AF.animate(el, function (t, dt) {
        step(t, dt);
        render(t);
        if (state.landed && !state.settledFired && t - state.tImpact > 3.2) {
          state.settledFired = true;
          if (runner) runner.setFps(12);
          if (opts.onSettled) opts.onSettled();
        }
      }, { fps: 30 });
    }

    return {
      replay: function () {
        if (!runner) return;
        reset();
        runner.setFps(30);
        runner.restart();
      }
    };
  }

  function pickCols(el) {
    var w = (el.parentElement || el).clientWidth || 1000;
    if (w >= 980) return 150;
    if (w >= 700) return 120;
    return 96;
  }

  global.FallenTree = { mount: mount, palette: PALETTE };
})(window);
