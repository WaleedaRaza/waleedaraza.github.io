// Playwright tests for blawg/edit.html against a mocked GitHub. Fake data only.
// Usage: BLAWG_BASE=http://127.0.0.1:8790 node tests/editor/editor.test.js [filter]
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const { MockRepo } = require('./mockgh');

const BASE = process.env.BLAWG_BASE || 'http://127.0.0.1:8790';
const FIX = path.join(__dirname, 'fixtures', 'repo');
const TOKEN = 'github_pat_TESTONLY0000000000aaaaaaaaaaZZ';
const USER = 'test-user';
const PASS = 'test-password-123';
const DRAFT_TITLE = 'Test draft zebra quokka';
const DRAFT_BODY = 'Fake draft body sentence that must never be committed in plain text anywhere.';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

async function open(browser, repo, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...opts.ctx });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('   [pageerror]', e.message));
  if (repo) await page.route('https://api.github.com/**', (r) => repo.handle(r));
  else await page.route('https://api.github.com/**', (r) => r.abort());
  await page.goto(`${BASE}/blawg/edit.html`);
  return { ctx, page };
}
async function firstRun(page, { user = USER, pass = PASS, token = TOKEN } = {}) {
  await page.fill('#si-user', user);
  await page.fill('#si-pass', pass);
  await page.fill('#si-pass2', pass);
  await page.fill('#si-token', token);
  await page.fill('#si-owner', 'test-owner');
  await page.fill('#si-repo', 'test-repo');
  await page.click('#si-go');
  await page.waitForSelector('#top:not([hidden])', { timeout: 20000 });
}
async function signIn(page, user = USER, pass = PASS) {
  await page.fill('#si-user', user);
  await page.fill('#si-pass', pass);
  await page.click('#si-go');
}
async function tab(page, v) { await page.click(`#tabs button[data-view="${v}"]`); }
async function selectPiece(page, id) { await tab(page, 'pieces'); await page.click(`#p-list .item[data-id="${id}"]`); }
async function newPiece(page, { title, desc = '', state = 'draft', body = '', group = 'alpha', type = 'Note' }) {
  await tab(page, 'pieces');
  await page.click('#p-new');
  await page.fill('#f-title', title);
  await page.fill('#f-desc', desc);
  await page.selectOption('#f-type', type);
  await page.selectOption('#f-group', group);
  await page.selectOption('#f-state', state);
  await page.fill('#f-body', body);
  await page.click('#f-save');
}
async function pasteImport(page, obj) {
  await tab(page, 'import');
  await page.fill('#i-text', typeof obj === 'string' ? obj : JSON.stringify(obj));
  await page.click('#i-check');
}
async function decryptDraftsEnc(text, pass) {
  const env = JSON.parse(text);
  const sub = globalThis.crypto.subtle;
  const base = await sub.importKey('raw', Buffer.from(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await sub.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: Buffer.from(env.salt, 'base64'), iterations: env.iter }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await sub.decrypt({ name: 'AES-GCM', iv: Buffer.from(env.iv, 'base64') }, key, Buffer.from(env.ct, 'base64'));
  return JSON.parse(Buffer.from(pt).toString('utf8'));
}
const allStorage = (page) => page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));

// ---------------------------------------------------------------- unit level (in the browser)
test('crypto round trip, wrong password/username fail, iterations, salts', async (browser) => {
  const { ctx, page } = await open(browser, null);
  const r = await page.evaluate(async () => {
    const C = await import('/blawg/editor/crypto.js');
    const out = {};
    const { env } = await C.createVault('u1', 'pw-one-long', { token: 'github_pat_x', n: 1 });
    out.iter = env.iter; out.hasToken = JSON.stringify(env).includes('github_pat_x');
    out.ok = (await C.openVault(env, 'u1', 'pw-one-long')).secret.token;
    try { await C.openVault(env, 'u1', 'wrong-pass'); out.wrongPass = 'opened'; } catch (e) { out.wrongPass = e.message; }
    try { await C.openVault(env, 'u2', 'pw-one-long'); out.wrongUser = 'opened'; } catch (e) { out.wrongUser = e.message; }
    const e2 = (await C.createVault('u1', 'pw-one-long', { a: 1 })).env;
    out.saltsDiffer = env.salt !== e2.salt;
    const d = await C.draftsKey('pw-one-long');
    const sealed = await C.sealDrafts(d.key, d.salt, { pieces: [{ title: 'Fake draft' }], connections: [] });
    out.sealedPlain = JSON.stringify(sealed).includes('Fake draft');
    const d2 = await C.draftsKey('pw-one-long', sealed.salt, sealed.iter);
    out.drafts = (await C.openDrafts(d2.key, sealed)).pieces[0].title;
    const d3 = await C.draftsKey('nope-nope-nope', sealed.salt);
    try { await C.openDrafts(d3.key, sealed); out.draftsWrong = 'opened'; } catch (e) { out.draftsWrong = e.message; }
    try { await C.deriveKey('x', new Uint8Array(16), 1000); out.lowIter = 'allowed'; } catch (e) { out.lowIter = 'refused'; }
    return out;
  });
  await ctx.close();
  assert.strictEqual(r.iter, 310000);
  assert.strictEqual(r.hasToken, false);
  assert.strictEqual(r.ok, 'github_pat_x');
  assert.match(r.wrongPass, /Wrong username or password/);
  assert.match(r.wrongUser, /Wrong username or password/);
  assert.ok(r.saltsDiffer);
  assert.strictEqual(r.sealedPlain, false);
  assert.strictEqual(r.drafts, 'Fake draft');
  assert.match(r.draftsWrong, /could not be opened/);
  assert.strictEqual(r.lowIter, 'refused');
});

