/* ═══════════════════════════════════════════════════════════════════════
   BLAWG PAGE (blawg/index.html)
   tree + arrows · read on request · five at random · the board · gallery
   · single essays · request tray · codes
   Data: posts.js (BLOG_POSTS), sealed/index.js (BLOG_READY),
         sealed/keys.js (BLOG_RINGS), ../assets/ascii/catalog.js
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var ASSETS = (window.BLAWG_ASSETS || '../assets/ascii/');
  var REQUEST_TO = 'waleedraza1211@gmail.com';   // same address as the contact link on the home page
  var CAT = window.AsciiCatalog;
  var reduced = window.AsciiField && AsciiField.reducedMotion;

  var posts = (window.BLOG_POSTS || []).slice();
  var READY = window.BLOG_READY || {};
  var RINGS = window.BLOG_RINGS || [];
  var bySlug = {};
  posts.forEach(function (p) { bySlug[p.slug] = p; });
  var essaysFor = {};                          // piece key -> essays it sits on
  posts.forEach(function (p) {
    if (!p.art || !CAT.get(p.art)) { delete p.art; return; }
    (essaysFor[p.art] = essaysFor[p.art] || []).push(p);
  });

  var keys = {}, opened = [], plain = {}, picked = [];

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(p) { return ('00' + p.n).slice(-3); }
  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null');
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { return null; }
  }
  /* open = anyone can read · unlocked = a code opened it · ready = read on request.
     The page never says an essay is unwritten. */
  function state(p) {
    if (p.body) return 'open';
    return READY[p.slug] && keys[p.slug] ? 'unlocked' : 'ready';
  }
  var LABEL = { open: 'OPEN', unlocked: 'UNLOCKED', ready: 'ON REQUEST' };
  function canRead(p) { var s = state(p); return s === 'open' || s === 'unlocked'; }
  function previewHtml(p) {
    var r = READY[p.slug];
    return p.preview || (r && r.excerpt) || (p.summary ? '<p>' + esc(p.summary) + '</p>' : '') || (r && r.blurb ? '<p>' + esc(r.blurb) + '</p>' : '');
  }
  function previewPlain(p) { var d = document.createElement('div'); d.innerHTML = previewHtml(p); return d.textContent.trim(); }
  function dots(p) { return (p.art ? '<i class="dot d-art" title="has art"></i>' : '') + (p.pick ? '<i class="dot d-pick" title="Waleed\'s pick"></i>' : ''); }

  /* ── live pieces: one running instance per spot, held still when out of focus ── */
  var lives = {};
  function hold(L, still) {
    if (!L.sc || L.tree || L.paused === still) return;
    var r = L.sc.toggle();
    L.paused = typeof r === 'boolean' ? r : still;
  }
  function attach(id, key, box, run, maxH) {
    var L = lives[id];
    if (L && L.key !== key) { hold(L, true); if (L.el && L.el.parentNode) L.el.parentNode.removeChild(L.el); L = null; }
    if (!L) {
      L = lives[id] = { key: key, tree: /^Tree\./.test(key) };
      L.wait = CAT.mount(key, ASSETS).then(function (m) {
        if (lives[id] !== L) return;
        L.el = m.el; L.box.appendChild(m.el);
        L.sc = m.start(); L.paused = false;
        if (!L.run) setTimeout(function () { if (!L.run) hold(L, true); }, reduced ? 0 : 450);
        setTimeout(function () { fit(L); }, 80);
      }).catch(function () {});
    }
    L.box = box; L.run = run; L.maxH = maxH;
    if (L.el && L.el.parentNode !== box) { box.appendChild(L.el); fit(L); }
    hold(L, !run);
    return L;
  }
  /* make a piece no taller than maxH (px) by narrowing it; pieces size themselves from their width */
  function fit(L) {
    if (!L || !L.el || !L.maxH) return;
    var lim = typeof L.maxH === 'function' ? L.maxH() : L.maxH;
    L.el.style.width = '';
    requestAnimationFrame(function () {
      var r = L.el.getBoundingClientRect();
      if (r.height > lim + 4 && r.width) {
        L.el.style.width = Math.floor(r.width * lim / r.height) + 'px';
        window.dispatchEvent(new Event('resize'));
      }
    });
  }
  function stop(id) { var L = lives[id]; if (L) { L.run = false; hold(L, true); } }
  function clickToggle(box, id) {
    box.addEventListener('click', function () { var L = lives[id]; if (L && L.sc) { if (L.tree) L.sc.replay(); else { L.run = L.paused; hold(L, !L.paused); } } });
  }

  /* ══ the tree, and the arrows beside it ══════════════════════════════ */
  var KOAN = 'If a tree falls in a forest and no one is around to hear it, does it make a sound?';
  var koanEl = $('koan'), typingTimer = null;
  function typeKoan(instant) {
    clearTimeout(typingTimer);
    if (instant) { koanEl.textContent = KOAN; return; }
    var i = 0;
    koanEl.innerHTML = '';
    (function tick() {
      koanEl.innerHTML = KOAN.slice(0, i).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '<span class="cursor">&#9612;</span>';
      if (i++ < KOAN.length) typingTimer = setTimeout(tick, 38);
      else typingTimer = setTimeout(function () { koanEl.textContent = KOAN; }, 2400);
    })();
  }
  var hint = $('replay');
  var Scene = /[?&]tree=oak\b/.test(location.search) ? FallenOak : FallenTree;
  var tree = Scene.mount($('tree-scene'), {
    onImpact: function () { setTimeout(function () { typeKoan(reduced); }, reduced ? 0 : 1600); },
    onSettled: function () { hint.classList.add('on'); }
  });
  function replay(e) {
    if (e) e.stopPropagation();
    hint.classList.remove('on'); koanEl.innerHTML = ''; clearTimeout(typingTimer);
    tree.replay();
  }
  hint.addEventListener('click', replay);
  $('scene-wrap').addEventListener('click', replay);

  var egg = 0, stage = $('hero-stage'), eggBox = $('egg-box'), eggCap = $('egg-cap');
  var ALL = CAT.list;                         // 0 is the redwood, which is the tree itself
  function showEgg(i) {
    egg = (i + ALL.length) % ALL.length;
    stage.classList.add('used');
    var e = ALL[egg];
    if (egg === 0) {
      stage.classList.remove('egg'); stop('egg');
      eggCap.innerHTML = '';
      return;
    }
    stage.classList.add('egg');
    attach('egg', e.key, eggBox, true, function () { return Math.max(260, innerHeight * 0.62); });
    var on = essaysFor[e.key] || [];
    eggCap.innerHTML = (egg + 1) + ' / ' + ALL.length + ' &middot; <b>' + esc(e.title) + '</b> &middot; ' + esc(e.note) +
      (on.length ? ' &middot; on ' + on.map(function (p) { return '<a href="#' + esc(p.slug) + '">' + num(p) + ' ' + esc(p.title) + '</a>'; }).join(', ') : '') +
      ' &middot; <button type="button" id="egg-home">back to the tree</button>';
  }
  $('egg-prev').addEventListener('click', function () { showEgg(egg - 1); });
  $('egg-next').addEventListener('click', function () { showEgg(egg + 1); });
  eggCap.addEventListener('click', function (e) { if (e.target.id === 'egg-home') { showEgg(0); replay(); } });
  clickToggle(eggBox, 'egg');

  /* ══ five at random ═════════════════════════════════════════════════ */
  var pvTrack = $('pv-track'), five = [], pvAt = 0;
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function drawFive() {
    var last = five.map(function (p) { return p.slug; });
    var pool = posts.filter(function (p) { return last.indexOf(p.slug) < 0; });
    var withArt = shuffle(pool.filter(function (p) { return p.art; })), rest = shuffle(pool.filter(function (p) { return !p.art; }));
    five = shuffle(withArt.slice(0, 3).concat(rest.slice(0, 2)));
    if (five.length < 5) five = five.concat(shuffle(pool).filter(function (p) { return five.indexOf(p) < 0; }).slice(0, 5 - five.length));
    pvTrack.innerHTML = five.map(function (p, i) {
      var text = previewPlain(p);
      return '<div class="pv-card' + (p.art ? '' : ' text') + '" data-i="' + i + '" data-n="' + num(p) + '">' +
        (p.art ? '<div class="pv-art" id="pv-art-' + i + '" title="Click to pause"></div>' : '') +
        '<div class="pv-meta">' + dots(p) + '<span>&#8470; ' + num(p) + ' &middot; ' + esc(p.tag) + '</span></div>' +
        '<div class="pv-title">' + esc(p.title) + '</div>' +
        (text ? '<div class="pv-text">' + esc(text) + '</div>' : '') +
        '<div class="pv-acts">' + actions(p) + '<button type="button" class="btn ghost" data-act="row" data-slug="' + esc(p.slug) + '">FIND IN THE BOARD</button></div></div>';
    }).join('');
    five.forEach(function (p, i) { if (p.art) clickToggle($('pv-art-' + i), 'pv' + i); });
    $('pv-dots').innerHTML = five.map(function (p, i) { return '<button type="button" aria-label="Essay ' + (i + 1) + '"></button>'; }).join('');
    pvAt = -1; pvGo(0);
  }
  function pvGo(i) {
    i = (i + five.length) % five.length;
    if (pvAt >= 0 && five[pvAt] && five[pvAt].art) stop('pv' + pvAt);
    pvAt = i;
    pvTrack.style.transform = 'translateX(' + (-100 * i) + '%)';
    Array.prototype.forEach.call($('pv-dots').children, function (b, k) { b.classList.toggle('on', k === i); });
    five.forEach(function (p, k) {
      if (!p.art) return;
      var near = Math.abs(k - i) <= 1;
      if (k === i || near) attach('pv' + k, p.art, $('pv-art-' + k), k === i, function () { return $('pv-art-' + k).clientHeight; });
    });
  }
  $('pv-prev').addEventListener('click', function () { pvGo(pvAt - 1); });
  $('pv-next').addEventListener('click', function () { pvGo(pvAt + 1); });
  $('pv-dots').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) pvGo(Array.prototype.indexOf.call(b.parentNode.children, b)); });
  $('pv-shuffle').addEventListener('click', function () { for (var k = 0; k < 5; k++) stop('pv' + k); drawFive(); });
  (function () {
    var x0 = null;
    $('pv-stage').addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    $('pv-stage').addEventListener('pointerup', function (e) {
      if (x0 === null) return; var dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) pvGo(pvAt + (dx < 0 ? 1 : -1));
    });
  })();

  /* ══ the board ══════════════════════════════════════════════════════ */
  var F = { f: 'all', cat: '', sort: 'n', q: '' }, openRow = '';
  var cats = [];
  posts.forEach(function (p) { if (cats.indexOf(p.tag) < 0) cats.push(p.tag); });
  $('cat').innerHTML += cats.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');

  function actions(p) {
    var on = picked.indexOf(p.slug) >= 0;
    if (canRead(p)) return '<button type="button" class="btn" data-act="read" data-slug="' + esc(p.slug) + '">READ</button>';
    return '<button type="button" class="btn' + (on ? ' on' : '') + '" data-act="pick" data-slug="' + esc(p.slug) + '">' + (on ? '&#10003; ON YOUR LIST' : '+ REQUEST') + '</button>' +
      (on ? '<button type="button" class="btn ghost" data-act="send">REVIEW AND SEND</button>' : '');
  }
  function list() {
    var q = F.q.toLowerCase();
    var out = posts.filter(function (p) {
      if (F.f === 'pick' && !p.pick) return false;
      if (F.f === 'nq' && !p.nq) return false;
      if (F.f === 'art' && !p.art) return false;
      if (F.f === 'unlocked' && !canRead(p)) return false;
      if (F.cat && p.tag !== F.cat) return false;
      if (q && p.title.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (F.sort === 'az') out.sort(function (a, b) { return a.title.replace(/^[^A-Za-z0-9]+/, '').localeCompare(b.title.replace(/^[^A-Za-z0-9]+/, '')); });
    return out;
  }
  function rowHead(p) {
    var st = state(p);
    return '<button type="button" class="row-head" aria-expanded="' + (openRow === p.slug) + '">' +
      '<span class="r-num">' + num(p) + '</span><span class="r-dots">' + dots(p) + '</span>' +
      '<span class="r-title">' + esc(p.title) + '</span><span class="r-cat">' + esc(p.tag) + '</span>' +
      '<span class="r-st st-' + st + '">' + LABEL[st] + '</span><span class="r-chev">&#9656;</span></button>';
  }
  function renderRows() {
    var L = list();
    $('shown').textContent = 'Showing ' + L.length + ' of ' + posts.length;
    $('rows').innerHTML = L.length ? L.map(function (p) {
      return '<li class="row' + (openRow === p.slug ? ' open' : '') + (picked.indexOf(p.slug) >= 0 ? ' picked' : '') + '" data-slug="' + esc(p.slug) + '">' + rowHead(p) + '<div class="row-body"></div></li>';
    }).join('') : '<li class="none-here">Nothing matches. Try another filter.</li>';
    if (openRow) fillRow(openRow);
    var nOpen = posts.filter(function (p) { return state(p) === 'open'; }).length, nUn = posts.filter(function (p) { return state(p) === 'unlocked'; }).length;
    $('post-count').textContent = '[' + posts.length + '] ON THE BOARD · ' + nOpen + ' OPEN' + (nUn ? ' · ' + nUn + ' UNLOCKED' : '');
    $('chip-unlocked').hidden = !nUn;
  }
  function rowEl(slug) { return $('rows').querySelector('.row[data-slug="' + slug.replace(/"/g, '') + '"]'); }
  function fillRow(slug) {
    var li = rowEl(slug), p = bySlug[slug]; if (!li) return;
    var body = li.querySelector('.row-body'), text = previewHtml(p), piece = p.art && CAT.get(p.art);
    body.innerHTML = (piece ? '<div class="rb-art" id="rb-art" title="Click to pause"></div><div class="rb-art-cap"><b>' + esc(piece.title) + '</b> &middot; ' + esc(piece.note) + '</div>' : '') +
      (text ? '<div class="rb-text">' + text + '</div>' : '') +
      '<div class="rb-acts">' + actions(p) + '</div>';
    if (piece) { attach('row', p.art, $('rb-art'), true, function () { return Math.max(240, Math.min(520, innerHeight * 0.6)); }); clickToggle($('rb-art'), 'row'); }
  }
  function toggleRow(slug, force) {
    var was = openRow;
    openRow = force || openRow !== slug ? slug : '';
    if (was && was !== openRow) { var o = rowEl(was); if (o) { o.classList.remove('open'); o.querySelector('.row-head').setAttribute('aria-expanded', 'false'); } stop('row'); }
    var li = rowEl(slug);
    if (!li) { renderRows(); li = rowEl(slug); }
    if (!li) return;
    li.classList.toggle('open', openRow === slug);
    li.querySelector('.row-head').setAttribute('aria-expanded', String(openRow === slug));
    if (openRow === slug) fillRow(slug); else stop('row');
  }
  $('rows').addEventListener('click', function (e) {
    var h = e.target.closest('.row-head');
    if (h) toggleRow(h.parentNode.getAttribute('data-slug'));
  });
  $('controls').addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    F.f = c.getAttribute('data-f');
    Array.prototype.forEach.call(document.querySelectorAll('#controls .chip'), function (x) { x.classList.toggle('on', x === c); });
    renderRows();
  });
  $('cat').addEventListener('change', function () { F.cat = this.value; renderRows(); });
  $('sort').addEventListener('change', function () { F.sort = this.value; renderRows(); });
  $('q').addEventListener('input', function () { F.q = this.value.trim(); renderRows(); });
  function setFilter(f) {
    F.f = f; Array.prototype.forEach.call(document.querySelectorAll('#controls .chip'), function (x) { x.classList.toggle('on', x.getAttribute('data-f') === f); });
  }
  function findInBoard(slug) {
    setFilter('all'); F.cat = ''; F.q = ''; $('cat').value = ''; $('q').value = '';
    renderRows(); toggleRow(slug, true);
    var li = rowEl(slug); if (li) li.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  /* one handler for every action button on the page */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act'), slug = b.getAttribute('data-slug');
    if (act === 'pick') togglePick(slug);
    if (act === 'send') openPanel();
    if (act === 'read') go(slug);
    if (act === 'row') findInBoard(slug);
  });

  /* ══ gallery: every piece, started when it nears the screen ══════════ */
  $('g-tag').textContent = 'ART · ' + ALL.length + ' PIECES';
  $('g-grid').innerHTML = ALL.map(function (e, i) {
    var on = essaysFor[e.key] || [];
    return '<div class="g-card"><div class="g-art" id="g-' + i + '" title="Click to pause"></div><div class="g-meta"><h3>' + esc(e.title) + '<span>' + esc(e.note) + '</span></h3>' +
      (on.length ? '<div class="with">on ' + on.map(function (p) { return '<a href="#' + esc(p.slug) + '">' + num(p) + ' ' + esc(p.title) + '</a>'; }).join('') + '</div>' : '') + '</div></div>';
  }).join('');
  (function () {
    var started = {};
    function startG(i) { if (started[i]) return; started[i] = true; attach('g' + i, ALL[i].key, $('g-' + i), true, function () { return $('g-' + i).clientHeight; }); clickToggle($('g-' + i), 'g' + i); }
    if (!window.IntersectionObserver) { ALL.forEach(function (e, i) { startG(i); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) {
        var i = +x.target.id.slice(2);
        if (x.isIntersecting) startG(i);
        else if (lives['g' + i]) stop('g' + i);
        if (x.isIntersecting && lives['g' + i] && lives['g' + i].sc) { lives['g' + i].run = true; hold(lives['g' + i], false); }
      });
    }, { rootMargin: '300px 0px' });
    ALL.forEach(function (e, i) { io.observe($('g-' + i)); });
  })();

  /* ══ request tray ═══════════════════════════════════════════════════ */
  function togglePick(slug) {
    var i = picked.indexOf(slug);
    if (i >= 0) picked.splice(i, 1); else picked.push(slug);
    store('blawg.picked', picked);
    refreshActions(); renderTray();
    if (document.body.classList.contains('reading')) route(true);
  }
  function refreshActions() {
    Array.prototype.forEach.call(document.querySelectorAll('.pv-acts, .rb-acts'), function (box) {
      var b = box.querySelector('[data-slug]'); if (!b) return;
      var p = bySlug[b.getAttribute('data-slug')], keep = box.classList.contains('pv-acts') ? box.querySelector('[data-act="row"]') : null;
      box.innerHTML = actions(p); if (keep) box.appendChild(keep);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.row'), function (li) { li.classList.toggle('picked', picked.indexOf(li.getAttribute('data-slug')) >= 0); });
  }
  function renderTray() {
    $('tray-n').textContent = picked.length;
    $('tray-word').textContent = picked.length === 1 ? 'essay' : 'essays';
    $('tray').classList.toggle('on', picked.length > 0 && !$('veil').classList.contains('on'));
  }
  function renderPanel() {
    var l = picked.map(function (s) { return bySlug[s]; }).filter(Boolean);
    $('panel-list').innerHTML = l.map(function (p) {
      return '<li><span><b>' + num(p) + '</b>' + esc(p.title) + '</span><button type="button" data-slug="' + esc(p.slug) + '" aria-label="Remove">&times;</button></li>';
    }).join('');
    $('panel-list').style.display = l.length ? '' : 'none';
    $('panel-none').style.display = l.length ? 'none' : '';
    $('panel-title').textContent = l.length ? 'REQUEST ' + l.length + (l.length === 1 ? ' ESSAY' : ' ESSAYS') : 'ASK';
  }
  function openPanel() { renderPanel(); $('req-sent').textContent = ''; $('veil').classList.add('on'); renderTray(); $('req-name').focus(); }
  function closePanel() { $('veil').classList.remove('on'); renderTray(); }
  function requestText() {
    var l = picked.map(function (s) { return bySlug[s]; }).filter(Boolean);
    var name = $('req-name').value.trim(), note = $('req-note').value.trim(), lines = ['Hi Waleed,', ''];
    if (l.length) { lines.push("I'd like to read:"); l.forEach(function (p) { lines.push('  #' + num(p) + ' ' + p.title); }); lines.push(''); }
    if (note) { lines.push(note); lines.push(''); }
    if (name) lines.push(name);
    return { subject: 'Blawg request' + (l.length ? ': ' + l.length + (l.length === 1 ? ' essay' : ' essays') : '') + (name ? ' from ' + name : ''), body: lines.join('\n') };
  }
  $('tray-go').addEventListener('click', openPanel);
  $('ask').addEventListener('click', openPanel);
  $('tray-clear').addEventListener('click', function () { picked = []; store('blawg.picked', picked); refreshActions(); renderTray(); });
  $('req-close').addEventListener('click', closePanel);
  $('veil').addEventListener('click', function (e) { if (e.target === $('veil')) closePanel(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
  $('panel-list').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; togglePick(b.getAttribute('data-slug')); renderPanel(); });
  $('req-mail').addEventListener('click', function () {
    if (!picked.length && !$('req-note').value.trim()) { $('req-sent').textContent = 'Pick an essay or write a note first.'; return; }
    var r = requestText();
    location.href = 'mailto:' + REQUEST_TO + '?subject=' + encodeURIComponent(r.subject) + '&body=' + encodeURIComponent(r.body);
    $('req-sent').textContent = 'Your mail app should have opened. If nothing happened, use COPY INSTEAD and send it to ' + REQUEST_TO + '.';
  });
  $('req-copy').addEventListener('click', function () {
    var r = requestText(), text = r.subject + '\n\n' + r.body;
    function done() { $('req-sent').textContent = 'Copied. Send it to ' + REQUEST_TO + '.'; }
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { $('req-sent').textContent = 'Could not copy. Email ' + REQUEST_TO + ' with the titles you want.'; }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  });

  /* ══ codes ══════════════════════════════════════════════════════════ */
  var codeMsg = $('code-msg');
  function showOpened(note) {
    if (!opened.length) { codeMsg.className = 'code-msg'; codeMsg.textContent = note || ''; return; }
    var n = Object.keys(keys).filter(function (s) { return READY[s]; }).length;
    var who = opened.map(function (r) { return r.name; }).filter(Boolean)[0];
    codeMsg.className = 'code-msg ok';
    codeMsg.innerHTML = '&#10003; ' + n + (n === 1 ? ' essay' : ' essays') + ' unlocked' + (who ? ' for ' + esc(who) : '') + '<button type="button" id="forget">forget on this device</button>';
  }
  function tryCode(code, remember) {
    if (!window.BlawgCrypt || !BlawgCrypt.available()) return Promise.reject(new Error('nocrypto'));
    return BlawgCrypt.openRing(code, RINGS).then(function (ring) {
      Object.keys(ring.keys).forEach(function (s) { keys[s] = ring.keys[s]; });
      if (!opened.some(function (r) { return r.id === ring.id; })) opened.push({ id: ring.id, name: ring.name });
      if (remember) {
        var saved = store('blawg.codes') || [], norm = BlawgCrypt.normCode(code);
        if (saved.indexOf(norm) < 0) { saved.push(norm); store('blawg.codes', saved); }
      }
      return true;
    });
  }
  function submitCode(code, where) {
    var msg = where || codeMsg;
    if (!BlawgCrypt.normCode(code)) return Promise.resolve(false);
    msg.className = msg === codeMsg ? 'code-msg' : 'err'; msg.textContent = 'opening…';
    return tryCode(code, true).then(function () {
      setFilter('unlocked'); F.cat = ''; F.q = ''; $('cat').value = ''; $('q').value = ''; renderRows(); refreshActions(); showOpened();
      if (document.body.classList.contains('reading')) route(true);
      return true;
    }, function (e) {
      var text = e && e.message === 'nocrypto' ? "This browser can't open codes here (it needs https)." : "That code doesn't open anything. Check it for typos.";
      if (msg === codeMsg) { codeMsg.className = 'code-msg bad'; codeMsg.textContent = text; } else msg.textContent = text;
      return false;
    });
  }
  $('code-form').addEventListener('submit', function (e) {
    e.preventDefault();
    submitCode($('code').value).then(function (ok) { if (ok) { $('code').value = ''; $('board').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); } });
  });
  codeMsg.addEventListener('click', function (e) {
    if (e.target.id !== 'forget') return;
    keys = {}; opened = []; plain = {}; store('blawg.codes', []);
    setFilter('all'); renderRows(); refreshActions(); showOpened('Forgotten on this device.');
  });

  /* sealed essays load on demand: sealed/<slug>.js calls BLOG_SEALED(slug, box) */
  var sealedBox = {}, sealedWait = {};
  window.BLOG_SEALED = function (slug, box) { sealedBox[slug] = box; };
  function loadSealed(slug) {
    if (sealedBox[slug]) return Promise.resolve(sealedBox[slug]);
    if (!sealedWait[slug]) sealedWait[slug] = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = 'sealed/' + slug + '.js';
      s.onload = function () { sealedBox[slug] ? ok(sealedBox[slug]) : fail(new Error('empty')); };
      s.onerror = function () { delete sealedWait[slug]; fail(new Error('load')); };
      document.head.appendChild(s);
    });
    return sealedWait[slug];
  }

  /* ══ single essay ═══════════════════════════════════════════════════ */
  function lockedBody(post, bodyEl) {
    var on = picked.indexOf(post.slug) >= 0, pv = previewHtml(post);
    bodyEl.innerHTML = (pv ? '<div class="excerpt">' + pv + '</div>' : '') +
      '<div class="unlock"><p>This essay is read on request. Add it to your list and send the list, and you get a code that opens it.</p>' +
      '<div class="row2"><button type="button" class="btn' + (on ? ' on' : '') + '" data-act="pick" data-slug="' + esc(post.slug) + '">' + (on ? '&#10003; ON YOUR LIST' : '+ ADD TO REQUEST') + '</button>' +
      (on ? '<button type="button" class="btn ghost" data-act="send">REVIEW AND SEND</button>' : '') + '</div>' +
      '<div class="or">Already have a code?</div><form autocomplete="off"><input placeholder="XXXXX-XXXXX-XXXXX-XXXXX" spellcheck="false" aria-label="Access code"><button class="btn ghost" type="submit">OPEN</button></form><div class="err" aria-live="polite"></div></div>';
    var form = bodyEl.querySelector('form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitCode(form.querySelector('input').value, bodyEl.querySelector('.err')).then(function (ok) {
        if (ok && state(post) !== 'unlocked') { var e2 = $('article-body').querySelector('.err'); if (e2) e2.textContent = "That code works, but it doesn't include this essay."; }
      });
    });
  }
  function renderBody(post) {
    var bodyEl = $('article-body'), st = state(post);
    if (st === 'open') { bodyEl.innerHTML = post.body; return; }
    if (st !== 'unlocked') { lockedBody(post, bodyEl); return; }
    if (plain[post.slug]) { bodyEl.innerHTML = plain[post.slug]; return; }
    bodyEl.innerHTML = '<p class="placeholder-note">opening…</p>';
    loadSealed(post.slug).then(function (box) { return BlawgCrypt.open(box, keys[post.slug]); }).then(function (html) {
      plain[post.slug] = html;
      if (here === post.slug) bodyEl.innerHTML = html;
    }, function () { bodyEl.innerHTML = '<p class="placeholder-note">This essay was updated after your code was made. Ask Waleed for a fresh code.</p>'; });
  }
  function metaLine(p) {
    var st = state(p), r = READY[p.slug], bits = ['&#8470; ' + num(p), esc(p.tag || '')];
    if (p.status === 'draft') bits.push('<span class="tag-draft">DRAFT</span>');
    else if (st === 'open' && p.date) bits.push(esc(p.date));
    else bits.push(LABEL[st] + (r && r.words ? ' · ' + Math.max(1, Math.round(r.words / 230)) + ' MIN' : ''));
    return bits.join(' · ');
  }
  var here = '';
  function fromHash() { try { return decodeURIComponent(location.hash.replace('#', '')); } catch (e) { return ''; } }
  function go(slug) {
    here = slug;
    try { history.pushState(null, '', slug ? '#' + encodeURIComponent(slug) : location.pathname + location.search); } catch (e) {}
    route();
    if (!slug) $('board').scrollIntoView({ block: 'start' });
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"], a.back');
    if (!a) return;
    var h = a.getAttribute('href');
    if (!a.classList.contains('back') && !bySlug[decodeURIComponent(h.slice(1))]) return;
    e.preventDefault();
    go(a.classList.contains('back') ? '' : decodeURIComponent(h.slice(1)));
  });
  function route(keep) {
    var post = bySlug[here], art = $('article');
    if (!post) {
      art.classList.remove('on'); document.body.classList.remove('reading'); document.title = 'Blawg | Waleed A. Raza';
      stop('article');
      return;
    }
    $('article-title').textContent = post.title;
    $('article-meta').innerHTML = metaLine(post);
    if (keep !== true) {
      var box = $('article-art');
      if (post.art) attach('article', post.art, box, true, function () { return Math.max(240, innerHeight * 0.55); });
      else { stop('article'); while (box.firstChild) box.removeChild(box.firstChild); if (lives.article) delete lives.article; }
      stop('row'); for (var k = 0; k < 5; k++) stop('pv' + k); stop('egg');
    }
    renderBody(post);
    art.classList.add('on'); document.body.classList.add('reading');
    document.title = post.title + ' | Waleed A. Raza';
    if (keep !== true) art.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
  clickToggle($('article-art'), 'article');

  /* ══ start ══════════════════════════════════════════════════════════ */
  picked = (store('blawg.picked') || []).filter(function (s) { return bySlug[s]; });
  renderRows(); renderTray(); drawFive();
  var linked = /^#k=(.+)$/.exec(location.hash), start = Promise.resolve();
  if (linked) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; } }
  (store('blawg.codes') || []).forEach(function (c) { start = start.then(function () { return tryCode(c, false).catch(function () {}); }); });
  start.then(function () {
    if (opened.length) { renderRows(); refreshActions(); showOpened(); }
    if (linked) return submitCode(decodeURIComponent(linked[1])).then(function (ok) { if (ok) $('board').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }).then(function () {
    function sync() { here = fromHash(); route(); }
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    sync();
  });
})();
