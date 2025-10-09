const { cleanText, calculateHash } = require('../utils/text-processing');
const { loadPromptTemplate, callGemini } = require('../utils/gemini');

/**
 * Traite un job d'analyse
 */
async function processJob(jobId, jobs, cache, primaryModel, fallbackModels, apiKey) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'running';

    const { content, userLanguage } = job;
    const cleanedContent = cleanText(content);
    const contentHash = calculateHash(cleanedContent);

    // Vérifier le cache pour cette langue spécifique
    if (cache.has(contentHash)) {
      const cachedEntry = cache.get(contentHash);

      // Si le rapport dans la langue demandée existe déjà
      if (cachedEntry.reports && cachedEntry.reports[userLanguage]) {
        console.log(`📦 Rapport ${userLanguage.toUpperCase()} trouvé en cache pour hash: ${contentHash.substring(0, 8)}...`);
        job.result = cachedEntry.reports[userLanguage];
        job.status = 'done';
        return;
      }

      console.log(`📦 Cache trouvé mais pas de version ${userLanguage.toUpperCase()}, génération en cours...`);
    }

    // Charger le prompt et le schéma
    let promptTemplate = await loadPromptTemplate();

    // Ajouter la préférence de langue dans le prompt (instruction forte)
    const languageMap = {
      'fr': 'français',
      'en': 'English'
    };
    const languageName = languageMap[userLanguage] || 'English';

    const languageInstruction = `\n\n⚠️ CRITICAL INSTRUCTION - LANGUAGE REQUIREMENT ⚠️
**YOU MUST GENERATE ALL "comment" FIELDS IN ${languageName.toUpperCase()} (${userLanguage.toUpperCase()}).**
Even if the source document is in another language, ALL your analysis comments MUST be written in ${languageName}.
This is a mandatory requirement. Do not write comments in any other language.
---\n`;

    const fullPrompt = promptTemplate + languageInstruction + '\n\n' + cleanedContent;

    // Appeler Gemini
    const aiResponse = await callGemini(fullPrompt, fallbackModels, apiKey);

    // Parser la réponse JSON
    let report;
    try {
      // Nettoyer la réponse (enlever les ```json si présents, balises HTML, etc.)
      let jsonText = aiResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Si la réponse commence par <!DOCTYPE ou <html, c'est une erreur HTML
      if (jsonText.startsWith('<!DOCTYPE') || jsonText.startsWith('<html')) {
        throw new Error('Réponse HTML reçue au lieu de JSON (erreur API ou quota dépassé)');
      }

      // Extraire le JSON s'il est entouré d'autre texte
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      report = JSON.parse(jsonText);

      // Logger la structure reçue pour debug
      console.log('📋 Réponse Gemini parsée avec succès');
      console.log('📊 Champs présents:', Object.keys(report));
      console.log('📄 Rapport complet:', JSON.stringify(report, null, 2));

    } catch (error) {
      console.error('❌ Réponse Gemini invalide (500 premiers caractères):', aiResponse.substring(0, 500));
      throw new Error(`Impossible de parser la réponse JSON de Gemini: ${error.message}`);
    }

    // Valider le schéma (basique)
    if (!report.site_name || !report.categories) {
      console.error('❌ Validation échouée - Champs manquants');
      console.error('   - site_name présent:', !!report.site_name);
      console.error('   - categories présent:', !!report.categories);
      console.error('   - Structure reçue:', JSON.stringify(report, null, 2));
      throw new Error('Réponse invalide : champs obligatoires manquants');
    }

    // Ajouter des métadonnées
    report.metadata = {
      content_hash: contentHash,
      analyzed_at: new Date().toISOString(),
      analyzed_url: job.url || 'unknown',
      model_used: primaryModel,
      output_language: userLanguage
    };

    // Mettre en cache avec structure multilingue
    if (cache.has(contentHash)) {
      // Ajouter la nouvelle langue au cache existant
      const existing = cache.get(contentHash);
      existing.reports[userLanguage] = report;
    } else {
      // Créer une nouvelle entrée cache
      cache.set(contentHash, {
        domain: job.url ? new URL(job.url).hostname : 'unknown',
        reports: {
          [userLanguage]: report
        },
        createdAt: new Date().toISOString()
      });
    }

    job.result = report;
    job.status = 'done';

  } catch (error) {
    console.error(`❌ Erreur lors du traitement du job ${jobId}:`, error.message);
    job.status = 'error';
    job.error = error.message;
  }
}

module.exports = {
  processJob
};