test('model: path guard, privacy rules, rebase, markdown escaping', async (browser) => {
  const { ctx, page } = await open(browser, null);
  const r = await page.evaluate(async () => {
    const M = await import('/blawg/editor/model.js');
    const G = await import('/blawg/editor/github.js');
    const { renderMarkdown } = await import('/blawg/editor/markdown.js');
    const out = {};
    for (const p of ['index.html', 'blawg/../index.html', '/blawg/x.json', 'assets/ascii/a.js']) {
      try { G.assertBlawgPath(p); out[p] = 'allowed'; } catch (e) { out[p] = 'refused'; }
    }
    G.assertBlawgPath('blawg/data/pieces.json');
    const doc = M.emptyDoc();
    doc.pieces.push({ ...M.newPiece('test-secret-x'), title: 'Test secret x', state: 'draft' });
    const files = { 'blawg/data/pieces.json': JSON.stringify([{ id: 'test-secret-x', title: 'Test secret x', state: 'draft' }]), 'blawg/data/connections.json': '[{"id":"lk-9","ends":["a","b"],"state":"draft"}]', 'blawg/img/Bad Name.webp': { bytes: 10 }, 'blawg/pieces/test-secret-x.md': 'x' };
    out.priv = M.privacyCheck(files, doc);
    const base = M.emptyDoc();
    base.pieces.push({ ...M.newPiece('p1'), title: 'P1', desc: 'base', state: 'live' });
    const theirs = M.clone(base); theirs.pieces[0].desc = 'theirs'; theirs.pieces[0].title = 'P1 renamed';
    const ops = [{ op: 'update', kind: 'piece', id: 'p1', set: { desc: 'mine', type: 'Note' } }];
    out.rb = M.rebase(base, theirs, ops);
    out.rb2 = M.rebase(base, theirs, ops, { '0:desc': 'theirs' });
    out.md = renderMarkdown('# Hi\n\n<script>alert(1)</script> **b** [x](javascript:alert(1))');
    return out;
  });
  await ctx.close();
  assert.strictEqual(r['index.html'], 'refused');
  assert.strictEqual(r['blawg/../index.html'], 'refused');
  assert.strictEqual(r['/blawg/x.json'], 'refused');
  assert.strictEqual(r['assets/ascii/a.js'], 'refused');
  const p = r.priv.join('\n');
  for (const re of [/draft piece in pieces.json/, /draft connection/, /not plain/, /webp/, /non-live piece/, /draft title/]) assert.match(p, re);
  assert.strictEqual(r.rb.conflicts.length, 1);
  assert.strictEqual(r.rb.conflicts[0].field, 'desc');
  assert.deepStrictEqual(r.rb2.ops[0].set, { type: 'Note' });
  assert.ok(!r.md.includes('<script>'));
  assert.ok(!r.md.includes('javascript:'));
});

