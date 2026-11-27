// Blawg editor data model: the working document, changeset ops, validation, diff,
// public/private split and the client-side privacy rules (mirrors tools/blawg/check_public.py).
// Pure functions, no DOM.

export const TYPES = ['Principle', 'Question', 'Stance', 'Case study', 'Reaction', 'Log', 'Note', 'Door'];
export const STATES = ['seed', 'draft', 'live'];
export const CONN_STATES = ['draft', 'live'];
export const ART_TARGETS = ['piece', 'type', 'group', 'gallery'];
export const AUTHORS = ['waleed', 'claude', 'warb'];
export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const IMG_RE = /^blawg\/img\/[a-z0-9]+(?:-[a-z0-9]+)*\.(jpg|png)$/;
export const ART_IMG_RE = /^blawg\/art\/[a-z0-9]+(?:-[a-z0-9]+)*\.(jpg|png)$/;
export const ASCII_RE = /^assets\/ascii\/[a-z0-9]+(?:-[a-z0-9]+)*\.js$/;
export const MAX_IMG_BYTES = 400 * 1024;

export const PATHS = {
  pieces: 'blawg/data/pieces.json',
  connections: 'blawg/data/connections.json',
  art: 'blawg/data/art.json',
  groups: 'blawg/data/groups.json',
  drafts: 'blawg/data/drafts.enc',
  md: (id) => `blawg/pieces/${id}.md`,
};

const PIECE_FIELDS = ['title', 'desc', 'group', 'type', 'state', 'body', 'img', 'art'];
const CONN_FIELDS = ['ends', 'text', 'label', 'state'];
const ART_FIELDS = ['name', 'kind', 'src'];

export const clone = (x) => JSON.parse(JSON.stringify(x));
export const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function norm(t) {
  t = String(t || '').normalize('NFKC').toLowerCase()
    .replace(/&amp;/g, '&').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  return t.replace(/[^a-z0-9&]+/g, ' ').trim();
}
export function slug(s) {
  return String(s || '').normalize('NFKD').toLowerCase().replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '') || 'piece';
}

export function emptyDoc() {
  return { groups: [], pieces: [], connections: [], art: { library: [], assign: { type: {}, group: {} }, gallery: [] } };
}

export function newPiece(id) {
  return { id, title: '', desc: '', group: null, type: null, state: 'draft', art: [], img: null, locked: false, bodyText: '' };
}

export const piece = (doc, id) => doc.pieces.find((p) => p.id === id);
export const conn = (doc, id) => doc.connections.find((c) => c.id === id);
export const artItem = (doc, id) => doc.art.library.find((a) => a.id === id);
export const isPublicPiece = (p) => p.state === 'live' || p.state === 'seed';

export function uniquePieceId(doc, base, taken = []) {
  let id = slug(base), n = 2;
  const used = new Set([...doc.pieces.map((p) => p.id), ...taken]);
  while (used.has(id)) id = `${slug(base)}-${n++}`;
  return id;
}
export function nextConnId(doc, taken = []) {
  let max = 0;
  for (const id of [...doc.connections.map((c) => c.id), ...taken]) {
    const m = /^lk-(\d+)$/.exec(id); if (m) max = Math.max(max, +m[1]);
  }
  return 'lk-' + String(max + 1).padStart(3, '0');
}

