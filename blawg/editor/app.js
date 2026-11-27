// Blawg editor UI. Edits text; never writes any. All changes are changeset ops that stack up
// (encrypted on this device) until Publish makes one commit.
import * as C from './crypto.js';
import * as M from './model.js';
import { renderMarkdown } from './markdown.js';
import { GitHub, loadSnapshot, changedPaths, commitFiles } from './github.js';
import { prepareImage, imageName } from './images.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = (v, n = 90) => { const s = typeof v === 'string' ? v : JSON.stringify(v ?? null); return s.length > n ? s.slice(0, n) + '…' : s; };

const S = {
  // in-memory only; wiped by signOut()
  vaultEnv: null, key: null, secret: null, gh: null, draftsKey: null, draftsSalt: null, draftsBroken: false,
  snap: null, base: M.emptyDoc(), ops: [], files: {}, readOnly: false, source: '',
  view: 'pieces', sel: null, connSel: null, artSel: null, q: '', cq: '', aq: '',
  importing: null, resolutions: {}, conflicts: [], dropped: [], lastCommit: null,
};
let workCache = null;
function work() {
  if (!workCache) workCache = M.applyOps(S.base, S.ops, S.files);
  return workCache.doc;
}
function invalidate() { workCache = null; }

// ---------- notices / modal ----------
function notice(msg, err = false) {
  const n = $('#notice');
  if (!msg) { n.hidden = true; return; }
  n.textContent = msg; n.className = err ? 'err' : ''; n.hidden = false;
}
function modal(html, buttons) {
  return new Promise((res) => {
    $('#modal-body').innerHTML = html;
    const bw = $('#modal-buttons'); bw.innerHTML = '';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.textContent = b.label; el.className = b.cls || ''; el.dataset.answer = b.value;
      el.onclick = () => { $('#modal').hidden = true; res(b.value); };
      bw.appendChild(el);
    }
    $('#modal').hidden = false;
    bw.lastChild && bw.lastChild.focus();
  });
}

// ---------- sign in ----------
function readVault() {
  try { return JSON.parse(localStorage.getItem(C.VAULT_KEY) || 'null'); } catch (e) { return null; }
}
function showSignIn(msg = '', err = true) {
  $('#top').hidden = true; notice('');
  const env = readVault();
  const first = !env;
  $('#main').innerHTML = `
  <form class="signin" id="signin-form" autocomplete="off">
    <h1>blawg <span class="acc">/ edit</span></h1>
    <p class="lead">${first ? 'First time on this device: choose a username and password, and paste your GitHub key once. The key is stored here only encrypted with your password.' : 'Sign in to unlock your GitHub key on this device.'}</p>
    <label>username<input id="si-user" name="username" autocomplete="username" required></label>
    <label>password<input id="si-pass" type="password" autocomplete="${first ? 'new-password' : 'current-password'}" required></label>
    ${first ? `
    <label>password again<input id="si-pass2" type="password" autocomplete="new-password" required></label>
    <label>GitHub fine-grained token <span class="dim">(this repo only, contents: read and write)</span><input id="si-token" type="password" autocomplete="off" spellcheck="false" required></label>
    <div class="grid2">
      <label>owner<input id="si-owner" value="WaleedaRaza" required></label>
      <label>repo<input id="si-repo" value="waleedaraza.github.io" required></label>
      <label>base branch<input id="si-base" value="main" required></label>
      <label>publish to branch<input id="si-target" value="blawg-review" required></label>
    </div>` : ''}
    <div id="si-msg" class="${err ? 'err' : 'ok'}">${h(msg)}</div>
    <div class="row" style="margin-top:12px">
      <button class="primary" id="si-go" type="submit">${first ? 'save and sign in' : 'sign in'}</button>
      ${first ? '' : '<button type="button" class="ghost" id="forget">forget this device</button>'}
    </div>
  </form>`;
  $('#si-user').focus();
  $('#signin-form').onsubmit = (e) => { e.preventDefault(); first ? firstRun() : signIn(); };
  const f = $('#forget'); if (f) f.onclick = forgetDevice;
}

async function firstRun() {
  const user = $('#si-user').value.trim(), pass = $('#si-pass').value, pass2 = $('#si-pass2').value;
  const token = $('#si-token').value.trim();
  const msg = $('#si-msg');
  msg.className = 'err';
  if (!user || !pass) return (msg.textContent = 'Username and password are needed.');
  if (pass.length < 10) return (msg.textContent = 'Use a password of at least 10 characters.');
  if (pass !== pass2) return (msg.textContent = 'The two passwords differ.');
  if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(token)) return (msg.textContent = 'That does not look like a GitHub token (github_pat_...).');
  const secret = { v: 1, token, owner: $('#si-owner').value.trim(), repo: $('#si-repo').value.trim(), base: $('#si-base').value.trim(), target: $('#si-target').value.trim() || 'blawg-review', allowMain: false };
  msg.className = 'ok'; msg.textContent = 'Checking the key with GitHub…';
  const gh = new GitHub(secret);
  try { await gh.repoInfo(); }
  catch (e) {
    if (e.status) { msg.className = 'err'; msg.textContent = `GitHub refused the key or repo: ${e.message}`; return; }
    // unreachable: save anyway, it is checked again on publish
  }
  msg.textContent = 'Encrypting the key…';
  const { env, key } = await C.createVault(user, pass, secret);
  localStorage.setItem(C.VAULT_KEY, JSON.stringify(env));
  S.vaultEnv = env; S.key = key; S.secret = secret;
  await afterUnlock(pass);
}

async function signIn() {
  const user = $('#si-user').value.trim(), pass = $('#si-pass').value;
  const msg = $('#si-msg');
  msg.className = 'ok'; msg.textContent = 'Unlocking…';
  $('#si-go').disabled = true;
  try {
    const { key, secret } = await C.openVault(readVault(), user, pass);
    S.vaultEnv = readVault(); S.key = key; S.secret = secret;
  } catch (e) {
    $('#si-pass').value = '';
    msg.className = 'err'; msg.textContent = e.message; $('#si-go').disabled = false; return;
  }
  await afterUnlock(pass);
}

async function afterUnlock(password) {
  S.gh = new GitHub(S.secret);
  $('#main').innerHTML = '<p class="dim">Loading the blog files…</p>';
  await load(password);
  password = null;
  $('#top').hidden = false;
  go(S.view);
}