// ---------------------------------------------------------------- sign in
test('first-run token setup stores only ciphertext; wrong password and username fail; forget device', async (browser) => {
  const repo = new MockRepo({ token: TOKEN, fixtureDir: FIX });
  const { ctx, page } = await open(browser, repo);
  await firstRun(page);
  assert.ok(await page.isVisible('#p-list .item[data-id="test-piece-a"]'));
  const st = await allStorage(page);
  assert.ok(!st.includes(TOKEN), 'plaintext token in localStorage');
  assert.ok(!st.includes('TESTONLY'), 'token fragment in localStorage');
  assert.ok(!st.includes(PASS));
  const vault = JSON.parse(await page.evaluate(() => localStorage.getItem('blawg.editor.vault')));
  assert.strictEqual(vault.kdf, 'PBKDF2-SHA256'); assert.ok(vault.iter >= 310000); assert.ok(vault.salt && vault.iv && vault.ct);
  await page.click('#sign-out');
  await page.waitForSelector('#signin-form');
  assert.strictEqual(await page.evaluate(() => window.__blawgEditor.work().pieces.length), 0, 'doc not wiped on sign-out');
  await signIn(page, USER, 'not-the-password');
  await page.waitForFunction(() => /Wrong username or password/.test(document.querySelector('#si-msg').textContent));
  assert.ok(!(await page.isVisible('#top')));
  await signIn(page, 'someone-else', PASS);
  await page.waitForFunction(() => /Wrong username or password/.test(document.querySelector('#si-msg').textContent) && !document.querySelector('#si-go').disabled);
  await signIn(page);
  await page.waitForSelector('#top:not([hidden])');
  await tab(page, 'settings');
  await page.click('#s-forget');
  await page.click('#modal-buttons button[data-answer="yes"]');
  await page.waitForSelector('#si-pass2'); // first-run form again
  assert.strictEqual(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('blawg.')).length), 0);
  await ctx.close();
});

test('bad token is refused by GitHub and nothing is stored', async (browser) => {
  const repo = new MockRepo({ token: TOKEN, fixtureDir: FIX });
  const { ctx, page } = await open(browser, repo);
  await page.fill('#si-user', USER); await page.fill('#si-pass', PASS); await page.fill('#si-pass2', PASS);
  await page.fill('#si-token', 'github_pat_WRONG000000000000000000000000'); await page.fill('#si-owner', 'test-owner'); await page.fill('#si-repo', 'test-repo');
  await page.click('#si-go');
  await page.waitForFunction(() => /refused/.test(document.querySelector('#si-msg').textContent));
  assert.strictEqual(await page.evaluate(() => localStorage.getItem('blawg.editor.vault')), null);
  await ctx.close();
});

// ---------------------------------------------------------------- pieces
test('piece CRUD; unsaved changes survive a reload and are stored encrypted', async (browser) => {
  const repo = new MockRepo({ token: TOKEN, fixtureDir: FIX });
  const { ctx, page } = await open(browser, repo);
  await firstRun(page);
  await newPiece(page, { title: DRAFT_TITLE, desc: 'fake desc', body: '# Heading\n\n' + DRAFT_BODY });
  await page.waitForSelector('#p-list .item[data-id="test-draft-zebra-quokka"]');
  assert.match(await page.innerHTML('#f-preview'), /<h1>Heading<\/h1>/);
  // update
  await selectPiece(page, 'test-piece-b');
  await page.fill('#f-desc', 'Edited fake desc B.');
  await page.click('#f-save');
  await page.waitForFunction(() => /Kept changes to test-piece-b/.test(document.querySelector('#notice').textContent));
  // duplicate title is refused
  await selectPiece(page, 'test-piece-c');
  await page.fill('#f-title', 'Test piece A');
  await page.click('#f-save');
  await page.waitForFunction(() => /duplicate title/.test(document.querySelector('#notice').textContent));
  const st = await allStorage(page);
  assert.ok(!st.includes('zebra') && !st.includes('Edited fake desc'), 'pending stored in plaintext');
  // reload: changes still there after sign-in
  await page.reload();
  await signIn(page);
  await page.waitForSelector('#top:not([hidden])');
  await page.waitForSelector('#p-list .item[data-id="test-draft-zebra-quokka"]');
  await selectPiece(page, 'test-piece-b');
  assert.strictEqual(await page.inputValue('#f-desc'), 'Edited fake desc B.');
  // delete names its connections
  await selectPiece(page, 'test-piece-a');
  await page.click('#f-delete');
  await page.waitForSelector('#modal:not([hidden])');
  assert.match(await page.textContent('#del-conns'), /lk-001.*Test piece A.*Test piece B/);
  await page.click('#modal-buttons button[data-answer="yes"]');
  await page.waitForFunction(() => !document.querySelector('#p-list .item[data-id="test-piece-a"]'));
  const w = await page.evaluate(() => window.__blawgEditor.work());
  assert.ok(!w.connections.find((c) => c.id === 'lk-001'));
  await tab(page, 'publish');
  const diff = await page.textContent('#pub-diff');
  assert.match(diff, /piece Test piece A/); assert.match(diff, /goes with a deleted piece/);
  await ctx.close();
});

