/* ===========================
   KOZEKI CLINIC - script.js
   =========================== */

(function () {
  'use strict';

  // ---- Header scroll behavior ----
  const header = document.getElementById('header');

  function onScroll() {
    if (window.scrollY > 30) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // ---- Hamburger menu ----
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link, .mobile-nav-reserve');

  hamburger.addEventListener('click', function () {
    const isOpen = mobileNav.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen.toString());
  });

  // Close mobile nav when a link is clicked
  mobileLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      mobileNav.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });

  // Close mobile nav when clicking outside
  document.addEventListener('click', function (e) {
    if (!header.contains(e.target)) {
      mobileNav.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  });

  // ---- Intersection Observer for scroll animations ----
  const appearEls = document.querySelectorAll(
    '.about-card, .doctor-card, .access-grid, .hours-wrapper, .access-block, .hours-tel-box'
  );

  // Add appear class
  appearEls.forEach(function (el) {
    el.classList.add('appear');
  });

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  appearEls.forEach(function (el) {
    observer.observe(el);
  });

  // Stagger about-cards
  const aboutCards = document.querySelectorAll('.about-card');
  aboutCards.forEach(function (card, i) {
    card.style.transitionDelay = (i * 0.1) + 's';
  });

  // ---- Smooth scroll for anchor links ----
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'));
        const top = target.getBoundingClientRect().top + window.scrollY - headerHeight;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

  // ---- Reserve button ripple effect ----
  document.querySelectorAll('.btn-primary, .btn-reserve').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      if (this.tagName === 'A' && this.href && !this.href.startsWith('#')) return;
      const ripple = document.createElement('span');
      ripple.style.cssText = [
        'position:absolute',
        'border-radius:50%',
        'background:rgba(255,255,255,0.3)',
        'width:10px',
        'height:10px',
        'transform:scale(0)',
        'animation:ripple 0.5s linear',
        'pointer-events:none',
      ].join(';');

      const rect = this.getBoundingClientRect();
      ripple.style.left = (e.clientX - rect.left - 5) + 'px';
      ripple.style.top = (e.clientY - rect.top - 5) + 'px';

      const style = document.createElement('style');
      style.textContent = '@keyframes ripple{to{transform:scale(40);opacity:0}}';
      if (!document.querySelector('style[data-ripple]')) {
        style.setAttribute('data-ripple', '1');
        document.head.appendChild(style);
      }

      if (getComputedStyle(this).position === 'static') {
        this.style.position = 'relative';
      }
      this.style.overflow = 'hidden';
      this.appendChild(ripple);
      setTimeout(function () { ripple.remove(); }, 600);
    });
  });

})();
