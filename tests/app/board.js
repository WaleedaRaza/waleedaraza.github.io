// Blawg board checks. Usage: node tests/app/board.js [baseUrl] [shotDir]
// Serves nothing itself: run tests/app/run.sh, which starts a static server on the repo root.
// Covers: 6 widths x 3 zooms, the click path (piece > See links > pick > two-essay view > read > swap > back > list),
// the line tooltip following the pointer, the dock (wide) and the library (phone), and frame timing / long tasks while idle.
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8770/blawg/';
const shots = process.argv[3] || '';
const SIZES = [[390, 844], [600, 900], [760, 1000], [1024, 768], [1280, 800], [1440, 900]];
const realClick = async (p, sel, dy) => { const c = await p.evaluate(([s, dy]) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, dy ? r.y + dy : r.y + r.height / 2]; }, [sel, dy || 0]); if (!c) return false; await p.mouse.click(c[0], c[1]); return true; };
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
(async () => {
  const b = await chromium.launch();
  for (const [W, H] of SIZES) {
    console.log(`== ${W}x${H}`);
    const p = await b.newPage({ viewport: { width: W, height: H } });
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('requestfailed', r => errs.push('request failed ' + r.url()));
    await p.goto(base); await p.waitForFunction(() => document.querySelectorAll('.t').length > 0, null, { timeout: 15000 }); await p.waitForTimeout(1500);
    const shot = async n => { if (shots) await p.screenshot({ path: `${shots}/${W}-${n}.png` }); };
    const btn = t => p.evaluate(t => document.querySelector(`.ib[title="${t}"]`)?.click(), t);
    const hash = () => p.evaluate(() => location.hash);
    const nPieces = await p.evaluate(() => document.querySelectorAll('.t').length);
    ok(nPieces > 0, `board shows ${nPieces} pieces`);
    for (const [name, steps] of [['whole', [['Whole board']]], ['stage', [['Centre stage']]], ['in', [['Centre stage'], ['Zoom in'], ['Zoom in']]]]) {
      for (const [t] of steps) await btn(t); await p.waitForTimeout(900); await shot('z-' + name);
      const vis = await p.evaluate(() => { const g = document.querySelector('.cvg.real'); if (!g) return false; const cs = getComputedStyle(g.querySelector('.cv')); return cs.display !== 'none' && +cs.opacity > 0.3; });
      ok(vis, `real link line visible at rest (${name})`);
    }
    await btn('Centre stage'); await p.waitForTimeout(700);
    const linked = await p.evaluate(() => { const ids = new Set(); document.querySelectorAll('.cvg.real').forEach(g => ids.add(g.getAttribute('data-b'))); return ids.size; });
    if (linked) {
      // open the first end of the first real link
      await p.evaluate(() => { const L = [...document.querySelectorAll('.t')].find(x => /Libxndr/.test(x.getAttribute('aria-label'))) || document.querySelector('.t'); L.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      await p.waitForTimeout(1200); await shot('p1-piece');
      ok(/^#p=/.test(await hash()), 'piece opens: ' + await hash());
      ok(await p.evaluate(() => document.querySelectorAll('.fc.slk').length) >= 4, 'one merged See links tile (4-5 hexes)');
      ok(/SEE LINKS/.test(await p.evaluate(() => [...document.querySelectorAll('.slk .slt')].map(t => t.textContent).join(' '))), 'tile reads SEE LINKS');
      await realClick(p, '.fc.slk'); await p.waitForTimeout(1200); await shot('p2-links');
      ok(/&l=1/.test(await hash()) && await p.evaluate(() => document.querySelectorAll('#textbox .lrow').length) > 0, 'link list opens');
      await realClick(p, '#textbox .lrow', 12); await p.waitForTimeout(1200); await shot('p3-pair');
      ok(/^#c=/.test(await hash()) && await p.evaluate(() => document.querySelectorAll('#textbox .pc').length) === 2, 'two-essay view');
      await p.evaluate(() => document.querySelectorAll('#textbox .pc')[1].click()); await p.waitForTimeout(1200);
      ok(/via=/.test(await hash()), 'read the other piece from the link: ' + await hash());
      const before = await hash(); await p.keyboard.press('x'); await p.waitForTimeout(1200);
      ok((await hash()) !== before && /via=/.test(await hash()), 'x swaps ends');
      await p.evaluate(() => [...document.querySelectorAll('#textbox .via button')].find(b => /Back to the connection/.test(b.textContent))?.click()); await p.waitForTimeout(1200);
      ok(/^#c=/.test(await hash()), 'back to the connection');
      await p.evaluate(() => document.querySelector('#textbox .via .bkl')?.click()); await p.waitForTimeout(1200);
      ok(/&l=1/.test(await hash()), 'back to the link list');
      await p.keyboard.press('Escape'); await p.waitForTimeout(800);
      ok((await hash()) === '', 'Esc clears');
      // hover a line: the tooltip follows the pointer
      await btn('Whole board'); await p.waitForTimeout(900);
      const pts = await p.evaluate(() => { const path = document.querySelector('.cvg.real .cv'), L = path.getTotalLength(), m = path.getScreenCTM(); return [0.35, 0.65].map(f => { const q = path.getPointAtLength(L * f), s = new DOMPoint(q.x, q.y).matrixTransform(m); return [s.x, s.y]; }); });
      const tips = []; for (const [x, y] of pts) { await p.mouse.move(x, y, { steps: 3 }); await p.waitForTimeout(200); tips.push(await p.evaluate(() => { const t = document.getElementById('tip'); return t.hidden ? null : [t.getBoundingClientRect().left, t.getBoundingClientRect().top, t.textContent]; })); }
      console.log('    tips', JSON.stringify(tips)); ok(tips[0] && tips[1] && /Connection/.test(tips[0][2]) && (tips[0][0] !== tips[1][0] || tips[0][1] !== tips[1][1]), 'line tooltip follows the pointer');
      await p.mouse.move(2, 2);
    }
    // a piece with no links shows no tile
    await p.evaluate(() => { const linkedIdx = new Set(); document.querySelectorAll('.t.linked').forEach(t => linkedIdx.add(t)); const t = [...document.querySelectorAll('.t')].find(x => !linkedIdx.has(x)); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => document.querySelectorAll('.fc.slk').length) === 0, 'no See links tile on a piece without links');
    await p.keyboard.press('Escape'); await p.waitForTimeout(600);
    if (W > 820) {
      await p.evaluate(() => document.querySelector('#sbody .hs')?.click()); await p.waitForTimeout(600);
      const bt = await p.$('#dock .hexes button:nth-child(3)'); if (bt) { await bt.hover(); await p.waitForTimeout(400); }
      ok(await p.evaluate(() => document.querySelector('#dockpop')?.classList.contains('on')), 'dock opens a group on hover');
      const pop = await p.$('#dockpop'); const bb = await pop.boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height - 5, { steps: 8 }); await p.waitForTimeout(400);
      ok(await p.evaluate(() => document.querySelector('#dockpop').classList.contains('on')), 'dock stays open moving into it');
      await p.mouse.move(5, 200, { steps: 4 }); await p.waitForTimeout(600);
      ok(!(await p.evaluate(() => document.querySelector('#dockpop').classList.contains('on'))), 'dock closes on leave');
      await p.evaluate(() => document.querySelector('#dock .hs')?.click()); await p.waitForTimeout(500);
    } else {
      const lb = await (await p.$('#libbtn')).boundingBox(); ok(lb && lb.x + lb.width <= W && lb.y + lb.height <= H, 'phone library button in the corner, on screen');
      await p.mouse.click(lb.x + lb.width / 2, lb.y + lb.height / 2); await p.waitForTimeout(450); await shot('lib');
      const sb = await (await p.$('#side')).boundingBox(); ok(sb && sb.x >= 0 && sb.x < W - 100, 'library slides out');
      const row = (await p.$$('#side .tr'))[2]; const rb = await row.boundingBox(); await p.mouse.click(rb.x + 40, rb.y + rb.height / 2); await p.waitForTimeout(500);
      ok(await p.evaluate(() => !document.getElementById('main').classList.contains('libon')), 'picking a row closes the library');
      ok(await p.evaluate(() => /#p=/.test(location.hash)), 'picking a row opens the piece');
      ok(await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2), 'phone page does not scroll');
      await p.waitForTimeout(2500);   /* let the stage sweep and art crossfade from that pick finish before measuring idle */
    }
    // idle: frame gaps and long tasks over 3 s
    const perf = await p.evaluate(() => new Promise(res => { const lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => lt.push(Math.round(e.duration)))).observe({ type: 'longtask' }); } catch (e) {}
      const gaps = []; let last = performance.now(), t0 = last; (function f(now) { gaps.push(now - last); last = now; if (now - t0 < 3000) requestAnimationFrame(f); else res({ frames: gaps.length, worst: Math.round(Math.max(...gaps.slice(2))), over25: gaps.filter(g => g > 25).length, longtasks: lt }); })(performance.now()); }));
    ok(perf.longtasks.length === 0, 'no long tasks while idle ' + JSON.stringify(perf));
    ok(perf.over25 <= 2, 'idle frames hold (<=2 slow frames in 3 s)');
    ok(errs.length === 0, 'no page errors ' + (errs.length ? JSON.stringify(errs.slice(0, 3)) : ''));
    await p.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
})();