// ---------- loading ----------
// files: {groups, pieces, connections, art} parsed JSON (or null), bodies {id: markdown}, drafts plaintext or null
export function docFromFiles({ groups, pieces, connections, art, bodies = {}, drafts = null }) {
  const doc = emptyDoc();
  doc.groups = (groups || []).map((g) => ({ id: g.id, name: g.name || g.id, order: g.order ?? 0, accent: g.accent || 'orange', art: g.art ?? null }));
  const a = art || {};
  doc.art.library = (a.library || []).map((x) => ({ id: x.id, name: x.name || x.id, kind: x.kind || 'img', src: x.src }));
  doc.art.assign.type = { ...((a.assign || {}).type || {}) };
  doc.art.assign.group = { ...((a.assign || {}).group || {}) };
  for (const g of doc.groups) if (g.art && !doc.art.assign.group[g.id]) doc.art.assign.group[g.id] = g.art;
  doc.art.gallery = [...(a.gallery || [])];
  const assignPiece = (a.assign || {}).piece || {};
  for (const p of pieces || []) {
    const q = newPiece(p.id);
    Object.assign(q, {
      title: p.title || '', desc: p.desc || '', group: p.group ?? null, type: p.type ?? null,
      state: p.state === 'live' ? 'live' : 'seed', img: p.img ?? null, locked: !!p.locked,
      art: [...(assignPiece[p.id] || p.art || [])], bodyText: bodies[p.id] || '',
    });
    if (p.cipher) q.cipher = p.cipher;
    doc.pieces.push(q);
  }
  doc.connections = (connections || []).map((c) => ({ id: c.id, ends: [...c.ends], text: c.text || '', label: c.label || '', state: 'live' }));
  if (drafts) {
    for (const p of drafts.pieces || []) {
      const have = piece(doc, p.id);
      if (have) { have.bodyText = p.bodyText || have.bodyText; continue; } // seed with a draft body
      const q = newPiece(p.id);
      Object.assign(q, {
        title: p.title || '', desc: p.desc || '', group: p.group ?? null, type: p.type ?? null,
        state: STATES.includes(p.state) ? p.state : 'draft', img: p.img ?? null, locked: !!p.locked,
        art: [...(p.art || [])], bodyText: p.bodyText || '',
      });
      doc.pieces.push(q);
    }
    for (const c of drafts.connections || []) {
      if (!conn(doc, c.id)) doc.connections.push({ id: c.id, ends: [...c.ends], text: c.text || '', label: c.label || '', state: 'draft' });
    }
  }
  return doc;
}

// ---------- ops ----------
function checkPieceSet(doc, set, selfId, errs, isCreate) {
  for (const k of Object.keys(set)) if (!PIECE_FIELDS.includes(k)) errs.push(`unknown piece field "${k}"`);
  if (isCreate && !String(set.title || '').trim()) errs.push('a new piece needs a title');
  if ('title' in set) {
    if (typeof set.title !== 'string' || !set.title.trim()) errs.push('title must be non-empty text');
    else {
      const n = norm(set.title);
      const dup = doc.pieces.find((p) => p.id !== selfId && norm(p.title) === n);
      if (dup) errs.push(`duplicate title: same as piece "${dup.id}"`);
    }
  }
  if ('desc' in set && typeof set.desc !== 'string') errs.push('desc must be text');
  if ('body' in set && typeof set.body !== 'string') errs.push('body must be Markdown text');
  if ('group' in set && set.group !== null && !doc.groups.some((g) => g.id === set.group)) errs.push(`bad group "${set.group}" (not in groups.json)`);
  if ('type' in set && set.type !== null && !TYPES.includes(set.type)) errs.push(`bad type "${set.type}" (one of ${TYPES.join(', ')})`);
  if ('state' in set && !STATES.includes(set.state)) errs.push(`bad state "${set.state}" (seed, draft or live)`);
  if ('img' in set && set.img !== null && !IMG_RE.test(String(set.img))) errs.push(`bad image filename "${set.img}" (blawg/img/<plain-name>.jpg|png)`);
  if ('art' in set) {
    if (!Array.isArray(set.art)) errs.push('art must be a list of art ids');
    else for (const a of set.art) if (!artItem(doc, a)) errs.push(`unknown art id "${a}"`);
  }
}
function checkConnSet(doc, set, errs, isCreate) {
  for (const k of Object.keys(set)) if (!CONN_FIELDS.includes(k)) errs.push(`unknown connection field "${k}"`);
  if (isCreate && !('ends' in set)) errs.push('a connection needs ends');
  if ('ends' in set) {
    if (!Array.isArray(set.ends) || set.ends.length < 2) errs.push('a connection needs 2 or more ends');
    else {
      if (new Set(set.ends).size !== set.ends.length) errs.push('a connection end is listed twice');
      for (const e of set.ends) if (!piece(doc, e)) errs.push(`connection to unknown or deleted piece "${e}"`);
    }
  }
  if ('text' in set && typeof set.text !== 'string') errs.push('text must be text (empty is allowed)');
  if ('label' in set && typeof set.label !== 'string') errs.push('label must be text');
  if ('state' in set && !CONN_STATES.includes(set.state)) errs.push(`bad connection state "${set.state}" (draft or live)`);
}
function liveConnToDraft(doc, c) {
  if (c.state !== 'live') return null;
  const d = c.ends.map((e) => piece(doc, e)).find((p) => p && p.state === 'draft');
  return d ? `live connection ${c.id} can't point at draft piece "${d.id}" (it would publish the draft); make it draft or make the piece seed/live` : null;
}