// ---------------------------------------------------------------- connections
test('connection CRUD with searchable picker', async (browser) => {
  const repo = new MockRepo({ token: TOKEN, fixtureDir: FIX });
  const { ctx, page } = await open(browser, repo);
  await firstRun(page);
  await tab(page, 'connections');
  await page.click('#c-new');
  await page.fill('#c-search', 'piece b');
  await page.click('#c-pick .item[data-id="test-piece-b"]');
  await page.fill('#c-search', 'seed');
  await page.fill('#c-search', 'piece c');
  await page.click('#c-pick .item[data-id="test-piece-c"]');
  await page.fill('#c-text', '');
  await page.fill('#c-label', 'fake label');
  await page.click('#c-save');
  await page.waitForSelector('#c-list .item[data-id="lk-002"]');
  // one end only is refused
  await page.click('#c-new');
  await page.click('#c-pick .item[data-id="test-piece-a"]');
  await page.click('#c-save');
  await page.waitForFunction(() => /2 or more ends/.test(document.querySelector('#notice').textContent));
  // update to live
  await page.click('#c-list .item[data-id="lk-002"]');
  await page.fill('#c-text', 'Fake words.');
  await page.selectOption('#c-state', 'live');
  await page.click('#c-save');
  let w = await page.evaluate(() => window.__blawgEditor.work());
  const c = w.connections.find((x) => x.id === 'lk-002');
  assert.deepStrictEqual([c.state, c.text, c.label, c.ends.join()], ['live', 'Fake words.', 'fake label', 'test-piece-b,test-piece-c']);
  // delete
  await page.click('#c-list .item[data-id="lk-001"]');
  await page.click('#c-delete');
  await page.click('#modal-buttons button[data-answer="yes"]');
  await page.waitForFunction(() => !document.querySelector('#c-list .item[data-id="lk-001"]'));
  w = await page.evaluate(() => window.__blawgEditor.work());
  assert.deepStrictEqual(w.connections.map((x) => x.id), ['lk-002']);
  await ctx.close();
});

// ---------------------------------------------------------------- art
test('art upload resizes a 3000px PNG to <=1600 wide and <=400KB; assignment', async (browser) => {
  const repo = new MockRepo({ token: TOKEN, fixtureDir: FIX });
  const { ctx, page } = await open(browser, repo);
  await firstRun(page);
  // build a big noisy PNG in the page
  const b64png = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 3000; c.height = 2000;
    const x = c.getContext('2d'); const id = x.createImageData(3000, 2000);
    for (let i = 0; i < id.data.length; i += 4) { id.data[i] = (i * 7) % 256; id.data[i + 1] = Math.random() * 255; id.data[i + 2] = (i / 4000) % 256; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  });
  const big = Buffer.from(b64png, 'base64');
  assert.ok(big.length > 400 * 1024 && big.readUInt32BE(16) === 3000, 'fixture image not big');
  await tab(page, 'art');
  await page.setInputFiles('#a-file', { name: 'Big Test Picture.PNG', mimeType: 'image/png', buffer: big });
  await page.waitForSelector('#a-up-info');
  await page.fill('#a-name', 'Test big picture');
  await page.click('#a-upload');
  await page.waitForSelector('#a-list .item[data-id="test-big-picture"]');
  // inspect the staged file through the export
  await tab(page, 'import');
  await page.click('#x-export');
  const cs = JSON.parse(await page.textContent('#x-out'));
  const [p, data] = Object.entries(cs.files)[0];
  assert.match(p, /^blawg\/art\/big-test-picture\.png$/);
  const buf = Buffer.from(data, 'base64');
  assert.strictEqual(buf.slice(1, 4).toString(), 'PNG');
  const w = buf.readUInt32BE(16);
  assert.ok(w <= 1600, `width ${w}`);
  assert.ok(buf.length <= 400 * 1024, `bytes ${buf.length}`);
  // assign to two essays, a type default, a group, the gallery
  await tab(page, 'art');
  await page.click('#a-list .item[data-id="test-big-picture"]');
  await page.check('#a-pieces input[value="test-piece-a"]');
  await page.check('#a-pieces input[value="test-piece-c"]');
  await page.check('#a-types input[value="Case study"]');
  await page.check('#a-groups input[value="beta"]');
  await page.check('#a-gallery');
  await page.click('#a-apply');
  const d = await page.evaluate(() => window.__blawgEditor.work());
  assert.deepStrictEqual(d.pieces.filter((x) => x.art.includes('test-big-picture')).map((x) => x.id), ['test-piece-a', 'test-piece-c']);
  assert.strictEqual(d.art.assign.type['Case study'], 'test-big-picture');
  assert.strictEqual(d.art.assign.group.beta, 'test-big-picture');
  assert.ok(d.art.gallery.includes('test-big-picture'));
  // ascii file from assets/ascii that is not in the library yet
  await page.selectOption('#a-ascii', 'assets/ascii/test-rock.js');
  await page.click('#a-add-file');
  await page.waitForSelector('#a-list .item[data-id="test-rock"]');
  await ctx.close();
});