function signOut(msg = 'Signed out. Keys wiped from memory.') {
  if (S.gh) S.gh.wipe();
  Object.assign(S, { key: null, secret: null, gh: null, draftsKey: null, draftsSalt: null, vaultEnv: null, snap: null, base: M.emptyDoc(), ops: [], files: {}, importing: null, conflicts: [], resolutions: {}, dropped: [] });
  invalidate();
  showSignIn(msg, false);
}

async function forgetDevice() {
  const a = await modal('<h2>Forget this device?</h2><p>This deletes the encrypted GitHub key and any unsaved changes stored on this device. Published work is not touched.</p>',
    [{ label: 'cancel', value: 'no', cls: 'ghost' }, { label: 'forget this device', value: 'yes' }]);
  if (a !== 'yes') return;
  for (const k of Object.keys(localStorage)) if (k.startsWith('blawg.editor.')) localStorage.removeItem(k);
  signOut('This device is forgotten. Nothing of yours is stored here now.');
}

// ---------- loading ----------
async function openDraftsFor(env, password) {
  if (!env) {
    if (!S.draftsKey) { const d = await C.draftsKey(password); S.draftsKey = d.key; S.draftsSalt = d.salt; }
    return null;
  }
  if (!S.draftsKey || S.draftsSalt !== env.salt) {
    if (!password) throw new Error('drafts.enc was re-keyed elsewhere; sign in again.');
    const d = await C.draftsKey(password, env.salt, env.iter); S.draftsKey = d.key; S.draftsSalt = d.salt;
  }
  return C.openDrafts(S.draftsKey, env);
}

async function docFromSnap(snap, password) {
  const drafts = await openDraftsFor(snap.draftsEnv, password);
  const d = M.docFromFiles({ ...snap.json, bodies: snap.bodies, drafts });
  d._knownFiles = snap.files;
  return d;
}

async function load(password) {
  S.readOnly = false; S.draftsBroken = false; S.source = '';
  let snap = null;
  try {
    snap = await loadSnapshot(S.gh, S.secret.target);
    if (!snap) snap = await loadSnapshot(S.gh, S.secret.base);
    if (!snap) throw new Error(`Neither branch "${S.secret.target}" nor "${S.secret.base}" exists.`);
    S.source = `github ${S.secret.owner}/${S.secret.repo}@${snap.branch}`;
  } catch (e) {
    // offline / blocked: read the files this page is served with, read-only
    S.readOnly = true;
    snap = await loadSameOrigin();
    S.source = 'this site (read-only: ' + e.message + ')';
  }
  S.snap = snap;
  try { S.base = await docFromSnap(snap, password); }
  catch (e) {
    S.draftsBroken = true; S.readOnly = true;
    S.base = M.docFromFiles({ ...snap.json, bodies: snap.bodies });
    S.base._knownFiles = snap.files;
    notice(e.message + ' Publishing is blocked so drafts are not overwritten.', true);
  }
  await restorePending();
  invalidate();
}

async function loadSameOrigin() {
  const get = async (p, dflt) => {
    try { const r = await fetch(new URL(p, location.href), { cache: 'no-store' }); if (!r.ok) return dflt; return await r.json(); }
    catch (e) { return dflt; }
  };
  const json = { pieces: await get('data/pieces.json', []), connections: await get('data/connections.json', []), art: await get('data/art.json', null), groups: await get('data/groups.json', []) };
  const bodies = {};
  for (const p of json.pieces) if (p.body) {
    try { const r = await fetch(new URL(`pieces/${p.id}.md`, location.href)); if (r.ok) bodies[p.id] = await r.text(); } catch (e) { /* skip */ }
  }
  return { branch: '(site)', head: null, tree: null, shas: {}, json, bodies, draftsEnv: null, files: [] };
}

// ---------- pending (encrypted, this device) ----------
async function persist() {
  invalidate(); updateBadge();
  if (!S.key) return;
  if (!S.ops.length && !Object.keys(S.files).length) { localStorage.removeItem(C.PENDING_KEY); return; }
  const base = M.clone(S.base);
  const { iv, ct } = await C.encryptJSON(S.key, { v: 1, ops: S.ops, files: S.files, base, baseShas: S.snap.shas, baseFiles: S.snap.files, branch: S.snap.branch });
  try { localStorage.setItem(C.PENDING_KEY, JSON.stringify({ v: 1, iv, ct })); }
  catch (e) { notice('Could not store unsaved changes on this device (storage full?). Publish soon.', true); }
}
async function restorePending() {
  let env = null;
  try { env = JSON.parse(localStorage.getItem(C.PENDING_KEY) || 'null'); } catch (e) { env = null; }
  if (!env) return;
  try {
    const p = await C.decryptJSON(S.key, env.iv, env.ct);
    S.ops = p.ops || []; S.files = p.files || {};
    if (S.ops.length || Object.keys(S.files).length) {
      // keep the base these ops were made on; Publish rebases if the remote moved
      S.base = p.base; S.base._knownFiles = p.baseFiles || S.snap.files;
      S.snap = { ...S.snap, shas: p.baseShas || {}, files: p.baseFiles || S.snap.files };
    }
  } catch (e) { notice('Unsaved changes on this device could not be opened and were left as they are.', true); }
}

async function addOps(ops, files = {}) {
  const trial = M.applyOps(S.base, [...S.ops, ...ops], { ...S.files, ...files });
  const bad = trial.results.slice(S.ops.length).flatMap((r) => r.errors);
  if (bad.length) { notice('Not changed: ' + [...new Set(bad)].join('; '), true); return false; }
  S.ops.push(...ops); Object.assign(S.files, files);
  await persist();
  return true;
}
function updateBadge() {
  const n = M.diff(S.base, work()).length + Object.keys(S.files).length;
  const b = $('#pending-count'); b.textContent = n; b.className = 'badge' + (n ? '' : ' zero');
  $('#branch-note').textContent = S.source + (S.readOnly ? '' : ` → ${S.secret?.target}`);
}

// ---------- views ----------
function go(view) {
  S.view = view;
  for (const b of $$('#tabs button')) b.classList.toggle('on', b.dataset.view === view);
  updateBadge();
  ({ pieces: viewPieces, connections: viewConnections, art: viewArt, import: viewImport, publish: viewPublish, settings: viewSettings })[view]();
}

const typeOpts = (sel) => `<option value="">(none)</option>` + M.TYPES.map((t) => `<option ${t === sel ? 'selected' : ''}>${h(t)}</option>`).join('');
const groupOpts = (doc, sel) => `<option value="">(none)</option>` + [...doc.groups].sort((a, b) => a.order - b.order).map((g) => `<option value="${h(g.id)}" ${g.id === sel ? 'selected' : ''}>${h(g.name)}</option>`).join('');
const stateOpts = (list, sel) => list.map((s) => `<option ${s === sel ? 'selected' : ''}>${s}</option>`).join('');
const st = (s) => `<span class="st st-${s}">${s}</span>`;

