// ========================================
// IMPORTS (via script tags dans popup.html)
// i18n.js, utils/*.js, services/*.js sont chargés avant ce fichier
// ========================================

// ========================================
// Event Handlers
// ========================================

// Handler pour le bouton d'analyse
document.getElementById('scanButton').addEventListener('click', async () => {
  const button = document.getElementById('scanButton');
  button.disabled = true;
  button.classList.add('opacity-50', 'cursor-not-allowed');

  let currentUrl = 'unknown';

  try {
    updateStatus('statusExtracting', 'loading');

    // Extraire le contenu
    const { content: text, url } = await extractPageContent();
    currentUrl = url;

    if (!text || text.length < 100) {
      throw new Error('Le contenu de la page est trop court pour être analysé');
    }

    const contentHash = await calculateHashInPopup(text);
    console.log('📊 [MANUEL] Hash du contenu:', contentHash);
    console.log('📏 [MANUEL] Longueur du contenu:', text.length, 'caractères');

    // VALIDATION : Vérifier que c'est bien des CGU
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const validation = await chrome.tabs.sendMessage(tab.id, {
        type: 'VALIDATE_CONTENT',
        content: text
      });

      if (!validation.valid) {
        // Message d'erreur simplifié pour l'utilisateur
        const lang = await loadLanguagePreference();
        const message = i18n.t('notCGUPage', lang);
        updateStatus(`ERROR:${message}`, 'error');
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
        return;
      }

      console.log('[Clear Terms] Validation réussie ✓');

    } catch (validationError) {
      console.warn('[Clear Terms] Impossible de valider (content script non chargé?):', validationError);
      // Continuer quand même l'analyse en cas d'erreur de validation
    }

    updateStatus('statusSending', 'loading');

    // Récupérer la préférence de langue
    const userLanguage = await loadLanguagePreference();

    // Lancer l'analyse
    const { job_id } = await startScan(url, text, userLanguage);

    chrome.runtime.sendMessage({
      type: 'ANALYSIS_STARTED',
      url,
      jobId: job_id
    });

    updateStatus('statusAnalyzing', 'loading');

    // Attendre le résultat
    const report = await pollJob(job_id);

    updateStatus('statusComplete', 'success');

    // Ajouter au reportsHistory
    await addToReportsHistory(report);

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
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_ERROR',
      url: currentUrl,
      error: error.message
    });

    updateStatus(`ERROR:${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('opacity-50', 'cursor-not-allowed');
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

// Event listeners pour la navigation
document.getElementById('settingsButton').addEventListener('click', () => {
  showSettingsPage();
});

document.getElementById('backButton').addEventListener('click', () => {
  showMainPage();
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

// Navigation vers l'historique
document.getElementById('historyLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/history/history.html') });
});

// ========================================
// Paramètres
// ========================================

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

// Event listener pour l'activation/désactivation du toast
document.getElementById('toastEnabled').addEventListener('change', (e) => {
  chrome.storage.local.set({ toastEnabled: e.target.checked });
  console.log('[Clear Terms] Détection automatique:', e.target.checked ? 'activée' : 'désactivée');
});

// Event listener pour la position du toast
document.getElementById('toastPosition').addEventListener('change', (e) => {
  chrome.storage.local.set({ toastPosition: e.target.value });
  console.log('[Clear Terms] Position du toast:', e.target.value);
});

// Event listener pour la durée du toast
document.getElementById('toastDuration').addEventListener('change', (e) => {
  chrome.storage.local.set({ toastDuration: parseInt(e.target.value) });
  console.log('[Clear Terms] Durée du toast:', e.target.value, 'ms');
});

// Event listener pour copier l'URL
document.getElementById('copyUrlButton').addEventListener('click', async (e) => {
  e.stopPropagation(); // Ne pas déclencher l'accordéon

  const urlElement = document.getElementById('analyzedUrl');
  const fullUrl = urlElement.dataset.fullUrl;

  try {
    await navigator.clipboard.writeText(fullUrl);

    // Feedback visuel
    e.currentTarget.classList.remove('text-gray-400');
    e.currentTarget.classList.add('text-green-500');

    setTimeout(() => {
      e.currentTarget.classList.remove('text-green-500');
      e.currentTarget.classList.add('text-gray-400');
    }, 1000);

    console.log('[Clear Terms] URL copiée:', fullUrl);
  } catch (error) {
    console.error('[Clear Terms] Erreur copie URL:', error);
  }
});

// ========================================
// Initialisation
// ========================================

// Charger le dernier rapport et la langue au démarrage
chrome.storage.local.get(['lastReport', 'userLanguage'], async (result) => {
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

  // Charger l'état de la détection automatique et les préférences du toast
  chrome.storage.local.get(['toastEnabled', 'toastPosition', 'toastDuration'], (toastResult) => {
    const toastEnabled = toastResult.toastEnabled !== false; // Activé par défaut
    document.getElementById('toastEnabled').checked = toastEnabled;

    const toastPosition = toastResult.toastPosition || 'bottom-right';
    document.getElementById('toastPosition').value = toastPosition;

    const toastDuration = toastResult.toastDuration !== undefined ? toastResult.toastDuration : 5000;
    document.getElementById('toastDuration').value = toastDuration.toString();
  });

  // Vérifier si une analyse auto est en cours pour l'onglet actif
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const autoJobKey = `autoJob_${tab.id}`;

    chrome.storage.local.get([autoJobKey], (jobResult) => {
      const autoJob = jobResult[autoJobKey];

      if (autoJob && autoJob.status === 'running') {
        // Analyse auto en cours : afficher le loader et griser le bouton
        console.log('[Clear Terms] Analyse auto en cours, affichage du loader');
        const button = document.getElementById('scanButton');
        button.disabled = true;
        button.classList.add('opacity-50', 'cursor-not-allowed');
        updateStatus('statusAnalyzing', 'loading');
        continuePollingFromPopup(autoJob.jobId);
      } else {
        // Pas d'analyse en cours : afficher le dernier rapport global
        if (result.lastReport) {
          console.log('[Clear Terms] Pas d\'analyse en cours, affichage du dernier rapport global');
          displayReport(result.lastReport);
        }
      }
    });
  } catch (error) {
    console.error('[Clear Terms] Erreur lors de la vérification de l\'analyse auto:', error);
    // Fallback: afficher le dernier rapport si disponible
    if (result.lastReport) {
      displayReport(result.lastReport);
    }
  }
});

/**
 * Continue le polling d'un job depuis la popup
 */
async function continuePollingFromPopup(jobId) {
  const button = document.getElementById('scanButton');
  try {
    const report = await pollJob(jobId);
    updateStatus('statusComplete', 'success');
    displayReport(report);
  } catch (error) {
    console.error('[Clear Terms] Erreur lors du polling depuis la popup:', error);
    updateStatus(`ERROR:${error.message}`, 'error');
  } finally {
    // Réactiver le bouton une fois l'analyse terminée
    button.disabled = false;
    button.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}

/**
 * Ajoute un rapport à l'historique
 */
async function addToReportsHistory(report) {
  try {
    const { reportsHistory = [] } = await chrome.storage.local.get(['reportsHistory']);

    console.log('[Clear Terms] 📚 Ajout au reportsHistory...');
    console.log('[Clear Terms] Historique actuel:', reportsHistory.length, 'rapports');
    console.log('[Clear Terms] Nouveau rapport:', report.site_name);

    // Créer l'entrée d'historique
    const historyEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      report: report
    };

    // Ajouter au début du tableau (plus récent en premier)
    reportsHistory.unshift(historyEntry);

    // Limiter à 100 rapports max (FIFO)
    if (reportsHistory.length > 100) {
      reportsHistory.splice(100);
    }

    // Sauvegarder
    await chrome.storage.local.set({ reportsHistory });
    console.log('[Clear Terms] ✅ Rapport ajouté à l\'historique. Total:', reportsHistory.length);

  } catch (error) {
    console.error('[Clear Terms] ❌ Erreur lors de l\'ajout au reportsHistory:', error);
  }
}
