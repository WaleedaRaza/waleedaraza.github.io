/* Blawg loader: reads blawg/data/*.json, lays the board out, then starts the board.
   Layout modes: 'left' (default) and 'right' put the 12 group hexagons in two long columns beside the centre stage;
   'top' and 'bottom' in two long rows; 'L' in a column down the left and a row along the bottom; 'circle' is the
   older ring. Groups join edge to edge. In the block layouts the stage is drawn larger so it matches the block.
   Every group is a full hexagon (37 cells; all the same size so they tile); the group's own tile sits at its centre and
   pieces fill it A to Z, ring by ring, clockwise from the top. The whole board sits inside one pointy-top hexagon. */
(function () {
  'use strict';
  var L = 88, DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]], RING = 18, S3 = Math.sqrt(3);
  function px(q, r) { return [L * S3 * (q + r / 2), L * 1.5 * r]; }
  function dist(q, r) { return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); }
  function ring(c, k) { if (k === 0) return [c]; var q = c[0] + DIRS[4][0] * k, r = c[1] + DIRS[4][1] * k, out = [];
    for (var d = 0; d < 6; d++) for (var i = 0; i < k; i++) { out.push([q, r]); q += DIRS[d][0]; r += DIRS[d][1]; } return out; }
  function akey(t) { return String(t || '').toLowerCase().replace(/^[^a-z0-9]+/, ''); }
  /* the centre stage's cells (same numbers as the board script) */
  /* the stage grows by adding cells, never by making them bigger: K=1 is 14 reader rows, a button row, 9 TV rows, 19 cells wide */
  function dims(K) { var nT = Math.round(14 * K), nV = Math.round(9 * K), hw = Math.round(9 * K); return { K: K, ST: nT - 2, SC: 2 + nV, HW: hw, SXM: hw * S3 * L + 1 }; }
  window.BlawgStageDims = dims;
  var STAGE = {}, STAGEC = [], D0;
  function stageSet(K) { D0 = dims(K); STAGE = {}; STAGEC = [];
    for (var r0 = -D0.ST; r0 <= D0.SC; r0++) for (var q0 = -80; q0 <= 80; q0++) if (Math.abs(px(q0, r0)[0]) <= D0.SXM) { STAGE[q0 + ',' + r0] = 1; STAGEC.push([q0, r0]); } }
  stageSet(1); var ST = D0.ST, SC = D0.SC, SXM = D0.SXM;
  var SW0 = 2 * (SXM + S3 * L / 2), SY0 = -ST * 1.5 * L - L, SY1 = SC * 1.5 * L + L, SH0 = SY1 - SY0, SCY0 = (SY0 + SY1) / 2, SK = 1;
  function stageCY() { return ((-D0.ST + D0.SC) / 2) * 1.5 * L; }
  var MODES = ['left', 'top', 'right', 'bottom', 'L', 'circle'];
  function get(name) { return fetch('data/' + name, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(name + ' ' + r.status); return r.json(); }); }

  function layout(groups, pieces, conns, art, mode) {
    groups = groups.slice().sort(function (a, b) { return a.order - b.order; });
    var GO = {}; groups.forEach(function (g, k) { GO[g.id] = k; });
    var shown = pieces.filter(function (p) { return p.state === 'live' || p.state === 'seed'; });   /* drafts never reach this file, but stay safe */
    shown.sort(function (a, b) { return (GO[a.group] - GO[b.group]) || (akey(a.title) < akey(b.title) ? -1 : akey(a.title) > akey(b.title) ? 1 : 0); });
    mode = MODES.indexOf(mode) >= 0 ? mode : 'left';
    var counts = groups.map(function (g) { return shown.filter(function (p) { return p.group === g.id; }).length; });
    function rkFor(n) { var rk = 2; while (1 + 3 * rk * (rk + 1) < n + 1) rk++; return rk; }
    var centres = [], rks = [];
    SK = 1; stageSet(1);
    if (mode === 'circle') {
      /* the ring: 12 points around the stage, starting at the top, clockwise */
      var slots = []; for (var d = 0; d < 6; d++) { var a = DIRS[d], b = DIRS[(d + 1) % 6]; slots.push([RING * a[0], RING * a[1]]); slots.push([RING / 2 * (a[0] + b[0]), RING / 2 * (a[1] + b[1])]); }
      function ang(c) { var p = px(c[0], c[1]); return ((Math.atan2(p[1], p[0]) + Math.PI / 2 + 1e-6) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); }
      slots.sort(function (x, y) { return ang(x) - ang(y); });
      groups.forEach(function (g, k) { centres.push(slots[k % slots.length]); rks.push(rkFor(counts[k])); });
    } else {
      /* one block of hexagons of radius k, joined edge to edge.
         A straight column steps (-k,2k+1),(-(k+1),2k+1) in turn; the second column sits at (k+1,k) from the first.
         A straight row steps (2k+1,-k),(k+1,k) in turn; the second row sits at (-(k+1),2k+1) from the first. */
      var k = 3; counts.forEach(function (n) { k = Math.max(k, rkFor(n)); });
      var V1 = [-k, 2 * k + 1], V2 = [-(k + 1), 2 * k + 1], VO = [k + 1, k], H1 = [2 * k + 1, -k], H2 = [k + 1, k], HO = [-(k + 1), 2 * k + 1];
      function chain(st, n, s1, s2) { var o = [st]; for (var j = 1; j < n; j++) { var sx = (j - 1) % 2 ? s2 : s1, l = o[o.length - 1]; o.push([l[0] + sx[0], l[1] + sx[1]]); } return o; }
      function shift(arr, v) { return arr.map(function (c) { return [c[0] + v[0], c[1] + v[1]]; }); }
      var N = groups.length, half = Math.ceil(N / 2);
      if (mode === 'left' || mode === 'right') { var c0 = chain([0, 0], half, V1, V2); centres = c0.concat(shift(c0, VO)).slice(0, N); }
      else if (mode === 'top' || mode === 'bottom') { var r0 = chain([0, 0], half, H1, H2); centres = r0.concat(shift(r0, HO)).slice(0, N); }
      else { /* L: a column down the left, then a row along the bottom from its corner */
        var arm = chain([0, 0], half, V1, V2), corner = arm[arm.length - 1], best = null;
        [[H1, H2], [H2, H1]].forEach(function (o2) { var row = chain(corner, N - half + 1, o2[0], o2[1]).slice(1), okk = row.every(function (c) { return arm.every(function (a2) { return dist(c[0] - a2[0], c[1] - a2[1]) >= 2 * k + 1; }); });
          var lowest = Math.min.apply(null, row.map(function (c) { return c[1]; }));
          if (okk && (!best || lowest > best.lowest)) best = { row: row, lowest: lowest }; });
        centres = arm.concat(best.row); }
      groups.forEach(function () { rks.push(k); });
      var all = []; centres.forEach(function (c) { for (var d1 = 0; d1 <= k; d1++) all = all.concat(ring(c, d1)); });
      var bx = [1e9, 1e9, -1e9, -1e9]; all.forEach(function (c) { var p = px(c[0], c[1]); bx[0] = Math.min(bx[0], p[0] - S3 * L / 2); bx[1] = Math.min(bx[1], p[1] - L); bx[2] = Math.max(bx[2], p[0] + S3 * L / 2); bx[3] = Math.max(bx[3], p[1] + L); });
      function clash(tq, tr) { for (var m = 0; m < all.length; m++) { var q1 = all[m][0] + tq, r1 = all[m][1] + tr; if (STAGE[q1 + ',' + r1]) return true;
        for (var e = 0; e < 6; e++) if (STAGE[(q1 + DIRS[e][0]) + ',' + (r1 + DIRS[e][1])]) return true; } return false; }
      function at2(x, y) { var tr = Math.round(y / (1.5 * L)); return [Math.round(x / (S3 * L) - tr / 2), tr]; }
      var tt = null;
      if (mode === 'L') {
        /* the stage fills the corner the L wraps: right of the column, above the row */
        var armX = -1e9, armY0 = 1e9, rowX = -1e9, rowY = 1e9; centres.forEach(function (c, n) { for (var d3 = 0; d3 <= k; d3++) ring(c, d3).forEach(function (cc) { var p = px(cc[0], cc[1]);
          if (n < half - 1) { armX = Math.max(armX, p[0] + S3 * L / 2); armY0 = Math.min(armY0, p[1] - L); } if (n >= half) { rowX = Math.max(rowX, p[0] + S3 * L / 2); rowY = Math.min(rowY, p[1] - L); } }); });
        var gap = S3 * L * 1.5, rw = rowX - armX - gap, rh = rowY - armY0 - gap;
        SK = Math.max(.6, Math.min(2.4, Math.min(rw / SW0, rh / SH0)));
        for (var tries = 0; tries < 40; tries++) { stageSet(SK); var cx = (armX + gap / 2 + rowX) / 2, cy = (armY0 + rowY - gap / 2) / 2; tt = at2(0 - cx, stageCY() - cy); if (!clash(tt[0], tt[1])) break; SK *= .97; }
      } else {
        var side = mode === 'left' || mode === 'right', sgn = mode === 'left' || mode === 'top' ? -1 : 1;
        SK = Math.max(1, Math.min(2.4, side ? (bx[3] - bx[1]) / SH0 : (bx[2] - bx[0]) / SW0)); stageSet(SK);
        var bcx = (bx[0] + bx[2]) / 2, bcy = (bx[1] + bx[3]) / 2;
        for (var t = 60 * L * 1.5; t > 0; t -= L * .75) { var tx = side ? sgn * t : 0, ty = side ? stageCY() : stageCY() + sgn * t, cand = at2(tx - bcx, ty - bcy); if (clash(cand[0], cand[1])) break; tt = cand; }
      }
      centres = centres.map(function (c) { return [c[0] + tt[0], c[1] + tt[1]]; });
    }
    var out_g = [], out_p = [], maxd = 0, at = {}, used = [];
    groups.forEach(function (g, k1) {
      var mine = shown.filter(function (p) { return p.group === g.id; }), rk = rks[k1];
      var c = centres[k1], cells = []; for (var d2 = 1; d2 <= rk; d2++) cells = cells.concat(ring(c, d2));
      var hx = px(c[0], c[1]);
      function key(cc) { var p = px(cc[0], cc[1]); return [dist(cc[0] - c[0], cc[1] - c[1]), Math.round(((Math.atan2(p[0] - hx[0], -(p[1] - hx[1])) + 2 * Math.PI + 1e-6) % (2 * Math.PI)) * 1e4)]; }
      var order = cells.slice().sort(function (x, y) { var a1 = key(x), b1 = key(y); return a1[0] - b1[0] || a1[1] - b1[1]; });
      mine.forEach(function (p, n) { at[p.id] = order[n]; });
      [c].concat(cells).forEach(function (cc) { maxd = Math.max(maxd, dist(cc[0], cc[1])); used.push(cc); });
      out_g.push({ id: g.id, name: g.name, order: g.order, n: mine.length, q: c[0], r: c[1], rk: rk, cells: [c].concat(cells), empty: order.slice(mine.length), accent: g.accent, art: g.art || null });
    });
    /* the universe: the smallest pointy-top hexagon around every cell (corners included), centred on the board's contents */
    var pts = []; used.forEach(function (c) { pts.push([px(c[0], c[1]), L]); }); STAGEC.forEach(function (c) { pts.push([px(c[0], c[1]), L]); });
    var cb = [1e9, 1e9, -1e9, -1e9]; pts.forEach(function (o) { var p = o[0], R = o[1]; cb[0] = Math.min(cb[0], p[0] - S3 * R / 2); cb[1] = Math.min(cb[1], p[1] - R); cb[2] = Math.max(cb[2], p[0] + S3 * R / 2); cb[3] = Math.max(cb[3], p[1] + R); });
    var ux = (cb[0] + cb[2]) / 2, uy = (cb[1] + cb[3]) / 2, rho = 0;
    pts.forEach(function (o) { var p = o[0], R = o[1]; for (var v = 0; v < 6; v++) { var an = v * Math.PI / 3 - Math.PI / 6, x = Math.abs(p[0] + R * Math.cos(an) - ux), y = Math.abs(p[1] + R * Math.sin(an) - uy);
      rho = Math.max(rho, x * 2 / S3, y + x / S3); } });
    rho += L * 7;   /* a wide margin of open grid all round */
    var cover = Object.keys(STAGE);
    var A = art || { assign: { piece: {}, type: {}, group: {} }, gallery: [] }, as = A.assign || {};
    function artFor(p) { var x = (as.piece || {})[p.id] || p.art; if (x && x.length) return x[0]; if (p.type && (as.type || {})[p.type]) return as.type[p.type]; if ((as.group || {})[p.group]) return as.group[p.group]; return null; }
    var IX = {};
    shown.forEach(function (p, i) { IX[p.id] = i; var o = { i: i, id: p.id, title: p.title, desc: p.desc || '', group: p.group, type: p.type || null, state: p.state, q: at[p.id][0], r: at[p.id][1], body: !!p.body, locked: !!p.locked };
      var k2 = artFor(p); if (k2) o.art = k2; if (p.img) o.img = '../' + p.img; out_p.push(o); });
    var out_b = [];
    (conns || []).forEach(function (c) { if (c.state !== 'live' || !c.ends || c.ends.length < 2) return; var e = c.ends.filter(function (x) { return IX[x] !== undefined; });
      /* the board draws a connection between pairs; a 3-way link becomes a fan from its first end */
      for (var j = 1; j < e.length; j++) out_b.push({ id: c.id + (e.length > 2 ? '.' + j : ''), a: IX[e[0]], b: IX[e[j]], text: c.text || '', label: c.label || '', q: c.quotes || null, sample: false, named: true }); });
    return { L: L, mode: mode, stageK: SK, stageCover: cover, maxd: maxd, uni: { x: ux, y: uy, rho: rho }, content: cb, groups: out_g, pieces: out_p, bridges: out_b, types: ['Principle', 'Question', 'Stance', 'Case study', 'Reaction', 'Log', 'Note', 'Door'], kinds: [], gallery: A.gallery || [] };
  }
  window.BlawgLayout = layout; window.BlawgModes = MODES;
  Promise.all([get('groups.json'), get('pieces.json'), get('connections.json'), get('art.json').catch(function () { return null; })]).then(function (r) {
    var mode = null; try { mode = localStorage.getItem('blawg-layout'); } catch (e) {}
    if (MODES.indexOf(mode) < 0) mode = window.matchMedia && matchMedia('(max-width: 820px)').matches ? 'top' : 'left';
    window.BlawgRaw = r; var D = layout(r[0], r[1], r[2], r[3], mode), boot = document.getElementById('boot'); if (boot) boot.remove();
    window.BLAWG_START(D);
  }).catch(function (e) { var boot = document.getElementById('boot'); if (boot) boot.textContent = 'The board could not load. Refresh to try again.'; if (window.console) console.error(e); });
})();