// ---------------------------------------------------------------- import / export
test('import valid changeset: diff with + ~ − and cascade, accept stacks; .md import; export round trip', async (browser) => {
  const repo = new MockRepo({ token: TOKEN, fixtureDir: FIX });
  const { ctx, page } = await open(browser, repo);
  await firstRun(page);
  await pasteImport(page, { changeset: 1, author: 'claude', note: 'fake test changeset', ops: [
    { op: 'create', kind: 'piece', id: 'test-piece-e', set: { title: 'Test piece E', desc: 'fake', group: 'beta', type: 'Question', state: 'live', body: 'Fake body E.' } },
    { op: 'update', kind: 'piece', id: 'test-piece-c', set: { desc: 'Fake new desc C' } },
    { op: 'create', kind: 'connection', id: 'lk-002', set: { ends: ['test-piece-e', 'test-piece-c'], text: '', label: '', state: 'live' } },
    { op: 'delete', kind: 'piece', id: 'test-piece-b' },
    { op: 'assign', kind: 'art', target: 'type', key: 'Note', art: ['test-tree'] },
  ] });
  await page.waitForSelector('#i-diff');
  assert.strictEqual(await page.isDisabled('#i-accept'), false);
  const plus = await page.textContent('#i-diff .e[data-sign="+"][data-id="test-piece-e"]');
  assert.match(plus, /Test piece E/);
  const tilde = await page.textContent('#i-diff .e[data-sign="~"][data-id="test-piece-c"]');
  assert.match(tilde, /desc: Fake seed piece C\.\s*→\s*Fake new desc C/);
  assert.ok(await page.isVisible('#i-diff .e[data-sign="-"][data-id="test-piece-b"]'));
  assert.match(await page.textContent('#i-diff .e[data-sign="-"][data-id="lk-001"]'), /goes with a deleted piece/);
  assert.strictEqual(await page.evaluate(() => window.__blawgEditor.pendingOps()), 0, 'applied before accept');
  await page.click('#i-accept');
  await page.waitForSelector('#pub-diff');
  assert.strictEqual(await page.evaluate(() => window.__blawgEditor.pendingOps()), 5);
  // .md with front matter
  await pasteImport(page, '---\ntitle: Test piece F\ngroup: alpha\ntype: Log\nstate: draft\ndesc: fake f\n---\nFake body F.\n');
  await page.waitForSelector('#i-diff');
  assert.match(await page.textContent('#i-diff'), /Test piece F/);
  await page.click('#i-accept');
  await page.waitForSelector('#pub-diff');
  const w = await page.evaluate(() => window.__blawgEditor.work());
  const f = w.pieces.find((x) => x.id === 'test-piece-f');
  assert.deepStrictEqual([f.state, f.type, f.bodyText.trim()], ['draft', 'Log', 'Fake body F.']);
  // export and re-import into a fresh device gives the same result
  await tab(page, 'import');
  await page.click('#x-export');
  const exported = JSON.parse(await page.textContent('#x-out'));
  assert.strictEqual(exported.changeset, 1); assert.strictEqual(exported.ops.length, 6);
  const fresh = await open(browser, new MockRepo({ token: TOKEN, fixtureDir: FIX }));
  await firstRun(fresh.page);
  await pasteImport(fresh.page, exported);
  await fresh.page.waitForSelector('#i-diff');
  await fresh.page.click('#i-accept');
  const w2 = await fresh.page.evaluate(() => window.__blawgEditor.work());
  const strip = (d) => JSON.stringify({ p: d.pieces, c: d.connections, a: d.art });
  assert.strictEqual(strip(w2), strip(w));
  await fresh.ctx.close();
  await ctx.close();
});

