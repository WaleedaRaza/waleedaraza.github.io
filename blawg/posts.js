/* ═══════════════════════════════════════════════════════════════════════
   BLAWG POSTS  (served at /blawg)
   ───────────────────────────────────────────────────────────────────────
   Every post lives here. blawg/index.html reads this list; no build step,
   no fetch (works from file:// and on locked-down browsers).

   To add a post, copy an entry and edit it:
     slug       plain lowercase-with-dashes, used in the URL: /blawg/#slug
     title      shown as written (stays public, even on locked posts)
     date       YYYY-MM-DD
     tag        category shown on the card and used by the filter row
     status     'soon' = on the board, not written (no page yet)
                'draft' = has a page, marked DRAFT
                'published' = shows the date
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
    tag: 'Intro',
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
    tag: 'Life',
    date: '2026-11-15',
    status: 'draft',
    summary: 'Placeholder.',
    body: '<p class="placeholder-note">Placeholder. Not written yet.</p>'
  },
  {
    slug: 'nqb8-patronage',
    title: 'NQB8 Patronage',
    tag: 'Case Study',
    date: '2026-11-15',
    status: 'draft',
    summary: 'Placeholder.',
    body: '<p class="placeholder-note">Placeholder. Not written yet.</p>'
  },

  /* ── On the board: titles from the ideas list, not written yet ── */
  { slug: "the-jensen-nvidia-affair-the-stock-and-who-benefits", title: "The Jensen/NVIDIA Affair: The Stock and Who Benefits", tag: "Markets & Money", status: 'soon' },
  { slug: "how-to-land-in-big-tech-and-negotiate-offers", title: "How to Land in Big Tech and Negotiate Offers", tag: "Craft & Career", status: 'soon' },
  { slug: "what-project-should-i-make", title: "What Project Should I Make?", tag: "Craft & Career", status: 'soon' },
  { slug: "how-do-i-find-my-passion-or-talent", title: "How Do I Find My Passion or Talent?", tag: "Life", status: 'soon' },
  { slug: "what-did-ai-do-to-coding-are-swes-cooked", title: "What Did AI Do to Coding? Are SWEs Cooked?", tag: "Tech & AI", status: 'soon' },
  { slug: "poker-philosophy", title: "Poker Philosophy", tag: "Mind", status: 'soon' },
  { slug: "miyamoto-musashi", title: "Miyamoto Musashi", tag: "Mind", status: 'soon' },
  { slug: "jon-jones", title: "Jon Jones", tag: "Culture", status: 'soon' },
  { slug: "the-ye-saga-start-to-end", title: "The Ye Saga, Start to End", tag: "Culture", status: 'soon' },
  { slug: "current-and-future-project-experiments", title: "Current and Future Project Experiments", tag: "Craft & Career", status: 'soon' },
  { slug: "what-id-make-if-you-gave-me-a-billion", title: "What I’d Make If You Gave Me a Billion", tag: "Craft & Career", status: 'soon' },
  { slug: "capitalist-realism-a-case-study", title: "Capitalist Realism — A Case Study", tag: "Mind", status: 'soon' },
  { slug: "darwinistic-capitalist-suffering-and-the-quarter-life-crisis", title: "Darwinistic Capitalist Suffering and the Quarter-Life Crisis", tag: "Life", status: 'soon' },
  { slug: "music-and-software-similarities", title: "Music and Software: Similarities", tag: "Craft & Career", status: 'soon' },
  { slug: "what-is-intelligence-blaise-ag-era-y-arcas", title: "What Is Intelligence? — Blaise Agüera y Arcas", tag: "Tech & AI", status: 'soon' },
  { slug: "the-creative-act-rick-rubin", title: "The Creative Act — Rick Rubin", tag: "Craft & Career", status: 'soon' },
  { slug: "stock-stories-elections-and-the-market", title: "Stock Stories: Elections and the Market", tag: "Markets & Money", status: 'soon' },
  { slug: "meaningful-vs-meaningless-startups", title: "Meaningful vs. Meaningless Startups", tag: "Tech & AI", status: 'soon' },
  { slug: "agents-agents-agents-llm-integration-within-society", title: "Agents, Agents, Agents: LLM Integration Within Society", tag: "Tech & AI", status: 'soon' },
  { slug: "sports-betting-prediction-markets-and-why-theyre-everywhere", title: "Sports Betting, Prediction Markets, and Why They’re Everywhere", tag: "Markets & Money", status: 'soon' },
  { slug: "corporate-extrapolation-enthusiasm-vs-cynicism", title: "Corporate Extrapolation: Enthusiasm vs. Cynicism", tag: "Life", status: 'soon' },
  { slug: "tools-and-companies-worth-existing", title: "Tools and Companies Worth Existing", tag: "Tech & AI", status: 'soon' },
  { slug: "the-psychology-of-the-shark-tank-sharks", title: "The Psychology of the Shark Tank Sharks", tag: "Markets & Money", status: 'soon' },
  { slug: "why-does-kanye-always-come-back", title: "Why Does Kanye Always Come Back?", tag: "Culture", status: 'soon' },
  { slug: "fashion-sense", title: "Fashion Sense", tag: "Culture", status: 'soon' },
  { slug: "autonomous-drones", title: "Autonomous Drones", tag: "Tech & AI", status: 'soon' },
  { slug: "weaponry-and-gaming", title: "Weaponry and Gaming", tag: "Tech & AI", status: 'soon' },
  { slug: "what-is-true-innovation", title: "What Is True Innovation?", tag: "Tech & AI", status: 'soon' },
  { slug: "an-exploration-of-the-phenomenon-of-religion", title: "An Exploration of the Phenomenon of Religion", tag: "Mind", status: 'soon' },
  { slug: "camus-a-case-study", title: "Camus — A Case Study", tag: "Mind", status: 'soon' },
  { slug: "on-the-genealogy-of-morals-exploration-and-reflection", title: "On the Genealogy of Morals — Exploration and Reflection", tag: "Mind", status: 'soon' },
  { slug: "warb-a-case-study", title: "Warb — A Case Study", tag: "Case Study", status: 'soon' },
  { slug: "libxndr-a-case-study", title: "Libxndr — A Case Study", tag: "Case Study", status: 'soon' },
  { slug: "pokeraio-a-case-study", title: "PokerAIO — A Case Study", tag: "Case Study", status: 'soon' },
  { slug: "2027-calendar", title: "2027 Calendar", tag: "Life", status: 'soon' },
  { slug: "pc-building", title: "PC Building", tag: "Hardware", status: 'soon' },
  { slug: "computer-components-market-lore-and-pricing", title: "Computer Components: Market Lore and Pricing", tag: "Hardware", status: 'soon' },
  { slug: "when-to-buy-a-pc-what-to-put-in-it-and-what-its-for", title: "When to Buy a PC, What to Put in It, and What It’s For", tag: "Hardware", status: 'soon' },
  { slug: "everything-you-need-to-know-about-using-and-renting-gpus", title: "Everything You Need to Know About Using and Renting GPUs", tag: "Hardware", status: 'soon' },
  { slug: "do-not-seek-outside-that-which-can-only-be-found-within", title: "Do Not Seek Outside That Which Can Only Be Found Within", tag: "Mind", status: 'soon' },
  { slug: "8-billion-100-billion-your-place-in-the-world-and-the-shared-subconscious", title: "8 Billion / 100 Billion: Your Place in the World and the Shared Subconscious", tag: "Mind", status: 'soon' },
  { slug: "jung-a-deep-dive", title: "Jung — A Deep Dive", tag: "Mind", status: 'soon' },
  { slug: "pavel-durov-a-deep-dive", title: "Pavel Durov — A Deep Dive", tag: "Culture", status: 'soon' },
  { slug: "lessons-from-mentors", title: "Lessons from Mentors", tag: "Craft & Career", status: 'soon' },
  { slug: "lessons-from-mentoring", title: "Lessons from Mentoring", tag: "Craft & Career", status: 'soon' },
  { slug: "how-to-be-a-good-vibe-coder", title: "How to Be a Good Vibe Coder", tag: "Tech & AI", status: 'soon' },
  { slug: "swiss-army-knife", title: "Swiss Army Knife", tag: "Life", status: 'soon' },
  { slug: "the-polymath-hypothesis-people-who-can-be-talented-at-anything", title: "The Polymath Hypothesis: People Who Can Be Talented at Anything", tag: "Mind", status: 'soon' },
  { slug: "is-mental-illness-a-real-thing", title: "Is Mental Illness a Real Thing?", tag: "Mind", status: 'soon' },
  { slug: "competence-is-the-father-of-formidability", title: "Competence Is the Father of Formidability", tag: "Life", status: 'soon' },
  { slug: "my-approach-to-money", title: "My Approach to Money", tag: "Markets & Money", status: 'soon' },
  { slug: "iq-and-eq-what-do-both-get-you", title: "IQ and EQ: What Do Both Get You?", tag: "Mind", status: 'soon' },
  { slug: "places-you-dont-see-darwinism", title: "Places You Don’t See Darwinism", tag: "Mind", status: 'soon' },
  { slug: "if-youre-evil-youre-at-least-competent-a-reaction", title: "“If You’re Evil, You’re at Least Competent” — A Reaction", tag: "Mind", status: 'soon' },
  { slug: "different-types-of-talented-people", title: "Different Types of Talented People", tag: "Life", status: 'soon' },
  { slug: "do-you-have-free-will", title: "Do You Have Free Will?", tag: "Mind", status: 'soon' },
  { slug: "are-we-in-a-simulation", title: "Are We in a Simulation?", tag: "Mind", status: 'soon' },
  { slug: "social-construct-tier-list", title: "Social Construct Tier List", tag: "Culture", status: 'soon' },
  { slug: "think-about-the-tool-until-you-think-through-it", title: "Think About the Tool Until You Think Through It", tag: "Craft & Career", status: 'soon' },
  { slug: "whats-cool-about-being-alive-in-2026", title: "What’s Cool About Being Alive in 2026?", tag: "Life", status: 'soon' },
  { slug: "information-age-and-knowledgemaxing", title: "Information Age and Knowledgemaxing", tag: "Life", status: 'soon' },
  { slug: "steve-jobs-on-just-doing", title: "Steve Jobs on Just Doing", tag: "Craft & Career", status: 'soon' },
  { slug: "techno-music-exploration", title: "Techno Music Exploration", tag: "Culture", status: 'soon' },
  { slug: "math-to-coding-to-machine-learning-or-agentic-product-development", title: "Math → Coding → Machine Learning or Agentic Product Development", tag: "Tech & AI", status: 'soon' },
  { slug: "my-two-splits-of-software", title: "My Two Splits of Software", tag: "Tech & AI", status: 'soon' },
  { slug: "wtf-do-you-do-at-work", title: "WTF Do You Do at Work?", tag: "Craft & Career", status: 'soon' },
  { slug: "true-work-is-play", title: "True Work Is Play", tag: "Life", status: 'soon' },
  { slug: "the-4d-self", title: "The 4D Self", tag: "Mind", status: 'soon' },
  { slug: "ambient-and-decisive-moments", title: "Ambient and Decisive Moments", tag: "Life", status: 'soon' },
  { slug: "we-will-live-forever-we-will-not-feel-forever", title: "We Will Live Forever. We Will Not Feel Forever.", tag: "Mind", status: 'soon' },
];
