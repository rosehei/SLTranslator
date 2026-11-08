/* ============================================
   Translators Data Loader, Search, Filter & Verify
   Data lives in js/translators-data.js and is loaded
   asynchronously (works on http:// and file://).
   ============================================ */

(function () {
  'use strict';

  const PAGE_SIZE = 20;
  const SEARCH_DEBOUNCE_MS = 250;
  const DATA_SCRIPT_SRC = 'js/translators-data.js';

  const state = {
    raw: null,
    prepared: null,
    all: [],
    filtered: [],
    languages: [],
    page: 1
  };

  let loadPromise = null;
  let directoryPromise = null;
  let verificationInitialized = false;

  /* --- Data loading & preparation --- */

  function loadTranslatorsData() {
    if (Array.isArray(window.TRANSLATORS) && window.TRANSLATORS.length) {
      state.raw = window.TRANSLATORS;
      return Promise.resolve(state.raw);
    }

    if (loadPromise) return loadPromise;

    loadPromise = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = DATA_SCRIPT_SRC;
      script.async = true;
      script.setAttribute('data-translators-data', '');

      script.onload = function () {
        if (Array.isArray(window.TRANSLATORS) && window.TRANSLATORS.length) {
          state.raw = window.TRANSLATORS;
          resolve(state.raw);
        } else {
          reject(new Error('Translator data file loaded but data is unavailable.'));
        }
      };

      script.onerror = function () {
        reject(new Error('Failed to load translator data.'));
      };

      document.head.appendChild(script);
    }).catch(function (error) {
      loadPromise = null;
      throw error;
    });

    return loadPromise;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  }

  function normalizeLanguageToken(token) {
    let value = String(token == null ? '' : token)
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    value = value.replace(/^[.,;:\-–—]+|[.,;:\-–—]+$/g, '').trim();
    if (!value) return '';

    // Repair space-separated spellings such as "S i n h a l a".
    if (/^(?:[A-Za-z]\s+){2,}[A-Za-z]$/.test(value)) {
      value = value.replace(/\s+/g, '');
    }

    const lower = value.toLowerCase();
    const aliases = {
      tamii: 'tamil',
      ukraine: 'ukrainian'
    };
    const canonical = aliases[lower] || lower;

    if (!/^[a-z][a-z .'-]*$/.test(canonical)) return '';
    if (['not available', 'na', 'none', '0'].indexOf(canonical) !== -1) return '';

    return canonical.split(' ').map(function (word) {
      return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    }).join(' ');
  }

  function extractLanguages(translator) {
    const languages = [];
    const seen = new Set();

    [translator.lang1, translator.lang2].forEach(function (field) {
      if (!field) return;

      String(field).split(/\s*(?:-|–|—|\/|,|&|\bto\b)\s*/i).forEach(function (part) {
        const language = normalizeLanguageToken(part);
        if (language && !seen.has(language)) {
          seen.add(language);
          languages.push(language);
        }
      });
    });

    return languages;
  }

  function prepareTranslators(raw) {
    return (raw || []).map(function (translator) {
      const languages = extractLanguages(translator);
      const searchParts = [
        translator.name,
        translator.regNumber,
        translator.address,
        translator.tel,
        translator.lang1,
        translator.lang2,
        languages.join(' ')
      ];

      return {
        id: translator.id,
        regNumber: translator.regNumber || '',
        name: translator.name || '',
        address: translator.address || '',
        tel: translator.tel || '',
        lang1: translator.lang1 || null,
        lang2: translator.lang2 || null,
        languages: languages,
        searchText: searchParts.filter(Boolean).join(' ').toLowerCase()
      };
    });
  }

  function getPreparedTranslators(raw) {
    if (state.prepared && (!raw || raw === state.raw)) return state.prepared;

    const source = raw || state.raw || [];
    state.prepared = prepareTranslators(source);
    return state.prepared;
  }

  function getUniqueLanguages(translators) {
    const list = translators || getPreparedTranslators();
    const languages = new Set();

    list.forEach(function (translator) {
      translator.languages.forEach(function (language) {
        languages.add(language);
      });
    });

    return Array.from(languages).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function getLanguageOptions(translators) {
    return getUniqueLanguages(translators);
  }

  /* --- Search & filter --- */

  function filterTranslators(query, language, translators) {
    const list = translators || getPreparedTranslators();
    const terms = String(query == null ? '' : query)
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return list.filter(function (translator) {
      const matchesQuery = !terms.length || terms.every(function (term) {
        return translator.searchText.indexOf(term) !== -1;
      });

      const matchesLanguage = !language || translator.languages.indexOf(language) !== -1;

      return matchesQuery && matchesLanguage;
    });
  }

  /* --- Rendering helpers --- */

  function getInitials(name) {
    const initials = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(function (word) { return word.charAt(0); })
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return initials || '?';
  }

  function buildTranslatorCard(translator) {
    const languages = translator.languages.length ? translator.languages : ['Not specified'];

    return '' +
      '<div class="translator-card">' +
        '<div class="translator-card-header">' +
          '<div class="translator-avatar" aria-hidden="true">' + escapeHtml(getInitials(translator.name)) + '</div>' +
          '<div>' +
            '<div class="translator-name">' + escapeHtml(translator.name) + '</div>' +
            '<span class="translator-reg">' + escapeHtml(translator.regNumber) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="translator-details">' +
          '<div class="translator-detail">' +
            '<span class="detail-icon" aria-hidden="true">📍</span>' +
            '<span>' + escapeHtml(translator.address || 'Not available') + '</span>' +
          '</div>' +
          '<div class="translator-detail">' +
            '<span class="detail-icon" aria-hidden="true">📞</span>' +
            '<span>' + escapeHtml(translator.tel || 'Not available') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="translator-languages">' +
          languages.map(function (language) {
            return '<span class="lang-tag">' + escapeHtml(language) + '</span>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  function noResultsHtml() {
    return '' +
      '<div class="no-results">' +
        '<div class="no-results-icon" aria-hidden="true">🔍</div>' +
        '<h3>No translators found</h3>' +
        '<p>Try adjusting your search terms or language filter.</p>' +
      '</div>';
  }

  function loadingHtml() {
    return '' +
      '<div class="directory-loading" role="status">' +
        '<span class="directory-spinner" aria-hidden="true"></span>' +
        '<p>Loading translators…</p>' +
      '</div>';
  }

  function loadErrorHtml() {
    return '' +
      '<div class="no-results">' +
        '<div class="no-results-icon" aria-hidden="true">⚠️</div>' +
        '<h3>Unable to load translators</h3>' +
        '<p>Please refresh the page and try again.</p>' +
      '</div>';
  }

  function buildPageItems(currentPage, totalPages) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, function (_, index) { return index + 1; });
    }

    const items = [1];
    let start = Math.max(2, currentPage - 2);
    let end = Math.min(totalPages - 1, currentPage + 2);

    if (currentPage <= 3) {
      start = 2;
      end = Math.min(totalPages - 1, 5);
    } else if (currentPage >= totalPages - 2) {
      start = Math.max(2, totalPages - 4);
      end = totalPages - 1;
    }

    if (start > 2) items.push('ellipsis-start');
    for (let page = start; page <= end; page += 1) items.push(page);
    if (end < totalPages - 1) items.push('ellipsis-end');

    items.push(totalPages);
    return items;
  }

  /* --- Directory page --- */

  function initDirectory() {
    if (directoryPromise) return directoryPromise;
    directoryPromise = setupDirectory();
    return directoryPromise;
  }

  async function setupDirectory() {
    const searchInput = document.getElementById('directorySearch');
    const langFilter = document.getElementById('langFilter');
    const grid = document.getElementById('translatorGrid');
    const countEl = document.getElementById('resultsCount');
    const paginationEl = document.getElementById('pagination');

    if (!grid) return;

    if (countEl) countEl.textContent = 'Loading translators…';
    if (paginationEl) paginationEl.innerHTML = '';
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = loadingHtml();

    let raw;
    try {
      raw = await loadTranslatorsData();
    } catch (error) {
      grid.removeAttribute('aria-busy');
      grid.innerHTML = loadErrorHtml();
      if (countEl) countEl.textContent = '';
      return;
    }

    const all = getPreparedTranslators(raw);
    state.raw = raw;
    state.all = all;
    state.filtered = all.slice();
    state.languages = getUniqueLanguages(all);
    state.page = 1;

    if (langFilter) {
      const fragment = document.createDocumentFragment();
      const allOption = document.createElement('option');
      allOption.value = '';
      allOption.textContent = 'All Languages';
      fragment.appendChild(allOption);

      state.languages.forEach(function (language) {
        const option = document.createElement('option');
        option.value = language;
        option.textContent = language;
        fragment.appendChild(option);
      });

      langFilter.replaceChildren(fragment);
    }

    const prefersReducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function renderPagination(totalPages) {
      if (!paginationEl) return;

      if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
      }

      const items = buildPageItems(state.page, totalPages);
      const parts = [];

      parts.push(
        '<button type="button" class="page-btn page-prev" data-page="' + (state.page - 1) + '"' +
        (state.page === 1 ? ' disabled' : '') + ' aria-label="Previous page">Previous</button>'
      );

      items.forEach(function (item) {
        if (typeof item === 'string') {
          parts.push('<span class="page-ellipsis" aria-hidden="true">…</span>');
        } else {
          const isCurrent = item === state.page;
          parts.push(
            '<button type="button" class="page-btn' + (isCurrent ? ' active' : '') + '"' +
            ' data-page="' + item + '"' +
            (isCurrent ? ' aria-current="page"' : '') +
            ' aria-label="Page ' + item + '">' + item + '</button>'
          );
        }
      });

      parts.push(
        '<button type="button" class="page-btn page-next" data-page="' + (state.page + 1) + '"' +
        (state.page === totalPages ? ' disabled' : '') + ' aria-label="Next page">Next</button>'
      );

      paginationEl.innerHTML = parts.join('');
    }

    function renderPage() {
      const total = state.filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;

      const start = total ? (state.page - 1) * PAGE_SIZE : 0;
      const end = Math.min(start + PAGE_SIZE, total);

      grid.removeAttribute('aria-busy');

      if (countEl) {
        countEl.textContent = total
          ? 'Showing ' + (start + 1) + '–' + end + ' of ' + total + ' translators'
          : 'Showing 0 of 0 translators';
      }

      if (!total) {
        grid.innerHTML = noResultsHtml();
        if (paginationEl) paginationEl.innerHTML = '';
        return;
      }

      const pageItems = state.filtered.slice(start, end);
      grid.innerHTML = pageItems.map(buildTranslatorCard).join('');
      renderPagination(totalPages);
    }

    function applyFilters() {
      const query = searchInput ? searchInput.value : '';
      const language = langFilter ? langFilter.value : '';

      state.filtered = filterTranslators(query, language, all);
      state.page = 1;
      renderPage();
    }

    let debounceTimer = null;

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        window.clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(applyFilters, SEARCH_DEBOUNCE_MS);
      });
    }

    if (langFilter) {
      langFilter.addEventListener('change', applyFilters);
    }

    if (paginationEl) {
      paginationEl.addEventListener('click', function (event) {
        const button = event.target.closest('button[data-page]');
        if (!button || button.disabled) return;

        const requestedPage = parseInt(button.getAttribute('data-page'), 10);
        if (!Number.isFinite(requestedPage)) return;

        const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
        const nextPage = Math.min(Math.max(1, requestedPage), totalPages);
        if (nextPage === state.page) return;

        state.page = nextPage;
        renderPage();

        if (countEl && countEl.scrollIntoView) {
          countEl.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start'
          });
        }
      });
    }

    // Support search queries coming from the homepage.
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get('q');
    if (initialQuery && searchInput) {
      searchInput.value = initialQuery;
      state.filtered = filterTranslators(initialQuery, '', all);
      state.page = 1;
    }

    renderPage();
  }

  /* --- Verification page --- */

  function verifyTranslator(regNumber, translators) {
    const query = String(regNumber == null ? '' : regNumber).trim().toUpperCase();
    if (!query) return null;

    const list = translators || state.raw ||
      (Array.isArray(window.TRANSLATORS) ? window.TRANSLATORS : []);

    return list.find(function (translator) {
      return String(translator.regNumber == null ? '' : translator.regNumber)
        .trim()
        .toUpperCase() === query;
    }) || null;
  }

  function initVerification() {
    if (verificationInitialized) return;

    const input = document.getElementById('verifyInput');
    const button = document.getElementById('verifyBtn');
    const resultDiv = document.getElementById('verifyResult');

    if (!input || !button || !resultDiv) return;

    verificationInitialized = true;

    const initialDataPromise = loadTranslatorsData();
    initialDataPromise.catch(function () {
      // The click handler retries the load and shows a friendly error.
    });

    async function getTranslatorsForVerification() {
      try {
        return await initialDataPromise;
      } catch (error) {
        return await loadTranslatorsData();
      }
    }

    async function runVerification() {
      const registration = input.value.trim();

      if (!registration) {
        resultDiv.className = 'verify-result show error';
        resultDiv.innerHTML = '' +
          '<div class="verify-result-icon" aria-hidden="true">❌</div>' +
          '<h4>Registration Required</h4>' +
          '<p>Please enter a registration number.</p>';
        return;
      }

      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = 'Verifying…';

      try {
        const translators = await getTranslatorsForVerification();
        showVerifyResult(resultDiv, verifyTranslator(registration, translators), registration);
      } catch (error) {
        resultDiv.className = 'verify-result show error';
        resultDiv.innerHTML = '' +
          '<div class="verify-result-icon" aria-hidden="true">⚠️</div>' +
          '<h4>Unable to Verify</h4>' +
          '<p>Translator data could not be loaded. Please refresh the page and try again.</p>';
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }

    button.addEventListener('click', runVerification);

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        runVerification();
      }
    });
  }

  function showVerifyResult(container, translator, query) {
    container.classList.add('show');

    if (translator) {
      const languages = extractLanguages(translator);

      container.className = 'verify-result show success';
      container.innerHTML = '' +
        '<div class="verify-result-icon" aria-hidden="true">✅</div>' +
        '<h4>Verified — Registration Found</h4>' +
        '<p><strong>Name:</strong> ' + escapeHtml(translator.name) + '</p>' +
        '<p><strong>Registration:</strong> ' + escapeHtml(translator.regNumber) + '</p>' +
        '<p><strong>Address:</strong> ' + escapeHtml(translator.address) + '</p>' +
        '<p><strong>Languages:</strong> ' + escapeHtml(languages.join(' | ') || 'Not available') + '</p>';
      return;
    }

    container.className = 'verify-result show error';
    container.innerHTML = '' +
      '<div class="verify-result-icon" aria-hidden="true">❌</div>' +
      '<h4>Not Found</h4>' +
      '<p>No translator found with registration number "' + escapeHtml(query) + '".</p>' +
      '<p>Please check the number and try again.</p>' +
      '<p class="verify-submit-hint">If you\'re a translator and not found in this database ' +
        '<a href="https://docs.google.com/forms/d/e/1FAIpQLSc1_6XTHjHtW1VeeOCkSzHi_gAOA1xgQkGkC7gN8vFn19-XTg/viewform?usp=header" target="_blank" rel="noopener noreferrer">please submit your details</a>.' +
      '</p>';
  }

  /* --- Public API --- */

  window.loadTranslatorsData = loadTranslatorsData;
  window.getPreparedTranslators = getPreparedTranslators;
  window.getUniqueLanguages = getUniqueLanguages;
  window.getLanguageOptions = getLanguageOptions;
  window.filterTranslators = filterTranslators;
  window.verifyTranslator = verifyTranslator;
  window.initDirectory = initDirectory;
  window.initVerification = initVerification;

  /* --- Auto-initialise the current page --- */

  function autoInit() {
    if (document.getElementById('translatorGrid')) initDirectory();
    if (document.getElementById('verifyInput')) initVerification();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
