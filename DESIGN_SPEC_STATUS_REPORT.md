# Portfolio Site - Design Spec Status Report

## 📊 DATA (Content That Must Be Preserved)

### 1. Hero Section
- **Name:** Waleed Raza
- **Tagline:** "I build real-time, data-intensive consumer products."
- **Subheadline:** "Currently shipping PokerGeek (provably fair poker + analytics) and building Alexandria Vault (personal PDF library)."
- **CTAs:** "See Products" button, "Contact" button

### 2. Products Section (5 Products)

#### Product 1: PokerGeek
- **Name:** PokerGeek
- **Tagline:** Chess.com for poker: play + improve + prove fairness
- **Problem:** Online poker feels untrustworthy. Players can't verify fairness, training tools are disconnected from real play.
- **Solution:** Provably fair poker + analytics-native progression. Every hand becomes data for improvement.
- **Status:** In Dev - Escape velocity product
- **What it does:**
  - Play real-time poker with friends in private rooms
  - Every hand becomes data for improvement
  - Prove game fairness with cryptographic proofs
  - Track progress with analytics and rankings
- **MVP Status:**
  - ✅ Real-time multiplayer Texas Hold'em tables
  - ✅ Private rooms with invite links
  - ✅ Hand history logging
  - ✅ Provably fair shuffling
  - 🔄 Analytics dashboard (in progress)
  - 🔄 Rankings and achievements (in progress)
