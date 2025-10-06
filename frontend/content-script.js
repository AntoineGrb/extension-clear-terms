/**
 * Content Script - Détection automatique des CGU
 * Injecté sur toutes les pages pour détecter et analyser les CGU
 */

// ========================================
// CONFIGURATION
// ========================================

/**
 * Mots-clés pour la détection légère (Niveau 1)
 */
const KEYWORDS_LIGHT = {
  fr: [
    'conditions générales',
    'conditions d\'utilisation',
    'politique de confidentialité',
    'mentions légales',
    'cgu',
    'cgv',
    'données personnelles',
    'vie privée'
  ],
  en: [
    'terms of service',
    'terms of use',
    'privacy policy',
    'terms and conditions',
    'user agreement',
    'legal notice',
    'terms & conditions',
    'privacy notice'
  ]
};

/**
 * Critères de validation approfondie (Niveau 2)
 */
const VALIDATION_CRITERIA = {
  minLength: 2000, // Longueur minimale en caractères
  contractualKeywords: {
    fr: [
      'acceptez',
      'consentement',
      'responsabilité',
      'droits',
      'obligations',
      'article',
      'clause',
      'utilisateur',
      'service',
      'contrat',
      'propriété intellectuelle',
      'résiliation',
      'modification',
      'notification'
    ],
    en: [
      'agree',
      'consent',
      'liability',
      'rights',
      'obligations',
      'article',
      'clause',
      'user',
      'service',
      'agreement',
      'intellectual property',
      'termination',
      'modification',
      'notification'
    ]
  },
  minKeywordOccurrences: 8 // Nombre minimum d'occurrences de mots contractuels
};

// ========================================
// EXCLUSIONS : Moteurs de recherche et pages navigables
// ========================================

/**
 * Liste des patterns d'URLs de moteurs de recherche
 */
const SEARCH_ENGINE_PATTERNS = [
  'google.com/search',
  'google.fr/search',
  'google.co.uk/search',
  'google.de/search',
  'google.es/search',
  'google.it/search',
  'bing.com/search',
  'duckduckgo.com/',
  'yahoo.com/search',
  'yahoo.fr/search',
  'ecosia.org/search',
  'qwant.com/',
  'yandex.com/search',
  'yandex.ru/search',
  'baidu.com/s'
];

/**
 * Vérifie si la page est un moteur de recherche
 */
function isSearchEnginePage() {
  const url = window.location.href.toLowerCase();
  const isSearchEngine = SEARCH_ENGINE_PATTERNS.some(pattern => url.includes(pattern));

  if (isSearchEngine) {
    console.log('[Clear Terms] Moteur de recherche détecté');
  }

  return isSearchEngine;
}

/**
 * Détecte si la page ressemble à des résultats de recherche
 * Basé sur des patterns DOM typiques
 */
function looksLikeSearchResults() {
  const searchPatterns = [
    'input[name="q"]',              // Barre de recherche Google/Bing
    'input[name="search"]',         // Barre de recherche générique
    'form[role="search"]',          // Formulaire de recherche
    '[data-sokoban-container]',     // Google SERP
    '.search-result',               // Résultats génériques
    '#search',                      // Container de résultats
    '[id*="search-results"]',       // IDs contenant search-results
    '[class*="search-results"]'     // Classes contenant search-results
  ];

  const foundPattern = searchPatterns.find(selector => document.querySelector(selector));

  if (foundPattern) {
    console.log('[Clear Terms] Structure de résultats de recherche détectée:', foundPattern);
    return true;
  }

  return false;
}

// ========================================
// EXTRACTION DE CONTENU (partagée auto + manuel)
// ========================================

/**
 * Extrait le contenu nettoyé de la page
 * Utilisé pour scan auto ET manuel (garantit le même hash)
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

    // Supprimer les éléments inutiles
    const elementsToRemove = clone.querySelectorAll('script, style, nav, header, footer, aside');
    elementsToRemove.forEach(el => el.remove());

    // Extraire le texte avec textContent (plus stable que innerText)
    const text = clone.body.textContent || '';

    // Nettoyer les espaces multiples et sauts de ligne excessifs
    const cleanedText = text.replace(/\s+/g, ' ').trim();

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

// ========================================
// DÉTECTION NIVEAU 1 : Filtre léger
// ========================================

/**
 * Vérifie si la page est probablement une page de CGU
 * Basé sur l'URL et le titre de la page
 */
function isLikelyTermsPage() {
  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

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
  }

  return false;
}

