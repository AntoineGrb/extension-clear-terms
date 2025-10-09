const BACKEND_URL = 'http://localhost:3000';
const POLL_INTERVAL = 2000; // 2 secondes
const MAX_POLL_ATTEMPTS = 60; // 2 minutes max

/**
 * Extrait le texte de la page active
 */
async function extractPageContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error('Impossible de récupérer l\'onglet actif');
  }

  // Demander au content script d'extraire le contenu (même logique que scan auto)
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: 'EXTRACT_CONTENT'
  });

  return response;
}

/**
 * Lance une analyse
 */
async function startScan(url, content, userLanguage) {
  const response = await fetch(`${BACKEND_URL}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, content, user_language_preference: userLanguage })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors du lancement de l\'analyse');
  }

  return await response.json();
}

/**
 * Poll un job jusqu'à ce qu'il soit terminé
 */
async function pollJob(jobId) {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const response = await fetch(`${BACKEND_URL}/jobs/${jobId}`);

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération du statut du job');
    }

    const job = await response.json();

    if (job.status === 'done') {
      // Créer une copie profonde pour éviter les mutations par référence
      const report = JSON.parse(JSON.stringify(job.result));

      // Mettre à jour le timestamp pour refléter le moment de cette analyse
      // (même si le rapport vient du cache, pour l'utilisateur c'est une nouvelle analyse)
      const now = new Date().toISOString();
      if (report.metadata) {
        report.metadata.analyzed_at = now;
      }

      console.log('📅 [MANUEL] Timestamp mis à jour:', now);

      return report;
    }

    if (job.status === 'error') {
      throw new Error(job.error || 'Erreur lors de l\'analyse');
    }

    // Attendre avant le prochain poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error('Timeout : l\'analyse a pris trop de temps');
}
