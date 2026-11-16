/* ═══════════════════════════════════════════════════════════════════════
   ASCII CATALOG: every finished piece, and how to load it
   ───────────────────────────────────────────────────────────────────────
   Used by the blog (tree arrows, essay art, gallery) and the studio.
     AsciiCatalog.list            [{ key, title, note }] in showing order
     AsciiCatalog.get(key)        one entry
     AsciiCatalog.mount(key, base) -> Promise of { el, scene }
                                  base = path to assets/ascii/ ('../assets/ascii/')
   A key is '<Module>.<name>', e.g. 'LabBatch.train'. Scripts load on first use.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var V1 = ['ascii-field.js', 'lab-scenes.js'];
  var MOD = {
    Tree:           ['pre',    ['ascii-field.js', 'fallen-tree.js', 'fallen-oak.js']],
    LabScenes:      ['pre',    ['ascii-field.js', 'paths-luma.js', 'lab-scenes.js']],
    LabHeaders:     ['pre',    V1.concat('lab-headers.js')],
    LabObjects:     ['pre',    V1.concat('lab-objects.js')],
    LabBackgrounds: ['pre',    V1.concat('lab-backgrounds.js')],
    LabV2:          ['canvas', ['ascii-field.js', 'ascii-canvas.js', 'lab-v2.js']],
    LabBatch:       ['canvas', ['ascii-field.js', 'ascii-canvas.js', 'lab-v2-batch.js']]
  };
  /* [key, title, note] */
  var L = [
    ['Tree.redwood', 'THE REDWOOD', 'the tree that falls'],
    ['LabV2.gargantua', 'GARGANTUA', 'the disc and its bent far side'],
    ['LabV2.dragons', 'WARMPOP', 'two dragons circling a fire'],
    ['LabBatch.train', 'THE TRAIN', 'flooded tracks at dusk'],
    ['LabBatch.corridor', 'THE CORRIDOR', 'one panel flickering'],
    ['LabBatch.gpu', 'GPU', 'three fans and a light strip'],
    ['LabHeaders.sisyphus', 'SISYPHUS', 'the stone, the hill, the walk down'],
    ['LabBatch.paleDot', 'PALE BLUE DOT', 'one pixel in the sunbeams'],
    ['LabBackgrounds.orangeRoom', 'THE ORANGE ROOM', 'light at the end of the hall'],
    ['LabBatch.currents', 'THE CURRENT', 'one point leans its own way'],
    ['LabObjects.nighthawk', 'F-117', 'a glint across the plates'],
    ['LabBatch.dunes', 'ARRAKIS', 'dunes under two moons'],
    ['LabV2.underwater', 'UNDER THE SURFACE', 'light folding into seams'],
    ['LabBackgrounds.neonGlass', 'THROUGH GLASS', 'city light and rain'],
    ['LabBatch.aurora', 'AURORA', 'curtains over a snow ridge'],
    ['LabHeaders.forever', 'FOREVER', 'the feeling goes, the record stays'],
    ['LabHeaders.rivers', 'RIVERS', 'one bet, sixteen rivers'],
    ['LabHeaders.simulation', 'FRAMES', 'frames inside frames'],
    ['LabBatch.warp', 'WARP', 'stars pulled into streaks'],
    ['LabBatch.eclipse', 'ECLIPSE', 'totality and its corona'],
    ['LabV2.helmet', 'HELMET', 'chrome, with a road in the visor'],
    ['LabBatch.roots', 'GENEALOGY', 'up and down at once'],
    ['LabBatch.ship', 'SHIP AT SEA', 'riding the moon path'],
    ['LabBatch.name', 'WALEED', 'the name, poured full of colour'],
    ['LabBatch.watch', 'WATCH', 'your time, right now'],
    ['LabBatch.circuit', 'CIRCUIT', 'signals leaving a chip'],
    ['LabHeaders.agents', 'AGENTS', 'teams that reshuffle themselves'],
    ['LabHeaders.bridge', 'THE BRIDGE', 'everything crosses here'],
    ['LabHeaders.market', 'THE MARKET', 'a price pulled toward the answer'],
    ['LabHeaders.sequencer', 'SEQUENCER', 'one pattern, read two ways'],
    ['LabBatch.equalizer', 'EQUALIZER', 'fifty bands'],
    ['LabBatch.scope', 'OSCILLOSCOPE', 'a phosphor trace'],
    ['LabBatch.rainbows', 'IN RAINBOWS', 'colour running down the page'],
    ['LabBatch.pyramid', 'PYRAMID', 'a stage of light'],
    ['LabBatch.smoke', 'SMOKE', 'one thread off an ember'],
    ['LabBatch.heart', 'HEART', 'beats, splits, closes'],
    ['LabObjects.heart808', '808s', 'a heart in two halves'],
    ['LabObjects.vinyl', 'VINYL', '33 and a third'],
    ['LabHeaders.warb', 'WARB', 'a returning note'],
    ['LabObjects.pokerChip', 'THE CHIP', 'a hand playing out'],
    ['LabObjects.enso', 'ENSO', 'one stroke'],
    ['LabBatch.yinyang', 'YIN YANG', 'turning, with a glow at the rim'],
    ['LabScenes.yinYang', 'YIN YANG, BREATHING', 'the first one'],
    ['LabScenes.paths', 'PATHS', 'a figure under a column of light'],
    ['LabBatch.life', 'LIFE', 'Conway, in two colours'],
    ['LabBatch.lorenz', 'LORENZ', 'two wings of chaos'],
    ['LabBatch.julia', 'JULIA SET', 'never settles'],
    ['LabBatch.dna', 'DNA', 'two strands'],
    ['LabBatch.bokeh', 'OUT OF FOCUS', 'city light, in Cocteau Twins colours'],
    ['LabBackgrounds.ridgeline', 'RED WEATHER', 'a ridge under snow'],
    ['LabBackgrounds.dunes', 'DUNES', 'something under the near dune'],
    ['LabBatch.galaxy', 'GALAXY', 'two arms turning'],
    ['LabBatch.clouds', 'ABOVE THE CLOUDS', 'one bird'],
    ['LabBatch.tunnel', 'TUNNEL', 'a flythrough'],
    ['LabBatch.rings', 'RINGS', 'a sound leaving a point'],
    ['LabBatch.lava', 'LAVA', 'two fluids finding each other'],
    ['LabBatch.donut', 'DONUT', 'the terminal classic, lit'],
    ['LabHeaders.current', 'AGAINST THE CURRENT', 'leaning, then rejoining'],
    ['LabHeaders.cutscene', 'THE CUTSCENE', 'try skipping it'],
    ['LabHeaders.helmet', 'HELMET, FIRST CUT', 'the road in the visor'],
    ['LabObjects.lightning', 'LIGHTNING', 'five strikes to full'],
    ['LabObjects.paperBoat', 'PAPER BOAT', 'early HTML, folded'],
    ['LabObjects.elevenSum', '1 + 1 = 11', 'the plus goes, the ones meet'],
    ['LabScenes.luckyBlock', 'LUCKY BLOCK', 'spins until someone opens it'],
    ['LabV2.ball', 'SEVEN STARS', 'glass, lit from behind'],
    ['LabObjects.dragonBall', 'SEVEN STARS, FIRST CUT', 'glass-orange, floating'],
    ['LabBackgrounds.underwater', 'UNDERWATER', 'light in sheets'],
    ['LabScenes.dragons', 'DRAGONS', 'the first pair'],
    ['Tree.oak', 'THE OAK', 'the first tree']
  ];
  var list = L.map(function (r) { return { key: r[0], title: r[1], note: r[2] }; });
  var byKey = {};
  list.forEach(function (e) { byKey[e.key] = e; });

  var loaded = {};
  function script(src) {
    return loaded[src] || (loaded[src] = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = function () { delete loaded[src]; fail(new Error('load ' + src)); };
      document.head.appendChild(s);
    }));
  }
  function maker(mod, name) {
    if (mod === 'Tree') {
      var T = name === 'oak' ? global.FallenOak : global.FallenTree;
      return T && function (el) {
        var s = T.mount(el, {});
        return { toggle: function () { s.replay(); return false; }, replay: s.replay };
      };
    }
    return global[mod] && global[mod][name];
  }
  function mount(key, base) {
    var parts = String(key).split('.'), m = MOD[parts[0]];
    if (!m || !byKey[key]) return Promise.reject(new Error('unknown piece ' + key));
    return m[1].reduce(function (p, f) {
      return p.then(function () {
        // skip files the page already loaded with its own <script> tags
        var have = Array.prototype.some.call(document.scripts, function (s) { return s.src && s.src.split('?')[0].slice(-f.length - 1) === '/' + f; });
        return have ? null : script(base + f);
      });
    }, Promise.resolve()).then(function () {
      var make = maker(parts[0], parts[1]);
      if (!make) throw new Error('missing ' + key);
      var el = document.createElement(m[0]);
      el.setAttribute('aria-hidden', 'true');
      return { el: el, start: function () { return make(el); } };
    });
  }
  global.AsciiCatalog = { list: list, get: function (k) { return byKey[k]; }, mount: mount };
})(window);
