// node tests/app/mappage.js [base]  -> drives the map page (#map) with real touches and mouse at 4 sizes; screenshots go to $OUT
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8770/blawg/';
const out = process.env.OUT || require('path').join(require('os').tmpdir(), 'blawg-map-shots');
require('fs').mkdirSync(out, { recursive: true });
const state = (p) => p.evaluate(() => ({ strip: document.querySelector('.mstrip').textContent.slice(0, 90), h3: (document.querySelector('.mpanel h3') || {}).textContent || null,
  pick: document.querySelectorAll('.bmap .tile.pick').length, hv: document.querySelectorAll('.bmap .tile.hv').length, ln: document.querySelectorAll('.bmap .tile.ln').length, on: document.querySelectorAll('.bmap .lnk.on').length,
  zt: document.querySelector('.bmap').classList.contains('zt'), vb: document.querySelector('.bmap').getAttribute('viewBox'), hash: location.hash, frame: (() => { const r = document.querySelector('.mframe').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
  overflowX: document.documentElement.scrollWidth - window.innerWidth }));
// centre of the n-th piece tile, in page pixels
const tileAt = (p, n) => p.evaluate((n) => { const t = document.querySelectorAll('.bmap .tile')[n], r = t.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, n);
(async () => {
  const b = await chromium.launch();
  for (const [w, hh, touch] of [[390, 844, true], [768, 1024, true], [1024, 768, false], [1440, 900, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: hh }, hasTouch: touch, isMobile: touch && w < 800 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push('PE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CE ' + m.text()); });
    await p.goto(base); await p.waitForTimeout(1500);
    // get to the map with a real press on the top-bar button
    const mb = await (await p.$('#mapbtn')).boundingBox();
    if (touch) await p.touchscreen.tap(mb.x + mb.width / 2, mb.y + mb.height / 2); else await p.mouse.click(mb.x + mb.width / 2, mb.y + mb.height / 2);
    await p.waitForTimeout(500);
    console.log(w, 'open', JSON.stringify(await state(p))); await p.screenshot({ path: `${out}/fit-${w}.png` });
    const cdp = await ctx.newCDPSession(p);
    const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    if (touch) {
      // slide one finger from piece 3 to piece 40, look mid-way, then lift
      const A = await tileAt(p, 3), Z = await tileAt(p, 40);
      await T('touchStart', [A]); for (let k = 1; k <= 10; k++) await T('touchMove', [[A[0] + (Z[0] - A[0]) * k / 10, A[1] + (Z[1] - A[1]) * k / 10]]);
      await p.waitForTimeout(100); console.log(w, 'sliding', JSON.stringify(await state(p))); await p.screenshot({ path: `${out}/slide-${w}.png` });
      await T('touchEnd', []); await p.waitForTimeout(300);
      console.log(w, 'lifted', JSON.stringify(await state(p)));
      // pinch out around the picked piece
      const C = await tileAt(p, 40);
      await T('touchStart', [[C[0] - 30, C[1]], [C[0] + 30, C[1]]]); for (let k = 1; k <= 8; k++) await T('touchMove', [[C[0] - 30 - k * 14, C[1]], [C[0] + 30 + k * 14, C[1]]]);
      await T('touchEnd', []); await p.waitForTimeout(200);
      console.log(w, 'pinched', JSON.stringify(await state(p))); await p.screenshot({ path: `${out}/zoom-${w}.png` });
      // two fingers move the map
      await T('touchStart', [[150, 300], [220, 300]]); for (let k = 1; k <= 6; k++) await T('touchMove', [[150 + k * 12, 300 + k * 10], [220 + k * 12, 300 + k * 10]]); await T('touchEnd', []);
      await p.waitForTimeout(150); console.log(w, 'moved', (await state(p)).vb);
      // tap another piece while enlarged
      const D = await p.evaluate(() => { const f = document.querySelector('.mframe').getBoundingClientRect(); for (const t of document.querySelectorAll('.bmap .tile')) { const r = t.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; if (!t.classList.contains('pick') && x > f.left + 40 && x < f.right - 40 && y > f.top + 70 && y < f.bottom - 70) return [x, y]; } });
      await p.touchscreen.tap(D[0], D[1]); await p.waitForTimeout(300); console.log(w, 'tap zoomed', JSON.stringify(await state(p)));
    } else {
      const A = await tileAt(p, 3); await p.mouse.move(A[0], A[1]); await p.waitForTimeout(100); console.log(w, 'hover', JSON.stringify(await state(p)));
      await p.screenshot({ path: `${out}/hover-${w}.png` });
      const Z = await tileAt(p, 40); await p.mouse.click(Z[0], Z[1]); await p.waitForTimeout(300); console.log(w, 'click', JSON.stringify(await state(p)));
      await p.mouse.move(Z[0], Z[1]); await p.mouse.wheel(0, -900); await p.waitForTimeout(200); console.log(w, 'wheel', JSON.stringify(await state(p))); await p.screenshot({ path: `${out}/zoom-${w}.png` });
      await p.mouse.move(600, 300); await p.mouse.down(); await p.mouse.move(520, 260, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(100); console.log(w, 'drag', (await state(p)).vb, (await state(p)).h3);
    }
    // the linked pair: open one end by its address, press the link in the panel
    await p.goto(base + '#map&s=libxndr-a-case-study'); await p.waitForTimeout(600);
    console.log(w, 'deep link', JSON.stringify(await state(p))); await p.screenshot({ path: `${out}/linked-${w}.png`, fullPage: true });
    const lk = await p.$('.mlink'); if (lk) { await lk.scrollIntoViewIfNeeded(); const bb = await lk.boundingBox(); if (touch) await p.touchscreen.tap(bb.x + 20, bb.y + 12); else await p.mouse.click(bb.x + 20, bb.y + 12); await p.waitForTimeout(300); console.log(w, 'jumped', JSON.stringify(await state(p))); }
    // buttons
    for (const sel of ['.mctl button:nth-child(2)', '.mctl button:nth-child(2)', '.mctl button:nth-child(2)', '.mctl .fit']) { const e = await p.$(sel); await e.scrollIntoViewIfNeeded(); const bb = await e.boundingBox(); if (touch) await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(120); if (sel.includes('nth')) await p.screenshot({ path: `${out}/plus-${w}.png` }); }
    console.log(w, 'after + + + fit', (await state(p)).vb, (await state(p)).h3);
    // back
    const bk = await p.$('.backbar .bk'); const kb = await bk.boundingBox(); if (touch) await p.touchscreen.tap(kb.x + 20, kb.y + 12); else await p.mouse.click(kb.x + 20, kb.y + 12); await p.waitForTimeout(500);
    console.log(w, 'back', await p.evaluate(() => [location.hash, !!document.querySelector('.tabs'), (document.querySelector('.prow.on b') || {}).textContent]));
    console.log(w, 'errors', errs); await ctx.close();
  }
  await b.close();
})();