// ----- pieces -----
function viewPieces() {
  const doc = work();
  $('#main').innerHTML = `
  <div class="split">
    <section>
      <div class="row" style="margin-bottom:8px"><input id="p-search" placeholder="search pieces" value="${h(S.q)}" class="grow" style="width:auto"><button class="alt" id="p-new">+ new</button></div>
      <div class="dim" style="font-size:12px;margin-bottom:6px">${doc.pieces.length} pieces · ${doc.pieces.filter((p) => p.state === 'live').length} live · ${doc.pieces.filter((p) => p.state === 'draft').length} draft</div>
      <div class="list" id="p-list"></div>
    </section>
    <section id="p-edit"></section>
  </div>`;
  const list = () => {
    const q = M.norm(S.q);
    const items = doc.pieces.filter((p) => !q || M.norm(`${p.title} ${p.id} ${p.desc} ${p.group || ''} ${p.type || ''} ${p.state}`).includes(q));
    $('#p-list').innerHTML = items.map((p) => `<button class="item ${p.id === S.sel ? 'on' : ''}" data-id="${h(p.id)}">${h(p.title || p.id)} ${st(p.state)}<span class="meta">${h(p.group || '-')} · ${h(p.type || '-')}</span></button>`).join('') || '<p class="dim" style="padding:8px">No pieces yet.</p>';
    for (const b of $$('#p-list .item')) b.onclick = () => { S.sel = b.dataset.id; viewPieces(); };
  };
  list();
  $('#p-search').oninput = (e) => { S.q = e.target.value; list(); };
  $('#p-new').onclick = () => { S.sel = '__new'; viewPieces(); };
  pieceForm(doc);
}

function pieceForm(doc) {
  const el = $('#p-edit');
  const isNew = S.sel === '__new';
  const p = isNew ? M.newPiece('') : M.piece(doc, S.sel);
  if (!p) { el.innerHTML = '<p class="dim">Pick a piece on the left, or make a new one.</p>'; return; }
  const imgSrc = (path) => (S.files[path] ? `data:image/${path.endsWith('.png') ? 'png' : 'jpeg'};base64,${S.files[path]}` : new URL('../' + path, location.href).href);
  el.innerHTML = `
  <form id="p-form" autocomplete="off">
    <div class="row" style="justify-content:space-between"><h2>${isNew ? 'new piece' : h(p.id)}</h2><span>${st(p.state)}</span></div>
    <label>title<input id="f-title" value="${h(p.title)}"></label>
    <label>desc<textarea id="f-desc" rows="2">${h(p.desc)}</textarea></label>
    <div class="grid4">
      <label>type<select id="f-type">${typeOpts(p.type)}</select></label>
      <label>group<select id="f-group">${groupOpts(doc, p.group)}</select></label>
      <label>state<select id="f-state">${stateOpts(M.STATES, p.state)}</select></label>
      <label>picture<input id="f-img-file" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png"></label>
    </div>
    <div class="row" id="f-img-row">${p.img ? `<img class="thumb" src="${h(imgSrc(p.img))}" alt=""><span class="dim" id="f-img-path">${h(p.img)}</span> <button type="button" class="ghost" id="f-img-clear">remove picture</button>` : '<span class="dim" id="f-img-path">no picture</span>'}</div>
    <input type="hidden" id="f-img" value="${h(p.img || '')}">
    ${p.art.length ? `<p class="dim">art: ${p.art.map(h).join(', ')} <span>(change in art)</span></p>` : ''}
    ${p.locked ? '<p class="dim">This essay is locked: its body is ciphertext and is kept as it is.</p>' : `
    <div class="bodybox">
      <label>body (Markdown)<textarea id="f-body" spellcheck="true">${h(p.bodyText)}</textarea></label>
      <div><div class="dim">preview</div><div class="preview" id="f-preview">${renderMarkdown(p.bodyText)}</div></div>
    </div>`}
    <div class="row" style="margin-top:12px">
      <button class="primary" type="submit" id="f-save">${isNew ? 'create piece' : 'keep changes'}</button>
      ${isNew ? '' : '<button type="button" id="f-delete">delete piece</button>'}
      <span class="dim">stacks into unsaved changes; nothing goes live until publish</span>
    </div>
  </form>`;
  const body = $('#f-body');
  if (body) body.oninput = () => { $('#f-preview').innerHTML = renderMarkdown(body.value); };
  $('#f-img-file').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const img = await prepareImage(file);
      const path = uniqueFile('blawg/img/', imageName(file.name, img.mime));
      S.files[path] = C.b64(img.bytes);
      $('#f-img').value = path;
      $('#f-img-row').innerHTML = `<img class="thumb" src="data:${img.mime};base64,${S.files[path]}" alt=""><span class="dim" id="f-img-path">${h(path)} · ${img.width}px · ${Math.round(img.bytes.length / 1024)}KB (not kept until you press ${isNew ? 'create' : 'keep changes'})</span>`;
    } catch (err) { notice(err.message, true); }
  };
  const clr = $('#f-img-clear'); if (clr) clr.onclick = () => { $('#f-img').value = ''; $('#f-img-row').innerHTML = '<span class="dim">no picture (press keep changes)</span>'; };
  $('#p-form').onsubmit = async (e) => {
    e.preventDefault();
    const set = { title: $('#f-title').value, desc: $('#f-desc').value, type: $('#f-type').value || null, group: $('#f-group').value || null, state: $('#f-state').value, img: $('#f-img').value || null };
    if (body) set.body = body.value;
    const files = {};
    if (set.img && S.files[set.img]) files[set.img] = S.files[set.img];
    if (isNew) {
      if (!set.title.trim()) return notice('A new piece needs a title.', true);
      const id = M.uniquePieceId(doc, set.title);
      if (await addOps([{ op: 'create', kind: 'piece', id, set }], files)) { S.sel = id; notice(`Created ${id} (unsaved).`); viewPieces(); }
      return;
    }
    const changed = {};
    for (const [k, v] of Object.entries(set)) if (!M.eq(k === 'body' ? p.bodyText : p[k], v)) changed[k] = v;
    if (!Object.keys(changed).length) return notice('No changes to keep.');
    if (await addOps([{ op: 'update', kind: 'piece', id: p.id, set: changed }], files)) { notice(`Kept changes to ${p.id} (unsaved): ${Object.keys(changed).join(', ')}.`); viewPieces(); }
  };
  const del = $('#f-delete');
  if (del) del.onclick = async () => {
    const trial = M.applyOps(doc, [{ op: 'delete', kind: 'piece', id: p.id }]);
    const cas = trial.results[0].cascaded.filter((c) => c.kind === 'connection');
    const names = cas.map((c) => { const k = M.conn(doc, c.id); return `<li>${h(c.id)}: ${k.ends.map((e) => h(M.piece(doc, e)?.title || e)).join(' ⇄ ')} <span class="dim">(${c.what})</span></li>`; }).join('');
    const a = await modal(`<h2>Delete “${h(p.title || p.id)}”?</h2>${cas.length ? `<p>These connections go with it:</p><ul id="del-conns">${names}</ul>` : '<p>It has no connections.</p>'}<p class="dim">Unsaved until you publish.</p>`,
      [{ label: 'cancel', value: 'no', cls: 'ghost' }, { label: 'delete', value: 'yes' }]);
    if (a !== 'yes') return;
    if (await addOps([{ op: 'delete', kind: 'piece', id: p.id }])) { S.sel = null; notice(`Deleted ${p.id}${cas.length ? ` and ${cas.length} connection change(s)` : ''} (unsaved).`); viewPieces(); }
  };
}

