/**
* Simplified Main JS File for GitHub Pages
*/

(function() {
  "use strict";

  // Mobile nav toggle
  function on(el, evt, fn) {
    let d = select(el);
    if (d) {
      if (evt == 'click') {
        d.addEventListener(evt, fn);
      } else {
        d.addEventListener(evt, fn);
      }
    }
  }

  function select(el, all = false) {
    el = el.trim();
    if (all) {
      return [...document.querySelectorAll(el)];
    } else {
      return document.querySelector(el);
    }
  }

  // Header toggle for mobile
  on('click', '.header-toggle', function(e) {
    select('#header').classList.toggle('header-show');
  });

  // Smooth scrolling for navigation links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Update active navigation link on scroll
  window.addEventListener('scroll', function() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.navmenu a[href^="#"]');
    
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (window.pageYOffset >= sectionTop - 200) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  });

})(); 