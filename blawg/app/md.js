/* A small, safe Markdown renderer for blawg bodies: headings, paragraphs, bold, italic, code, links, images, quotes, lists, rules.
   Everything is escaped first; only these constructs become HTML. Links and images accept http(s), relative and # targets only. */
(function () {
  'use strict';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function safeUrl(u) { u = String(u).trim(); return /^(https?:\/\/|\/|\.\.?\/|#|[a-z0-9_-]+(\/|\.))/i.test(u) && !/^javascript:/i.test(u) ? u : '#'; }
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, a, u) { return '<img alt="' + a + '" src="' + esc(safeUrl(u.replace(/&amp;/g, '&'))) + '" loading="lazy">'; });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, a, u) { var x = safeUrl(u.replace(/&amp;/g, '&')); return '<a href="' + esc(x) + '"' + (/^https?:/.test(x) ? ' target="_blank" rel="noopener"' : '') + '>' + a + '</a>'; });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, '$1<em>$2</em>');
    return s;
  }
  function render(md) {
    var lines = String(md || '').replace(/\r\n?/g, '\n').split('\n'), out = [], para = [], list = null, quote = [];
    function flushP() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    function flushL() { if (list) { out.push('<' + list.t + '>' + list.items.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</' + list.t + '>'); list = null; } }
    function flushQ() { if (quote.length) { out.push('<blockquote>' + render(quote.join('\n')) + '</blockquote>'); quote = []; } }
    lines.forEach(function (l) {
      var m;
      if (/^>\s?/.test(l)) { flushP(); flushL(); quote.push(l.replace(/^>\s?/, '')); return; } else flushQ();
      if (!l.trim()) { flushP(); flushL(); return; }
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { flushP(); flushL(); var n = Math.min(4, m[1].length + 1); out.push('<h' + n + '>' + inline(m[2]) + '</h' + n + '>'); return; }
      if (/^(\*\s*\*\s*\*|-{3,})\s*$/.test(l)) { flushP(); flushL(); out.push('<hr>'); return; }
      if ((m = l.match(/^\s*([-*]|\d+\.)\s+(.*)$/))) { flushP(); var t = /\d/.test(m[1]) ? 'ol' : 'ul'; if (!list || list.t !== t) { flushL(); list = { t: t, items: [] }; } list.items.push(m[2]); return; }
      flushL(); para.push(l.trim());
    });
    flushP(); flushL(); flushQ();
    return out.join('\n');
  }
  window.BlawgMD = { render: render, inline: inline };
})();
