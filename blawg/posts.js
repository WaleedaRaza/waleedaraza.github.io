/* ═══════════════════════════════════════════════════════════════════════
   BLAWG POSTS  (served at /blawg)
   ───────────────────────────────────────────────────────────────────────
   Every post lives here. blawg/index.html reads this list; no build step,
   no fetch (works from file:// and on locked-down browsers).

   To add a post, copy an entry and edit it:
     slug       plain lowercase-with-dashes, used in the URL: /blawg/#slug
     title      shown as written (stays public, even on locked posts)
     date       YYYY-MM-DD
     status     'draft' shows a DRAFT tag; 'published' shows the date
     summary    one or two lines for the list (public)
     body       HTML. Paragraphs in <p>, headings <h2>, quotes <blockquote>.

   PASSWORD-PROTECTED POST: don't write a `body`. Open
   blawg/_tools/encrypt.html on your computer (double-click it), paste the
   essay and a password, and paste the `encrypted: {...}` line it gives you
   in place of `body`. Only the scrambled text goes in this file; keep the
   plain essay out of the repo.

   Unpublished ideas: blawg/_drafts/ideas.md. GitHub Pages does not serve
   folders that start with "_", but the repository itself is public.
   ═══════════════════════════════════════════════════════════════════════ */
window.BLOG_POSTS = [
  {
    slug: 'a-tree-falls-in-the-forest',
    title: 'A Tree Falls in the Forest',
    date: '2026-11-15',
    status: 'draft',
    summary: 'The introduction. Why this blog exists, and whether writing makes a sound if no one reads it.',
    body:
      '<p class="placeholder-note">Placeholder. The intro goes here.</p>' +
      '<blockquote>If a tree falls in a forest and no one is around to hear it, does it make a sound?</blockquote>'
  },
  {
    slug: 'my-way-here-and-forward',
    title: 'My Way: Here and Forward',
    date: '2026-11-15',
    status: 'draft',
    summary: 'Placeholder.',
    body: '<p class="placeholder-note">Placeholder. Not written yet.</p>'
  },
  {
    slug: 'nqb8-patronage',
    title: 'NQB8 Patronage',
    date: '2026-11-15',
    status: 'draft',
    summary: 'Placeholder.',
    body: '<p class="placeholder-note">Placeholder. Not written yet.</p>'
  }
];
