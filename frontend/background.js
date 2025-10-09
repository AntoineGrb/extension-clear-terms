// Service Worker pour Clear Terms
// Permet de consulter les logs et gérer les événements en arrière-plan

const BACKEND_URL = 'http://localhost:3000'; //TODO : Mettre en config/env
const POLL_INTERVAL = 2000;
const MAX_POLL_ATTEMPTS = 60;

console.log('🚀 Clear Terms Service Worker démarré');

/**
 * Calcule le hash SHA-256 d'un contenu
 * Pour debug et vérification de cohérence cache
 */
async function calculateHash(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Détecte la langue du navigateur
 */
function detectBrowserLanguage() {
  const browserLang = navigator.language || 'en';
  const langCode = browserLang.split('-')[0].toLowerCase();
  return ['fr', 'en'].includes(langCode) ? langCode : 'en';
}

/**
 * Gère l'analyse automatique en arrière-plan
 */
async function handleAutoAnalysis(url, content, tabId) {
  try {
    console.log('🔍 Analyse automatique lancée pour:', url);

    // NOUVEAU : Calculer et logger le hash pour debug
    const contentHash = await calculateHash(content);
    console.log('📊 [AUTO] Hash du contenu:', contentHash);
    console.log('📏 [AUTO] Longueur du contenu:', content.length, 'caractères');

    // Récupérer la langue de l'utilisateur
    const { userLanguage } = await chrome.storage.local.get(['userLanguage']);
    const lang = userLanguage || detectBrowserLanguage();

    // Lancer l'analyse
    const response = await fetch(`${BACKEND_URL}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        content,
        user_language_preference: lang
      })
    });

    if (!response.ok) {
      throw new Error('Erreur lors du lancement de l\'analyse');
    }

    const { job_id } = await response.json();
    console.log('📊 Job ID créé:', job_id);

    // Stocker le job pour cet onglet
    await chrome.storage.local.set({
      [`autoJob_${tabId}`]: {
        jobId: job_id,
        url,
        status: 'running',
        startedAt: Date.now()
      }
    });

    // Lancer le polling
    pollAutoJob(job_id, tabId);

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse auto:', error);
  }
}

/**
 * Poll un job automatique jusqu'à ce qu'il soit terminé
 */
async function pollAutoJob(jobId, tabId) {
  console.log('⏳ Polling du job:', jobId);

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

    try {
      const response = await fetch(`${BACKEND_URL}/jobs/${jobId}`);

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération du job');
      }

      const job = await response.json();

      if (job.status === 'done') {
        console.log('✅ Analyse auto terminée pour l\'onglet', tabId);

        // Sauvegarder le rapport
        await chrome.storage.local.set({
          lastReport: job.result,
          [`autoJob_${tabId}`]: {
            jobId,
            status: 'done',
            result: job.result,
            completedAt: Date.now()
          }
        });

        break;
      }

      if (job.status === 'error') {
        console.error('❌ Erreur lors de l\'analyse auto:', job.error);

        await chrome.storage.local.set({
          [`autoJob_${tabId}`]: {
            jobId,
            status: 'error',
            error: job.error
          }
        });

        break;
      }

    } catch (error) {
      console.error('❌ Erreur lors du polling:', error);
      break;
    }
  }
}

// Écouter les messages depuis le popup ou content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message reçu:', message);

  // Analyse manuelle (depuis le popup)
  if (message.type === 'ANALYSIS_STARTED') {
    console.log('🔍 Analyse manuelle démarrée pour:', message.url);
    console.log('📊 Job ID:', message.jobId);
  }

  if (message.type === 'ANALYSIS_COMPLETE') {
    console.log('✅ Analyse manuelle terminée pour:', message.url);
    console.log('📋 Rapport complet:');
    console.log(JSON.stringify(message.report, null, 2));
  }

  if (message.type === 'ANALYSIS_ERROR') {
    console.error('❌ Erreur d\'analyse manuelle:', message.error);
    console.error('🔗 URL:', message.url);
  }

  // Analyse automatique (depuis le content script)
  if (message.type === 'AUTO_ANALYZE') {
    console.log('🤖 Demande d\'analyse automatique reçue');
    const tabId = sender.tab?.id;
    if (tabId) {
      handleAutoAnalysis(message.url, message.content, tabId);
    }
  }

  // Ouvrir la popup (depuis le toast)
  if (message.type === 'OPEN_POPUP') {
    console.log('📂 Ouverture de la popup demandée');
    chrome.action.openPopup();
  }

  sendResponse({ received: true });
  return true;
});

// Écouter l'installation de l'extension
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎉 Clear Terms installé pour la première fois');
  } else if (details.reason === 'update') {
    console.log('🔄 Clear Terms mis à jour vers la version', chrome.runtime.getManifest().version);
  }
});

// Logger les erreurs non gérées
self.addEventListener('error', (event) => {
  console.error('💥 Erreur non gérée dans le service worker:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('💥 Promise rejetée non gérée:', event.reason);
});