function uniqueFile(dir, name) {
  const known = new Set([...(S.snap?.files || []), ...Object.keys(S.files)]);
  let path = dir + name, n = 2;
  const [b, ext] = [name.replace(/\.[a-z]+$/, ''), name.split('.').pop()];
  while (known.has(path)) path = `${dir}${b}-${n++}.${ext}`;
  return path;
}

// ----- connections -----
function viewConnections() {
  const doc = work();
  const t = (id) => M.piece(doc, id)?.title || id;
  $('#main').innerHTML = `
  <div class="split">
    <section>
      <div class="row" style="margin-bottom:8px"><span class="grow dim">${doc.connections.length} connections</span><button class="alt" id="c-new">+ new</button></div>
      <div class="list" id="c-list">${doc.connections.map((c) => `<button class="item ${c.id === S.connSel ? 'on' : ''}" data-id="${h(c.id)}">${c.ends.map((e) => h(t(e))).join(' ⇄ ')} ${st(c.state)}<span class="meta">${h(c.id)}${c.label ? ' · ' + h(c.label) : ''}</span></button>`).join('') || '<p class="dim" style="padding:8px">No connections yet.</p>'}</div>
    </section>
    <section id="c-edit"></section>
  </div>`;
  for (const b of $$('#c-list .item')) b.onclick = () => { S.connSel = b.dataset.id; viewConnections(); };
  $('#c-new').onclick = () => { S.connSel = '__new'; viewConnections(); };
  connForm(doc);
}

function connForm(doc) {
  const el = $('#c-edit');
  const isNew = S.connSel === '__new';
  const c = isNew ? { id: '', ends: [], text: '', label: '', state: 'draft' } : M.conn(doc, S.connSel);
  if (!c) { el.innerHTML = '<p class="dim">Pick a connection, or make a new one.</p>'; return; }
  let ends = [...c.ends];
  el.innerHTML = `
  <form id="c-form" autocomplete="off">
    <h2>${isNew ? 'new connection' : h(c.id)}</h2>
    <div class="dim">ends (2 or more)</div>
    <div class="chips" id="c-ends"></div>
    <label>add a piece<input id="c-search" placeholder="search pieces"></label>
    <div class="picker" id="c-pick"></div>
    <label style="margin-top:12px">his text <span class="dim">(empty is fine for a draft)</span><textarea id="c-text" rows="5">${h(c.text)}</textarea></label>
    <div class="grid2">
      <label>label <span class="dim">(optional)</span><input id="c-label" value="${h(c.label)}"></label>
      <label>state<select id="c-state">${stateOpts(M.CONN_STATES, c.state)}</select></label>
    </div>
    <div class="row"><button class="primary" type="submit" id="c-save">${isNew ? 'create connection' : 'keep changes'}</button>${isNew ? '' : '<button type="button" id="c-delete">delete connection</button>'}</div>
  </form>`;
  const drawEnds = () => {
    $('#c-ends').innerHTML = ends.map((e) => `<span class="chip">${h(M.piece(doc, e)?.title || e)}<button type="button" data-id="${h(e)}" aria-label="remove">×</button></span>`).join('') || '<span class="dim">none yet</span>';
    for (const b of $$('#c-ends button')) b.onclick = () => { ends = ends.filter((x) => x !== b.dataset.id); drawEnds(); drawPick(); };
  };
  const drawPick = () => {
    const q = M.norm($('#c-search').value);
    const items = doc.pieces.filter((p) => !ends.includes(p.id) && (!q || M.norm(p.title + ' ' + p.id).includes(q))).slice(0, 60);
    $('#c-pick').innerHTML = items.map((p) => `<button type="button" class="item" data-id="${h(p.id)}">${h(p.title || p.id)} ${st(p.state)}</button>`).join('') || '<p class="dim" style="padding:6px">no match</p>';
    for (const b of $$('#c-pick .item')) b.onclick = () => { ends.push(b.dataset.id); drawEnds(); drawPick(); };
  };
  drawEnds(); drawPick();
  $('#c-search').oninput = drawPick;
  $('#c-form').onsubmit = async (e) => {
    e.preventDefault();
    const set = { ends: [...ends], text: $('#c-text').value, label: $('#c-label').value, state: $('#c-state').value };
    if (isNew) {
      const id = M.nextConnId(doc);
      if (await addOps([{ op: 'create', kind: 'connection', id, set }])) { S.connSel = id; notice(`Created ${id} (unsaved).`); viewConnections(); }
      return;
    }
    const changed = {};
    for (const [k, v] of Object.entries(set)) if (!M.eq(c[k], v)) changed[k] = v;
    if (!Object.keys(changed).length) return notice('No changes to keep.');
    if (await addOps([{ op: 'update', kind: 'connection', id: c.id, set: changed }])) { notice(`Kept changes to ${c.id} (unsaved).`); viewConnections(); }
  };
  const del = $('#c-delete');
  if (del) del.onclick = async () => {
    const a = await modal(`<h2>Delete connection ${h(c.id)}?</h2><p>${c.ends.map((e) => h(M.piece(doc, e)?.title || e)).join(' ⇄ ')}</p>`, [{ label: 'cancel', value: 'no', cls: 'ghost' }, { label: 'delete', value: 'yes' }]);
    if (a !== 'yes') return;
    if (await addOps([{ op: 'delete', kind: 'connection', id: c.id }])) { S.connSel = null; viewConnections(); }
  };
}

