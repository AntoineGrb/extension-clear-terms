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
const PRIMARY_MODEL = process.env.GEMINI_MODEL;
const FALLBACK_MODELS = [
  PRIMARY_MODEL,
  'gemini-2.0-flash-exp',
  'gemini-2.5-flash',
  'gemini-flash-latest'
].filter(Boolean);

const MAX_CACHE_ENTRIES = 1000; // Limite du cache : 1000 URLs max (avec FR + EN)

// Stockage en mémoire pour le MVP (jobs et cache)
const jobs = new Map(); // job_id -> { status, url, result, error, createdAt }
const cache = new Map(); // url_hash -> { url, domain, reports: { fr: {}, en: {} }, createdAt, lastAccessedAt }

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// -----------------------------
// Fonctions utilitaires du cache
// -----------------------------

/**
 * Vérifie et applique la limite du cache (LRU)
 * Si le cache atteint ou dépasse MAX_CACHE_ENTRIES, supprime les entrées les moins récemment utilisées
 */
function enforceCacheLimit() {
  if (cache.size < MAX_CACHE_ENTRIES) {
    return; // Pas besoin de nettoyer
  }

  const entriesToDelete = cache.size - MAX_CACHE_ENTRIES + 1; // +1 pour faire de la place pour la nouvelle entrée
  console.log(`⚠️  Limite du cache atteinte (${cache.size}/${MAX_CACHE_ENTRIES}). Suppression de ${entriesToDelete} entrée(s) les plus anciennes...`);

  // Trier les entrées par lastAccessedAt (les plus anciennes en premier)
  const sortedEntries = Array.from(cache.entries())
    .sort((a, b) => {
      const timeA = new Date(a[1].lastAccessedAt || a[1].createdAt);
      const timeB = new Date(b[1].lastAccessedAt || b[1].createdAt);
      return timeA - timeB;
    });

  // Supprimer les plus anciennes
  for (let i = 0; i < entriesToDelete; i++) {
    const [urlHash, entry] = sortedEntries[i];
    cache.delete(urlHash);
    console.log(`🗑️  Cache LRU supprimé: ${entry.url}`);
  }

  console.log(`✅ Cache réduit à ${cache.size} entrées`);
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

    if (content.length < 300) {
      return res.status(400).json({ error: 'Le contenu est trop court pour être analysé (minimum 300 caractères)' });
    }

    if (content.length > 500000) {
      return res.status(413).json({ error: 'Contenu trop long, plus de 500 000 caractères' });
    } 

    //TODO : Ajouter validation URL si fournie + rate limiting

    // Valider et définir la langue par défaut
    const userLanguage = ['fr', 'en'].includes(user_language_preference) ? user_language_preference : 'en';

    // Créer le job
    const jobId = crypto.randomUUID();
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
    processJob(jobId, jobs, cache, PRIMARY_MODEL, FALLBACK_MODELS, process.env.GEMINI_API_KEY, enforceCacheLimit);

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
 * Recherche dans le cache par hash d'URL
 * Query: ?url_hash=xxx&lang=fr|en
 */
app.get('/report', (req, res) => {
  const { url_hash, lang } = req.query;

  if (!url_hash) {
    return res.status(400).json({ error: 'Le paramètre "url_hash" est requis' });
  }

  const cachedEntry = cache.get(url_hash);

  if (!cachedEntry) {
    return res.status(404).json({ error: 'Rapport non trouvé en cache' });
  }

  // Si une langue est spécifiée, retourner uniquement cette version
  const language = ['fr', 'en'].includes(lang) ? lang : 'en';

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
// Nettoyage périodique du cache (24h d'expiration)
// -----------------------------
setInterval(() => {
  const now = new Date();
  const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 heures
  let deletedCount = 0;

  for (const [urlHash, cachedEntry] of cache.entries()) {
    const cacheAge = now - new Date(cachedEntry.createdAt);

    if (cacheAge > MAX_CACHE_AGE) {
      cache.delete(urlHash);
      deletedCount++;
      console.log(`🗑️  Cache expiré supprimé: ${cachedEntry.url} (âge: ${Math.round(cacheAge / 1000 / 60 / 60)}h)`);
    }
  }

  if (deletedCount > 0) {
    console.log(`🧹 Nettoyage du cache terminé: ${deletedCount} entrée(s) supprimée(s). Cache restant: ${cache.size}`);
  }
}, 60 * 60 * 1000); // Toutes les heures

// -----------------------------
// Lancement du serveur
// -----------------------------
app.listen(PORT, () => {
  console.log(`✅ Clear Terms Backend démarré sur le port ${PORT}`);
  console.log(`📊 Modèle IA: ${PRIMARY_MODEL}`);
});
