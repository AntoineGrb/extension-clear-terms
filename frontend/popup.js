const BACKEND_URL = 'http://localhost:3000';
const POLL_INTERVAL = 2000; // 2 secondes
const MAX_POLL_ATTEMPTS = 60; // 2 minutes max

// ========================================
// Helpers
// ========================================

/**
 * Extrait le texte de la page active
 */
async function extractPageContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error('Impossible de récupérer l\'onglet actif');
  }

  // Injecter un script pour extraire le texte
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Supprimer les éléments inutiles
      const clone = document.cloneNode(true);
      const elementsToRemove = clone.querySelectorAll('script, style, nav, header, footer, aside');
      elementsToRemove.forEach(el => el.remove());

      return {
        text: clone.body.innerText || clone.body.textContent,
        url: window.location.href
      };
    }
  });

  return results[0]?.result;
}

/**
 * Lance une analyse
 */
async function startScan(url, content, userLanguage) {
  const response = await fetch(`${BACKEND_URL}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, content, user_language_preference: userLanguage })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors du lancement de l\'analyse');
  }

  return await response.json();
}

/**
 * Poll un job jusqu'à ce qu'il soit terminé
 */
async function pollJob(jobId) {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const response = await fetch(`${BACKEND_URL}/jobs/${jobId}`);

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération du statut du job');
    }

    const job = await response.json();

    if (job.status === 'done') {
      return job.result;
    }

    if (job.status === 'error') {
      throw new Error(job.error || 'Erreur lors de l\'analyse');
    }

    // Attendre avant le prochain poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error('Timeout : l\'analyse a pris trop de temps');
}

/**
 * Calcule le grade (A-E) basé sur les catégories
 */
function calculateGrade(categories) {
  const statusCounts = { green: 0, amber: 0, red: 0, na: 0 };

  Object.values(categories).forEach(cat => {
    if (cat.status === 'n/a') statusCounts.na++;
    else statusCounts[cat.status]++;
  });

  const total = statusCounts.green + statusCounts.amber + statusCounts.red;
  if (total === 0) return 'E';

  const score = (statusCounts.green * 2 + statusCounts.amber) / (total * 2);

  if (score >= 0.8) return 'A';
  if (score >= 0.6) return 'B';
  if (score >= 0.4) return 'C';
  if (score >= 0.2) return 'D';
  return 'E';
}

/**
 * Obtient le nom de domaine depuis une URL
 */
function getDomainName(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Site web';
  }
}

/**
 * Applique les traductions à tous les éléments avec data-i18n
 */
function applyTranslations(lang) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = i18n.t(key, lang);

    // Pour les éléments avec du contenu mixte (comme les <li> avec emojis)
    // on préserve la structure HTML interne
    if (key.includes('aboutContent.status')) {
      // Cas spéciaux pour les statuts avec emojis
      const parts = translation.split(':');
      if (parts.length === 2) {
        const emoji = el.querySelector('.font-medium');
        if (emoji) {
          emoji.textContent = parts[0] + ' :';
          el.childNodes[el.childNodes.length - 1].textContent = parts[1];
        } else {
          el.textContent = translation;
        }
      } else {
        el.textContent = translation;
      }
    } else {
      el.textContent = translation;
    }
  });

  // Traduire les attributs title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.setAttribute('title', i18n.t(key, lang));
  });
}

/**
 * Affiche le rapport
 */
function displayReport(report) {
  const { site_name, categories, metadata } = report;

  // Calculer le grade
  const grade = calculateGrade(categories);

  // Afficher le nom du site (de l'IA)
  document.getElementById('siteName').textContent = site_name || 'Site web';

  // Récupérer la langue pour la date
  chrome.storage.local.get(['userLanguage'], (result) => {
    const lang = result.userLanguage || 'fr';
    const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

    // Afficher la date d'analyse
    const analysisDate = metadata?.analyzed_at
      ? new Date(metadata.analyzed_at).toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      : new Date().toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

    const analyzedLabel = i18n.t('analyzedOn', lang);
    document.getElementById('analysisDate').textContent = `${analyzedLabel} ${analysisDate}`;

    // Trier et afficher les catégories par ordre : red > amber > green
    const sortOrder = { red: 0, amber: 1, green: 2, 'n/a': 3 };
    const sortedCategories = Object.entries(categories)
      .filter(([_, cat]) => cat.status !== 'n/a')
      .sort(([_, a], [__, b]) => sortOrder[a.status] - sortOrder[b.status]);

    // Générer les cartes de catégories avec traduction
    const categoriesEl = document.getElementById('categoriesList');
    const categoryColors = {
      green: 'bg-emerald-50 border-emerald-500',
      amber: 'bg-amber-50 border-amber-500',
      red: 'bg-red-50 border-red-500'
    };

    categoriesEl.innerHTML = sortedCategories
      .map(([key, cat]) => `
        <div class="p-3 rounded-md border-l-4 ${categoryColors[cat.status]}">
          <div class="text-sm font-semibold text-gray-900 mb-1.5">${i18n.t(`categories.${key}`, lang)}</div>
          <div class="text-xs text-gray-600 leading-relaxed">${cat.comment}</div>
        </div>
      `)
      .join('');
  });

  // Afficher le grade avec Tailwind colors
  const gradeEl = document.getElementById('grade');
  gradeEl.textContent = grade;
  const gradeColors = {
    A: 'bg-emerald-500',
    B: 'bg-lime-500',
    C: 'bg-amber-500',
    D: 'bg-red-500',
    E: 'bg-red-600'
  };
  gradeEl.className = `w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0 ${gradeColors[grade] || 'bg-gray-400'}`;

  // Compter les badges
  const statusCounts = { green: 0, amber: 0, red: 0 };
  Object.values(categories).forEach(cat => {
    if (cat.status !== 'n/a') {
      statusCounts[cat.status]++;
    }
  });

  // Afficher les badges avec Tailwind
  const badgesEl = document.getElementById('badges');
  badgesEl.innerHTML = `
    <div class="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">${statusCounts.green} ✓</div>
    <div class="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">${statusCounts.amber} ⚠</div>
    <div class="px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-700">${statusCounts.red} ✗</div>
  `;

  // Afficher la section rapport
  document.getElementById('reportSection').classList.remove('hidden');

  // Afficher le contenu déplié par défaut
  const content = document.getElementById('reportContent');
  content.classList.remove('hidden');

  // Ajouter l'événement toggle pour l'accordéon
  const toggleBtn = document.getElementById('reportToggle');
  toggleBtn.onclick = () => {
    content.classList.toggle('hidden');
  };

  // Sauvegarder le rapport
  chrome.storage.local.set({ lastReport: report });
}

/**
 * Met à jour le statut (mode textuel moderne)
 */
function updateStatus(messageKey, type = '') {
  const statusEl = document.getElementById('status');

  const icons = {
    loading: '<svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>',
    success: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
    error: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
  };

  const styles = {
    loading: 'text-blue-600 bg-blue-50',
    success: 'text-green-600 bg-green-50',
    error: 'text-red-600 bg-red-50'
  };

  if (type && messageKey) {
    // Récupérer la langue pour traduire le message
    chrome.storage.local.get(['userLanguage'], (result) => {
      const lang = result.userLanguage || 'fr';

      // Si le message commence par "statusError:", on concatène
      let message;
      if (messageKey.startsWith('ERROR:')) {
        const errorText = messageKey.substring(6);
        message = `${i18n.t('statusError', lang)} ${errorText}`;
      } else {
        message = i18n.t(messageKey, lang);
      }

      statusEl.innerHTML = `
        <div class="flex items-center gap-2 mt-3 p-3 rounded-md ${styles[type] || ''}">
          ${icons[type] || ''}
          <span class="text-xs font-medium">${message}</span>
        </div>
      `;
    });
  } else {
    statusEl.innerHTML = '';
  }
}

// ========================================
// Event Handlers
// ========================================

document.getElementById('scanButton').addEventListener('click', async () => {
  const button = document.getElementById('scanButton');
  button.disabled = true;

  let currentUrl = 'unknown';

  try {
    updateStatus('statusExtracting', 'loading');

    // Extraire le contenu
    const { text, url } = await extractPageContent();
    currentUrl = url;

    if (!text || text.length < 100) {
      throw new Error('Le contenu de la page est trop court pour être analysé');
    }

    updateStatus('statusSending', 'loading');

    // Récupérer la préférence de langue
    const userLanguage = await loadLanguagePreference();

    // Lancer l'analyse
    const { job_id } = await startScan(url, text, userLanguage);

    // Logger le démarrage de l'analyse dans le service worker
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_STARTED',
      url,
      jobId: job_id
    });

    updateStatus('statusAnalyzing', 'loading');

    // Attendre le résultat
    const report = await pollJob(job_id);

    updateStatus('statusComplete', 'success');

    // Logger le rapport complet dans le service worker
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_COMPLETE',
      url,
      report
    });

    // Afficher le rapport
    displayReport(report);

  } catch (error) {
    console.error('Erreur:', error);

    // Logger l'erreur dans le service worker
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_ERROR',
      url: currentUrl,
      error: error.message
    });

    updateStatus(`ERROR:${error.message}`, 'error');
  } finally {
    button.disabled = false;
  }
});

// ========================================
// Navigation
// ========================================

/**
 * Affiche la page paramètres
 */
function showSettingsPage() {
  document.getElementById('mainPage').classList.add('hidden');
  document.getElementById('settingsPage').classList.remove('hidden');
}

/**
 * Affiche la page principale
 */
function showMainPage() {
  document.getElementById('settingsPage').classList.add('hidden');
  document.getElementById('mainPage').classList.remove('hidden');
}

/**
 * Détecte la langue du navigateur
 */
function detectBrowserLanguage() {
  const browserLang = navigator.language || navigator.userLanguage;
  // Extraire le code langue (ex: "en-US" -> "en", "fr-FR" -> "fr")
  const langCode = browserLang.split('-')[0].toLowerCase();

  // Retourner 'fr' ou 'en', défaut 'en' si non supporté
  return ['fr', 'en'].includes(langCode) ? langCode : 'en';
}

/**
 * Charge la préférence de langue
 */
async function loadLanguagePreference() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['userLanguage'], (result) => {
      // Si pas de préférence sauvegardée, utiliser la langue du navigateur
      if (!result.userLanguage) {
        const detectedLang = detectBrowserLanguage();
        resolve(detectedLang);
      } else {
        resolve(result.userLanguage);
      }
    });
  });
}

/**
 * Sauvegarde la préférence de langue
 */
function saveLanguagePreference(lang) {
  chrome.storage.local.set({ userLanguage: lang });
}

// Event listeners pour la navigation
document.getElementById('settingsButton').addEventListener('click', () => {
  showSettingsPage();
});

document.getElementById('backButton').addEventListener('click', () => {
  showMainPage();
});

// Event listener pour le changement de langue
document.getElementById('languageSelect').addEventListener('change', (e) => {
  const newLang = e.target.value;
  saveLanguagePreference(newLang);
  applyTranslations(newLang); // Appliquer immédiatement les traductions

  // Rafraîchir le rapport si présent
  chrome.storage.local.get(['lastReport'], (result) => {
    if (result.lastReport) {
      displayReport(result.lastReport);
    }
  });
});

// Navigation vers À propos
document.getElementById('aboutButton').addEventListener('click', () => {
  document.getElementById('mainPage').classList.add('hidden');
  document.getElementById('aboutPage').classList.remove('hidden');
});

document.getElementById('backFromAbout').addEventListener('click', () => {
  document.getElementById('aboutPage').classList.add('hidden');
  document.getElementById('mainPage').classList.remove('hidden');
});

// Navigation vers Terms
document.getElementById('termsButton').addEventListener('click', () => {
  document.getElementById('mainPage').classList.add('hidden');
  document.getElementById('termsPage').classList.remove('hidden');
});

document.getElementById('backFromTerms').addEventListener('click', () => {
  document.getElementById('termsPage').classList.add('hidden');
  document.getElementById('mainPage').classList.remove('hidden');
});

// ========================================
// Initialisation
// ========================================

// Charger le dernier rapport et la langue au démarrage
chrome.storage.local.get(['lastReport', 'userLanguage'], (result) => {
  // Définir la langue (préférence utilisateur ou détection navigateur)
  let lang;
  if (result.userLanguage) {
    lang = result.userLanguage;
  } else {
    // Première utilisation : détecter la langue du navigateur
    lang = detectBrowserLanguage();
    // Sauvegarder cette détection comme préférence initiale
    saveLanguagePreference(lang);
  }

  document.getElementById('languageSelect').value = lang;

  // Appliquer les traductions
  applyTranslations(lang);

  // Charger le dernier rapport si présent
  if (result.lastReport) {
    displayReport(result.lastReport);
  }
});
