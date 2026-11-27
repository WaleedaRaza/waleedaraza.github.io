// Screenshots of the editor (fake fixture data) at 1440 and 390 wide, deviceScaleFactor 1.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { MockRepo } = require('./mockgh');
const BASE = process.env.BLAWG_BASE || 'http://127.0.0.1:8790';
const OUT = process.env.SHOTS_DIR || '/home/user/shots/editor';
const TOKEN = 'github_pat_TESTONLY0000000000aaaaaaaaaaZZ';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  for (const [w, hgt] of [[1440, 900], [390, 844]]) {
    const repo = new MockRepo({ token: TOKEN, fixtureDir: path.join(__dirname, 'fixtures', 'repo') });
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('https://api.github.com/**', (r) => repo.handle(r));
    await page.goto(`${BASE}/blawg/edit.html`);
    await page.screenshot({ path: `${OUT}/signin-first-run-${w}.png`, fullPage: true });
    await page.fill('#si-user', 'test-user'); await page.fill('#si-pass', 'test-password-123'); await page.fill('#si-pass2', 'test-password-123');
    await page.fill('#si-token', TOKEN); await page.fill('#si-owner', 'test-owner'); await page.fill('#si-repo', 'test-repo');
    await page.click('#si-go'); await page.waitForSelector('#top:not([hidden])');
    await page.click('#sign-out'); await page.waitForSelector('#signin-form');
    await page.fill('#si-user', 'test-user'); await page.fill('#si-pass', 'wrong-password');
    await page.click('#si-go'); await page.waitForFunction(() => /Wrong/.test(document.querySelector('#si-msg').textContent));
    await page.screenshot({ path: `${OUT}/signin-${w}.png`, fullPage: true });
    await page.fill('#si-pass', 'test-password-123'); await page.click('#si-go'); await page.waitForSelector('#top:not([hidden])');
    await page.click('#p-list .item[data-id="test-piece-a"]');
    await page.fill('#f-body', '# Test piece A\n\nFake body text for **test piece A**, with a [link](https://example.com).\n\n> A fake quote.\n\n- one\n- two\n');
    await page.dispatchEvent('#f-body', 'input');
    await page.screenshot({ path: `${OUT}/piece-editor-${w}.png`, fullPage: true });
    await page.click('#tabs button[data-view="import"]');
    await page.fill('#i-text', JSON.stringify({ changeset: 1, author: 'claude', note: 'fake example', ops: [
      { op: 'create', kind: 'piece', id: 'test-piece-e', set: { title: 'Test piece E', desc: 'Fake new piece.', group: 'beta', type: 'Question', state: 'live', body: 'Fake.' } },
      { op: 'update', kind: 'piece', id: 'test-piece-c', set: { desc: 'Fake new desc C' } },
      { op: 'delete', kind: 'piece', id: 'test-piece-b' },
      { op: 'create', kind: 'connection', id: 'lk-002', set: { ends: ['test-piece-e', 'test-piece-a'], text: '', label: '', state: 'draft' } } ] }, null, 1));
    await page.click('#i-check'); await page.waitForSelector('#i-diff');
    await page.screenshot({ path: `${OUT}/import-diff-${w}.png`, fullPage: true });
    await page.fill('#i-text', JSON.stringify({ changeset: 1, ops: [{ op: 'update', kind: 'piece', id: 'nope', set: { type: 'Essay' } }, { op: 'create', kind: 'connection', id: 'lk-003', set: { ends: ['test-piece-a', 'ghost'] } }] }));
    await page.click('#i-check'); await page.waitForSelector('#i-ops');
    await page.screenshot({ path: `${OUT}/import-invalid-${w}.png`, fullPage: true });
    await page.fill('#i-text', JSON.stringify({ changeset: 1, ops: [{ op: 'update', kind: 'piece', id: 'test-piece-c', set: { desc: 'Fake new desc C' } }, { op: 'create', kind: 'piece', id: 'test-draft-x', set: { title: 'Test draft X', state: 'draft', group: 'alpha', body: 'fake' } }] }));
    await page.click('#i-check'); await page.waitForSelector('#i-diff'); await page.click('#i-accept');
    await page.waitForSelector('#pub-diff');
    await page.screenshot({ path: `${OUT}/publish-${w}.png`, fullPage: true });
    await page.click('#tabs button[data-view="connections"]'); await page.click('#c-list .item[data-id="lk-001"]');
    await page.evaluate(() => { const box = document.querySelector('#c-passages .qbody[data-id="test-piece-a"]'); const n = box.firstChild; const r = document.createRange(); const at = n.data.indexOf('Fake body text'); r.setStart(n, at); r.setEnd(n, at + 14); getSelection().removeAllRanges(); getSelection().addRange(r); });
    await page.click('#c-passages .q-anchor[data-id="test-piece-a"]');
    await page.screenshot({ path: `${OUT}/connection-passages-${w}.png`, fullPage: true });
    await page.click('#tabs button[data-view="art"]'); await page.click('#a-list .item[data-id="test-tree"]');
    await page.screenshot({ path: `${OUT}/art-${w}.png`, fullPage: true });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > w) console.log(`WARN horizontal overflow at ${w}: ${sw}`);
    await ctx.close();
  }
  await browser.close();
  console.log('shots written to ' + OUT);
})();
