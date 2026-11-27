/* Blawg loader: reads blawg/data/*.json, lays the board out (same rules as the approved v12 mock), then starts the board.
   Layout rules: 12 group clusters evenly on a ring; each a round hexagon (19 or 37 cells, larger if a group grows);
   the group's own tile at the centre; pieces fill it A to Z, ring by ring, clockwise from the top. */
(function () {
  'use strict';
  var L = 88, DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]], RING = 18, S3 = Math.sqrt(3);
  function px(q, r) { return [L * S3 * (q + r / 2), L * 1.5 * r]; }
  function dist(q, r) { return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); }
  function ring(c, k) { if (k === 0) return [c]; var q = c[0] + DIRS[4][0] * k, r = c[1] + DIRS[4][1] * k, out = [];
    for (var d = 0; d < 6; d++) for (var i = 0; i < k; i++) { out.push([q, r]); q += DIRS[d][0]; r += DIRS[d][1]; } return out; }
  function akey(t) { return String(t || '').toLowerCase().replace(/^[^a-z0-9]+/, ''); }
  function get(name) { return fetch('data/' + name, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(name + ' ' + r.status); return r.json(); }); }

  function layout(groups, pieces, conns, art) {
    groups = groups.slice().sort(function (a, b) { return a.order - b.order; });
    var GO = {}; groups.forEach(function (g, k) { GO[g.id] = k; });
    var shown = pieces.filter(function (p) { return p.state === 'live' || p.state === 'seed'; });   /* drafts never reach this file, but stay safe */
    shown.sort(function (a, b) { return (GO[a.group] - GO[b.group]) || (akey(a.title) < akey(b.title) ? -1 : akey(a.title) > akey(b.title) ? 1 : 0); });
    /* slots: 12 points on a ring, starting at the top, clockwise */
    var slots = []; for (var d = 0; d < 6; d++) { var a = DIRS[d], b = DIRS[(d + 1) % 6]; slots.push([RING * a[0], RING * a[1]]); slots.push([RING / 2 * (a[0] + b[0]), RING / 2 * (a[1] + b[1])]); }
    function ang(c) { var p = px(c[0], c[1]); return ((Math.atan2(p[1], p[0]) + Math.PI / 2 + 1e-6) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); }
    slots.sort(function (x, y) { return ang(x) - ang(y); });
    var out_g = [], out_p = [], maxd = 0, at = {};
    groups.forEach(function (g, k) {
      var mine = shown.filter(function (p) { return p.group === g.id; }), need = mine.length + 1, rk = 2; while (1 + 3 * rk * (rk + 1) < need) rk++;
      var c = slots[k % slots.length], cells = []; for (var d2 = 1; d2 <= rk; d2++) cells = cells.concat(ring(c, d2));
      var hx = px(c[0], c[1]);
      function key(cc) { var p = px(cc[0], cc[1]); return [dist(cc[0] - c[0], cc[1] - c[1]), Math.round(((Math.atan2(p[0] - hx[0], -(p[1] - hx[1])) + 2 * Math.PI + 1e-6) % (2 * Math.PI)) * 1e4)]; }
      var order = cells.slice().sort(function (x, y) { var a1 = key(x), b1 = key(y); return a1[0] - b1[0] || a1[1] - b1[1]; });
      mine.forEach(function (p, n) { at[p.id] = order[n]; });
      [c].concat(cells).forEach(function (cc) { maxd = Math.max(maxd, dist(cc[0], cc[1])); });
      out_g.push({ id: g.id, name: g.name, order: g.order, n: mine.length, q: c[0], r: c[1], rk: rk, cells: [c].concat(cells), empty: order.slice(mine.length), accent: g.accent, art: g.art || null });
    });
    var A = art || { assign: { piece: {}, type: {}, group: {} }, gallery: [] }, as = A.assign || {};
    function artFor(p) { var x = (as.piece || {})[p.id] || p.art; if (x && x.length) return x[0]; if (p.type && (as.type || {})[p.type]) return as.type[p.type]; if ((as.group || {})[p.group]) return as.group[p.group]; return null; }
    var IX = {};
    shown.forEach(function (p, i) { IX[p.id] = i; var o = { i: i, id: p.id, title: p.title, desc: p.desc || '', group: p.group, type: p.type || null, state: p.state, q: at[p.id][0], r: at[p.id][1], body: !!p.body, locked: !!p.locked };
      var k2 = artFor(p); if (k2) o.art = k2; if (p.img) o.img = '../' + p.img; out_p.push(o); });
    var out_b = [];
    (conns || []).forEach(function (c) { if (c.state !== 'live' || !c.ends || c.ends.length < 2) return; var e = c.ends.filter(function (x) { return IX[x] !== undefined; });
      /* the board draws a connection between pairs; a 3-way link becomes a fan from its first end */
      for (var j = 1; j < e.length; j++) out_b.push({ id: c.id + (e.length > 2 ? '.' + j : ''), a: IX[e[0]], b: IX[e[j]], text: c.text || '', label: c.label || '', q: c.quotes || null, sample: false, named: true }); });
    return { L: L, maxd: maxd, groups: out_g, pieces: out_p, bridges: out_b, types: ['Principle', 'Question', 'Stance', 'Case study', 'Reaction', 'Log', 'Note', 'Door'], kinds: [], gallery: A.gallery || [] };
  }
  window.BlawgLayout = layout;
  Promise.all([get('groups.json'), get('pieces.json'), get('connections.json'), get('art.json').catch(function () { return null; })]).then(function (r) {
    var D = layout(r[0], r[1], r[2], r[3]), boot = document.getElementById('boot'); if (boot) boot.remove();
    window.BLAWG_START(D);
  }).catch(function (e) { var boot = document.getElementById('boot'); if (boot) boot.textContent = 'The board could not load. Refresh to try again.'; if (window.console) console.error(e); });
})();
