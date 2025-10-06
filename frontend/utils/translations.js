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