// Apply one op to doc in place. Returns {errors, cascaded:[{kind,id,what}]}. Nothing changes when there are errors.
export function applyOp(doc, op, files = {}) {
  const errors = [], cascaded = [];
  if (!op || typeof op !== 'object') return { errors: ['op is not an object'], cascaded };
  const { kind } = op;
  const set = op.set || {};
  if (op.op === 'assign') {
    if (kind !== 'art') errors.push('assign only works on kind "art"');
    if (!ART_TARGETS.includes(op.target)) errors.push(`bad assign target "${op.target}" (piece, type, group or gallery)`);
    if (!Array.isArray(op.art)) errors.push('assign needs an "art" list');
    else for (const a of op.art) if (!artItem(doc, a)) errors.push(`unknown art id "${a}"`);
    if (op.target === 'piece' && !piece(doc, op.key)) errors.push(`unknown piece id "${op.key}"`);
    if (op.target === 'type' && !TYPES.includes(op.key)) errors.push(`bad type "${op.key}"`);
    if (op.target === 'group' && !doc.groups.some((g) => g.id === op.key)) errors.push(`unknown group "${op.key}"`);
    if ((op.target === 'type' || op.target === 'group') && Array.isArray(op.art) && op.art.length > 1) errors.push(`a ${op.target} default takes one art id`);
    if (errors.length) return { errors, cascaded };
    if (op.target === 'piece') piece(doc, op.key).art = [...op.art];
    else if (op.target === 'gallery') doc.art.gallery = [...new Set(op.art)];
    else {
      const m = doc.art.assign[op.target];
      if (op.art.length) m[op.key] = op.art[0]; else delete m[op.key];
    }
    return { errors, cascaded };
  }
  if (!['create', 'update', 'delete'].includes(op.op)) return { errors: [`bad op "${op.op}" (create, update, delete or assign)`], cascaded };
  if (!['piece', 'connection', 'art'].includes(kind)) return { errors: [`bad kind "${kind}" (piece, connection or art)`], cascaded };
  if (typeof op.id !== 'string' || !ID_RE.test(op.id)) errors.push(`bad id "${op.id}" (lowercase slug a-z 0-9 -)`);
  if (op.op !== 'delete' && (typeof op.set !== 'object' || op.set === null || Array.isArray(op.set))) errors.push('missing "set" object');
  if (errors.length) return { errors, cascaded };

  if (kind === 'piece') {
    const have = piece(doc, op.id);
    if (op.op === 'create') {
      if (have) errors.push(`id "${op.id}" already exists`);
      checkPieceSet(doc, set, op.id, errors, true);
      if (set.img && !files[set.img] && !(doc._knownFiles || []).includes(set.img)) errors.push(`image "${set.img}" is not in the repo or this changeset`);
      if (errors.length) return { errors, cascaded };
      const p = newPiece(op.id);
      assignPiece(p, set);
      if (!('state' in set)) p.state = 'draft';
      doc.pieces.push(p);
    } else if (op.op === 'update') {
      if (!have) return { errors: [`unknown piece id "${op.id}"`], cascaded };
      checkPieceSet(doc, set, op.id, errors, false);
      if (set.img && !files[set.img] && !(doc._knownFiles || []).includes(set.img) && set.img !== have.img) errors.push(`image "${set.img}" is not in the repo or this changeset`);
      if (set.state === 'draft') for (const c of doc.connections) if (c.state === 'live' && c.ends.includes(op.id)) errors.push(`piece is in live connection ${c.id}; a draft can't be in a live connection`);
      if ('body' in set && have.locked) errors.push('piece is locked; its body is ciphertext and is not edited here');
      if (errors.length) return { errors, cascaded };
      assignPiece(have, set);
    } else {
      if (!have) return { errors: [`unknown piece id "${op.id}" (already deleted?)`], cascaded };
      doc.pieces = doc.pieces.filter((p) => p !== have);
      for (const c of [...doc.connections]) {
        if (!c.ends.includes(op.id)) continue;
        const ends = c.ends.filter((e) => e !== op.id);
        if (ends.length < 2) { doc.connections = doc.connections.filter((x) => x !== c); cascaded.push({ kind: 'connection', id: c.id, what: 'deleted' }); }
        else { c.ends = ends; cascaded.push({ kind: 'connection', id: c.id, what: 'end removed' }); }
      }
    }
    return { errors, cascaded };
  }
  if (kind === 'connection') {
    const have = conn(doc, op.id);
    if (op.op === 'create') {
      if (have) errors.push(`connection id "${op.id}" already exists`);
      checkConnSet(doc, set, errors, true);
      if (errors.length) return { errors, cascaded };
      const c = { id: op.id, ends: [...set.ends], text: set.text || '', label: set.label || '', state: set.state || 'draft' };
      const bad = liveConnToDraft(doc, c); if (bad) return { errors: [bad], cascaded };
      doc.connections.push(c);
    } else if (op.op === 'update') {
      if (!have) return { errors: [`unknown connection id "${op.id}"`], cascaded };
      checkConnSet(doc, set, errors, false);
      if (errors.length) return { errors, cascaded };
      const c = { ...clone(have), ...clone(set) };
      const bad = liveConnToDraft(doc, c); if (bad) return { errors: [bad], cascaded };
      Object.assign(have, clone(set));
    } else {
      if (!have) return { errors: [`unknown connection id "${op.id}" (already deleted?)`], cascaded };
      doc.connections = doc.connections.filter((c) => c !== have);
    }
    return { errors, cascaded };
  }
  // art library (extension: see SCHEMA-editor-notes.md)
  const have = artItem(doc, op.id);
  if (op.op === 'create' || op.op === 'update') {
    for (const k of Object.keys(set)) if (!ART_FIELDS.includes(k)) errors.push(`unknown art field "${k}"`);
    if (op.op === 'create' && have) errors.push(`art id "${op.id}" already exists`);
    if (op.op === 'update' && !have) return { errors: [`unknown art id "${op.id}"`], cascaded };
    const k = set.kind ?? have?.kind;
    if (!['ascii', 'img'].includes(k)) errors.push(`bad art kind "${k}" (ascii or img)`);
    const src = set.src ?? have?.src;
    if (k === 'ascii' && !ASCII_RE.test(String(src))) errors.push(`bad ascii src "${src}" (assets/ascii/<plain-name>.js)`);
    if (k === 'img' && !ART_IMG_RE.test(String(src))) errors.push(`bad art filename "${src}" (blawg/art/<plain-name>.jpg|png)`);
    if (k === 'img' && 'src' in set && !files[src] && !(doc._knownFiles || []).includes(src)) errors.push(`art file "${src}" is not in the repo or this changeset`);
    if (errors.length) return { errors, cascaded };
    if (have) Object.assign(have, clone(set));
    else doc.art.library.push({ id: op.id, name: set.name || op.id, kind: k, src });
    return { errors, cascaded };
  }
  if (!have) return { errors: [`unknown art id "${op.id}"`], cascaded };
  doc.art.library = doc.art.library.filter((a) => a !== have);
  for (const p of doc.pieces) if (p.art.includes(op.id)) { p.art = p.art.filter((a) => a !== op.id); cascaded.push({ kind: 'piece', id: p.id, what: 'art removed' }); }
  for (const t of ['type', 'group']) for (const [k, v] of Object.entries(doc.art.assign[t])) if (v === op.id) delete doc.art.assign[t][k];
  doc.art.gallery = doc.art.gallery.filter((a) => a !== op.id);
  return { errors, cascaded };
}