test('import invalid changeset lists every reason and cannot be accepted', async (browser) => {
  const repo = new MockRepo({ token: TOKEN, fixtureDir: FIX });
  const { ctx, page } = await open(browser, repo);
  await firstRun(page);
  await pasteImport(page, { changeset: 1, author: 'robot', ops: [
    { op: 'update', kind: 'piece', id: 'no-such-piece', set: { desc: 'x' } },
    { op: 'create', kind: 'piece', id: 'test-dup', set: { title: 'Test piece A', group: 'alpha', state: 'draft' } },
    { op: 'create', kind: 'piece', id: 'test-bad-enum', set: { title: 'Test bad enum', group: 'nogroup', type: 'Essay', state: 'published' } },
    { op: 'delete', kind: 'piece', id: 'test-piece-c' },
    { op: 'create', kind: 'connection', id: 'lk-009', set: { ends: ['test-piece-a', 'test-piece-c'], state: 'draft' } },
    { op: 'create', kind: 'connection', id: 'lk-010', set: { ends: ['test-piece-a', 'ghost-piece'], state: 'draft' } },
    { op: 'update', kind: 'piece', id: 'test-piece-a', set: { img: 'blawg/img/Bad Name.webp' } },
    { op: 'create', kind: 'art', id: 'bad-art', set: { name: 'x', kind: 'img', src: 'blawg/art/UPPER.PNG' } },
    { op: 'frobnicate', kind: 'piece', id: 'x' },
  ], files: { 'blawg/img/Bad.webp': 'AAAA' } });
  await page.waitForSelector('#i-ops');
  assert.ok(await page.isDisabled('#i-accept'));
  assert.ok(!(await page.isVisible('#i-diff')));
  const txt = (await page.textContent('#i-result')).replace(/\s+/g, ' ');
  for (const re of [/bad author "robot"/, /unknown piece id "no-such-piece"/, /duplicate title/, /bad group "nogroup"/, /bad type "Essay"/, /bad state "published"/,
    /connection to unknown or deleted piece "test-piece-c"/, /connection to unknown or deleted piece "ghost-piece"/, /bad image filename/, /bad art filename/, /bad op "frobnicate"/, /bad filename "blawg\/img\/Bad\.webp"/]) assert.match(txt, re);
  assert.strictEqual(await page.evaluate(() => window.__blawgEditor.pendingOps()), 0);
  // not JSON at all
  await pasteImport(page, 'this is not json');
  await page.waitForSelector('#i-errors');
  assert.match(await page.textContent('#i-errors'), /Not valid JSON/);
  await ctx.close();
});

