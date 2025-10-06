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
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
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

    const { content } = job;
    const cleanedContent = cleanText(content);
    const contentHash = calculateHash(cleanedContent);

    // Vérifier le cache
    if (cache.has(contentHash)) {
      console.log(`📦 Rapport trouvé en cache pour hash: ${contentHash.substring(0, 8)}...`);
      job.result = cache.get(contentHash);
      job.status = 'done';
      return;
    }

    // Charger le prompt et le schéma
    const promptTemplate = await loadPromptTemplate();
    const fullPrompt = promptTemplate + '\n\n' + cleanedContent;

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
    if (!report.site_name || !report.categories) {
      console.error('❌ Validation échouée - Champs manquants');
      console.error('   - site_name présent:', !!report.site_name);
      console.error('   - categories présent:', !!report.categories);
      console.error('   - Structure reçue:', JSON.stringify(report, null, 2));
      throw new Error('Réponse invalide : champs site_name ou categories manquants');
    }

    // Ajouter des métadonnées
    report.metadata = {
      content_hash: contentHash,
      analyzed_at: new Date().toISOString(),
      model_used: PRIMARY_MODEL
    };

    // Mettre en cache
    cache.set(contentHash, report);

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
 * Body: { url: string, content: string }
 * Response: { job_id: string }
 */
app.post('/scan', async (req, res) => {
  try {
    const { url, content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Le champ "content" est requis et doit être une chaîne de caractères' });
    }

    if (content.length < 100) {
      return res.status(400).json({ error: 'Le contenu est trop court pour être analysé (minimum 100 caractères)' });
    }

    // Générer un job_id unique
    const jobId = crypto.randomUUID();

    // Créer le job
    jobs.set(jobId, {
      status: 'queued',
      url: url || 'unknown',
      content,
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
 * Query: ?hash=xxx
 */
app.get('/report', (req, res) => {
  const { hash } = req.query;

  if (!hash) {
    return res.status(400).json({ error: 'Le paramètre "hash" est requis' });
  }

  const report = cache.get(hash);

  if (!report) {
    return res.status(404).json({ error: 'Rapport non trouvé en cache' });
  }

  res.json(report);
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
