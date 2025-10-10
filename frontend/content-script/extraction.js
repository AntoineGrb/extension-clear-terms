// ========================================
// EXTRACTION DE CONTENU (partagée auto + manuel)
// ========================================

/**
 * Extrait le contenu nettoyé de la page
 * Utilisé pour scan auto ET manuel (garantit le même hash)
 * IMPORTANT: Utilise textContent (pas innerText) pour cohérence
 */
function extractCleanContent() {
  try {
    // Clone le document
    const clone = document.cloneNode(true);

    // Vérifier que le clone a un body
    if (!clone.body) {
      console.error('[Clear Terms] Erreur: clone.body est null');
      return {
        text: document.body ? (document.body.textContent || '') : '',
        url: window.location.href
      };
    }

    // Supprimer les éléments inutiles et dynamiques
    const elementsToRemove = clone.querySelectorAll(`
      script,
      style,
      nav,
      header,
      footer,
      aside,
      [role="dialog"],
      [role="banner"],
      [class*="cookie"],
      [class*="Cookie"],
      [id*="cookie"],
      [id*="Cookie"],
      [class*="consent"],
      [class*="Consent"],
      [id*="consent"],
      [class*="banner"],
      [class*="Banner"],
      [class*="popup"],
      [class*="Popup"],
      [class*="modal"],
      [class*="Modal"],
      [aria-label*="cookie" i],
      [aria-label*="consent" i],
      [aria-label*="privacy banner" i]
    `);
    elementsToRemove.forEach(el => el.remove());

    // Vérifier à nouveau que clone.body existe après les suppressions
    if (!clone.body) {
      console.error('[Clear Terms] Erreur: clone.body est devenu null après suppressions');
      return {
        text: document.body ? (document.body.textContent || '').replace(/\s+/g, ' ').trim() : '',
        url: window.location.href
      };
    }

    // Extraire le texte avec textContent
    const text = clone.body.textContent || '';

    // Nettoyer les espaces multiples et sauts de ligne excessifs
    let cleanedText = text.replace(/\s+/g, ' ').trim();

    return {
      text: cleanedText,
      url: window.location.href
    };
  } catch (error) {
    console.error('[Clear Terms] Erreur dans extractCleanContent:', error);
    return {
      text: document.body ? (document.body.textContent || '').replace(/\s+/g, ' ').trim() : '',
      url: window.location.href
    };
  }
}
