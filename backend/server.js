const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const { processJob } = require('./services/job-processor');

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
    processJob(jobId, jobs, cache, PRIMARY_MODEL, FALLBACK_MODELS, process.env.GEMINI_API_KEY);

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
