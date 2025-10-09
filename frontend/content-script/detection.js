// ========================================
// DÉTECTION - Logique de détection et validation de CGU
// ========================================

/**
 * Fonction principale de détection, lancée au chargement de la page
 * Détecte et lance l'analyse automatique si CGU détectées
 */
async function detectAndAnalyze() {
  try {
    console.log('[Clear Terms] 🔍 Détection lancée sur:', window.location.href);

    // Vérifier si la détection auto est activée
    console.log('[Clear Terms] ⏳ Vérification des paramètres...');
    const settings = await chrome.storage.local.get(['toastEnabled']);
    console.log('[Clear Terms] Settings toastEnabled:', settings.toastEnabled);
    if (settings.toastEnabled === false) {
      console.log('[Clear Terms] ❌ Détection automatique désactivée');
      return;
    }

    // ---- Étape 1: Filtre léger -----
    console.log('[Clear Terms] ⏳ Filtre léger...');

    // Vérifier si c'est un moteur de recherche
    if (isSearchEnginePage()) {
      console.log('[Clear Terms] ❌ Page de moteur de recherche détectée, skip');
      return;
    }

    //TODO: maintient ou suppression ?
    // Vérifier si ça ressemble à des résultats de recherche
    // if (looksLikeSearchResults()) {
    //   console.log('[Clear Terms] ❌ Structure de résultats de recherche détectée, skip');
    //   return;
    // }

    // Vérifier si la page est probablement une page de CGU
    if (!isLikelyTermsPage()) {
      console.log('[Clear Terms] ❌ Page non identifiée comme CGU (filtre léger)');
      return;
    }

    console.log('[Clear Terms] ✅ Candidat CGU détecté, validation en cours...');

    // Utiliser extractCleanContent()
    console.log('[Clear Terms] ⏳ Extraction du contenu...');
    const { text: content, url } = extractCleanContent();
    console.log('[Clear Terms] Contenu extrait:', content.length, 'caractères');

    // ---- Étape 2: Validation approfondie -----
    console.log('[Clear Terms] ⏳ Validation approfondie...');
    const validation = validateTermsPage(content);
    if (!validation.valid) {
      console.log('[Clear Terms] ❌ Validation échouée:', validation.reason);
      return;
    }

    console.log('[Clear Terms] ✅✅✅ CGU détectée et validée !');

    // Afficher le toast
    console.log('[Clear Terms] 📢 Affichage du toast...');
    createToast();

    // Lancer l'analyse en arrière-plan
    console.log('[Clear Terms] 🚀 Envoi message AUTO_ANALYZE...');
    chrome.runtime.sendMessage({
      type: 'AUTO_ANALYZE',
      url: url,
      content: content
    });
    console.log('[Clear Terms] ✅ Message AUTO_ANALYZE envoyé');
  } catch (error) {
    console.error('[Clear Terms] ❌ ERREUR dans detectAndAnalyze:', error);
    console.error('[Clear Terms] Stack:', error.stack);
  }
}

/**
 * Vérifie si la page est probablement une page de CGU (étape 1)
 * Basé sur l'URL et le titre de la page
 */
function isLikelyTermsPage() {
  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  const mainTitle = document.querySelector('h1') ? document.querySelector('h1').textContent.toLowerCase() : '';

  // Vérifier URL et pathname
  const allKeywords = [...KEYWORDS_LIGHT.fr, ...KEYWORDS_LIGHT.en];

  for (const keyword of allKeywords) {
    // Chercher le mot-clé avec tirets, underscores ou sans espaces
    const variations = [
      keyword.replace(/\s/g, '-'),
      keyword.replace(/\s/g, '_'),
      keyword.replace(/\s/g, ''),
      keyword.replace(/'/g, '')
    ];

    for (const variant of variations) {
      if (url.includes(variant) || pathname.includes(variant)) {
        console.log('[Clear Terms] Détection URL:', variant);
        return true;
      }
    }

    // Vérifier le titre
    if (title.includes(keyword)) {
      console.log('[Clear Terms] Détection titre:', keyword);
      return true;
    }

    // Vérifier le h1 principal
    if (mainTitle.includes(keyword)) {
      console.log('[Clear Terms] Détection h1 principal:', keyword);
      return true;
    }
  }

  return false;
}

/**
 * Valide qu'une page est bien une page de CGU (lancée en étape 2)
 * @param {string} content - Le contenu textuel de la page
 * @returns {Object} { valid: boolean, reason?: string, count?: number }
 */
function validateTermsPage(content) {
  // Critère 1: Longueur minimale
  if (content.length < VALIDATION_CRITERIA.minLength) {
    console.log('[Clear Terms] Validation échouée: contenu trop court', content.length);
    return {
      valid: false,
      reason: 'content_too_short',
      length: content.length
    };
  }

  // Critère 2: Titre fort dans le champ lexical
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
  const allKeywords = [...KEYWORDS_LIGHT.fr, ...KEYWORDS_LIGHT.en];

  const hasStrongTitle = headings.some(h => {
    const text = h.textContent.toLowerCase();
    return allKeywords.some(kw => text.includes(kw));
  });

  if (!hasStrongTitle) {
    console.log('[Clear Terms] Validation échouée: pas de titre fort');
    return { valid: false, reason: 'no_strong_title' };
  }

  // Critère 3: Occurrences de mots-clés contractuels
  const contentLower = content.toLowerCase();
  const allContractualKeywords = [
    ...VALIDATION_CRITERIA.contractualKeywords.fr,
    ...VALIDATION_CRITERIA.contractualKeywords.en
  ];

  let keywordCount = 0;
  allContractualKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword.replace(/'/g, "['']?")}\\b`, 'gi');
    const matches = contentLower.match(regex);
    if (matches) {
      keywordCount += matches.length;
    }
  });

  if (keywordCount < VALIDATION_CRITERIA.minKeywordOccurrences) {
    console.log('[Clear Terms] Validation échouée: pas assez de mots contractuels', keywordCount);
    return {
      valid: false,
      reason: 'insufficient_contractual_keywords',
      count: keywordCount
    };
  }

  console.log('[Clear Terms] Validation réussie ✓ (', keywordCount, 'mots contractuels)');
  return { valid: true, keywordCount };
}
