/* ═══════════════════════════════════════════════════════════════════════════
   WALEEDOS APP.JS
   Main application logic - rendering, navigation, interactions
   ═══════════════════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

let artifacts = [];
let currentProductView = 'tiles';
let currentProjectFilter = 'all';
let innerModeEnabled = false;

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Load artifacts data
  await loadArtifacts();
  
  // Render sections
  renderProducts();
  renderProjects();
  
  // Check for saved inner mode preference
  if (localStorage.getItem('innerMode') === 'true') {
    toggleInnerMode(true);
  }
  
  // Setup scroll-based nav highlighting
  setupScrollSpy();
  
  // Add animation classes
  animateOnScroll();
});

// ─────────────────────────────────────────────────────────────────────────────
// DATA LOADING
// ─────────────────────────────────────────────────────────────────────────────

async function loadArtifacts() {
  try {
    const response = await fetch('assets/data/artifacts.json');
    const data = await response.json();
    artifacts = data.artifacts || [];
  } catch (error) {
    console.error('Failed to load artifacts:', error);
    artifacts = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERING - PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────

function renderProducts() {
  const container = document.getElementById('products-tiles');
  if (!container) return;
  
  // Filter and sort products by focus_weight (descending)
  const products = artifacts
    .filter(a => a.type === 'product')
    .sort((a, b) => b.focus_weight - a.focus_weight);
  
  container.innerHTML = products.map(artifact => createArtifactCard(artifact)).join('');
  
  // Add event listeners
  container.querySelectorAll('.artifact-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `artifact.html?id=${card.dataset.id}`;
    });
    
    card.addEventListener('mouseenter', (e) => showTooltip(e, card.dataset.id));
    card.addEventListener('mouseleave', hideTooltip);
    card.addEventListener('mousemove', moveTooltip);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERING - PROJECTS
// ─────────────────────────────────────────────────────────────────────────────

function renderProjects() {
  const container = document.getElementById('projects-tiles');
  if (!container) return;
  
  // Filter projects
  let projects = artifacts
    .filter(a => a.type === 'project')
    .sort((a, b) => b.focus_weight - a.focus_weight);
  
  // Apply domain filter
  if (currentProjectFilter !== 'all') {
    projects = projects.filter(a => 
      a.domain_tags && a.domain_tags.includes(currentProjectFilter)
    );
  }
  
  // Don't show retired/archive unless specifically filtered
  projects = projects.filter(a => a.tier !== 'retired' && a.tier !== 'archive');
  
  container.innerHTML = projects.map(artifact => createArtifactCard(artifact)).join('');
  
  // Add event listeners
  container.querySelectorAll('.artifact-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.href = `artifact.html?id=${card.dataset.id}`;
    });
    
    card.addEventListener('mouseenter', (e) => showTooltip(e, card.dataset.id));
    card.addEventListener('mouseleave', hideTooltip);
    card.addEventListener('mousemove', moveTooltip);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

function createArtifactCard(artifact) {
  const tierLabel = formatTier(artifact.tier);
  const statusLabel = formatStatus(artifact.status);
  const tags = (artifact.domain_tags || []).slice(0, 3);
  
  return `
    <article class="artifact-card animate-in" 
             data-id="${artifact.id}" 
             data-tier="${artifact.tier}"
             data-status="${artifact.status}">
      <div class="shine-sweep"></div>
      <header class="card-header">
        <h3 class="card-title">${escapeHtml(artifact.name)}</h3>
        <span class="card-status" data-status="${artifact.status}">${statusLabel}</span>
      </header>
      <p class="card-tagline">${escapeHtml(artifact.tagline)}</p>
      <footer class="card-meta">
        <span class="card-tier">${tierLabel}</span>
        ${tags.map(tag => `<span class="card-tag">${escapeHtml(tag)}</span>`).join('')}
      </footer>
    </article>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatTier(tier) {
  const labels = {
    'escape_velocity': 'Escape Velocity',
    'wow_factor': 'Wow Factor',
    'rocket_stage': 'Rocket Stage',
    'moonshot': 'Moonshot',
    'utility': 'Utility',
    'paused': 'Paused',
    'research': 'Research',
    'incubation': 'Incubation',
    'archive': 'Archive',
    'retired': 'Archived'
  };
  return labels[tier] || tier;
}

function formatStatus(status) {
  const labels = {
    'active': 'Active',
    'paused': 'Paused',
    'prototype': 'Prototype',
    'research': 'Research',
    'concept': 'Concept',
    'retired': 'Archived'
  };
  return labels[status] || status;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW TOGGLE
// ─────────────────────────────────────────────────────────────────────────────

function setView(section, view) {
  if (section === 'products') {
    currentProductView = view;
    
    // Update toggle buttons
    document.querySelectorAll('#products-view-toggle .view-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    // Toggle visibility
    const tiles = document.getElementById('products-tiles');
    const graph = document.getElementById('products-graph');
    
    if (view === 'tiles') {
      tiles.style.display = 'grid';
      graph.classList.remove('visible');
    } else {
      tiles.style.display = 'none';
      graph.classList.add('visible');
      initGraph('products');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT FILTERING
// ─────────────────────────────────────────────────────────────────────────────

function filterProjects(filter) {
  currentProjectFilter = filter;
  
  // Update filter pills
  document.querySelectorAll('#project-filters .filter-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.filter === filter);
  });
  
  // Re-render projects
  renderProjects();
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────

function showTooltip(event, artifactId) {
  const artifact = artifacts.find(a => a.id === artifactId);
  if (!artifact) return;
  
  const tooltip = document.getElementById('tooltip');
  tooltip.querySelector('.tooltip-title').textContent = artifact.name;
  tooltip.querySelector('.tooltip-desc').textContent = artifact.tagline;
  tooltip.querySelector('.tooltip-status').textContent = formatStatus(artifact.status);
  
  tooltip.classList.add('visible');
  moveTooltip(event);
}

function hideTooltip() {
  const tooltip = document.getElementById('tooltip');
  tooltip.classList.remove('visible');
}

function moveTooltip(event) {
  const tooltip = document.getElementById('tooltip');
  const padding = 15;
  const x = event.clientX + padding;
  const y = event.clientY - tooltip.offsetHeight - padding;
  
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${Math.max(10, y)}px`;
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER MODE TOGGLE
// ─────────────────────────────────────────────────────────────────────────────

function toggleInnerMode(forceState) {
  innerModeEnabled = forceState !== undefined ? forceState : !innerModeEnabled;
  document.body.classList.toggle('inner-mode', innerModeEnabled);
  localStorage.setItem('innerMode', innerModeEnabled);
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

function toggleNav() {
  const nav = document.getElementById('site-nav');
  nav.classList.toggle('open');
}

function setupScrollSpy() {
  const sections = ['hero', 'products', 'projects'];
  const navLinks = document.querySelectorAll('.nav-link');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href === '#' + entry.target.id || 
              (href === '#' && entry.target.id === 'hero')) {
            link.classList.add('active');
          } else if (href.startsWith('#')) {
            link.classList.remove('active');
          }
        });
      }
    });
  }, { threshold: 0.3 });
  
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────

function animateOnScroll() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animationPlayState = 'running';
      }
    });
  }, { threshold: 0.1 });
  
  document.querySelectorAll('.animate-in').forEach(el => {
    el.style.animationPlayState = 'paused';
    observer.observe(el);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAPH (Stub - will use force-graph when vendored)
// ─────────────────────────────────────────────────────────────────────────────

let graphInstance = null;

function initGraph(section) {
  const canvas = document.getElementById(`${section}-graph-canvas`);
  if (!canvas) return;
  
  // Check if force-graph is available
  if (typeof ForceGraph === 'undefined') {
    // Fallback: show message
    const container = document.getElementById(`${section}-graph`);
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-tertiary);font-family:var(--font-mono);font-size:var(--text-sm);">
        Graph view requires force-graph library. Using tiles view.
      </div>
    `;
    return;
  }
  
  // Filter artifacts for this section
  const sectionArtifacts = artifacts.filter(a => 
    section === 'products' ? a.type === 'product' : a.type === 'project'
  );
  
  // Build nodes
  const nodes = sectionArtifacts.map(a => ({
    id: a.id,
    name: a.name,
    val: a.focus_weight / 10,
    color: getTierColor(a.tier)
  }));
  
  // Build links from relationships
  const links = [];
  sectionArtifacts.forEach(a => {
    if (a.relationships) {
      a.relationships.forEach(rel => {
        if (nodes.find(n => n.id === rel.target)) {
          links.push({
            source: a.id,
            target: rel.target
          });
        }
      });
    }
  });
  
  // Initialize graph
  const container = document.getElementById(`${section}-graph`);
  graphInstance = ForceGraph()(container)
    .graphData({ nodes, links })
    .nodeLabel('name')
    .nodeColor('color')
    .nodeVal('val')
    .linkColor(() => 'rgba(255,255,255,0.1)')
    .backgroundColor('#0a0a0f')
    .onNodeClick(node => {
      window.location.href = `artifact.html?id=${node.id}`;
    });
}

function getTierColor(tier) {
  const colors = {
    'escape_velocity': '#ffd700',
    'wow_factor': '#00d4aa',
    'rocket_stage': '#7e57c2',
    'moonshot': '#00bcd4',
    'utility': '#4caf50',
    'paused': '#757575',
    'research': '#ff9800',
    'incubation': '#e91e63',
    'archive': '#424242',
    'retired': '#424242'
  };
  return colors[tier] || '#666';
}

// ─────────────────────────────────────────────────────────────────────────────
// SMOOTH SCROLL
// ─────────────────────────────────────────────────────────────────────────────

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // Close mobile nav
    document.getElementById('site-nav')?.classList.remove('open');
  });
});

