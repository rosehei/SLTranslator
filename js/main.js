/* ============================================
   Main JavaScript — Navigation & Animations
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initScrollAnimations();
  initActiveNavLink();
  initStats();
});

/* --- Navbar --- */
function initNavbar() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  const navbar = document.getElementById('navbar');

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      links.classList.toggle('active');
    });

    // Close menu when a link is clicked
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('active');
        links.classList.remove('active');
      });
    });
  }

  // Sticky nav scroll effect
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });
  }
}

/* --- Active Navigation Link --- */
function initActiveNavLink() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    link.classList.toggle('active', href === currentPage);
  });
}

/* --- Scroll Animations (IntersectionObserver) --- */
function initScrollAnimations() {
  const elements = document.querySelectorAll('.fade-in');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  });

  elements.forEach(el => observer.observe(el));
}

/* --- Homepage stats: count-up animation & live client counter --- */

const CLIENT_COUNT_BASE = 24561;
const CLIENT_COUNT_BASE_TIMESTAMP = Date.parse('2026-11-08T00:00:00+05:30');
const CLIENT_COUNT_INCREMENT_MS = 600000;
const STAT_ANIMATION_DURATION_MS = 1800;

function getLiveClientCount() {
  const elapsed = Date.now() - CLIENT_COUNT_BASE_TIMESTAMP;

  if (!Number.isFinite(elapsed)) return CLIENT_COUNT_BASE;

  const increments = Math.floor(elapsed / CLIENT_COUNT_INCREMENT_MS);
  return Math.max(CLIENT_COUNT_BASE, CLIENT_COUNT_BASE + increments);
}

function formatStatNumber(value) {
  return Math.round(value).toLocaleString('en-US');
}

function prefersReducedMotion() {
  return window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function animateStatNumber(element, target) {
  const suffix = element.getAttribute('data-suffix') || '';
  const startAttr = parseInt(element.getAttribute('data-start'), 10);
  const start = Number.isFinite(startAttr) ? startAttr : 0;

  if (
    target <= start ||
    prefersReducedMotion() ||
    typeof window.requestAnimationFrame !== 'function'
  ) {
    element.textContent = formatStatNumber(target) + suffix;
    element.dataset.animated = 'true';
    return;
  }

  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / STAT_ANIMATION_DURATION_MS, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);

    element.textContent = formatStatNumber(current) + suffix;

    if (progress < 1) {
      window.requestAnimationFrame(tick);
    } else {
      element.textContent = formatStatNumber(target) + suffix;
      element.dataset.animated = 'true';
    }
  }

  window.requestAnimationFrame(tick);
}

function initStats() {
  const statsSection = document.querySelector('.hero-stats');
  if (!statsSection) return;

  const numberElements = Array.from(statsSection.querySelectorAll('.stat-number'));
  if (!numberElements.length) return;

  const clientsElement = document.getElementById('statClients');
  let hasAnimated = false;

  function animateAll() {
    if (hasAnimated) return;
    hasAnimated = true;

    if (clientsElement) {
      clientsElement.setAttribute('data-target', String(getLiveClientCount()));
    }

    numberElements.forEach(element => {
      const target = parseInt(element.getAttribute('data-target'), 10);
      if (!Number.isFinite(target)) return;
      animateStatNumber(element, target);
    });
  }

  function startObserving() {
    if (hasAnimated) return;

    if (!('IntersectionObserver' in window)) {
      animateAll();
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateAll();
          observer.disconnect();
        }
      });
    }, { threshold: 0.3 });

    observer.observe(statsSection);
  }

  if (clientsElement) {
    clientsElement.setAttribute('data-target', String(getLiveClientCount()));
  }

  // The HTML already contains fallback values. Refine them from the dataset
  // before starting the animation, so the displayed totals stay accurate.
  const dataPromise = typeof window.loadTranslatorsData === 'function'
    ? window.loadTranslatorsData()
    : Promise.resolve(null);

  dataPromise.then(raw => {
    if (!raw || typeof window.getPreparedTranslators !== 'function') return;

    const translators = window.getPreparedTranslators(raw);
    const translatorsElement = document.getElementById('statTranslators');
    const languagesElement = document.getElementById('statLanguages');

    if (translatorsElement) {
      translatorsElement.setAttribute('data-target', String(translators.length));
    }

    if (languagesElement && typeof window.getUniqueLanguages === 'function') {
      languagesElement.setAttribute('data-target', String(window.getUniqueLanguages(translators).length));
    }
  }).catch(() => {
    // Keep the fallback values from the HTML if the dataset cannot load.
  }).then(startObserving);

  if (clientsElement) {
    window.setInterval(() => {
      const value = getLiveClientCount();
      clientsElement.setAttribute('data-target', String(value));

      if (clientsElement.dataset.animated === 'true') {
        clientsElement.textContent = formatStatNumber(value);
      }
    }, 60000);
  }
}