- **Links:** View Product (pokerswound.html), GitHub (https://github.com/WaleedaRaza/pokerswound)

#### Product 2: Alexandria Vault
- **Name:** Alexandria Vault
- **Tagline:** Personal PDF library + open-access discovery
- **Problem:** PDFs are chaos. People have files scattered, can't search them, lose track of what they own.
- **Solution:** Turn your PDF collection (starting with 1400+ books) into a searchable, organized knowledge vault.
- **Status:** In Dev - Wow factor product
- **What it does:**
  - Upload and organize your PDF collection
  - Full-text search across your entire library
  - Discover open-access and public domain PDFs
  - Auto-extract metadata (title, author, covers)
  - Build collections and share references
- **Coming Soon:**
  - Local PDF library import/upload
  - Auto metadata extraction
  - Full-text search
  - PDF discovery search (open-access only)
- **Links:** Coming Soon (disabled), GitHub (https://github.com/WaleedaRaza/alexandria-vault)

#### Product 3: ClipVault
- **Name:** ClipVault
- **Tagline:** Save videos into a searchable library
- **Problem:** Saving videos is messy. Links die, bookmarks are unusable, quality options are confusing.
- **Solution:** Paste link → organized download with transcripts. Turn your collection into a searchable knowledge base.
- **Status:** Shipping - Ad trap utility
- **What it does:**
  - Paste TikTok/Reels/YouTube link → instant download
  - Auto-generate transcripts and summaries
  - Organize clips with folders, tags, and playlists
  - Search your entire video library
  - Batch download multiple links
- **MVP Status:**
  - 🔄 Paste link → download MP4/MP3 (in progress)
  - 🔄 Format and quality selection (in progress)
  - 🔄 Auto-title and thumbnail extraction (in progress)
  - 🔄 Basic library view (in progress)
- **Links:** Coming Soon (disabled), GitHub (https://github.com/WaleedaRaza/clipvault)

#### Product 4: Lifeline OS
- **Name:** Lifeline OS
- **Tagline:** Personal operating system for planning, execution, and reflection
- **Problem:** Tools are fragmented, routines are inconsistent, emotional state swings break follow-through.
- **Solution:** One system that turns intention into reliable daily execution. Planning, execution, and reflection in one loop.
- **Status:** In Dev - Agent swarm OS layer
- **What it does:**
  - Plan your day with "must-wins" and priorities
  - Track goals and projects with structured roadmaps
  - Reflect with AI coaching and journaling prompts
  - Build habits with streak tracking
  - Get AI-powered insights on patterns and progress
- **MVP Status:**
  - ✅ Local LLM agent integration
  - ✅ Goal and task planning
  - ✅ AI coaching personas
  - 🔄 Today dashboard (in progress)
  - 🔄 Habit tracking (in progress)
- **Links:** View Product (https://github.com/WaleedaRaza/paths), GitHub (https://github.com/WaleedaRaza/paths)

#### Product 5: Petform
- **Name:** Petform
- **Tagline:** All-in-one pet management platform
- **Problem:** Pet care is fragmented. Owners track health in notes, texts, and scattered vet PDFs. They miss medications, forget appointments.
- **Solution:** One home for pet life—reminders, records, AI insights, and community all in one place.
- **Status:** In Dev - Consumer platform
- **What it does:**
  - Create detailed pet profiles with photos and medical history
  - Set reminders for medications, vet appointments, and feeding
  - Log health events, symptoms, and behaviors
  - Get AI-powered answers to pet care questions
  - Share access with family, roommates, or pet sitters
- **MVP Status:**
  - 🔄 Pet profiles with photos (in progress)
  - 🔄 Medication and feeding schedules (in progress)
  - 🔄 Reminder notifications (in progress)
  - 🔄 Health event logging (in progress)
- **Links:** View Product (petform.html), GitHub (https://github.com/WaleedaRaza/petform)

### 3. About Section
- **Title:** About Me
- **Subtitle:** Software developer
- **Description:** Currently focused on ML modeling, LLMs/transformer models, NLP stance and sentiment algorithms, Computer Vision applications and models, Distributed system architecture and design, Full-Stack web and iOS Development, Data pipeline and platform engineering
- **Role:** Software Engineer Intern @ Freddie Mac
- **Education:** Computer Science BS
- **Connect Section:**
  - Title: "Let's Connect"
  - Description: "Interested in collaborating on interesting projects or discussing opportunities? I'm always open to:"
  - **Connection Types:**
    - Collaborations: Open source projects, hackathons, research
    - Work: Full-time roles, internships, contract dev
    - Networking: chats, discussions
- **Contact Buttons:**
  - Email via Gmail (waleedraza1211@gmail.com)
  - LinkedIn (https://www.linkedin.com/in/waleedaraza/)
  - GitHub (https://github.com/WaleedaRaza)
  - Collaboration Form (https://forms.gle/xTfFt4CSmrEVijEC9)
  - Resume (placeholder - coming soon)
  - Products (link to #products)

### 4. Skills Section
- **Title:** Skills
- **Subtitle:** Technologies and frameworks I work with
- **Skills List (alphabetical):**
  - AWS, Apache, Apache Spark, Azure, C, Dart, Docker, FastAPI, Firebase, Flask, Flutter, Git, Java, JavaScript, Keras, Kubeflow, Kubernetes, Matplotlib, MongoDB, Node.js, NumPy, OpenCV, PostgreSQL, Prometheus, Python, PyTorch, React, Redis, scikit-learn, Supabase, Swift, TensorFlow, TypeScript, Unix, VS Code

### 5. Social Links
- **Instagram:** https://www.instagram.com/wwwaleedraza/
- **LinkedIn:** https://www.linkedin.com/in/waleedaraza/

### 6. Navigation Menu
- Home (#hero)
- Products (#products)
- About (#about)
- Contact (#contact)
- Skills (#skills)

---

## 🏗️ FORM (Structure/Layout Requirements)

### Page Structure (Must Maintain)
1. **Header** (fixed/sidebar navigation)
   - Logo/Name
   - Social links (Instagram, LinkedIn)
   - Navigation menu (5 items)

2. **Main Content** (sections in order):
   - Hero Section (#hero)
   - Products Section (#products)
   - About Section (#about)
   - Skills Section (#skills)
   - Contact/Map Section (#contact)

### Section Requirements

#### Hero Section
- Must have: Name, tagline, subheadline, 2 CTA buttons
- Structure: Centered content

#### Products Section
- Must have: Section title "Products", subtitle
- Each product card must contain:
  - Product name (h3)
  - Tagline (h5)
  - Problem paragraph
  - Solution paragraph
  - Status badge
  - Expandable "Learn more" section (toggle functionality)
  - Action buttons (View Product, GitHub)

#### About Section
- Must have: Title, subtitle, description, role, education, connect section, contact buttons grid

#### Skills Section
- Must have: Section title, subtitle, skills grid (icons)

#### Contact Section
- Currently: Google Maps embed (Washington, DC)

---

## ⚙️ FUNCTIONS (Functionality That Must Stay)

### 1. Navigation
- **Smooth scroll** to sections via anchor links (#hero, #products, #about, #contact, #skills)
- **Active state** on current section in nav menu
- **Mobile menu toggle** (hamburger menu for mobile)

### 2. Product Cards
- **Expandable preview** - Click "Learn more" to expand/collapse details
- **Toggle function** - `togglePreview(previewId)` JavaScript function
- **Chevron icon** - Changes from down to up when expanded

### 3. Animations (Optional but currently used)
- **AOS (Animate On Scroll)** - Fade-up animations on scroll
- **Data attributes:** `data-aos="fade-up"`, `data-aos-delay`

### 4. External Links
- All GitHub links open in new tab
- All social links open in new tab
- Email link opens Gmail compose
- Collaboration form opens Google Form

### 5. Responsive Behavior
- Mobile menu toggle
- Grid layouts adapt to screen size
- Product cards stack on mobile

---

## 🎨 CURRENT STYLING (To Be Replaced)

### Current Framework
- **Bootstrap 5.3.3** - Grid system, components
- **Bootstrap Icons** - Icon library
- **AOS** - Animate On Scroll library
- **Custom CSS** - main.css (2486+ lines)
- **Color Scheme:**
  - Primary: #dd5414 (orange)
  - Secondary: #008c98 (teal)
  - Accent: #ff6a00
  - Background: Dark theme (#040b14, #161b22)

### Current Classes (To Be Removed)
- Bootstrap classes: `container`, `row`, `col-lg-6`, `btn`, `btn-primary`, etc.
- Custom classes: `project-card`, `preview-toggle`, `preview-content`, `project-links`, `hero-title`, `hero-subtitle`, `section-title`, etc.

---

## ✅ REQUIREMENTS SUMMARY

### Must Keep
1. All content/data listed above
2. Section structure (Hero → Products → About → Skills → Contact)
3. Navigation menu with 5 items
4. Product card expand/collapse functionality
5. All external links and their destinations
6. Social links
7. Contact buttons grid

### Can Remove
1. All CSS/styling (Bootstrap, custom CSS)
2. All vendor libraries (AOS, Bootstrap JS, etc.)
3. All inline styles
4. All class names (except for functionality hooks)
5. Color scheme (will be redesigned)
6. Animations (can be re-added with new design)

### Must Maintain
- Semantic HTML structure
- ID attributes for navigation (#hero, #products, #about, #contact, #skills)
- Data attributes for product toggles (id="product-preview", onclick handlers)
- Link hrefs (internal anchors, external URLs)

---

## 📝 NOTES FOR DESIGNER

- This is a **product-focused portfolio** (not a traditional dev portfolio)
- Focus should be on **showcasing 5 products** clearly
- **Problem/Solution format** is intentional - keep this structure
- **Status badges** (In Dev, Shipping) are important for transparency
- **Expandable product details** allow users to dive deeper without cluttering the page
- Site should feel **modern, professional, product-focused** (not "developer portfolio")
- **Dark theme** is current but open to redesign
- **Mobile-first** responsive design is essential

---

**Ready for UI redesign. All data, structure, and functions documented above.**