function assignPiece(p, set) {
  for (const [k, v] of Object.entries(set)) {
    if (k === 'body') p.bodyText = v;
    else if (k === 'art') p.art = [...v];
    else p[k] = v;
  }
}

// Apply a list of ops to a copy. results[i] = {errors, cascaded}
export function applyOps(doc, ops, files = {}) {
  const d = clone(doc);
  d._knownFiles = doc._knownFiles || [];
  const results = ops.map((op) => applyOp(d, op, files));
  return { doc: d, results, errorCount: results.reduce((n, r) => n + r.errors.length, 0) };
}

// ---------- import ----------
export function parseFrontMatter(text) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error('Markdown import needs a front-matter header between --- lines (title, group, type, state).');
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const k = /^([A-Za-z_]+)\s*:\s*(.*)$/.exec(line);
    if (!k) throw new Error(`can't read header line "${line}"`);
    let v = k[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    meta[k[1].toLowerCase()] = v === 'null' || v === '' ? null : v;
  }
  return { meta, body: m[2] };
}

export function mdToChangeset(text, doc) {
  const { meta, body } = parseFrontMatter(text);
  const set = {};
  for (const k of ['title', 'desc', 'group', 'type', 'state']) if (k in meta) set[k] = k === 'desc' ? meta[k] || '' : meta[k];
  for (const k of Object.keys(meta)) if (!['title', 'desc', 'group', 'type', 'state', 'id'].includes(k)) set[k] = meta[k]; // flagged by validation
  set.body = body.replace(/^\r?\n/, '');
  let id = meta.id, op = 'create';
  if (id && piece(doc, id)) op = 'update';
  else if (!id) {
    const same = doc.pieces.find((p) => norm(p.title) === norm(meta.title));
    if (same) { id = same.id; op = 'update'; } else id = uniquePieceId(doc, meta.title || 'piece');
  }
  return { changeset: 1, author: 'waleed', note: 'from a .md file', ops: [{ op, kind: 'piece', id, set }] };
}