// ----- art -----
function viewArt() {
  const doc = work();
  const used = (id) => doc.pieces.filter((p) => p.art.includes(id)).length;
  const inLib = new Set(doc.art.library.map((a) => a.src));
  const asciiFiles = (S.snap?.files || []).filter((f) => M.ASCII_RE.test(f) && !inLib.has(f));
  const artFiles = (S.snap?.files || []).filter((f) => M.ART_IMG_RE.test(f) && !inLib.has(f));
  $('#main').innerHTML = `
  <div class="split">
    <section>
      <h3>library</h3>
      <div class="list" id="a-list">${doc.art.library.map((a) => `<button class="item ${a.id === S.artSel ? 'on' : ''}" data-id="${h(a.id)}">${h(a.name)} <span class="st">${a.kind}</span>${doc.art.gallery.includes(a.id) ? ' <span class="st st-live">gallery</span>' : ''}<span class="meta">${h(a.src)} · ${used(a.id)} essays</span></button>`).join('') || '<p class="dim" style="padding:8px">Library is empty.</p>'}</div>
      <h3 style="margin-top:16px">add</h3>
      <label>upload JPG or PNG<input id="a-file" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png"></label>
      <label>name<input id="a-name" placeholder="name for the library"></label>
      <div id="a-up-note" class="dim"></div>
      <button class="alt" id="a-upload" disabled>add picture to library</button>
      <label style="margin-top:14px">ASCII art file<select id="a-ascii"><option value="">(pick a file in assets/ascii/)</option>${[...asciiFiles, ...artFiles].map((f) => `<option>${h(f)}</option>`).join('')}</select></label>
      <button class="alt" id="a-add-file">add file to library</button>
    </section>
    <section id="a-edit"></section>
  </div>`;
  for (const b of $$('#a-list .item')) b.onclick = () => { S.artSel = b.dataset.id; viewArt(); };
  let prepared = null;
  $('#a-file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      prepared = await prepareImage(f);
      prepared.path = uniqueFile('blawg/art/', imageName($('#a-name').value || f.name, prepared.mime));
      if (!$('#a-name').value) $('#a-name').value = f.name.replace(/\.[a-z]+$/i, '');
      $('#a-up-note').innerHTML = `<img class="thumb" src="data:${prepared.mime};base64,${C.b64(prepared.bytes)}" alt=""><span id="a-up-info">${h(prepared.path)} · ${prepared.width}×${prepared.height} · ${Math.round(prepared.bytes.length / 1024)}KB</span>`;
      $('#a-upload').disabled = false;
    } catch (err) { notice(err.message, true); }
  };
  $('#a-upload').onclick = async () => {
    if (!prepared) return;
    const name = $('#a-name').value.trim() || prepared.path;
    const id = uniqueArtId(doc, M.slug(name));
    const b = C.b64(prepared.bytes);
    if (await addOps([{ op: 'create', kind: 'art', id, set: { name, kind: 'img', src: prepared.path } }], { [prepared.path]: b })) { S.artSel = id; notice(`Added ${prepared.path} to the library (unsaved).`); viewArt(); }
  };
  $('#a-add-file').onclick = async () => {
    const src = $('#a-ascii').value; if (!src) return;
    const base = src.split('/').pop().replace(/\.[a-z]+$/, '');
    const id = uniqueArtId(doc, base);
    if (await addOps([{ op: 'create', kind: 'art', id, set: { name: base.replace(/-/g, ' '), kind: src.endsWith('.js') ? 'ascii' : 'img', src } }])) { S.artSel = id; viewArt(); }
  };
  artForm(doc);
}
function uniqueArtId(doc, base) { let id = base || 'art', n = 2; while (M.artItem(doc, id)) id = `${base}-${n++}`; return id; }

function artForm(doc) {
  const el = $('#a-edit');
  const a = M.artItem(doc, S.artSel);
  if (!a) { el.innerHTML = '<p class="dim">Pick art on the left to assign it.</p>'; return; }
  const chosen = new Set(doc.pieces.filter((p) => p.art.includes(a.id)).map((p) => p.id));
  el.innerHTML = `
  <h2>${h(a.name)}</h2><p class="dim">${h(a.id)} · ${h(a.src)}</p>
  ${a.kind === 'img' ? `<img class="thumb" alt="" src="${h(S.files[a.src] ? `data:image/${a.src.endsWith('.png') ? 'png' : 'jpeg'};base64,${S.files[a.src]}` : new URL('../' + a.src, location.href).href)}">` : ''}
  <h3>essays <span class="dim" id="a-count">(${chosen.size} ticked)</span></h3>
  <input id="a-search" placeholder="search essays" value="${h(S.aq)}">
  <div class="picker" id="a-pieces" style="margin-top:6px"></div>
  <h3 style="margin-top:14px">type default</h3>
  <div class="grid4" id="a-types">${M.TYPES.map((t) => `<label><input type="checkbox" value="${h(t)}" ${doc.art.assign.type[t] === a.id ? 'checked' : ''}> ${h(t)}</label>`).join('')}</div>
  <h3>group art</h3>
  <div class="grid4" id="a-groups">${doc.groups.map((g) => `<label><input type="checkbox" value="${h(g.id)}" ${doc.art.assign.group[g.id] === a.id ? 'checked' : ''}> ${h(g.name)}</label>`).join('') || '<span class="dim">no groups</span>'}</div>
  <label><input type="checkbox" id="a-gallery" ${doc.art.gallery.includes(a.id) ? 'checked' : ''}> in the public gallery</label>
  <div class="row"><button class="primary" id="a-apply">keep assignments</button><button id="a-delete">remove from library</button></div>`;
  const draw = () => {
    const q = M.norm(S.aq);
    $('#a-pieces').innerHTML = doc.pieces.filter((p) => !q || M.norm(p.title + ' ' + p.id).includes(q)).map((p) => `<label><input type="checkbox" value="${h(p.id)}" ${chosen.has(p.id) ? 'checked' : ''}> ${h(p.title || p.id)} ${st(p.state)}</label>`).join('');
    for (const cb of $$('#a-pieces input')) cb.onchange = () => { cb.checked ? chosen.add(cb.value) : chosen.delete(cb.value); $('#a-count').textContent = `(${chosen.size} ticked)`; };
  };
  draw();
  $('#a-search').oninput = (e) => { S.aq = e.target.value; draw(); };
  $('#a-apply').onclick = async () => {
    const ops = [];
    for (const p of doc.pieces) {
      const has = p.art.includes(a.id), want = chosen.has(p.id);
      if (has !== want) ops.push({ op: 'assign', kind: 'art', target: 'piece', key: p.id, art: want ? [...p.art, a.id] : p.art.filter((x) => x !== a.id) });
    }
    for (const cb of $$('#a-types input')) {
      const cur = doc.art.assign.type[cb.value];
      if (cb.checked && cur !== a.id) ops.push({ op: 'assign', kind: 'art', target: 'type', key: cb.value, art: [a.id] });
      if (!cb.checked && cur === a.id) ops.push({ op: 'assign', kind: 'art', target: 'type', key: cb.value, art: [] });
    }
    for (const cb of $$('#a-groups input')) {
      const cur = doc.art.assign.group[cb.value];
      if (cb.checked && cur !== a.id) ops.push({ op: 'assign', kind: 'art', target: 'group', key: cb.value, art: [a.id] });
      if (!cb.checked && cur === a.id) ops.push({ op: 'assign', kind: 'art', target: 'group', key: cb.value, art: [] });
    }
    const inG = doc.art.gallery.includes(a.id), wantG = $('#a-gallery').checked;
    if (inG !== wantG) ops.push({ op: 'assign', kind: 'art', target: 'gallery', key: '', art: wantG ? [...doc.art.gallery, a.id] : doc.art.gallery.filter((x) => x !== a.id) });
    if (!ops.length) return notice('No assignment changes.');
    if (await addOps(ops)) { notice(`Kept ${ops.length} assignment change(s) (unsaved).`); viewArt(); }
  };
  $('#a-delete').onclick = async () => {
    const n = doc.pieces.filter((p) => p.art.includes(a.id)).length;
    const ans = await modal(`<h2>Remove “${h(a.name)}” from the library?</h2><p>It is unassigned from ${n} essays and every default. The file stays in the repo.</p>`, [{ label: 'cancel', value: 'no', cls: 'ghost' }, { label: 'remove', value: 'yes' }]);
    if (ans === 'yes' && await addOps([{ op: 'delete', kind: 'art', id: a.id }])) { S.artSel = null; viewArt(); }
  };
}

