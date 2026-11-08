/* ============================================
   Lightbox — Image Viewer with Navigation
   ============================================ */

(function () {
  let overlay, imgEl, prevBtn, nextBtn, closeBtn, counterEl, titleEl;
  let images = [];
  let currentIndex = 0;
  let touchStartX = 0;

  /* --- Build lightbox DOM --- */
  function createLightbox() {
    overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.id = 'lightboxOverlay';
    overlay.innerHTML = `
      <div class="lightbox-content">
        <span class="lightbox-title" id="lightboxTitle"></span>
        <button class="lightbox-close" id="lightboxClose" aria-label="Close">✕</button>
        <button class="lightbox-nav lightbox-prev" id="lightboxPrev" aria-label="Previous">‹</button>
        <img src="" alt="Document preview" id="lightboxImg">
        <button class="lightbox-nav lightbox-next" id="lightboxNext" aria-label="Next">›</button>
        <span class="lightbox-counter" id="lightboxCounter"></span>
      </div>`;
    document.body.appendChild(overlay);

    imgEl = document.getElementById('lightboxImg');
    prevBtn = document.getElementById('lightboxPrev');
    nextBtn = document.getElementById('lightboxNext');
    closeBtn = document.getElementById('lightboxClose');
    counterEl = document.getElementById('lightboxCounter');
    titleEl = document.getElementById('lightboxTitle');

    closeBtn.addEventListener('click', closeLightbox);
    prevBtn.addEventListener('click', () => navigate(-1));
    nextBtn.addEventListener('click', () => navigate(1));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeLightbox();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    });

    // Touch swipe
    overlay.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    overlay.addEventListener('touchend', (e) => {
      const diff = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(diff) > 50) {
        navigate(diff > 0 ? -1 : 1);
      }
    }, { passive: true });
  }

  /* --- Open lightbox --- */
  function openLightbox(imageList, startIndex, title) {
    if (!overlay) createLightbox();
    images = imageList;
    currentIndex = startIndex || 0;
    titleEl.textContent = title || '';
    updateImage();
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  /* --- Close lightbox --- */
  function closeLightbox() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* --- Navigate --- */
  function navigate(direction) {
    currentIndex = (currentIndex + direction + images.length) % images.length;
    updateImage();
  }

  /* --- Update displayed image --- */
  function updateImage() {
    imgEl.src = images[currentIndex];
    counterEl.textContent = `${currentIndex + 1} / ${images.length}`;
    prevBtn.style.display = images.length > 1 ? 'flex' : 'none';
    nextBtn.style.display = images.length > 1 ? 'flex' : 'none';
  }

  // Expose globally
  window.openLightbox = openLightbox;
})();