export function parseImport(text, filename = '') {
  const t = String(text || '').trim();
  if (/\.md$/i.test(filename) || t.startsWith('---')) return { kind: 'md', text };
  let cs;
  try { cs = JSON.parse(t); } catch (e) { throw new Error('Not valid JSON and not a .md with front matter: ' + e.message); }
  return { kind: 'json', changeset: cs };
}

// Top-level changeset problems (not per op)
export function checkChangeset(cs) {
  const errs = [];
  if (!cs || typeof cs !== 'object' || Array.isArray(cs)) return ['changeset must be a JSON object'];
  if (cs.changeset !== 1) errs.push('"changeset" must be 1');
  if (!Array.isArray(cs.ops)) errs.push('"ops" must be a list');
  if (cs.author !== undefined && !AUTHORS.includes(cs.author)) errs.push(`bad author "${cs.author}" (waleed, claude or warb)`);
  for (const k of Object.keys(cs)) if (!['changeset', 'author', 'note', 'ops', 'files'].includes(k)) errs.push(`unknown top-level key "${k}"`);
  if (cs.files !== undefined) {
    if (typeof cs.files !== 'object' || Array.isArray(cs.files)) errs.push('"files" must be an object of path: base64');
    else for (const [p, v] of Object.entries(cs.files)) {
      if (!IMG_RE.test(p) && !ART_IMG_RE.test(p)) errs.push(`bad filename "${p}" (blawg/img|art/<plain-name>.jpg|png)`);
      if (typeof v !== 'string') errs.push(`file "${p}" must be base64 text`);
      else if (v.length * 0.75 > MAX_IMG_BYTES + 4) errs.push(`file "${p}" is over 400KB`);
    }
  }
  return errs;
}

