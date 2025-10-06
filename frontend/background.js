// Service Worker pour Clear Terms
// Permet de consulter les logs et gérer les événements en arrière-plan

console.log('🚀 Clear Terms Service Worker démarré');

// Écouter les messages depuis le popup ou content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message reçu:', message);

  if (message.type === 'ANALYSIS_STARTED') {
    console.log('🔍 Analyse démarrée pour:', message.url);
    console.log('📊 Job ID:', message.jobId);
  }

  if (message.type === 'ANALYSIS_COMPLETE') {
    console.log('✅ Analyse terminée pour:', message.url);
    console.log('📋 Rapport complet:');
    console.log(JSON.stringify(message.report, null, 2));
  }

  if (message.type === 'ANALYSIS_ERROR') {
    console.error('❌ Erreur d\'analyse:', message.error);
    console.error('🔗 URL:', message.url);
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
