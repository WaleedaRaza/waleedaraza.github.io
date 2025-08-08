/**
* Template Name: iPortfolio
* Template URL: https://bootstrapmade.com/iportfolio-bootstrap-portfolio-websites-template/
* Updated: Jun 29 2024 with Bootstrap v5.3.3
* Author: BootstrapMade.com
* License: https://bootstrapmade.com/license/
*/

(function() {
  "use strict";

  // Initialize AOS (Animate On Scroll)
  AOS.init({
    duration: 1000,
    easing: "ease-in-out",
    once: true,
    mirror: false
  });

  // Initialize GLightbox
  GLightbox({
    selector: '.glightbox'
  });

  // Initialize Swiper
  var testiSwiper = new Swiper(".testimonials-carousel", {
    speed: 600,
    loop: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false,
    },
    slidesPerView: "auto",
    pagination: {
      el: ".swiper-pagination",
      type: "bullets",
      clickable: true,
    },
    breakpoints: {
      320: {
        slidesPerView: 1,
        spaceBetween: 20,
      },
      1200: {
        slidesPerView: 3,
        spaceBetween: 20,
      },
    },
  });

  // Initialize Isotope
  window.addEventListener('load', () => {
    let portfolioContainer = select('.portfolio-container');
    if (portfolioContainer) {
      let portfolioIsotope = new Isotope(portfolioContainer, {
        itemSelector: '.portfolio-item',
        layoutMode: 'fitRows'
      });

      let portfolioFilters = select('#portfolio-flters li', true);

      on('click', '#portfolio-flters li', function(e) {
        e.preventDefault();
        portfolioFilters.forEach(function(el) {
          el.classList.remove('filter-active');
        });
        this.classList.add('filter-active');

        portfolioIsotope.arrange({
          filter: this.getAttribute('data-filter')
        });
        portfolioIsotope.on('arrangeComplete', function() {
          AOS.refresh()
        });
      }, true);
    }
  });

  // Initialize Typed.js
  if (select(".typed")) {
    new Typed(".typed", {
      strings: ["Full-Stack Developer", "ML/AI Engineer", "Distributed Systems Expert"],
      typeSpeed: 100,
      backSpeed: 0,
      backDelay: 2000,
      loop: true
    });
  }

  // Initialize Pure Counter
  new PureCounter();

  // Initialize Waypoints
  new Waypoint({
    element: document.getElementById('about'),
    handler: function(direction) {
      if (direction === 'down') {
        document.querySelector('.scroll-top').classList.add('active');
      } else {
        document.querySelector('.scroll-top').classList.remove('active');
      }
    },
    offset: '80%'
  });

  // Mobile nav toggle
  on('click', '.mobile-nav-toggle', function(e) {
    select('#navbar').classList.toggle('navbar-mobile');
    this.classList.toggle('bi-list');
    this.classList.toggle('bi-x');
  });

  // Header toggle for mobile
  on('click', '.header-toggle', function(e) {
    select('#header').classList.toggle('header-show');
  });

  // Scroll top button
  on('click', '.scroll-top', function(e) {
    select('body,html').animate({
      scrollTop: 0
    }, 1500, 'easeInOutExpo');
  });

  // Helper functions
  function select(el, all = false) {
    el = el.trim();
    if (all) {
      return [...document.querySelectorAll(el)];
    } else {
      return document.querySelector(el);
    }
  }

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

})();