// ---------- diff ----------
const label = (p) => (p && (p.title || p.id)) || '';
export function diff(a, b, cascaded = []) {
  const out = [];
  const cas = new Set(cascaded.map((c) => `${c.kind}:${c.id}`));
  const fieldDiff = (x, y, fields) => fields.filter((f) => !eq(x[f], y[f])).map((f) => ({ f: f === 'bodyText' ? 'body' : f, old: x[f], new: y[f] }));
  const pf = ['title', 'desc', 'group', 'type', 'state', 'img', 'art', 'bodyText'];
  for (const p of b.pieces) {
    const o = piece(a, p.id);
    if (!o) out.push({ sign: '+', kind: 'piece', id: p.id, label: label(p), fields: fieldDiff({}, p, pf).filter((x) => !eq(x.new, '') && !eq(x.new, [])) });
    else { const fs = fieldDiff(o, p, pf); if (fs.length) out.push({ sign: '~', kind: 'piece', id: p.id, label: label(p), fields: fs }); }
  }
  for (const p of a.pieces) if (!piece(b, p.id)) out.push({ sign: '-', kind: 'piece', id: p.id, label: label(p), fields: [] });
  const cf = ['ends', 'text', 'label', 'state'];
  const clabel = (d, c) => c.ends.map((e) => label(piece(d, e)) || e).join(' ⇄ ');
  for (const c of b.connections) {
    const o = conn(a, c.id);
    if (!o) out.push({ sign: '+', kind: 'connection', id: c.id, label: clabel(b, c), fields: fieldDiff({}, c, cf) });
    else { const fs = fieldDiff(o, c, cf); if (fs.length) out.push({ sign: '~', kind: 'connection', id: c.id, label: clabel(b, c), fields: fs, cascaded: cas.has(`connection:${c.id}`) }); }
  }
  for (const c of a.connections) if (!conn(b, c.id)) out.push({ sign: '-', kind: 'connection', id: c.id, label: clabel(a, c), fields: [], cascaded: cas.has(`connection:${c.id}`) });
  for (const x of b.art.library) {
    const o = artItem(a, x.id);
    if (!o) out.push({ sign: '+', kind: 'art', id: x.id, label: x.name, fields: fieldDiff({}, x, ['name', 'kind', 'src']) });
    else { const fs = fieldDiff(o, x, ['name', 'kind', 'src']); if (fs.length) out.push({ sign: '~', kind: 'art', id: x.id, label: x.name, fields: fs }); }
  }
  for (const x of a.art.library) if (!artItem(b, x.id)) out.push({ sign: '-', kind: 'art', id: x.id, label: x.name, fields: [] });
  for (const t of ['type', 'group']) {
    const keys = new Set([...Object.keys(a.art.assign[t]), ...Object.keys(b.art.assign[t])]);
    for (const k of keys) if (!eq(a.art.assign[t][k], b.art.assign[t][k])) out.push({ sign: '~', kind: 'assign', id: `${t}:${k}`, label: `${t} default: ${k}`, fields: [{ f: 'art', old: a.art.assign[t][k] ?? null, new: b.art.assign[t][k] ?? null }] });
  }
  if (!eq(a.art.gallery, b.art.gallery)) out.push({ sign: '~', kind: 'assign', id: 'gallery', label: 'gallery', fields: [{ f: 'gallery', old: a.art.gallery, new: b.art.gallery }] });
  return out;
}

export function summarize(entries, fileCount = 0) {
  const n = {};
  for (const e of entries) { const k = `${e.sign}${e.kind}`; n[k] = (n[k] || 0) + 1; }
  const parts = Object.entries(n).map(([k, v]) => `${k[0]}${v} ${k.slice(1)}${v > 1 ? 's' : ''}`);
  if (fileCount) parts.push(`+${fileCount} file${fileCount > 1 ? 's' : ''}`);
  return parts.join(', ') || 'no changes';
}

// ---------- public / private split ----------
function arrLines(arr) { return arr.length ? '[\n' + arr.map((o) => '  ' + JSON.stringify(o)).join(',\n') + '\n]\n' : '[]\n'; }