// ========================================
// DÉTECTION NIVEAU 2 : Validation approfondie
// ========================================

/**
 * Valide qu'une page est bien une page de CGU
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
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
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

// ========================================
// TOAST UI
// ========================================

/**
 * Crée et affiche le toast de notification
 * Utilise Shadow DOM pour l'isolation CSS
 */
function createToast() {
  // Vérifier si le toast existe déjà
  if (document.getElementById('clear-terms-toast-container')) {
    console.log('[Clear Terms] Toast déjà affiché');
    return;
  }

  // Récupérer la langue de l'utilisateur
  chrome.storage.local.get(['userLanguage'], (result) => {
    const lang = result.userLanguage || 'fr';

    const translations = {
      fr: {
        title: 'Rapport CGU disponible',
        subtitle: 'Cliquez pour voir l\'analyse'
      },
      en: {
        title: 'Terms Report Available',
        subtitle: 'Click to view analysis'
      }
    };

    const t = translations[lang];

    // Créer le container
    const toastContainer = document.createElement('div');
    toastContainer.id = 'clear-terms-toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      animation: slideIn 0.3s ease-out;
    `;

    // Créer Shadow DOM
    const shadow = toastContainer.attachShadow({ mode: 'open' });

    // Injecter le style et le HTML
    shadow.innerHTML = `
      <style>
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .toast {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          padding: 16px;
          max-width: 320px;
          border-left: 4px solid #6366f1;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .toast:hover {
          box-shadow: 0 15px 50px rgba(0, 0, 0, 0.25);
          transform: translateY(-2px);
        }

        .toast-content {
          display: flex;
          align-items: start;
          gap: 12px;
        }

        .icon-container {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          background: #eef2ff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon {
          width: 24px;
          height: 24px;
          color: #6366f1;
        }

        .text-content {
          flex: 1;
          min-width: 0;
        }

        .title {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 4px 0;
        }

        .subtitle {
          font-size: 12px;
          color: #6b7280;
          margin: 0;
        }

        .close-btn {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          border: none;
          background: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .close-btn:hover {
          color: #4b5563;
        }

        .close-icon {
          width: 20px;
          height: 20px;
        }
      </style>
      <div class="toast">
        <div class="toast-content">
          <div class="icon-container">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div class="text-content">
            <p class="title">${t.title}</p>
            <p class="subtitle">${t.subtitle}</p>
          </div>
          <button class="close-btn" id="close-toast" aria-label="Close">
            <svg class="close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(toastContainer);

    // Event listener: Ouvrir la popup au clic
    const toastElement = shadow.querySelector('.toast');
    toastElement.addEventListener('click', (e) => {
      if (!e.target.closest('#close-toast')) {
        chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        toastContainer.remove();
      }
    });

    // Event listener: Fermer le toast
    shadow.querySelector('#close-toast').addEventListener('click', (e) => {
      e.stopPropagation();
      toastContainer.remove();
    });

    // Auto-fermeture après 5 secondes
    setTimeout(() => {
      if (document.getElementById('clear-terms-toast-container')) {
        toastContainer.remove();
      }
    }, 5000);
  });
}

// ========================================
// WORKFLOW PRINCIPAL
// ========================================

/**
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

    // Étape 1: Filtre léger
    console.log('[Clear Terms] ⏳ Filtre léger...');
        // Vérifier si c'est un moteur de recherche
    if (isSearchEnginePage()) {
      console.log('[Clear Terms] ❌ Page de moteur de recherche détectée, skip');
      return;
    }

    // Vérifier si ça ressemble à des résultats de recherche
    if (looksLikeSearchResults()) {
      console.log('[Clear Terms] ❌ Structure de résultats de recherche détectée, skip');
      return;
    }

    // Vérifier si la page est probablement une page de CGU
    if (!isLikelyTermsPage()) {
      console.log('[Clear Terms] ❌ Page non identifiée comme CGU (filtre léger)');
      return;
    }

    console.log('[Clear Terms] ✅ Candidat CGU détecté, validation en cours...');

    // MODIFIÉ : Utiliser extractCleanContent() pour cohérence avec scan manuel
    console.log('[Clear Terms] ⏳ Extraction du contenu...');
    const { text: content, url } = extractCleanContent();
    console.log('[Clear Terms] Contenu extrait:', content.length, 'caractères');

    // Étape 2: Validation approfondie
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

  // NOUVEAU : Extraction de contenu pour scan manuel (même logique que scan auto)
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
