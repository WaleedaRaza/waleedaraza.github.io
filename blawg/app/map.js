/* The map page: the twelve groups as hexagons with every piece inside, links drawn between pieces.
   One flat SVG. Zooming only changes its viewBox; nothing is animated.
     look    slide a finger / move the mouse   the piece under you lights up with its links, its title shows in the strip
     pick    lift the finger / click           the piece opens in the panel under the map
     enlarge pinch, double-tap, wheel, + -     titles appear inside the hexes once they fit
     move    two fingers / mouse drag
   window.BlawgMapPage(env) -> { root, pick(i), layout(), destroy() }                                                   */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', S3 = Math.sqrt(3), L = 88, T = L - 9, ND = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  function sv(tag, a) { var e = document.createElementNS(NS, tag); for (var k in a || {}) e.setAttribute(k, a[k]); return e; }
  function hexPts(R, cx, cy) { var a = []; for (var i = 0; i < 6; i++) a.push((cx + R * Math.cos(i * Math.PI / 3 - Math.PI / 6)).toFixed(1) + ',' + (cy + R * Math.sin(i * Math.PI / 3 - Math.PI / 6)).toFixed(1)); return a.join(' '); }
  /* cells of a hexagon of radius n: the centre first, then ring by ring */
  function spiral(n) { var out = [[0, 0]]; for (var k = 1; k <= n; k++) { var q = k * ND[4][0], r = k * ND[4][1]; for (var d = 0; d < 6; d++) for (var i = 0; i < k; i++) { out.push([q, r]); q += ND[d][0]; r += ND[d][1]; } } return out; }
  function edgePath(cells, ox, oy) { var set = {}, d = ''; cells.forEach(function (c) { set[c[0] + ',' + c[1]] = 1; });
    cells.forEach(function (c) { var x = ox + L * S3 * (c[0] + c[1] / 2), y = oy + L * 1.5 * c[1]; for (var i = 0; i < 6; i++) { if (set[(c[0] + ND[i][0]) + ',' + (c[1] + ND[i][1])]) continue; var a1 = i * Math.PI / 3 - Math.PI / 6, a2 = a1 + Math.PI / 3;
      d += 'M' + (x + L * Math.cos(a1)).toFixed(1) + ' ' + (y + L * Math.sin(a1)).toFixed(1) + 'L' + (x + L * Math.cos(a2)).toFixed(1) + ' ' + (y + L * Math.sin(a2)).toFixed(1); } }); return d; }
  function wrap(t, n, rows) { var w = String(t).replace(/[—–]/g, '-').split(/\s+/), out = [], c = ''; w.forEach(function (x) { if ((c + ' ' + x).trim().length > n && c) { out.push(c); c = x; } else c = (c + ' ' + x).trim(); }); out.push(c);
    if (out.length > rows) { out = out.slice(0, rows); out[rows - 1] = out[rows - 1].slice(0, n - 1).replace(/[\s,:;-]+$/, '') + '…'; } return out.map(function (r) { return r.length > n + 2 ? r.slice(0, n) + '…' : r; }); }

  window.BlawgMapPage = function (E) {
    var G = E.G, P = E.P, B = E.B, h = E.h;
    var frame = h('div', { class: 'mframe', tabindex: '0', role: 'application', 'aria-label': 'Map of the twelve groups. Use the list on the blog page if you cannot use the map.' });
    var strip = h('div', { class: 'mstrip' }), panel = h('div', { class: 'pane mpanel', 'aria-live': 'polite' });
    var bOut = h('button', { type: 'button', 'aria-label': 'Smaller', text: '−' }), bIn = h('button', { type: 'button', 'aria-label': 'Larger', text: '+' }), bFit = h('button', { type: 'button', class: 'fit', text: 'Fit' });
    var ctl = h('div', { class: 'mctl' }, [bOut, bIn, bFit]);
    var root = h('div', { class: 'mpage' }, [h('div', { class: 'mbox' }, [frame, strip]), panel]);
    var svg = null, pos = [], grp = [], tiles = [], lines = [], labs = [], MW = 1, MH = 1, cols = 0;
    var W = 1, H = 1, k0 = 1, z = 1, cx = 0, cy = 0, sel = null, hov = null, hovG = null, alive = true;

    /* ── build the drawing for the current width ── */
    /* 3, 4 or 6 groups across: whichever draws the hexes largest in this window */
    function colsFor(w) { var best = 3, bk = 0, hm = window.innerHeight * .6; [3, 4, 6].forEach(function (c) { var mw = c * (7 * S3 * L + L * 1.3), mh = Math.ceil(G.length / c) * (11 * L + L * 5.1), k = Math.min(w / mw, hm / mh); if (k > bk * 1.02) { bk = k; best = c; } }); return best; }
    function build() {
      cols = colsFor(root.clientWidth || window.innerWidth); pos = []; grp = []; tiles = []; lines = []; labs = [];
      var sw = 7 * S3 * L + L * 1.3, lab = L * 4.2, sh = 11 * L + lab + L * .9, rows = Math.ceil(G.length / cols); MW = cols * sw; MH = rows * sh;
      svg = sv('svg', { class: 'bmap', role: 'img', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid meet' });
      var gCells = sv('g'), gTiles = sv('g'), gLines = sv('g'), gText = sv('g', { class: 'tts' }), gLab = sv('g');
      G.forEach(function (g, n) { var ids = E.inGroup(g.id), R = ids.length <= 19 ? 2 : 3, cells = spiral(R), ox = (n % cols) * sw + sw / 2, oy = Math.floor(n / cols) * sh + lab + 5.5 * L, acc = g.acc || 'var(--orange)';
        grp.push({ id: g.id, x: ox, y: oy, rad: (R * 1.5 + 1) * L, n: ids.length, name: g.name });
        cells.forEach(function (c, k) { var x = ox + L * S3 * (c[0] + c[1] / 2), y = oy + L * 1.5 * c[1];
          if (k >= ids.length) { gCells.appendChild(sv('polygon', { class: 'cell', points: hexPts(T, x, y) })); return; }
          var i = ids[k], t = sv('polygon', { class: 'tile' + (E.isRead(i) ? ' rd' : ''), points: hexPts(T, x, y) }); gTiles.appendChild(t); tiles[i] = t; pos[i] = [x, y];
          var tx = sv('g', { class: 'tt' }), ls = wrap(P[i].title, 9, 4); ls.forEach(function (rw, m) { var e = sv('text', { x: x.toFixed(0), y: (y + 8 + (m - (ls.length - 1) / 2) * 28).toFixed(0) }); e.textContent = rw; tx.appendChild(e); }); gText.appendChild(tx); t.tx = tx; });
        gCells.appendChild(sv('path', { class: 'fam', d: edgePath(cells, ox, oy), style: 'stroke:' + acc }));
        var nm = wrap(E.pad2(g.order) + ' ' + g.name, 21, 3), top = oy - (R * 1.5 + 1) * L - L * .45;
        nm.forEach(function (rw, m) { var e = sv('text', { class: 'glab', x: ox.toFixed(0), y: '0', style: 'fill:' + acc }); e.textContent = rw; gLab.appendChild(e); labs.push([e, top, nm.length - 1 - m]); }); });
      B.forEach(function (b, j) { var A = pos[b.a], Z = pos[b.b]; if (!A || !Z) return; var dx = Z[0] - A[0], dy = Z[1] - A[1], k = .16, mx = (A[0] + Z[0]) / 2 - dy * k, my = (A[1] + Z[1]) / 2 + dx * k;
        var p = sv('path', { class: 'lnk', d: 'M' + A[0].toFixed(0) + ' ' + A[1].toFixed(0) + 'Q' + mx.toFixed(0) + ' ' + my.toFixed(0) + ' ' + Z[0].toFixed(0) + ' ' + Z[1].toFixed(0) }); gLines.appendChild(p); lines[j] = p; });
      [gCells, gTiles, gLines, gText, gLab].forEach(function (x) { svg.appendChild(x); });
      frame.textContent = ''; frame.appendChild(svg);
      z = 1; cx = MW / 2; cy = MH / 2; size(); paint(); }
    /* the frame is as tall as the whole map needs, up to 60% of the screen */
    function size() { W = frame.clientWidth || 1; H = Math.round(Math.max(220, Math.min(W * MH / MW, window.innerHeight * .6))); frame.style.height = H + 'px'; k0 = Math.min(W / MW, H / MH); view(); }
    function zmax() { return Math.max(1, 132 / (S3 * L * k0)); }
    function view() { z = Math.max(1, Math.min(zmax(), z)); var vw = W / (k0 * z), vh = H / (k0 * z);
      cx = vw >= MW ? MW / 2 : Math.max(vw / 2, Math.min(MW - vw / 2, cx)); cy = vh >= MH ? MH / 2 : Math.max(vh / 2, Math.min(MH - vh / 2, cy));
      svg.setAttribute('viewBox', (cx - vw / 2).toFixed(1) + ' ' + (cy - vh / 2).toFixed(1) + ' ' + vw.toFixed(1) + ' ' + vh.toFixed(1));
      /* group names stay a readable size on screen instead of growing with the map */
      var fs = Math.min(92, 17 / (k0 * z)); labs.forEach(function (q) { q[0].setAttribute('font-size', fs.toFixed(1)); q[0].setAttribute('y', (q[1] - q[2] * fs * 1.13).toFixed(1)); });
      svg.classList.toggle('zt', S3 * L * k0 * z >= 58); bOut.disabled = bFit.disabled = z <= 1.001; bIn.disabled = z >= zmax() - .001; }
    function toU(x, y) { var r = frame.getBoundingClientRect(); return [cx + (x - r.left - W / 2) / (k0 * z), cy + (y - r.top - H / 2) / (k0 * z)]; }
    function zoomAt(x, y, f) { var u = toU(x, y), r = frame.getBoundingClientRect(); z = Math.max(1, Math.min(zmax(), z * f)); cx = u[0] - (x - r.left - W / 2) / (k0 * z); cy = u[1] - (y - r.top - H / 2) / (k0 * z); view(); }
    function hit(x, y) { var u = toU(x, y), best = null, bd = L * L; for (var i = 0; i < pos.length; i++) { if (!pos[i]) continue; var dx = pos[i][0] - u[0], dy = pos[i][1] - u[1], d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
      var g = null; if (best == null) grp.forEach(function (q) { if (Math.hypot(q.x - u[0], q.y - u[1]) < q.rad) g = q; }); return { i: best, g: g }; }
    function reveal(i) { if (z <= 1.001 || !pos[i]) return; var vw = W / (k0 * z), vh = H / (k0 * z), m = L * 1.5; if (Math.abs(pos[i][0] - cx) > vw / 2 - m || Math.abs(pos[i][1] - cy) > vh / 2 - m) { cx = pos[i][0]; cy = pos[i][1]; view(); } }

    /* ── what is lit ── */
    var marked = [];
    function paint() { marked.forEach(function (e) { e.classList.remove('hv', 'pick', 'ln', 'on'); if (e.tx) e.tx.classList.remove('dk'); }); marked = [];
      function mark(e, c) { if (!e) return; e.classList.add(c); marked.push(e); }
      var act = hov != null ? hov : sel;
      if (act != null) E.linksOf(act).forEach(function (j) { mark(lines[j], 'on'); mark(tiles[E.other(j, act)], 'ln'); });
      if (sel != null && tiles[sel]) { mark(tiles[sel], 'pick'); tiles[sel].tx.classList.add('dk'); }
      if (hov != null && tiles[hov]) { mark(tiles[hov], 'hv'); tiles[hov].tx.classList.add('dk'); }
      svg.classList.toggle('foc', hov != null && E.linksOf(hov).length > 0);
      strip.textContent = '';
      if (act != null) { var n = E.linksOf(act).length; strip.appendChild(h('i', { text: E.GI[P[act].group].name })); strip.appendChild(h('b', { text: P[act].title })); strip.appendChild(h('em', { text: n ? '⇄ ' + n + (n === 1 ? ' link' : ' links') : 'no links yet' })); }
      else if (hovG) { strip.appendChild(h('b', { text: hovG.name })); strip.appendChild(h('em', { text: hovG.n + ' pieces' })); }
      else strip.appendChild(h('em', { class: 'hint', text: E.touch() ? 'Slide a finger across the map. Lift it to open that piece below.' : 'Move over the map. Click a piece to open it below.' })); }
    function setHover(t) { var i = t ? t.i : null, g = t ? t.g : null; if (i === hov && g === hovG) return; hov = i; hovG = g; paint(); }

    /* ── the piece under the map ── */
    function pick(i, quiet) { sel = (i != null && P[i]) ? i : null; paint(); panel.textContent = ''; if (E.onPick) E.onPick(sel);
      if (!quiet) { try { history.replaceState(null, '', '#map' + (sel != null ? '&s=' + encodeURIComponent(P[sel].id) : '')); } catch (e) {} }
      if (sel == null) { panel.appendChild(h('p', { class: 'slot', text: 'Nothing open yet. Pick any hexagon on the map and the piece opens here.' })); return; }
      reveal(sel);
      var p = P[sel], g = E.GI[p.group], ids = E.inGroup(p.group), at = ids.indexOf(sel), me = sel;
      var pv = h('button', { class: 'st', type: 'button', 'aria-label': 'Previous piece in this group', text: '‹' }), nx = h('button', { class: 'st', type: 'button', 'aria-label': 'Next piece in this group', text: '›' });
      pv.onclick = function () { pick(ids[(at - 1 + ids.length) % ids.length]); }; nx.onclick = function () { pick(ids[(at + 1) % ids.length]); };
      panel.appendChild(h('div', { class: 'pt' }, [h('span', { text: E.pad2(g.order) + ' · ' + g.name + ' · ' + (at + 1) + ' of ' + ids.length }), h('span', { class: 'sp' }), pv, nx]));
      panel.appendChild(h('h3', { text: p.title })); if (p.desc) panel.appendChild(h('p', { class: 'lede', text: p.desc }));
      var ls = E.linksOf(sel); if (ls.length) { var box = h('div', { class: 'mlinks' }, [h('span', { class: 'lb', text: 'Linked to' })]);
        ls.forEach(function (j) { var o = E.other(j, me), b = h('button', { type: 'button', class: 'mlink' }, [h('b', { text: '⇄ ' + P[o].title }), B[j].text ? h('span', { text: B[j].text }) : null]); b.onclick = function () { pick(o); }; box.appendChild(b); }); panel.appendChild(box); }
      if (p.img) panel.appendChild(h('img', { src: p.img, alt: '', loading: 'lazy' }));
      var pb = h('div', { class: 'pb full' }); panel.appendChild(pb);
      if (p.body && E.BMD) { pb.appendChild(h('p', { class: 'slot', text: 'Loading…' }));
        fetch('pieces/' + encodeURIComponent(p.id) + '.md', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (md) { if (alive && sel === me) pb.innerHTML = E.BMD.render(md); }).catch(function () { if (sel !== me) return; pb.textContent = ''; pb.appendChild(h('p', { class: 'slot', text: 'This piece could not load. Try again in a moment.' })); }); }
      else pb.appendChild(h('p', { class: 'slot', text: 'Not written yet. Your words for this piece go here.' }));
      panel.appendChild(h('div', { class: 'acts' }, [h('a', { class: 'go', href: E.pref(sel), text: '⤢ Open the full essay' }), h('a', { class: 'go2', href: E.readHere(sel), text: 'See it in its group' })]));
      if (!quiet) { E.markRead(sel); if (tiles[sel]) tiles[sel].classList.add('rd'); } }

    /* ── fingers and mouse ── */
    var pts = {}, np = 0, multi = false, moved = false, st = null, pin = null, lastTap = null;
    function two() { var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
    frame.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { frame.setPointerCapture(e.pointerId); } catch (x) {} pts[e.pointerId] = { x: e.clientX, y: e.clientY }; np++;
      if (np === 1) { multi = false; moved = false; st = { x: e.clientX, y: e.clientY, cx: cx, cy: cy, mouse: e.pointerType === 'mouse' }; if (!st.mouse) setHover(hit(e.clientX, e.clientY)); }
      else if (np === 2) { multi = true; setHover(null); var t = two(); pin = { d: t.d, z: z, u: toU(t.x, t.y) }; }
      e.preventDefault(); });
    frame.addEventListener('pointermove', function (e) { var p = pts[e.pointerId];
      if (!p) { if (e.pointerType === 'mouse') setHover(e.target.closest('button') ? null : hit(e.clientX, e.clientY)); return; }
      p.x = e.clientX; p.y = e.clientY;
      if (np >= 2 && pin) { var t = two(), r = frame.getBoundingClientRect(); z = Math.max(1, Math.min(zmax(), pin.z * t.d / pin.d)); cx = pin.u[0] - (t.x - r.left - W / 2) / (k0 * z); cy = pin.u[1] - (t.y - r.top - H / 2) / (k0 * z); view(); return; }
      if (np !== 1 || multi || !st) return; var dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (st.mouse) { if (!moved && Math.hypot(dx, dy) > 4) { moved = true; frame.classList.add('drag'); setHover(null); } if (moved) { cx = st.cx - dx / (k0 * z); cy = st.cy - dy / (k0 * z); view(); } }
      else setHover(hit(e.clientX, e.clientY)); });
    function up(e) { if (!pts[e.pointerId]) return; delete pts[e.pointerId]; np = Math.max(0, np - 1); if (np < 2) pin = null; if (np) return;
      frame.classList.remove('drag');
      if (e.type === 'pointerup' && !multi && !(st && st.mouse && moved)) { var t = hit(e.clientX, e.clientY), now = Date.now();
        if (lastTap && now - lastTap.t < 330 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 28) { zoomAt(e.clientX, e.clientY, 2.2); lastTap = null; } else lastTap = { t: now, x: e.clientX, y: e.clientY };
        if (t.i != null) pick(t.i); }
      if (!st || !st.mouse) setHover(null); else setHover(hit(e.clientX, e.clientY)); }
    frame.addEventListener('pointerup', up); frame.addEventListener('pointercancel', up);
    frame.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !np) setHover(null); });
    frame.addEventListener('wheel', function (e) { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.deltaMode ? .05 : .0016))); }, { passive: false });
    /* Safari's own pinch-zoom of the page must not fire on the map */
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { frame.addEventListener(n, function (e) { e.preventDefault(); }); });
    bIn.onclick = function () { if (z <= 1.001 && sel != null && pos[sel]) { cx = pos[sel][0]; cy = pos[sel][1]; } z *= 1.7; view(); };
    bOut.onclick = function () { z /= 1.7; view(); };
    bFit.onclick = function () { z = 1; view(); };
    frame.addEventListener('keydown', function (e) { if (e.key === '+' || e.key === '=') bIn.onclick(); else if (e.key === '-') bOut.onclick(); else if (e.key === '0') bFit.onclick(); });

    var rt; function onResize() { clearTimeout(rt); rt = setTimeout(function () { if (!alive || !document.body.contains(root)) return; if (colsFor(root.clientWidth) !== cols) build(); else size(); }, 150); }
    window.addEventListener('resize', onResize);
    return { root: root, ctl: ctl, pick: pick, layout: function () { build(); }, destroy: function () { alive = false; window.removeEventListener('resize', onResize); } };
  };
})();
