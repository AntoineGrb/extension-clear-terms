const fs = require('fs').promises;
const path = require('path');

/**
 * Charge le prompt template
 */
async function loadPromptTemplate() {
  const promptPath = path.join(__dirname, '..', 'prompt-template.md');
  return await fs.readFile(promptPath, 'utf-8');
}

/**
 * Charge le schéma JSON
 */
async function loadSchema() {
  const schemaPath = path.join(__dirname, '..', 'schema.json');
  const content = await fs.readFile(schemaPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Appelle l'API Gemini avec le système de fallback
 */
async function callGemini(prompt, fallbackModels, apiKey) {
  let lastError = null;

  for (const model of fallbackModels) {
    try {
      const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await (await fetch)(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 2048,
          }
        })
      });

      const raw = await response.text();

      if (!raw) {
        throw new Error("Réponse vide reçue de l'API Gemini.");
      }

      const data = JSON.parse(raw);

      if (!response.ok) {
        throw new Error(data.error?.message || `Erreur HTTP ${response.status}`);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || null;

      if (!text) {
        throw new Error("Aucune réponse générée par Gemini");
      }

      console.log(`✅ Modèle utilisé: ${model}`);
      return text;

    } catch (error) {
      console.error(`❌ Échec avec le modèle ${model}:`, error.message);
      lastError = error;
    }
  }

  throw new Error(`Tous les modèles ont échoué. Dernière erreur: ${lastError?.message}`);
}

module.exports = {
  loadPromptTemplate,
  loadSchema,
  callGemini
};
