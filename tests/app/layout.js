/* Layout checks: 6 window sizes x 6 layouts, real mouse clicks. Every tile inside the hexagonal universe and off the stage,
   no zooming out past the whole board, no panning out of it, the choice remembered. node tests/app/layout.js <url> [shotdir] */
const { chromium } = require('playwright');
const URL = process.argv[2], out = process.argv[3] || ''; const fails = [];
function ok(c, m) { if (!c) fails.push(m); }
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[390, 844], [600, 900], [760, 1000], [1024, 768], [1280, 800], [1440, 900]]) {
    const pg = await b.newPage({ viewport: { width: w, height: h } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL); await pg.waitForTimeout(1200);
    const def = await pg.$eval('.lays .lb.on', e => e.dataset.lay); ok(def === (w <= 820 ? 'top' : 'left'), `${w}: default ${def}`);
    const lib = async (on) => { const b2 = await pg.$('#libbtn'); if (!b2 || !(await b2.isVisible())) return; const isOn = await pg.evaluate(() => document.getElementById('main').classList.contains('libon')); if (isOn === on) return; const r = await b2.boundingBox(); await pg.mouse.click(r.x + r.width / 2, r.y + r.height / 2); await pg.waitForTimeout(400); };
    for (const m of ['left', 'top', 'right', 'bottom', 'L', 'circle']) {
      await lib(true); const btn = await pg.$(`.lays .lb[data-lay="${m}"]`); await btn.scrollIntoViewIfNeeded(); const bb = await btn.boundingBox();
      ok(bb && bb.x >= 0 && bb.x + bb.width <= w + 1, `${w} ${m}: button off screen ${JSON.stringify(bb)}`);
      await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await pg.waitForTimeout(700);
      const on = await pg.$eval('.lays .lb.on', e => e.dataset.lay); ok(on === m, `${w} ${m}: active ${on}`);
      // every tile inside the universe, none overlapping the stage
      const geo = await pg.evaluate(() => { const t = [...document.querySelectorAll('#world .t, #world .gh')].map(e => { const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(e.getAttribute('transform')); return [+m[1], +m[2]]; });
        const up = document.querySelector('#unic polygon').getAttribute('points').split(' ').map(p => p.split(',').map(Number)); const fc = [...document.querySelectorAll('#world .fc')].map(e => { const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(e.parentNode.getAttribute('transform')); return [+m[1], +m[2]]; }); return { t, up, fc }; });
      const xs = geo.up.map(p => p[0]), ys = geo.up.map(p => p[1]); const ux = (Math.min(...xs) + Math.max(...xs)) / 2, uy = (Math.min(...ys) + Math.max(...ys)) / 2, rho = (Math.max(...ys) - Math.min(...ys)) / 2;
      const outside = geo.t.filter(([x, y]) => { const ax = Math.abs(x - ux), ay = Math.abs(y - uy); return ax > rho * Math.sqrt(3) / 2 || ay + ax / Math.sqrt(3) > rho; }).length;
      ok(outside === 0, `${w} ${m}: ${outside} tiles outside universe`);
      const inStage = geo.t.filter(([x, y]) => geo.fc.some(([a, b]) => Math.hypot(a - x, b - y) < 160)).length;   /* no tile on or touching a stage cell */
      const sizes = await pg.evaluate(() => [...new Set([...document.querySelectorAll('#world .fc, #world .t .hx, #world .cell')].map(e => { const b = e.getBBox(); return Math.round(b.height / 10); }))]);
      ok(sizes.every(v => Math.abs(v - sizes[0]) <= 2), `${w} ${m}: hexagons of different sizes ${sizes}`); ok(inStage === 0, `${w} ${m}: ${inStage} tiles on stage`);
      await lib(false); if (out && (w === 1440 || w === 390)) await pg.screenshot({ path: `${out}/${m}-${w}.png` });
    }
    // whole board, then try to zoom further out and pan away
    await lib(true); const wb = await pg.$('button[title="Whole board"]'); await wb.scrollIntoViewIfNeeded(); const wbb = await wb.boundingBox(); await pg.mouse.click(wbb.x + 10, wbb.y + 10); await pg.waitForTimeout(600);
    const z0 = await pg.evaluate(() => document.getElementById('world').getAttribute('transform'));
    await lib(false); await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(100); const bd = await (await pg.$("#board")).boundingBox();
    await pg.mouse.move(bd.x + 12, bd.y + 12); for (let i = 0; i < 5; i++) { await pg.mouse.wheel(0, 400); await pg.waitForTimeout(50); }
    const z1 = await pg.evaluate(() => document.getElementById('world').getAttribute('transform'));
    const sc = t => +/scale\(([\d.e-]+)\)/.exec(t)[1]; ok(sc(z1) >= sc(z0) - 1e-6, `${w}: zoomed past whole board ${sc(z0)} -> ${sc(z1)}`);
    for (const [dx, dy] of [[1, 1], [1, 1], [1, 1], [-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1]]) { await pg.mouse.move(bd.x + bd.width * .5, bd.y + bd.height * .5); await pg.mouse.down(); await pg.mouse.move(bd.x + bd.width * (.5 + dx * .45), bd.y + bd.height * (.5 + dy * .45), { steps: 6 }); await pg.mouse.up();
      const c = await pg.evaluate(() => { const t = document.getElementById('world').getAttribute('transform'), m = /translate\(([-\d.e]+) ([-\d.e]+)\) scale\(([\d.e-]+)\)/.exec(t), r = document.getElementById('board').getBoundingClientRect(), z = +m[3];
        const wx = (r.width / 2 - m[1]) / z, wy = (r.height / 2 - m[2]) / z, up = document.querySelector('#unic polygon').getAttribute('points').split(' ').map(p => p.split(',').map(Number)); const xs = up.map(p => p[0]), ys = up.map(p => p[1]);
        return wx >= Math.min(...xs) - 1 && wx <= Math.max(...xs) + 1 && wy >= Math.min(...ys) - 1 && wy <= Math.max(...ys) + 1; });
      ok(c, `${w}: panned outside universe (${dx},${dy})`); }
    if (out && w === 1440) await pg.screenshot({ path: `${out}/whole-pan-${w}.png` });
    // reload keeps layout
    await pg.reload(); await pg.waitForTimeout(1000); const kept = await pg.$eval('.lays .lb.on', e => e.dataset.lay); ok(kept === 'circle', `${w}: layout not remembered (${kept})`);
    ok(!errs.length, `${w}: errors ${errs}`);
    await pg.close();
  }
  await b.close(); console.log(fails.length ? fails.join('\n') : 'layout: ALL OK'); process.exit(fails.length ? 1 : 0);
})();
