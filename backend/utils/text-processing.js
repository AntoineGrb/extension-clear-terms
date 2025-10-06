const crypto = require('crypto');

/**
 * Calcule un hash SHA-256 du contenu
 */
function calculateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Nettoie le texte extrait (supprime espaces multiples, lignes vides, etc.)
 * IMPORTANT: Doit être identique à extractCleanContent() du content-script
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  calculateHash,
  cleanText
};
