/* ============================================
   Reviews — Captcha, Ratings, Submission
   ============================================ */

(function () {
  const STORAGE_KEY = 'stl_reviews';
  let captchaAnswer = 0;

  /* --- Seed reviews (shown by default) --- */
  const SEED_REVIEWS = [
    {
      id: 's1',
      author: 'Amanda Perera',
      translator: 'P.M. Thilakarathne',
      rating: 5,
      text: 'Excellent service! Mr. Thilakarathne translated my birth certificate very quickly and professionally. The embassy accepted it without any issues.',
      date: '2026-08-15',
      status: 'approved'
    },
    {
      id: 's2',
      author: 'Kumaran Raj',
      translator: 'Navananthakumran N.',
      rating: 4,
      text: 'Very reliable translator. Handled my marriage certificate translation to Tamil with great attention to detail. Would recommend.',
      date: '2026-09-22',
      status: 'approved'
    },
    {
      id: 's3',
      author: 'Sarah Fernando',
      translator: 'H.M.D.A. Herath',
      rating: 5,
      text: 'Mr. Herath was extremely professional. He completed the translation of my academic transcripts ahead of schedule. Highly recommended!',
      date: '2026-10-10',
      status: 'approved'
    }
  ];

  /* --- Get all reviews (seed + localStorage) --- */
  function getAllReviews() {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return [...SEED_REVIEWS, ...stored];
  }

  /* --- Save a new review --- */
  function saveReview(review) {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    stored.push(review);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }

  /* --- Generate math captcha --- */
  function generateCaptcha() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    captchaAnswer = a + b;
    const captchaEl = document.getElementById('captchaQuestion');
    if (captchaEl) {
      captchaEl.textContent = `What is ${a} + ${b}?`;
    }
  }

  /* --- Render star display --- */
  function renderStars(rating) {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  /* --- Render reviews --- */
  function renderReviews() {
    const container = document.getElementById('reviewsGrid');
    if (!container) return;

    const reviews = getAllReviews();

    container.innerHTML = reviews.map(r => {
      const initials = r.author.split(' ').map(w => w[0]).join('').toUpperCase();
      const badgeClass = r.status === 'approved' ? 'approved' : 'pending';
      const badgeText = r.status === 'approved' ? '✓ Approved' : '⏳ Pending';
      const dateStr = new Date(r.date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      return `
        <div class="review-card">
          <div class="review-header">
            <div class="review-author">
              <div class="review-avatar">${initials}</div>
              <div class="review-author-info">
                <div class="review-name">${r.author}</div>
                <div class="review-date">${dateStr}</div>
              </div>
            </div>
            <span class="review-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="review-stars">${renderStars(r.rating)}</div>
          <p class="review-text">${r.text}</p>
          <div class="review-translator">Translator: <strong>${r.translator}</strong></div>
        </div>`;
    }).join('');
  }

  /* --- Handle form submission --- */
  function initReviewForm() {
    const form = document.getElementById('reviewForm');
    const messageEl = document.getElementById('formMessage');
    if (!form) return;

    generateCaptcha();

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const author = document.getElementById('reviewAuthor').value.trim();
      const translator = document.getElementById('reviewTranslator').value;
      const ratingInput = document.querySelector('input[name="rating"]:checked');
      const text = document.getElementById('reviewText').value.trim();
      const captchaInput = document.getElementById('captchaAnswer').value.trim();

      // Validate
      if (!author || !translator || !ratingInput || !text) {
        showMessage(messageEl, 'Please fill in all required fields.', 'error');
        return;
      }

      if (parseInt(captchaInput) !== captchaAnswer) {
        showMessage(messageEl, 'Incorrect captcha answer. Please try again.', 'error');
        generateCaptcha();
        document.getElementById('captchaAnswer').value = '';
        return;
      }

      // Save review
      const review = {
        id: 'u_' + Date.now(),
        author,
        translator,
        rating: parseInt(ratingInput.value),
        text,
        date: new Date().toISOString().split('T')[0],
        status: 'pending'
      };

      saveReview(review);
      showMessage(messageEl, 'Thank you! Your review has been submitted and is pending approval.', 'success');

      form.reset();
      generateCaptcha();
      renderReviews();
    });
  }

  function showMessage(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = `form-message show ${type}`;
    setTimeout(() => { el.classList.remove('show'); }, 5000);
  }

  /* --- Initialize reviews page --- */
  function initReviews() {
    renderReviews();
    initReviewForm();
  }

  // Expose
  window.initReviews = initReviews;
})();