export function serialize(doc) {
  const pub = doc.pieces.filter(isPublicPiece);
  const pieces = pub.map((p) => {
    const live = p.state === 'live';
    const o = { id: p.id, title: p.title, desc: p.desc, group: p.group, type: p.type, state: p.state, art: [...p.art], img: p.img,
      locked: live ? !!p.locked : false, body: live && !p.locked && !!p.bodyText.trim() };
    if (live && p.locked && p.cipher) o.cipher = p.cipher;
    return o;
  });
  const connections = doc.connections.filter((c) => c.state === 'live').map((c) => ({ id: c.id, ends: [...c.ends], text: c.text, label: c.label, state: 'live' }));
  const assignPiece = {};
  for (const p of pub) if (p.art.length) assignPiece[p.id] = [...p.art];
  const art = { library: doc.art.library.map((x) => ({ id: x.id, name: x.name, kind: x.kind, src: x.src })),
    assign: { piece: assignPiece, type: { ...doc.art.assign.type }, group: { ...doc.art.assign.group } }, gallery: [...doc.art.gallery] };
  const groups = doc.groups.map((g) => ({ id: g.id, name: g.name, order: g.order, accent: g.accent, art: doc.art.assign.group[g.id] ?? null }));
  const md = {};
  for (const p of pub) if (p.state === 'live' && !p.locked && p.bodyText.trim()) md[p.id] = p.bodyText.endsWith('\n') ? p.bodyText : p.bodyText + '\n';
  const draftPieces = doc.pieces.filter((p) => p.state === 'draft' || (p.state === 'seed' && p.bodyText.trim()))
    .map((p) => ({ id: p.id, title: p.title, desc: p.desc, group: p.group, type: p.type, state: p.state, art: [...p.art], img: p.img, locked: !!p.locked, body: false, bodyText: p.bodyText }));
  const draftConns = doc.connections.filter((c) => c.state === 'draft').map((c) => ({ id: c.id, ends: [...c.ends], text: c.text, label: c.label, state: 'draft' }));
  return {
    text: {
      [PATHS.pieces]: arrLines(pieces),
      [PATHS.connections]: arrLines(connections),
      [PATHS.art]: JSON.stringify(art, null, 2) + '\n',
      [PATHS.groups]: arrLines(groups),
    },
    md,
    drafts: { pieces: draftPieces, connections: draftConns },
  };
}

// ---------- privacy (same rules as SCHEMA.md "Privacy" / check_public.py, plus draft titles the editor knows) ----------
export function pathAllowed(p) {
  return typeof p === 'string' && /^blawg\/[a-z0-9][a-z0-9/._-]*$/.test(p) && !p.includes('..') && !p.includes('//') && !p.endsWith('/');
}
export function plainName(p) {
  if (p === PATHS.drafts) return true;
  if (p.startsWith('blawg/pieces/')) return /^blawg\/pieces\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(p);
  if (p.startsWith('blawg/img/')) return IMG_RE.test(p);
  if (p.startsWith('blawg/art/')) return ART_IMG_RE.test(p);
  if (p.startsWith('blawg/data/')) return /^blawg\/data\/[a-z0-9-]+\.(json|enc)$/.test(p);
  return /^blawg\/[a-z0-9/_-]+(\.[a-z0-9]+)?$/.test(p);
}

// files: {path: string (text) | {bytes:number} (binary)}. Returns list of reasons; empty = OK.
export function privacyCheck(files, doc, extraText = []) {
  const errs = [];
  for (const p of Object.keys(files)) {
    if (!pathAllowed(p)) errs.push(`refusing path outside blawg/: ${p}`);
    else if (!plainName(p)) errs.push(`filename is not plain: ${p}`);
    if (/\.webp$/i.test(p)) errs.push(`.webp is not allowed: ${p}`);
    const f = files[p];
    if (f && typeof f === 'object' && f.bytes > MAX_IMG_BYTES) errs.push(`image over 400KB: ${p}`);
  }
  let pub = [];
  try { pub = JSON.parse(files[PATHS.pieces] || '[]'); } catch (e) { errs.push('pieces.json is not valid JSON'); }
  const pubIds = new Map(pub.map((p) => [p.id, p]));
  for (const p of pub) {
    if (p.state === 'draft') errs.push(`draft piece in pieces.json: ${p.id}`);
    else if (!['live', 'seed'].includes(p.state)) errs.push(`bad state in pieces.json: ${p.id}`);
  }
  try {
    for (const c of JSON.parse(files[PATHS.connections] || '[]')) {
      if (c.state !== 'live') errs.push(`draft connection in connections.json: ${c.id}`);
      for (const e of c.ends) if (!pubIds.has(e)) errs.push(`live connection ${c.id} points at a piece that is not public`);
    }
  } catch (e) { errs.push('connections.json is not valid JSON'); }
  for (const p of Object.keys(files)) {
    const m = /^blawg\/pieces\/(.+)\.md$/.exec(p);
    if (m && typeof files[p] === 'string') {
      const q = pubIds.get(m[1]);
      if (!q || q.state !== 'live' || !q.body) errs.push(`body of a non-live piece would be a public .md: ${p}`);
    }
  }
  // draft titles / ids / bodies must not appear in any public text
  const needles = [];
  for (const d of doc.pieces) {
    if (d.state === 'draft') {
      if (norm(d.title).length >= 4) needles.push({ n: norm(d.title), why: `draft title "${d.title}"` });
      if (norm(d.id).length >= 6) needles.push({ n: norm(d.id), why: `draft id "${d.id}"` });
    }
    if (d.state !== 'live' && norm(d.bodyText).length >= 30) needles.push({ n: norm(d.bodyText), why: `unpublished body of "${d.title}"` });
  }
  const texts = [...Object.entries(files).filter(([p, v]) => p !== PATHS.drafts && typeof v === 'string'), ...Object.keys(files).map((p) => ['(path) ' + p, p]), ...extraText.map((t, i) => [`(text ${i + 1})`, t])];
  for (const [p, v] of texts) {
    const hay = ' ' + norm(v) + ' ';
    for (const nd of needles) if (hay.includes(' ' + nd.n + ' ')) errs.push(`${nd.why} appears in public file ${p.replace('(path) ', '')}`);
  }
  return [...new Set(errs)];
}

