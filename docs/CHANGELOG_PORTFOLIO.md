# WaleedOS Portfolio Changelog

All notable changes to the portfolio site and product catalog.

---

## [1.0.0] — 2025-12-20

### 🎉 Major Release: Product Graph Portfolio

Complete rebuild of the portfolio as an interactive product graph with 19 products.

### Added

#### Data Layer
- **`data/products.json`** — Canonical product catalog with 19 products
  - Full metadata: status, category, focus weight, monetization, timeline
  - Product narratives: problem, solution, UVP, MVP, roadmap
  - Proof links: repos, demos, docs
  - Connection graph: tech, audience, and timeline relationships
  
- **`data/needs_info.json`** — Tracker for missing product information
  - 1 high-priority blocker (DataDepth)
  - 3 medium blockers
  - 6 low blockers

#### Frontend
- **D3.js Force-Directed Bubble Graph**
  - 19 nodes sized by focus weight (1-10)
  - Color-coded by category (Moonshot, Platform, Utility, Tooling, Research)
  - Interactive connections showing product relationships
  - Drag-and-drop node positioning
  
- **Search and Filters**
  - Real-time text search across product names and taglines
  - Category filter dropdown
  - Status filter dropdown
  - Focus weight slider (hide low-priority products)
  
- **Artifact Panel**
  - Slide-in panel with full product details
  - Problem → Solution → UVP flow
  - MVP progress checklist
  - Proof links and metadata
  - Link to dedicated product page
  
- **Mobile Fallback**
  - Card list view for screens < 768px
  - All filtering still works
  - Touch-friendly interactions

- **Proof Ledger**
  - Activity timeline showing recent work
  - Links to GitHub commits

- **19 Product Pages** (`products/*.html`)
  - Individual landing page for each product
  - Full product narrative
  - Progress tracking
  - Tech stack display

#### Scripts
- **`scripts/generate_product_pages.js`**
  - Reads products.json
  - Generates HTML pages for each product
  - Consistent styling with tokens.css
  
- **`scripts/sync_products_from_github.js`**
  - Fetches repo metadata from GitHub API
  - Identifies unmapped repos
  - Updates tech stack information

#### Documentation
- **`docs/PRODUCT_INDEX.md`** — Full product catalog in markdown
- **`docs/CHANGELOG_PORTFOLIO.md`** — This file
- **`docs/DESIGN_SPEC.md`** — Complete design specification

### Changed

- **Hero Section**
  - Simplified tagline: "Building real-time, data-intensive consumer products."
  - Added product count context
  
- **Navigation**
  - Reduced to 4 items: Products, Proof, About, Contact
  - Floating glass pill design
  
- **Typography**
  - Switched from Inter to IBM Plex Mono + IBM Plex Sans
  - More distinctive, less "generic AI"
  
- **Color System**
  - Category-based color coding for products
  - Consistent status colors (shipping=green, in-dev=amber, prototype=purple)

### Removed

- Old static 5-node SVG tree
- Bootstrap and vendor libraries
- Verbose tech stack lists per product
- Testimonials section (no testimonials yet)
- Services section (not applicable)

### Technical Details

- **No build step required** — vanilla HTML/CSS/JS
- **D3.js v7** for graph visualization
- **CSS custom properties** via tokens.css
- **Zero server dependencies** — GitHub Pages ready
- **Mobile-first responsive design**

### Product Catalog Summary

| Category | Count | Key Products |
|----------|-------|--------------|
| Moonshot | 1 | PokerGeek |
| Platform | 7 | Alexandria Vault, Lifeline OS, DataDepth, Petform, StockScouter, NewsNet, MMAmania |
| Utility | 1 | ClipVault |
| Tooling | 5 | AgentYeager, GPUZap, TerminalTool, Portfolio, Landing |
| Research | 3 | WARVIS, HandCuts, PetAI (archived) |
| Archived | 2 | Stock Surveyor, HackFax |

### Known Issues

- GitHub API rate limits may block sync script without token
- Some products need repo creation (Alexandria Vault, ClipVault)
- Demo links pending for most products

### Migration Notes

The old portfolio (`index.html` pre-2025-12-20) is not backed up in this repo. The new version is a complete replacement, not an incremental update.

---

## [0.x] — Pre-2025

Legacy portfolio versions. See git history for details.

- Bootstrap-based design
- Static project cards
- Single-page layout without product graph

---

## Upcoming

### [1.1.0] — Planned
- [ ] Inner Mode (deeper content toggle)
- [ ] Blog/writing section
- [ ] GitHub Actions for auto-sync
- [ ] Demo videos embedded in product pages

### [1.2.0] — Planned
- [ ] Product page SEO optimization
- [ ] RSS feed for updates
- [ ] Email waitlist integration
- [ ] Analytics dashboard

---

*Maintained as part of WaleedOS portfolio infrastructure.*



