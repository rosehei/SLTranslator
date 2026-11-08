/* ============================================
   Translators Data, Search, Filter & Verify
   ============================================ */

const TRANSLATORS = [
  {
    id: 1,
    regNumber: '1997/LL/PU/001',
    name: 'P.M. Thilakarathne',
    address: 'Kirimathiyana East, Lunuwilla',
    tel: '0777892610',
    lang1: 'Sinhala - English',
    lang2: null
  },
  {
    id: 2,
    regNumber: '1977/LL/KL/001',
    name: 'S.D. Cyril Sadanayake',
    address: '26, De Silva Road, Atabagoda, Panadura',
    tel: '0771926906',
    lang1: 'English - Sinhala',
    lang2: null
  },
  {
    id: 3,
    regNumber: '1979/LL/CO/001',
    name: 'D.A. Vincent',
    address: 'Not available',
    tel: '0776738956',
    lang1: 'English - Sinhala',
    lang2: null
  },
  {
    id: 4,
    regNumber: '1983/LL/CO/026',
    name: 'Premadasa D.',
    address: 'No:50/045, Edirisinghe Road, Mirihana',
    tel: '0115022984',
    lang1: 'Tamil - English',
    lang2: null
  },
  {
    id: 5,
    regNumber: '1985/LL/CO/003',
    name: 'Kurukulasuriya Patrick Peiris',
    address: 'No.26/3, Church Road, Welisara, Ragama',
    tel: '0771469078',
    lang1: 'Sinhala - Tamil',
    lang2: 'Tamil - English'
  },
  {
    id: 6,
    regNumber: '1989/LL/GA/001',
    name: 'M.S.M Faiserdeen',
    address: 'No.105, Kandy Road, Thihariya, Kalagedihena',
    tel: '0774009150',
    lang1: 'Sinhala - Tamil',
    lang2: 'Tamil - English'
  },
  {
    id: 7,
    regNumber: '1991/LL/CO/001',
    name: 'Liyanaarachchilage Asoka Lakshman Liyanaarachchi',
    address: '"Arosha", Kahawatte Ela, Polgahawela',
    tel: '0718299916',
    lang1: 'Sinhala - English',
    lang2: null
  },
  {
    id: 8,
    regNumber: '1992/LL/GA/001',
    name: 'H.M.D.A. Herath',
    address: '28, Kolawatta, Veyangoda',
    tel: '0332233032',
    lang1: 'Sinhala - English',
    lang2: null
  },
  {
    id: 9,
    regNumber: '1993/LL/BT/001',
    name: 'Nadarajah Mohanamoorthy',
    address: '50, 8th Cross Street, Kulavadi, Batticaloa',
    tel: '0773042894',
    lang1: 'Sinhala - English',
    lang2: null
  },
  {
    id: 10,
    regNumber: '1993/LL/CO/008',
    name: 'Navananthakumran N.',
    address: '6/025, Galpotha Street, Colombo 13',
    tel: '0775280700',
    lang1: 'Sinhala - English',
    lang2: 'English - Tamil'
  }
];

/* --- Get all unique language combinations --- */
function getLanguageOptions() {
  const langs = new Set();
  TRANSLATORS.forEach(t => {
    langs.add(t.lang1);
    if (t.lang2) langs.add(t.lang2);
  });
  return Array.from(langs).sort();
}

/* --- Search & Filter --- */
function filterTranslators(query = '', language = '') {
  const q = query.toLowerCase().trim();
  return TRANSLATORS.filter(t => {
    const matchesQuery = !q ||
      t.name.toLowerCase().includes(q) ||
      t.regNumber.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q) ||
      t.tel.includes(q);

    const matchesLang = !language ||
      t.lang1 === language ||
      t.lang2 === language;

    return matchesQuery && matchesLang;
  });
}

/* --- Render translator cards --- */
function renderTranslatorCards(translators, container) {
  if (!container) return;

  if (translators.length === 0) {
    container.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <h3>No translators found</h3>
        <p>Try adjusting your search terms or filters.</p>
      </div>`;
    return;
  }

  container.innerHTML = translators.map(t => {
    const initials = t.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const languages = [t.lang1, t.lang2].filter(Boolean);

    return `
      <div class="translator-card fade-in visible">
        <div class="translator-card-header">
          <div class="translator-avatar">${initials}</div>
          <div>
            <div class="translator-name">${t.name}</div>
            <span class="translator-reg">${t.regNumber}</span>
          </div>
        </div>
        <div class="translator-details">
          <div class="translator-detail">
            <span class="detail-icon">📍</span>
            <span>${t.address}</span>
          </div>
          <div class="translator-detail">
            <span class="detail-icon">📞</span>
            <span>${t.tel}</span>
          </div>
        </div>
        <div class="translator-languages">
          ${languages.map(l => `<span class="lang-tag">${l}</span>`).join('')}
        </div>
      </div>`;
  }).join('');
}

/* --- Verification lookup --- */
function verifyTranslator(regNumber) {
  const q = regNumber.trim().toUpperCase();
  return TRANSLATORS.find(t => t.regNumber.toUpperCase() === q) || null;
}

/* --- Initialize directory page --- */
function initDirectory() {
  const searchInput = document.getElementById('directorySearch');
  const langFilter = document.getElementById('langFilter');
  const grid = document.getElementById('translatorGrid');
  const countEl = document.getElementById('resultsCount');

  if (!grid) return;

  // Populate language filter
  if (langFilter) {
    getLanguageOptions().forEach(lang => {
      const opt = document.createElement('option');
      opt.value = lang;
      opt.textContent = lang;
      langFilter.appendChild(opt);
    });
  }

  function update() {
    const query = searchInput ? searchInput.value : '';
    const lang = langFilter ? langFilter.value : '';
    const results = filterTranslators(query, lang);
    renderTranslatorCards(results, grid);
    if (countEl) {
      countEl.textContent = `Showing ${results.length} of ${TRANSLATORS.length} translators`;
    }
  }

  if (searchInput) searchInput.addEventListener('input', update);
  if (langFilter) langFilter.addEventListener('change', update);

  // Initial render
  update();
}

/* --- Initialize verification page --- */
function initVerification() {
  const input = document.getElementById('verifyInput');
  const btn = document.getElementById('verifyBtn');
  const resultDiv = document.getElementById('verifyResult');

  if (!btn || !input || !resultDiv) return;

  btn.addEventListener('click', () => {
    const reg = input.value.trim();
    if (!reg) {
      showVerifyResult(resultDiv, null, 'Please enter a registration number.');
      return;
    }
    const translator = verifyTranslator(reg);
    showVerifyResult(resultDiv, translator, reg);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btn.click();
  });
}

function showVerifyResult(container, translator, query) {
  container.classList.add('show');

  if (translator) {
    container.className = 'verify-result show success';
    container.innerHTML = `
      <div class="verify-result-icon">✅</div>
      <h4>Verified — Registration Found</h4>
      <p><strong>Name:</strong> ${translator.name}</p>
      <p><strong>Registration:</strong> ${translator.regNumber}</p>
      <p><strong>Address:</strong> ${translator.address}</p>
      <p><strong>Languages:</strong> ${[translator.lang1, translator.lang2].filter(Boolean).join(' | ')}</p>`;
  } else {
    container.className = 'verify-result show error';
    container.innerHTML = `
      <div class="verify-result-icon">❌</div>
      <h4>Not Found</h4>
      <p>No translator found with registration number "${query}".</p>
      <p>Please check the number and try again, or contact the administration.</p>`;
  }
}