// ---------- rebase (remote changed under us) ----------
function entity(doc, op) {
  if (op.kind === 'piece') return piece(doc, op.id);
  if (op.kind === 'connection') return conn(doc, op.id);
  if (op.kind === 'art') return artItem(doc, op.id);
  return null;
}
function fieldOf(e, f) { return f === 'body' ? e.bodyText : e[f]; }
function assignValue(doc, op) {
  if (op.target === 'piece') { const p = piece(doc, op.key); return p ? p.art : undefined; }
  if (op.target === 'gallery') return doc.art.gallery;
  const v = doc.art.assign[op.target][op.key]; return v ? [v] : [];
}

// resolutions: {"<opIndex>:<field>": "mine"|"theirs"}. Returns {ops, conflicts, dropped}
export function rebase(oldBase, newBase, ops, resolutions = {}) {
  const conflicts = [], dropped = [], out = [];
  ops.forEach((op, i) => {
    if (op.op === 'assign') {
      const o = assignValue(oldBase, op), t = assignValue(newBase, op);
      if (t === undefined) { dropped.push({ i, op, why: `piece ${op.key} is gone on the remote` }); return; }
      if (!eq(o, t) && !eq(op.art, t)) {
        const r = resolutions[`${i}:art`];
        if (!r) conflicts.push({ i, key: `${i}:art`, kind: 'assign', id: `${op.target}:${op.key}`, field: 'art', base: o, theirs: t, mine: op.art });
        else if (r === 'theirs') return;
      }
      out.push(op); return;
    }
    const oe = entity(oldBase, op), te2 = entity(newBase, op);
    if (op.op === 'create') {
      if (te2) dropped.push({ i, op, why: `id ${op.id} now exists on the remote` }); else out.push(op);
      return;
    }
    if (op.op === 'delete') { if (te2) out.push(op); return; }
    if (!te2) { dropped.push({ i, op, why: `${op.kind} ${op.id} was deleted on the remote` }); return; }
    if (!oe) { out.push(op); return; } // created by an earlier pending op
    const set = {};
    for (const [f, mine] of Object.entries(op.set || {})) {
      const o = fieldOf(oe, f), t = fieldOf(te2, f);
      if (!eq(o, t) && !eq(mine, t)) {
        const r = resolutions[`${i}:${f}`];
        if (!r) { conflicts.push({ i, key: `${i}:${f}`, kind: op.kind, id: op.id, field: f, base: o, theirs: t, mine }); set[f] = mine; }
        else if (r === 'mine') set[f] = mine;
      } else set[f] = mine;
    }
    if (Object.keys(set).length) out.push({ ...op, set });
  });
  return { ops: out, conflicts, dropped };
}

export function changeset(ops, files = {}, note = '') {
  const cs = { changeset: 1, author: 'waleed', note: note || 'exported from the blawg editor', ops: clone(ops) };
  if (Object.keys(files).length) cs.files = { ...files };
  return cs;
}
