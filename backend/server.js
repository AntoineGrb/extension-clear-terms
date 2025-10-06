const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------
// Configuration
// -----------------------------
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
const FALLBACK_MODELS = [
  PRIMARY_MODEL,
  'gemini-2.5-flash',
  'gemini-flash-latest'
].filter(Boolean);

// Stockage en mémoire pour le MVP (jobs et cache)
const jobs = new Map(); // job_id -> { status, url, result, error, createdAt }
const cache = new Map(); // content_hash -> report

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// -----------------------------
// Helpers
// -----------------------------

/**
 * Calcule un hash SHA-256 du contenu
 */
function calculateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Charge le prompt template
 */
async function loadPromptTemplate() {
  const promptPath = path.join(__dirname, 'prompt-template.md');
  return await fs.readFile(promptPath, 'utf-8');
}

/**
 * Charge le schéma JSON
 */
async function loadSchema() {
  const schemaPath = path.join(__dirname, 'schema.json');
  const content = await fs.readFile(schemaPath, 'utf-8');
  return JSON.parse(content);
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

/**
 * Appelle l'API Gemini avec le système de fallback
 */
async function callGemini(prompt) {
  let lastError = null;

  for (const model of FALLBACK_MODELS) {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

      const response = await fetch(apiUrl, {
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

/**
 * Traite un job d'analyse
 */
async function processJob(jobId) {
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

    // Ajouter la préférence de langue dans le prompt
    const languageInstruction = `\n\n**USER_LANGUAGE_PREFERENCE: ${userLanguage}** (Génère tous les commentaires dans cette langue)\n`;
    const fullPrompt = promptTemplate + languageInstruction + '\n\n' + cleanedContent;

    // Appeler Gemini
    const aiResponse = await callGemini(fullPrompt);

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
    if (!report.site_name || !report.categories || !report.detected_language) {
      console.error('❌ Validation échouée - Champs manquants');
      console.error('   - site_name présent:', !!report.site_name);
      console.error('   - categories présent:', !!report.categories);
      console.error('   - detected_language présent:', !!report.detected_language);
      console.error('   - Structure reçue:', JSON.stringify(report, null, 2));
      throw new Error('Réponse invalide : champs obligatoires manquants');
    }

    // Ajouter des métadonnées
    report.metadata = {
      content_hash: contentHash,
      analyzed_at: new Date().toISOString(),
      model_used: PRIMARY_MODEL,
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
        detected_language: report.detected_language,
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

// -----------------------------
// Routes API
// -----------------------------

/**
 * POST /scan
 * Lance une analyse de CGU
 * Body: { url: string, content: string, user_language_preference: string }
 * Response: { job_id: string }
 */
app.post('/scan', async (req, res) => {
  try {
    const { url, content, user_language_preference } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Le champ "content" est requis et doit être une chaîne de caractères' });
    }

    if (content.length < 100) {
      return res.status(400).json({ error: 'Le contenu est trop court pour être analysé (minimum 100 caractères)' });
    }

    // Valider et définir la langue par défaut
    const userLanguage = ['fr', 'en'].includes(user_language_preference) ? user_language_preference : 'fr';

    // Générer un job_id unique
    const jobId = crypto.randomUUID();

    // Créer le job
    jobs.set(jobId, {
      status: 'queued',
      url: url || 'unknown',
      content,
      userLanguage,
      result: null,
      error: null,
      createdAt: Date.now()
    });

    // Lancer le traitement en arrière-plan
    processJob(jobId);

    res.json({ job_id: jobId });

  } catch (error) {
    console.error('Erreur /scan:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /jobs/:id
 * Récupère l'état d'un job
 * Response: { status: 'queued'|'running'|'done'|'error', result?: object, error?: string }
 */
app.get('/jobs/:id', (req, res) => {
  const { id } = req.params;
  const job = jobs.get(id);

  if (!job) {
    return res.status(404).json({ error: 'Job introuvable' });
  }

  const response = {
    status: job.status,
    url: job.url
  };

  if (job.status === 'done' && job.result) {
    response.result = job.result;
  }

  if (job.status === 'error' && job.error) {
    response.error = job.error;
  }

  res.json(response);
});

/**
 * GET /report
 * Recherche dans le cache par hash de contenu
 * Query: ?hash=xxx&lang=fr|en
 */
app.get('/report', (req, res) => {
  const { hash, lang } = req.query;

  if (!hash) {
    return res.status(400).json({ error: 'Le paramètre "hash" est requis' });
  }

  const cachedEntry = cache.get(hash);

  if (!cachedEntry) {
    return res.status(404).json({ error: 'Rapport non trouvé en cache' });
  }

  // Si une langue est spécifiée, retourner uniquement cette version
  const language = ['fr', 'en'].includes(lang) ? lang : 'fr';

  if (cachedEntry.reports && cachedEntry.reports[language]) {
    res.json(cachedEntry.reports[language]);
  } else {
    return res.status(404).json({
      error: `Rapport non disponible en ${language}`,
      available_languages: Object.keys(cachedEntry.reports || {})
    });
  }
});

/**
 * GET /health
 * Healthcheck basique
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    jobs_count: jobs.size,
    cache_count: cache.size,
    timestamp: new Date().toISOString()
  });
});

// -----------------------------
// Nettoyage périodique des vieux jobs (MVP)
// -----------------------------
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 heure

  for (const [jobId, job] of jobs.entries()) {
    if (now - job.createdAt > maxAge) {
      jobs.delete(jobId);
      console.log(`🗑️  Job ${jobId} supprimé (trop ancien)`);
    }
  }
}, 10 * 60 * 1000); // Toutes les 10 minutes

// -----------------------------
// Lancement du serveur
// -----------------------------
app.listen(PORT, () => {
  console.log(`✅ Clear Terms Backend démarré sur le port ${PORT}`);
  console.log(`📊 Modèle IA: ${PRIMARY_MODEL}`);
});
