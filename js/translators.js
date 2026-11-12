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

  function titleCaseNameToken(token) {
    return token.replace(/[A-Za-z]+/g, function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }

  function formatName(value) {
    let name = String(value == null ? '' : value)
      .replace(/\s+/g, ' ')
      .trim();

    if (!name) return '';

    const allCaps = /[A-Z]/.test(name) && name === name.toUpperCase();

    name = name
      .replace(/,\s*(?=[A-Za-z])/g, ', ')
      .replace(/\.(?=[A-Z]{3,}|[A-Z][a-z])/g, '. ');

    if (allCaps) {
      name = name.split(' ').map(function (token) {
        return token.indexOf('.') === -1 ? titleCaseNameToken(token) : token;
      }).join(' ');
    }

    return name.replace(/\s+/g, ' ').trim();
  }

  const MOBILE_PREFIXES = ['070', '071', '072', '075', '076', '077', '078'];
  const WHATSAPP_MESSAGE = 'Hello, I found your number from the website sltranslators.lk. Could I know your translation fee, please?';
  const WHATSAPP_ICON_SVG = '<svg class="whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';

  function normalizePhoneDigits(value) {
    return String(value == null ? '' : value).replace(/\D/g, '');
  }

  function normalizeNationalNumber(digits) {
    let value = digits;

    if (value.indexOf('0094') === 0) value = value.slice(2);

    if (value.indexOf('94') === 0 && value.length === 11) {
      value = '0' + value.slice(2);
    } else if (value.length === 9 && value.charAt(0) === '7') {
      value = '0' + value;
    }

    return value;
  }

  function isMobileNational(national) {
    return national.length === 10 &&
      MOBILE_PREFIXES.indexOf(national.slice(0, 3)) !== -1;
  }

  function extractPhoneNumbers(tel) {
    const text = String(tel == null ? '' : tel);
    const phones = [];
    const seen = new Set();
    const compact = text.replace(/[\s\-().]/g, '');
    const matches = compact.match(/(?:\+?94[\s-]?)?0?\d{9}/g) || [];

    matches.forEach(function (match) {
      const national = normalizeNationalNumber(normalizePhoneDigits(match));
      if (!national || seen.has(national)) return;

      seen.add(national);
      const mobile = isMobileNational(national);

      phones.push({
        display: national,
        national: national,
        isMobile: mobile,
        whatsapp: mobile ? '94' + national.slice(1) : null
      });
    });

    if (!phones.length) {
      const fallback = text.trim();
      if (fallback && !/^not available$/i.test(fallback) && fallback !== '-') {
        phones.push({
          display: fallback,
          national: '',
          isMobile: false,
          whatsapp: null
        });
      }
    }

    return phones;
  }

  function buildWhatsAppUrl(whatsappNumber) {
    return 'https://wa.me/' + whatsappNumber + '?text=' + encodeURIComponent(WHATSAPP_MESSAGE);
  }

  function hasUsableAddress(address) {
    const value = String(address == null ? '' : address).trim().toLowerCase();
    return Boolean(value) && value !== 'not available' && value !== '-';
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
      const phones = extractPhoneNumbers(translator.tel);
      const hasMobile = phones.some(function (phone) { return phone.isMobile; });
      const hasAddress = hasUsableAddress(translator.address);
      const searchParts = [
        translator.name,
        translator.regNumber,
        translator.address,
        translator.tel,
        translator.district,
        translator.lang1,
        translator.lang2,
        languages.join(' '),
        phones.map(function (phone) { return phone.display; }).join(' ')
      ];

      return {
        id: translator.id,
        regNumber: translator.regNumber || '',
        name: formatName(translator.name),
        address: translator.address || '',
        tel: translator.tel || '',
        district: translator.district || '',
        districtCode: translator.districtCode || '',
        lang1: translator.lang1 || null,
        lang2: translator.lang2 || null,
        languages: languages,
        phones: phones,
        hasMobile: hasMobile,
        hasAddress: hasAddress,
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

  function getUniqueDistricts(translators) {
    const list = translators || getPreparedTranslators();
    const districts = new Set();

    list.forEach(function (translator) {
      if (translator.district) districts.add(translator.district);
    });

    return Array.from(districts).sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function getDistrictOptions(translators) {
    return getUniqueDistricts(translators);
  }

  /* --- Search & filter --- */

  function profilePriority(translator) {
    if (translator.hasAddress && translator.hasMobile) return 3;
    if (translator.hasAddress) return 2;
    if (translator.hasMobile) return 1;
    return 0;
  }

  function filterTranslators(query, language, district, mobileOnly, translators) {
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
      const matchesDistrict = !district || translator.district === district;
      const matchesMobile = !mobileOnly || translator.hasMobile;

      return matchesQuery && matchesLanguage && matchesDistrict && matchesMobile;
    }).sort(function (a, b) {
      return profilePriority(b) - profilePriority(a);
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

  function buildPhonesHtml(translator) {
    const phones = translator.phones || [];

    if (!phones.length) {
      return '<div class="translator-detail">' +
        '<span class="detail-icon" aria-hidden="true">📞</span>' +
        '<span>Not available</span>' +
      '</div>';
    }

    return phones.map(function (phone) {
      if (phone.isMobile) {
        return '<div class="translator-detail">' +
          '<span class="detail-icon" aria-hidden="true">📱</span>' +
          '<a class="whatsapp-link" href="' + escapeHtml(buildWhatsAppUrl(phone.whatsapp)) + '"' +
            ' target="_blank" rel="noopener noreferrer"' +
            ' aria-label="Chat with ' + escapeHtml(translator.name) + ' on WhatsApp"' +
            ' title="Chat on WhatsApp">' +
            WHATSAPP_ICON_SVG +
            '<span>' + escapeHtml(phone.display) + '</span>' +
          '</a>' +
        '</div>';
      }

      return '<div class="translator-detail">' +
        '<span class="detail-icon" aria-hidden="true">📞</span>' +
        '<span>' + escapeHtml(phone.display) + '</span>' +
      '</div>';
    }).join('');
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
          buildPhonesHtml(translator) +
          (translator.district
            ? '<div class="translator-detail">' +
                '<span class="detail-icon" aria-hidden="true">🏛️</span>' +
                '<span>' + escapeHtml(translator.district) + '</span>' +
              '</div>'
            : '') +
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
        '<p>Try adjusting your search terms or filters.</p>' +
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
    const districtFilter = document.getElementById('districtFilter');
    const mobileOnlyFilter = document.getElementById('mobileOnlyFilter');
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
    state.filtered = filterTranslators('', '', '', false, all);
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

    if (districtFilter) {
      const fragment = document.createDocumentFragment();
      const allOption = document.createElement('option');
      allOption.value = '';
      allOption.textContent = 'All Districts';
      fragment.appendChild(allOption);

      getUniqueDistricts(all).forEach(function (district) {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        fragment.appendChild(option);
      });

      districtFilter.replaceChildren(fragment);
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
      const district = districtFilter ? districtFilter.value : '';
      const mobileOnly = mobileOnlyFilter ? mobileOnlyFilter.checked : false;

      state.filtered = filterTranslators(query, language, district, mobileOnly, all);
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

    if (districtFilter) {
      districtFilter.addEventListener('change', applyFilters);
    }

    if (mobileOnlyFilter) {
      mobileOnlyFilter.addEventListener('change', applyFilters);
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
      state.filtered = filterTranslators(initialQuery, '', '', false, all);
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
        '<p><strong>Name:</strong> ' + escapeHtml(formatName(translator.name)) + '</p>' +
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
  window.getUniqueDistricts = getUniqueDistricts;
  window.getDistrictOptions = getDistrictOptions;
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
