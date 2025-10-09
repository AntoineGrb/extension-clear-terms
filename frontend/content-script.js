/**
 * Content Script - Détection automatique des CGU
 * Injecté sur toutes les pages pour détecter et analyser les CGU
 *
 * Architecture modulaire :
 * - config.js : Constantes et critères de détection
 * - exclusions.js : Filtrage des moteurs de recherche
 * - extraction.js : Extraction du contenu de page
 * - detection.js : Logique de détection et validation
 * - toast.js : Interface utilisateur (notifications)
 */

// ========================================
// LISTENERS
// ========================================

/**
 * Écouter les messages de la popup (pour validation manuelle)
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VALIDATE_CONTENT') {
    const validation = validateTermsPage(message.content);
    sendResponse(validation);
  }

  // Extraction de contenu pour scan manuel (même logique que scan auto)
  if (message.type === 'EXTRACT_CONTENT') {
    const { text, url } = extractCleanContent();
    sendResponse({ content: text, url: url });
  }

  return true; // Réponse asynchrone
});

// ========================================
// INITIALISATION
// ========================================

// Lancer la détection au chargement de la page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Attendre un peu que le contenu dynamique se charge
    setTimeout(detectAndAnalyze, 500);
  });
} else {
  // Si la page est déjà chargée, lancer immédiatement
  // (mais avec un petit délai pour les SPAs)
  setTimeout(detectAndAnalyze, 500);
}

console.log('[Clear Terms] Content script chargé ✓');
