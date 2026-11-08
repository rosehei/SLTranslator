(function () {
  const POLL_INTERVAL_MS = 45000;
  const SEARCH_DEBOUNCE_MS = 200;
  const MAX_SUGGESTIONS = 10;
  const MAX_REVIEW_LENGTH = 1000;

  let captchaAnswer = 0;
  let translatorList = null;
  let translatorDataPromise = null;
  let selectedTranslator = null;
  let suggestionResults = [];
  let activeSuggestionIndex = -1;
  let searchDebounce = null;
  let pickerElements = null;
  let lastReviewsSnapshot = null;
  let pollTimer = null;
  let feedInitialized = false;
  let isFetchingReviews = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function generateCaptcha() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    captchaAnswer = a + b;
    const captchaEl = document.getElementById('captchaQuestion');
    if (captchaEl) {
      captchaEl.textContent = `What is ${a} + ${b}?`;
    }
  }

  function renderStars(rating) {
    const value = Math.max(0, Math.min(5, parseInt(rating, 10) || 0));
    return '★'.repeat(value) + '☆'.repeat(5 - value);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function renderEmptyState(container) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center;">
        <h3>No reviews yet</h3>
        <p>Be the first to share your experience with a sworn translator.</p>
      </div>`;
  }

  function renderErrorState(container) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center;">
        <h3>Reviews are temporarily unavailable</h3>
        <p>Please check back soon.</p>
      </div>`;
  }

  function renderReviews(reviews) {
    const container = document.getElementById('reviewsGrid');
    if (!container) return;

    if (!Array.isArray(reviews) || reviews.length === 0) {
      renderEmptyState(container);
      return;
    }

    container.innerHTML = reviews.map(review => {
      const author = escapeHtml(review.author || 'Anonymous');
      const initials = escapeHtml(
        String(review.author || '?')
          .split(/\s+/)
          .filter(Boolean)
          .map(word => word[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || '?'
      );
      const translatorName = escapeHtml(review.translatorName || '');
      const translatorReg = escapeHtml(review.translatorRegNumber || '');
      const dateStr = escapeHtml(formatDate(review.submittedAt));
      const text = escapeHtml(review.text || '');

      return `
        <div class="review-card">
          <div class="review-header">
            <div class="review-author">
              <div class="review-avatar">${initials}</div>
              <div class="review-author-info">
                <div class="review-name">${author}</div>
                <div class="review-date">${dateStr}</div>
              </div>
            </div>
          </div>
          <div class="review-stars">${renderStars(review.rating)}</div>
          <p class="review-text">${text}</p>
          <div class="review-translator">
            Translator: <strong>${translatorName}</strong>${translatorReg ? ` (${translatorReg})` : ''}
          </div>
        </div>`;
    }).join('');
  }

  async function fetchReviews(force) {
    if (isFetchingReviews) return;
    isFetchingReviews = true;

    try {
      const response = await fetch('/api/reviews', {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Unable to load reviews');
      }

      const data = await response.json();
      const reviews = Array.isArray(data)
        ? data
        : (Array.isArray(data.reviews) ? data.reviews : []);
      const snapshot = JSON.stringify(reviews);

      if (force || snapshot !== lastReviewsSnapshot) {
        lastReviewsSnapshot = snapshot;
        renderReviews(reviews);
      }
    } catch (error) {
      if (lastReviewsSnapshot === null) {
        const container = document.getElementById('reviewsGrid');
        if (container) renderErrorState(container);
      }
    } finally {
      isFetchingReviews = false;
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = window.setInterval(() => {
      if (!document.hidden) fetchReviews(false);
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (!pollTimer) return;
    window.clearInterval(pollTimer);
    pollTimer = null;
  }

  function initReviewsFeed() {
    if (feedInitialized) return;
    feedInitialized = true;

    fetchReviews(true);
    startPolling();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopPolling();
        return;
      }

      fetchReviews(false);
      startPolling();
    });
  }

  function loadTranslatorList() {
    if (translatorList) return Promise.resolve(translatorList);

    if (!translatorDataPromise) {
      translatorDataPromise = (async () => {
        if (
          typeof window.loadTranslatorsData !== 'function' ||
          typeof window.getPreparedTranslators !== 'function'
        ) {
          return [];
        }

        const raw = await window.loadTranslatorsData();
        const prepared = window.getPreparedTranslators(raw);
        translatorList = Array.isArray(prepared) ? prepared : [];
        return translatorList;
      })().catch(() => {
        translatorList = [];
        return translatorList;
      });
    }

    return translatorDataPromise;
  }

  function setHint(text, isError) {
    if (!pickerElements || !pickerElements.hint) return;
    pickerElements.hint.textContent = text || '';
    pickerElements.hint.classList.toggle('error', Boolean(isError));
  }

  function closeSuggestions() {
    if (!pickerElements) return;

    pickerElements.suggestions.hidden = true;
    pickerElements.suggestions.innerHTML = '';
    pickerElements.search.setAttribute('aria-expanded', 'false');
    pickerElements.search.removeAttribute('aria-activedescendant');
    suggestionResults = [];
    activeSuggestionIndex = -1;
  }

  function updateActiveSuggestion() {
    if (!pickerElements) return;

    const options = pickerElements.suggestions.querySelectorAll('[role="option"]');
    options.forEach((option, index) => {
      const isActive = index === activeSuggestionIndex;
      option.setAttribute('aria-selected', isActive ? 'true' : 'false');

      if (isActive) {
        pickerElements.search.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      }
    });

    if (activeSuggestionIndex < 0) {
      pickerElements.search.removeAttribute('aria-activedescendant');
    }
  }

  function renderSuggestions(results) {
    if (!pickerElements) return;

    suggestionResults = results;
    activeSuggestionIndex = results.length > 0 ? 0 : -1;

    if (results.length === 0) {
      closeSuggestions();
      return;
    }

    pickerElements.suggestions.innerHTML = results.map((translator, index) => `
      <li class="translator-suggestion"
          id="translator-option-${index}"
          role="option"
          aria-selected="${index === activeSuggestionIndex ? 'true' : 'false'}"
          data-suggestion-index="${index}">
        <span class="translator-suggestion-name">${escapeHtml(translator.name)}</span>
        <span class="translator-suggestion-reg">${escapeHtml(translator.regNumber)}</span>
      </li>`).join('');

    pickerElements.suggestions.hidden = false;
    pickerElements.search.setAttribute('aria-expanded', 'true');
    updateActiveSuggestion();
  }

  function moveActiveSuggestion(delta) {
    if (!suggestionResults.length) return;

    if (activeSuggestionIndex < 0) {
      activeSuggestionIndex = delta > 0 ? 0 : suggestionResults.length - 1;
    } else {
      activeSuggestionIndex =
        (activeSuggestionIndex + delta + suggestionResults.length) % suggestionResults.length;
    }

    updateActiveSuggestion();
  }

  async function runSearch(query) {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized || selectedTranslator) {
      closeSuggestions();
      return;
    }

    const list = await loadTranslatorList();
    if (selectedTranslator) return;

    const terms = normalized.split(/\s+/);
    const results = list.filter(translator => {
      const haystack = `${translator.name || ''} ${translator.regNumber || ''}`.toLowerCase();
      return terms.every(term => haystack.includes(term));
    }).slice(0, MAX_SUGGESTIONS);

    if (results.length === 0) {
      closeSuggestions();
      setHint('No matching translators found.', false);
      return;
    }

    setHint('');
    renderSuggestions(results);
  }

  function selectTranslator(translator) {
    if (!translator || !pickerElements) return;

    selectedTranslator = translator;
    pickerElements.regInput.value = translator.regNumber || '';
    pickerElements.nameInput.value = translator.name || '';
    pickerElements.selectedName.textContent =
      `${translator.name || ''} (${translator.regNumber || ''})`;
    pickerElements.selected.hidden = false;
    pickerElements.search.hidden = true;
    pickerElements.search.value = '';
    setHint('');
    closeSuggestions();
    if (pickerElements.changeButton) pickerElements.changeButton.focus();
  }

  function clearSelectedTranslator() {
    if (!pickerElements) return;

    selectedTranslator = null;
    pickerElements.regInput.value = '';
    pickerElements.nameInput.value = '';
    pickerElements.selectedName.textContent = '';
    pickerElements.selected.hidden = true;
    pickerElements.search.hidden = false;
    pickerElements.search.value = '';
    closeSuggestions();
    setHint('Start typing a name or registration number.');
  }

  function initTranslatorPicker() {
    const picker = document.getElementById('translatorPicker');
    const search = document.getElementById('translatorSearch');
    const suggestions = document.getElementById('translatorSuggestions');
    const selected = document.getElementById('translatorSelected');
    const selectedName = document.getElementById('translatorSelectedName');
    const changeButton = document.getElementById('translatorChange');
    const regInput = document.getElementById('reviewTranslatorReg');
    const nameInput = document.getElementById('reviewTranslatorName');
    const hint = document.getElementById('translatorHint');

    if (
      !picker || !search || !suggestions || !selected ||
      !selectedName || !regInput || !nameInput || !hint
    ) {
      return;
    }

    pickerElements = {
      picker,
      search,
      suggestions,
      selected,
      selectedName,
      changeButton,
      regInput,
      nameInput,
      hint
    };

    setHint('Start typing a name or registration number.');
    loadTranslatorList();

    search.addEventListener('input', () => {
      if (selectedTranslator) return;

      const query = search.value.trim();
      window.clearTimeout(searchDebounce);

      if (!query) {
        closeSuggestions();
        setHint('Start typing a name or registration number.');
        return;
      }

      setHint('');
      closeSuggestions();
      searchDebounce = window.setTimeout(() => {
        runSearch(query);
      }, SEARCH_DEBOUNCE_MS);
    });

    search.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (suggestions.hidden) {
          const query = search.value.trim();
          if (query) runSearch(query);
        } else {
          moveActiveSuggestion(1);
        }
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!suggestions.hidden) moveActiveSuggestion(-1);
        return;
      }

      if (event.key === 'Enter') {
        if (!suggestions.hidden && activeSuggestionIndex >= 0) {
          const translator = suggestionResults[activeSuggestionIndex];
          if (translator) {
            event.preventDefault();
            selectTranslator(translator);
          }
        }
        return;
      }

      if (event.key === 'Escape' && !suggestions.hidden) {
        event.preventDefault();
        closeSuggestions();
      }
    });

    suggestions.addEventListener('mousedown', event => {
      const option = event.target.closest('[data-suggestion-index]');
      if (!option) return;

      event.preventDefault();
      const index = parseInt(option.getAttribute('data-suggestion-index'), 10);
      if (Number.isFinite(index) && suggestionResults[index]) {
        selectTranslator(suggestionResults[index]);
      }
    });

    if (changeButton) {
      changeButton.addEventListener('click', () => {
        clearSelectedTranslator();
        search.focus();
      });
    }

    document.addEventListener('click', event => {
      if (!picker.contains(event.target)) closeSuggestions();
    });
  }

  function showMessage(element, message, type) {
    if (!element) return;

    element.textContent = message;
    element.className = `form-message show ${type}`;
    window.setTimeout(() => {
      element.classList.remove('show');
    }, 5000);
  }

  function initReviewForm() {
    const form = document.getElementById('reviewForm');
    const messageEl = document.getElementById('formMessage');
    if (!form || !pickerElements) return;

    const submitButton = form.querySelector('button[type="submit"]');
    generateCaptcha();

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const author = document.getElementById('reviewAuthor').value.trim();
      const ratingInput = document.querySelector('input[name="rating"]:checked');
      const text = document.getElementById('reviewText').value.trim();
      const captchaInput = document.getElementById('captchaAnswer').value.trim();
      const translatorName = pickerElements.nameInput.value.trim();
      const translatorRegNumber = pickerElements.regInput.value.trim();

      if (!translatorRegNumber) {
        setHint('Please select a translator from the suggestions.', true);
        pickerElements.search.hidden = false;
        pickerElements.search.focus();
        return;
      }

      if (!author || !ratingInput || !text) {
        showMessage(messageEl, 'Please fill in all required fields.', 'error');
        return;
      }

      if (text.length > MAX_REVIEW_LENGTH) {
        showMessage(messageEl, `Your review must be ${MAX_REVIEW_LENGTH} characters or fewer.`, 'error');
        return;
      }

      if (parseInt(captchaInput, 10) !== captchaAnswer) {
        showMessage(messageEl, 'Incorrect captcha answer. Please try again.', 'error');
        generateCaptcha();
        document.getElementById('captchaAnswer').value = '';
        return;
      }

      if (submitButton) submitButton.disabled = true;

      try {
        const response = await fetch('/api/reviews', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            author,
            translatorName,
            translatorRegNumber,
            rating: parseInt(ratingInput.value, 10),
            text
          })
        });

        let data = null;
        try {
          data = await response.json();
        } catch (error) {
          data = null;
        }

        if (!response.ok) {
          const message = data && data.error
            ? data.error
            : 'Unable to submit your review right now. Please try again.';
          showMessage(messageEl, message, 'error');
          return;
        }

        showMessage(messageEl, 'Thank you! Your review has been received.', 'success');
        form.reset();
        clearSelectedTranslator();
        generateCaptcha();
      } catch (error) {
        showMessage(messageEl, 'Unable to submit your review right now. Please try again.', 'error');
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  function initReviews() {
    initTranslatorPicker();
    initReviewForm();
    initReviewsFeed();
  }

  window.initReviews = initReviews;
})();
