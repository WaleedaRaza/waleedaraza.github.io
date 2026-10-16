// Product screenshot galleries, shared by the home page cards and the product pages.
// Images and captions come from projects/media.js (built by tools/build_media.py).
//
//   Gallery.mount(element, 'warb', { interval, delay, thumbs, base })
//
// - starts on a PREVIEW image (a random one when a product has several)
// - cycles on its own; pauses while hovered, while the tab is hidden, and while the viewer is open
// - long screenshots are shown from the top and pan down on hover
// - click (or Enter) opens the full-screen viewer
(function () {
  'use strict';

  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function startIndex(m) {
    return m.previews.length ? m.previews[Math.floor(Math.random() * m.previews.length)] : 0;
  }

  // Close to the frame's shape: fill it, anchored at the top. Far from it: show it whole over a blurred copy.
  function fitFor(img, frame) {
    const frameRatio = frame.clientWidth / (frame.clientHeight || 1);
    const r = (img.w / img.h) / frameRatio;
    return r > 0.7 && r < 1.45 ? 'cover' : 'contain';
  }

  // ═══ Full-screen viewer (one for the whole page) ═══
  const Viewer = (() => {
    let el, images, idx, base, onClose, lastFocus;

    function build() {
      el = document.createElement('div');
      el.className = 'lb';
      el.hidden = true;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.innerHTML = `
        <button class="lb-close" aria-label="Close">×</button>
        <button class="lb-nav lb-prev" aria-label="Previous">‹</button>
        <figure class="lb-figure">
          <div class="lb-scroll"><img class="lb-img" alt=""></div>
          <figcaption class="lb-cap"><span class="lb-count"></span><span class="lb-text"></span></figcaption>
        </figure>
        <button class="lb-nav lb-next" aria-label="Next">›</button>`;
      document.body.appendChild(el);
      el.querySelector('.lb-close').addEventListener('click', close);
      el.querySelector('.lb-prev').addEventListener('click', () => go(-1));
      el.querySelector('.lb-next').addEventListener('click', () => go(1));
      // the image opens fitted to the screen; clicking it toggles full size (scroll to read)
      el.querySelector('.lb-img').addEventListener('click', (e) => {
        const img = e.currentTarget;
        const scroll = el.querySelector('.lb-scroll');
        if (!scroll.classList.contains('is-zoomed') && img.naturalWidth <= img.clientWidth && img.naturalHeight <= img.clientHeight) return;
        scroll.classList.toggle('is-zoomed');
      });
      // click on the dark backdrop closes; clicks on the image do not
      el.addEventListener('click', (e) => {
        if (e.target === el || e.target.classList.contains('lb-figure') || e.target.classList.contains('lb-scroll')) close();
      });
      document.addEventListener('keydown', (e) => {
        if (el.hidden) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === 'ArrowRight') go(1);
      });
      // swipe left/right on touch screens
      let x0 = null;
      el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
      el.addEventListener('pointerup', (e) => {
        if (x0 === null) return;
        const dx = e.clientX - x0; x0 = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      });
    }

    function render() {
      const im = images[idx];
      const img = el.querySelector('.lb-img');
      img.src = base + im.src;
      img.alt = im.caption || '';
      img.width = im.w;
      img.height = im.h;
      const scroll = el.querySelector('.lb-scroll');
      scroll.classList.remove('is-zoomed');
      scroll.scrollTop = 0;
      el.querySelector('.lb-count').textContent = `${idx + 1} / ${images.length}`;
      el.querySelector('.lb-text').textContent = im.caption || '';
      const many = images.length > 1;
      el.querySelector('.lb-prev').hidden = !many;
      el.querySelector('.lb-next').hidden = !many;
    }

    function go(step) {
      idx = (idx + step + images.length) % images.length;
      render();
    }

    function open(imgs, i, b, cb) {
      if (!el) build();
      images = imgs; idx = i; base = b; onClose = cb;
      lastFocus = document.activeElement;
      render();
      el.hidden = false;
      document.documentElement.classList.add('lb-open');
      el.querySelector('.lb-close').focus();
    }

    function close() {
      el.hidden = true;
      document.documentElement.classList.remove('lb-open');
      if (onClose) onClose(idx);
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }

    return { open, isOpen: () => !!el && !el.hidden };
  })();

  // ═══ One gallery ═══
  function mount(el, product, opts) {
    const { interval = 3500, delay = 0, thumbs = false, base = '' } = opts || {};
    const m = (window.PRODUCT_MEDIA || {})[product];
    if (!el || !m || !m.images.length) return null;
    const images = m.images;
    let idx = startIndex(m);
    let front = 0;
    let hovering = false;
    let timer = null;

    el.classList.add('gal');
    el.innerHTML = `
      <div class="gal-stage" tabindex="0" role="button" aria-label="Open screenshots in full screen">
        <div class="gal-slide is-front"><img class="gal-bg" alt="" aria-hidden="true"><img class="gal-fg" alt=""></div>
        <div class="gal-slide"><img class="gal-bg" alt="" aria-hidden="true"><img class="gal-fg" alt=""></div>
        ${images.length > 1 ? `
        <button class="gal-nav gal-prev" aria-label="Previous screenshot">‹</button>
        <button class="gal-nav gal-next" aria-label="Next screenshot">›</button>` : ''}
        <span class="gal-count"></span>
        <span class="gal-expand" aria-hidden="true">⤢</span>
      </div>
      <p class="gal-caption"></p>
      ${thumbs
        ? `<div class="gal-thumbs">${images.map((im, i) => `<button class="gal-thumb" data-i="${i}" aria-label="${esc(im.caption) || 'Screenshot ' + (i + 1)}"><img src="${base}${im.src}" alt="" loading="lazy"></button>`).join('')}</div>`
        : `<div class="gal-dots" aria-hidden="true">${images.map((_, i) => `<span data-i="${i}"></span>`).join('')}</div>`}`;

    const stage = el.querySelector('.gal-stage');
    const slides = el.querySelectorAll('.gal-slide');

    function paint(slide, im) {
      return new Promise((resolve) => {
        const src = base + im.src;
        const fg = slide.querySelector('.gal-fg');
        slide.dataset.fit = fitFor(im, stage);
        fg.onload = fg.onerror = () => resolve();
        slide.querySelector('.gal-bg').src = src;
        fg.alt = im.caption || '';
        fg.src = src;
        if (fg.complete) resolve();
      });
    }

    function label() {
      el.querySelector('.gal-count').textContent = `${idx + 1} / ${images.length}`;
      el.querySelector('.gal-caption').textContent = images[idx].caption || '';
      el.querySelectorAll('.gal-dots span, .gal-thumb').forEach((d) => d.classList.toggle('active', Number(d.dataset.i) === idx));
      const active = el.querySelector('.gal-thumb.active');
      if (active) active.parentElement.scrollTo({ left: active.offsetLeft - 8, behavior: 'smooth' });
    }

    function show(i) {
      idx = (i + images.length) % images.length;
      const next = slides[1 - front];
      const target = idx;
      label();
      paint(next, images[idx]).then(() => {
        if (target !== idx) return; // a newer request superseded this one
        slides[front].classList.remove('is-front');
        next.classList.add('is-front');
        front = 1 - front;
      });
      new Image().src = base + images[(idx + 1) % images.length].src; // warm the next one
    }

    function schedule(wait) {
      clearTimeout(timer);
      if (REDUCED_MOTION || images.length < 2) return;
      timer = setTimeout(() => {
        if (!hovering && !document.hidden && !Viewer.isOpen()) show(idx + 1);
        schedule(interval);
      }, wait);
    }

    function openViewer() {
      Viewer.open(images, idx, base, (i) => { if (i !== idx) show(i); schedule(interval); });
    }

    stage.addEventListener('click', (e) => {
      const nav = e.target.closest('.gal-nav');
      if (nav) {
        e.stopPropagation();
        show(idx + (nav.classList.contains('gal-next') ? 1 : -1));
        schedule(interval);
        return;
      }
      openViewer();
    });
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openViewer(); }
      else if (e.key === 'ArrowRight') { show(idx + 1); schedule(interval); }
      else if (e.key === 'ArrowLeft') { show(idx - 1); schedule(interval); }
    });
    el.addEventListener('click', (e) => {
      const pick = e.target.closest('.gal-thumb, .gal-dots span');
      if (pick) { show(Number(pick.dataset.i)); schedule(interval); }
    });
    const hoverRoot = opts && opts.hoverRoot ? opts.hoverRoot : el;
    hoverRoot.addEventListener('mouseenter', () => { hovering = true; });
    hoverRoot.addEventListener('mouseleave', () => { hovering = false; });

    // First image straight in, then the shape check again once the layout has settled
    paint(slides[0], images[idx]);
    label();
    window.addEventListener('resize', () => {
      slides.forEach((s) => { if (s.classList.contains('is-front')) s.dataset.fit = fitFor(images[idx], stage); });
    });
    schedule(interval + delay);
    return { show, open: openViewer };
  }

  window.Gallery = { mount, open: Viewer.open };
})();
