// ========================================
// IMPORTS (via script tags dans popup.html)
// i18n.js, utils/*.js, services/*.js sont chargés avant ce fichier
// ========================================

// ========================================
// Event Handlers
// ========================================

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

    // NOUVEAU : Calculer et logger le hash pour debug
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

  // Charger l'état de la détection automatique
  chrome.storage.local.get(['toastEnabled'], (toastResult) => {
    const toastEnabled = toastResult.toastEnabled !== false; // Activé par défaut
    document.getElementById('toastEnabled').checked = toastEnabled;
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
      } else if (autoJob && autoJob.status === 'done') {
        // Analyse auto terminée : afficher le rapport
        console.log('[Clear Terms] Analyse auto terminée, affichage du rapport');
        displayReport(autoJob.result);
      } else if (result.lastReport) {
        // Pas d'analyse auto, afficher le dernier rapport si disponible
        displayReport(result.lastReport);
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