// ---------------------------------------------------------------- publish
test('publish: one commit on blawg-review, only blawg/ paths, drafts never in plaintext', async (browser) => {
  const repo = new MockRepo({ token: TOKEN, fixtureDir: FIX });
  const mainBefore = repo.head('main');
  const { ctx, page } = await open(browser, repo);
  await firstRun(page);
  await newPiece(page, { title: DRAFT_TITLE, desc: 'fake draft desc', body: DRAFT_BODY });
  await newPiece(page, { title: 'Test piece G', desc: 'fake live G', state: 'live', body: 'Fake live body G.' });
  await selectPiece(page, 'test-piece-c');
  await page.fill('#f-body', 'Fake seed draft body C that stays encrypted until it goes live.');
  await page.click('#f-save');
  await tab(page, 'connections');
  await page.click('#c-new');
  await page.click('#c-pick .item[data-id="test-draft-zebra-quokka"]');
  await page.click('#c-pick .item[data-id="test-piece-g"]');
  await page.click('#c-save');
  await tab(page, 'publish');
  assert.ok(await page.isVisible('#pub-privacy-ok'));
  assert.match(await page.textContent('#pub-target'), /blawg-review/);
  await page.click('#pub-go');
  await page.waitForSelector('#pub-ok', { timeout: 20000 });
  assert.strictEqual(repo.head('main'), mainBefore, 'main moved');
  const head = repo.head('blawg-review');
  assert.ok(head);
  const commits = repo.commitsAfter('blawg-review', mainBefore);
  assert.strictEqual(commits.length, 1, 'expected exactly one commit');
  const changed = repo.changedPaths(head);
  assert.ok(changed.length > 0 && changed.every((p) => p.startsWith('blawg/')), 'path outside blawg/: ' + changed);
  for (const p of ['blawg/data/pieces.json', 'blawg/data/drafts.enc', 'blawg/pieces/test-piece-g.md']) assert.ok(changed.includes(p), p);
  assert.ok(!changed.includes('blawg/pieces/test-draft-zebra-quokka.md'));
  const msg = repo.commits.get(head).message;
  assert.ok(!/zebra|quokka/i.test(msg), 'draft title in commit message');
  // search every file in the committed tree for any draft text
  const flat = repo.flat(head);
  for (const [p, sha] of Object.entries(flat)) {
    const s = repo.blobs.get(sha).toString('latin1').toLowerCase();
    for (const needle of ['zebra', 'quokka', 'stays encrypted until', 'never be committed']) assert.ok(!s.includes(needle), `${needle} found in ${p}`);
  }
  const pieces = JSON.parse(repo.readText('blawg-review', 'blawg/data/pieces.json'));
  assert.ok(pieces.every((x) => x.state !== 'draft'));
  assert.ok(pieces.find((x) => x.id === 'test-piece-g' && x.body === true));
  assert.ok(pieces.find((x) => x.id === 'test-piece-c' && x.state === 'seed' && x.body === false));
  const conns = JSON.parse(repo.readText('blawg-review', 'blawg/data/connections.json'));
  assert.deepStrictEqual(conns.map((c) => c.id), ['lk-001']);
  const drafts = await decryptDraftsEnc(repo.readText('blawg-review', 'blawg/data/drafts.enc'), PASS);
  assert.ok(drafts.pieces.find((x) => x.title === DRAFT_TITLE && x.bodyText === DRAFT_BODY));
  assert.ok(drafts.pieces.find((x) => x.id === 'test-piece-c' && /stays encrypted/.test(x.bodyText)));
  assert.strictEqual(drafts.connections.length, 1);
  // pending is cleared; a reload shows drafts again (from drafts.enc)
  assert.strictEqual(await page.evaluate(() => localStorage.getItem('blawg.editor.pending')), null);
  await page.reload(); await signIn(page); await page.waitForSelector('#top:not([hidden])');
  await page.waitForSelector('#p-list .item[data-id="test-draft-zebra-quokka"]');
  // a second publish is a second single commit on the same branch
  await selectPiece(page, 'test-piece-g');
  await page.fill('#f-desc', 'fake live G, edited');
  await page.click('#f-save');
  await tab(page, 'publish');
  await page.click('#pub-go');
  await page.waitForSelector('#pub-ok', { timeout: 20000 });
  assert.strictEqual(repo.commitsAfter('blawg-review', head).length, 1);
  assert.ok(repo.changedPaths(repo.head('blawg-review')).every((p) => p.startsWith('blawg/')));
  await ctx.close();
});