// ----- import / export -----
function renderDiff(entries, doc) {
  if (!entries.length) return '<p class="dim">no changes</p>';
  const cls = { '+': 's-plus', '~': 's-tilde', '-': 's-minus' };
  const sym = { '+': '+', '~': '~', '-': '−' };
  const val = (f, v) => (f === 'body' ? `${String(v || '').length} chars` : h(short(v)));
  return entries.map((e) => `<div class="e" data-sign="${e.sign}" data-kind="${e.kind}" data-id="${h(e.id)}"><span class="sgn ${cls[e.sign]}">${sym[e.sign]}</span>${e.kind} <b>${h(e.label || e.id)}</b> <span class="dim">${h(e.id)}</span>${e.cascaded ? ' <span class="cas">(goes with a deleted piece)</span>' : ''}
    ${e.fields.map((f) => `<span class="f">${h(f.f)}: ${e.sign === '+' ? '' : `<span class="old">${val(f.f, f.old)}</span> → `}${val(f.f, f.new)}</span>`).join('')}</div>`).join('');
}

function viewImport() {
  $('#main').innerHTML = `
  <h2>import</h2>
  <p class="dim">Drop or paste a changeset .json, or a .md with a front-matter header. Nothing changes until you accept, and accepting only adds to your unsaved changes.</p>
  <div class="drop" id="i-drop">drop a .json or .md file here, or <label style="display:inline;color:var(--acc2);cursor:pointer"><u>choose a file</u><input type="file" id="i-file" accept=".json,.md,application/json,text/markdown,text/plain" hidden></label></div>
  <label>or paste<textarea id="i-text" rows="7" spellcheck="false" placeholder='{"changeset":1,"author":"claude","ops":[...]}'></textarea></label>
  <div class="row"><button class="alt" id="i-check">check</button></div>
  <div id="i-result"></div>
  <h2 style="margin-top:28px">export</h2>
  <p class="dim">Your unsaved changes as a changeset, in the same format Import reads (and a Claude chat or a Warb pull request writes).</p>
  <div class="row"><button class="alt" id="x-export">export changes as changeset</button><a id="x-download" hidden download="blawg-changeset.json">download blawg-changeset.json</a></div>
  <pre class="out" id="x-out" hidden></pre>`;
  let fname = '';
  const drop = $('#i-drop');
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = async (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) { fname = f.name; $('#i-text').value = await f.text(); check(); } };
  $('#i-file').onchange = async (e) => { const f = e.target.files[0]; if (f) { fname = f.name; $('#i-text').value = await f.text(); check(); } };
  $('#i-text').oninput = () => { fname = ''; };
  $('#i-check').onclick = () => check();
  const check = () => {
    const doc = work();
    const out = $('#i-result');
    let cs;
    try {
      const parsed = M.parseImport($('#i-text').value, fname);
      cs = parsed.kind === 'md' ? M.mdToChangeset(parsed.text, doc) : parsed.changeset;
    } catch (e) { S.importing = null; out.innerHTML = `<div class="errbox" id="i-errors">${h(e.message)}</div>`; return; }
    const top = M.checkChangeset(cs);
    const ops = Array.isArray(cs?.ops) ? cs.ops : [];
    const files = (cs && typeof cs.files === 'object' && !Array.isArray(cs.files)) ? cs.files : {};
    const trial = M.applyOps(doc, ops, { ...S.files, ...files });
    const cascaded = trial.results.flatMap((r) => r.cascaded);
    const nerr = top.length + trial.errorCount;
    S.importing = nerr ? null : { cs, ops, files };
    const opLine = (op, r, i) => `<div class="op" data-ok="${r.errors.length ? 0 : 1}"><span class="${r.errors.length ? 'err' : 'ok'}">${r.errors.length ? '✗' : '✓'}</span> ${i + 1}. ${h(op?.op)} ${h(op?.kind)} ${h(op?.id ?? op?.key ?? '')}${r.errors.map((x) => `<span class="f err">${h(x)}</span>`).join('')}</div>`;
    out.innerHTML = `
      ${top.length ? `<div class="errbox" id="i-errors">${top.map(h).join('\n')}</div>` : ''}
      ${trial.errorCount ? `<div class="errbox" id="i-errors-ops">${trial.errorCount} problem(s) found. Fix the file and check again; nothing was applied.</div>` : ''}
      <h3>${ops.length} op(s)${cs?.author ? ` from ${h(cs.author)}` : ''}${cs?.note ? ` · ${h(cs.note)}` : ''}</h3>
      <div class="ops" id="i-ops">${ops.map((op, i) => opLine(op, trial.results[i], i)).join('')}</div>
      ${nerr ? '' : `<h3 style="margin-top:12px">what changes</h3><div class="diff" id="i-diff">${renderDiff(M.diff(doc, trial.doc, cascaded), trial.doc)}</div>`}
      <div class="row"><button class="primary" id="i-accept" ${nerr ? 'disabled' : ''}>accept into unsaved changes</button><button class="ghost" id="i-discard">discard</button></div>`;
    $('#i-accept').onclick = async () => {
      if (!S.importing) return;
      if (await addOps(S.importing.ops, S.importing.files)) { S.importing = null; notice(`Imported ${ops.length} op(s) into unsaved changes.`); go('publish'); }
    };
    $('#i-discard').onclick = () => { S.importing = null; out.innerHTML = ''; $('#i-text').value = ''; };
  };
  $('#x-export').onclick = () => {
    const cs = M.changeset(S.ops, S.files);
    const txt = JSON.stringify(cs, null, 2);
    const a = $('#x-download');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.hidden = false;
    const o = $('#x-out'); o.textContent = txt; o.hidden = false;
  };
}

