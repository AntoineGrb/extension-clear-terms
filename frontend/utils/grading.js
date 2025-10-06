/**
 * Calcule le grade (A-E) basé sur les catégories
 */
function calculateGrade(categories) {
  const statusCounts = { green: 0, amber: 0, red: 0, na: 0 };

  Object.values(categories).forEach(cat => {
    if (cat.status === 'n/a') statusCounts.na++;
    else statusCounts[cat.status]++;
  });

  const total = statusCounts.green + statusCounts.amber + statusCounts.red;
  if (total === 0) return 'E';

  const score = (statusCounts.green * 2 + statusCounts.amber) / (total * 2);

  if (score >= 0.8) return 'A';
  if (score >= 0.6) return 'B';
  if (score >= 0.4) return 'C';
  if (score >= 0.2) return 'D';
  return 'E';
}

/**
 * Obtient le nom de domaine depuis une URL
 */
function getDomainName(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Site web';
  }
}