test('privacy check blocks a publish that would leak a draft title', async (browser) => {
  const repo = new MockRepo({ token: TOKEN, fixtureDir: FIX });
  const { ctx, page } = await open(browser, repo);
  await firstRun(page);
  await newPiece(page, { title: 'Test hidden walrus', body: 'fake' });
  await selectPiece(page, 'test-piece-b');
  await page.fill('#f-desc', 'This mentions test hidden walrus by mistake.');
  await page.click('#f-save');
  await tab(page, 'publish');
  await page.waitForSelector('#pub-privacy');
  assert.match(await page.textContent('#pub-privacy'), /draft title "Test hidden walrus" appears in public file blawg\/data\/pieces\.json/);
  assert.ok(await page.isDisabled('#pub-go'));
  // a live connection to a draft piece is refused up front
  await tab(page, 'connections');
  await page.click('#c-new');
  await page.click('#c-pick .item[data-id="test-hidden-walrus"]');
  await page.click('#c-pick .item[data-id="test-piece-a"]');
  await page.selectOption('#c-state', 'live');
  await page.click('#c-save');
  await page.waitForFunction(() => /can't point at draft piece/.test(document.querySelector('#notice').textContent));
  assert.strictEqual(repo.head('blawg-review'), undefined);
  await ctx.close();
});

test('remote changed since load: re-applies on top, asks only about fields both changed', async (browser) => {
  const repo = new MockRepo({ token: TOKEN, fixtureDir: FIX });
  const { ctx, page } = await open(browser, repo);
  await firstRun(page);
  await selectPiece(page, 'test-piece-a');
  await page.fill('#f-desc', 'Mine: desc A');
  await page.click('#f-save');
  await selectPiece(page, 'test-piece-c');
  await page.fill('#f-desc', 'Mine: desc C');
  await page.click('#f-save');
  // a PR lands on main meanwhile: changes A.desc (conflict), B.title (no conflict), C.group (no conflict)
  const pieces = JSON.parse(repo.readText('main', 'blawg/data/pieces.json'));
  pieces[0].desc = 'Theirs: desc A'; pieces[1].title = 'Test piece B renamed'; pieces[2].group = 'beta';
  repo.pushOutside('main', { 'blawg/data/pieces.json': '[\n' + pieces.map((p) => '  ' + JSON.stringify(p)).join(',\n') + '\n]\n' });
  const mainHead = repo.head('main');
  await tab(page, 'publish');
  await page.click('#pub-go');
  await page.waitForSelector('#pub-conflicts');
  const boxes = await page.$$('#pub-conflicts .conflict');
  assert.strictEqual(boxes.length, 1, 'only one field conflicts');
  assert.match(await boxes[0].textContent(), /piece test-piece-a.*desc.*Mine: desc A.*Theirs: desc A/s);
  await page.check('#pub-conflicts input[value="mine"]');
  await page.click('#pub-go');
  await page.waitForSelector('#pub-ok', { timeout: 20000 });
  const head = repo.head('blawg-review');
  assert.deepStrictEqual(repo.commits.get(head).parents, [mainHead]);
  const out = JSON.parse(repo.readText('blawg-review', 'blawg/data/pieces.json'));
  const by = Object.fromEntries(out.map((p) => [p.id, p]));
  assert.strictEqual(by['test-piece-a'].desc, 'Mine: desc A');
  assert.strictEqual(by['test-piece-b'].title, 'Test piece B renamed');
  assert.strictEqual(by['test-piece-c'].desc, 'Mine: desc C');
  assert.strictEqual(by['test-piece-c'].group, 'beta');
  await ctx.close();
});

test('main needs the setting AND typing main', async (browser) => {
  const repo = new MockRepo({ token: TOKEN, fixtureDir: FIX });
  const { ctx, page } = await open(browser, repo);
  await firstRun(page);
  await selectPiece(page, 'test-piece-b');
  await page.fill('#f-desc', 'fake main edit');
  await page.click('#f-save');
  await tab(page, 'settings');
  await page.fill('#s-target', 'main');
  await page.click('#s-form button[type=submit]');
  await tab(page, 'publish');
  await page.click('#pub-go');
  await page.waitForFunction(() => /Commits to main are off/.test(document.querySelector('#pub-result').textContent));
  await tab(page, 'settings');
  await page.check('#s-main');
  await page.click('#s-form button[type=submit]');
  await tab(page, 'publish');
  await page.fill('#pub-main', 'yes');
  await page.click('#pub-go');
  await page.waitForFunction(() => /Type the word main/.test(document.querySelector('#pub-result').textContent));
  const before = repo.head('main');
  await page.fill('#pub-main', 'main');
  await page.click('#pub-go');
  await page.waitForSelector('#pub-ok', { timeout: 20000 });
  assert.notStrictEqual(repo.head('main'), before);
  assert.ok(repo.changedPaths(repo.head('main')).every((p) => p.startsWith('blawg/')));
  await ctx.close();
});

test('GitHub unreachable: loads the files this site serves, read-only (empty when absent)', async (browser) => {
  const { ctx, page } = await open(browser, null);
  await firstRun(page);
  assert.match(await page.textContent('#branch-note'), /read-only/);
  const n = await page.evaluate(() => window.__blawgEditor.work().pieces.length);
  const fs = require('fs');
  const real = path.join(__dirname, '..', '..', 'blawg', 'data', 'pieces.json');
  const expected = fs.existsSync(real) ? JSON.parse(fs.readFileSync(real, 'utf8')).length : 0;
  assert.strictEqual(n, expected);
  await tab(page, 'publish');
  await ctx.close();
});

(async () => {
  const filter = process.argv[2] || '';
  const browser = await chromium.launch();
  let pass = 0, fail = 0;
  for (const t of tests) {
    if (filter && !t.name.includes(filter)) continue;
    const t0 = Date.now();
    try { await t.fn(browser); pass++; console.log(`PASS  ${t.name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`); }
    catch (e) { fail++; console.log(`FAIL  ${t.name}\n      ${String(e && e.stack || e).split('\n').slice(0, 4).join('\n      ')}`); }
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