// ----- publish -----
async function gitBlobSha(bytes) {
  const head = C.utf8(`blob ${bytes.length}\0`);
  const all = new Uint8Array(head.length + bytes.length); all.set(head); all.set(bytes, head.length);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-1', all))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Build everything one commit would hold for the current work doc.
async function buildCommit(doc, remoteShas) {
  const ser = M.serialize(doc);
  const writes = { ...ser.text };
  const checkFiles = { ...ser.text };
  for (const [id, text] of Object.entries(ser.md)) {
    const p = M.PATHS.md(id);
    checkFiles[p] = text;
    if (remoteShas[p] !== await gitBlobSha(C.utf8(text))) writes[p] = text;
  }
  const deletes = Object.keys(remoteShas).filter((p) => /^blawg\/pieces\/.+\.md$/.test(p) && !(p.slice(13, -3) in ser.md));
  const referenced = new Set([...doc.pieces.map((p) => p.img), ...doc.art.library.map((a) => a.src)]);
  for (const [p, b] of Object.entries(S.files)) if (referenced.has(p)) { writes[p] = C.unb64(b); checkFiles[p] = { bytes: writes[p].length }; }
  const draftsEnv = await C.sealDrafts(S.draftsKey, S.draftsSalt, ser.drafts);
  writes[M.PATHS.drafts] = JSON.stringify(draftsEnv) + '\n';
  checkFiles[M.PATHS.drafts] = writes[M.PATHS.drafts];
  return { writes, deletes, checkFiles };
}

function commitMessage(entries, nfiles) { return `blawg editor: publish (${M.summarize(entries, nfiles)})`; }

function viewPublish() {
  const doc = work();
  const entries = M.diff(S.base, doc);
  const nfiles = Object.keys(S.files).length;
  const target = S.secret.target;
  const isMain = target === 'main';
  const ser = M.serialize(doc);
  const pre = {};
  Object.assign(pre, ser.text);
  for (const [id, t] of Object.entries(ser.md)) pre[M.PATHS.md(id)] = t;
  for (const [p, b] of Object.entries(S.files)) pre[p] = { bytes: Math.floor(b.length * 0.75) };
  const priv = M.privacyCheck(pre, doc, [commitMessage(entries, nfiles)]);
  const invalid = workCache.errorCount;
  $('#main').innerHTML = `
  <h2>publish</h2>
  <p>${entries.length + nfiles ? `<b>${h(M.summarize(entries, nfiles))}</b>` : 'No unsaved changes.'}</p>
  <p class="dim">One commit to <span class="acc2">${h(S.secret.owner)}/${h(S.secret.repo)}</span> branch <b class="acc" id="pub-target">${h(target)}</b>${target !== S.secret.base ? ` (made from ${h(S.secret.base)} if it does not exist yet)` : ''}. Only files under blawg/ are written. Drafts go only into drafts.enc, encrypted.</p>
  ${S.dropped.length ? `<div class="errbox">${S.dropped.map((d) => h(d.why)).join('\n')} (these changes were dropped)</div>` : ''}
  <div class="diff" id="pub-diff">${renderDiff(entries, doc)}${Object.keys(S.files).map((p) => `<div class="e"><span class="sgn s-plus">+</span>file ${h(p)} <span class="dim">${Math.round(S.files[p].length * 0.75 / 1024)}KB</span></div>`).join('')}</div>
  ${S.conflicts.length ? `<div id="pub-conflicts"><h3>both sides changed these fields</h3><p class="dim">The files changed on GitHub since you loaded them. Everything else was re-applied on top. Pick a side for each:</p>${S.conflicts.map((c) => `
    <div class="conflict" data-key="${h(c.key)}"><b>${h(c.kind)} ${h(c.id)}</b> · ${h(c.field)}
      <label><input type="radio" name="cf-${h(c.key)}" value="mine" ${S.resolutions[c.key] === 'mine' ? 'checked' : ''}> mine: ${h(short(c.mine, 200))}</label>
      <label><input type="radio" name="cf-${h(c.key)}" value="theirs" ${S.resolutions[c.key] === 'theirs' ? 'checked' : ''}> theirs: ${h(short(c.theirs, 200))}</label></div>`).join('')}</div>` : ''}
  ${priv.length ? `<div class="errbox" id="pub-privacy"><b>Blocked by the privacy check:</b>\n${priv.map(h).join('\n')}</div>` : (entries.length + nfiles ? '<div class="okbox" id="pub-privacy-ok">privacy check passes</div>' : '')}
  ${invalid ? `<div class="errbox">${invalid} unsaved change(s) no longer apply; discard and redo them.</div>` : ''}
  ${S.readOnly ? `<div class="errbox">Read-only: ${h(S.draftsBroken ? 'drafts.enc did not open with this password.' : 'GitHub is not reachable from this browser.')}</div>` : ''}
  ${isMain ? `<div class="conflict"><b>Publishing to main</b> puts this live on the site. ${S.secret.allowMain ? '' : '<span class="err">Commits to main are switched off in settings.</span>'}<label>type <b>main</b> to confirm<input id="pub-main" autocomplete="off"></label></div>` : ''}
  <div class="row"><button class="primary" id="pub-go" ${(!entries.length && !nfiles) || priv.length || S.readOnly || invalid ? 'disabled' : ''}>publish one commit</button>
  <button class="ghost" id="pub-discard" ${entries.length + nfiles ? '' : 'disabled'}>discard all unsaved changes</button></div>
  <div id="pub-result">${S.lastCommit ? `<div class="okbox" id="pub-ok">Published commit ${h(S.lastCommit.sha.slice(0, 7))} to ${h(S.lastCommit.branch)}.</div>` : ''}</div>`;
  for (const r of $$('#pub-conflicts input[type=radio]')) r.onchange = () => { S.resolutions[r.name.slice(3)] = r.value; };
  $('#pub-go').onclick = () => publish();
  $('#pub-discard').onclick = async () => {
    const a = await modal(`<h2>Discard all unsaved changes?</h2><p>${h(M.summarize(entries, nfiles))}</p>`, [{ label: 'cancel', value: 'no', cls: 'ghost' }, { label: 'discard', value: 'yes' }]);
    if (a !== 'yes') return;
    S.ops = []; S.files = {}; S.conflicts = []; S.resolutions = {}; S.dropped = [];
    await persist(); viewPublish();
  };
}

async function publish(retry = 0) {
  const res = $('#pub-result');
  const say = (m, err) => { res.innerHTML = `<div class="${err ? 'errbox' : 'okbox'}" id="${err ? 'pub-err' : 'pub-status'}">${h(m)}</div>`; };
  const target = S.secret.target;
  if (target === 'main') {
    if (!S.secret.allowMain) return say('Commits to main are off. Turn them on in settings first.', true);
    if (($('#pub-main')?.value || '').trim() !== 'main') return say('Type the word main to confirm publishing to main.', true);
  }
  if (S.conflicts.length && S.conflicts.some((c) => !S.resolutions[c.key])) return say('Pick mine or theirs for every field both sides changed.', true);
  $('#pub-go').disabled = true;
  try {
    say('Checking GitHub for changes since you loaded…');
    let head = await S.gh.getRef(target), exists = !!head;
    const readBranch = exists ? target : S.secret.base;
    const remote = await loadSnapshot(S.gh, readBranch);
    if (!remote) throw new Error(`Base branch "${S.secret.base}" does not exist.`);
    head = remote.head;
    if (changedPaths(S.snap.shas, remote.shas).length || (S.snap.branch !== remote.branch && S.snap.branch !== '(site)')) {
      const newBase = await docFromSnap(remote, null);
      const rb = M.rebase(S.base, newBase, S.ops, S.resolutions);
      if (rb.conflicts.length) {
        S.conflicts = rb.conflicts; viewPublish();
        $('#pub-result').innerHTML = '<div class="errbox" id="pub-err">The files changed on GitHub. Your other changes were re-applied; pick a side for the fields above, then publish again.</div>';
        return;
      }
      S.base = newBase; S.ops = rb.ops; S.dropped = rb.dropped; S.snap = remote; S.conflicts = []; S.resolutions = {};
      await persist();
    }
    const doc = work();
    if (workCache.errorCount) throw new Error('Some unsaved changes no longer apply to the current files.');
    const entries = M.diff(S.base, doc);
    const nfiles = Object.keys(S.files).length;
    const message = commitMessage(entries, nfiles);
    const { writes, deletes, checkFiles } = await buildCommit(doc, remote.shas);
    const priv = M.privacyCheck(checkFiles, doc, [message]);
    if (priv.length) { viewPublish(); return; }
    say('Writing one commit…');
    const sha = await commitFiles(S.gh, { branch: target, head, baseTree: remote.tree, writes, deletes, message, create: !exists });
    if (!exists) { /* branch created by commitFiles */ }
    S.lastCommit = { sha, branch: target };
    S.ops = []; S.files = {}; S.dropped = [];
    const fresh = await loadSnapshot(S.gh, target);
    S.snap = fresh; S.base = await docFromSnap(fresh, null);
    await persist();
    viewPublish();
  } catch (e) {
    if (e.status === 422 && retry < 1) return publish(retry + 1); // ref moved under us: re-check once
    say(e.message, true);
    const b = $('#pub-go'); if (b) b.disabled = false;
  }
}

// ----- settings -----
function viewSettings() {
  const s = S.secret;
  $('#main').innerHTML = `
  <form id="s-form" class="signin" style="margin-top:0">
    <h2>settings</h2>
    <p class="dim">Stored on this device inside the encrypted vault.</p>
    <div class="grid2">
      <label>owner<input value="${h(s.owner)}" disabled></label>
      <label>repo<input value="${h(s.repo)}" disabled></label>
      <label>base branch<input id="s-base" value="${h(s.base)}"></label>
      <label>publish to branch<input id="s-target" value="${h(s.target)}"></label>
    </div>
    <label><input type="checkbox" id="s-main" ${s.allowMain ? 'checked' : ''}> allow publishing to main <span class="dim">(off by default; you still type main each time)</span></label>
    <div class="row"><button class="primary" type="submit">save settings</button></div>
    <h2 style="margin-top:28px">this device</h2>
    <div class="row"><button type="button" class="ghost" id="s-signout">sign out</button><button type="button" id="s-forget">forget this device</button></div>
  </form>`;
  $('#s-form').onsubmit = async (e) => {
    e.preventDefault();
    S.secret = { ...S.secret, base: $('#s-base').value.trim() || 'main', target: $('#s-target').value.trim() || 'blawg-review', allowMain: $('#s-main').checked };
    S.vaultEnv = await C.resealVault(S.vaultEnv, S.key, S.secret);
    localStorage.setItem(C.VAULT_KEY, JSON.stringify(S.vaultEnv));
    S.gh = new GitHub(S.secret);
    notice('Settings saved.'); updateBadge();
  };
  $('#s-signout').onclick = () => signOut();
  $('#s-forget').onclick = forgetDevice;
}

// ---------- boot ----------
for (const b of $$('#tabs button')) b.onclick = () => { notice(''); go(b.dataset.view); };
$('#sign-out').onclick = () => signOut();
showSignIn('', true);

// test hook (no secrets exposed): lets tests read derived state
window.__blawgEditor = { model: M, work: () => work(), pendingOps: () => S.ops.length };
