/**
 * Affiche le rapport
 */
function displayReport(report) {
  const { site_name, categories, metadata } = report;

  // Calculer le grade
  const grade = calculateGrade(categories);

  // Afficher le nom du site (de l'IA)
  document.getElementById('siteName').textContent = site_name || 'Site web';

  // Récupérer la langue pour la date
  chrome.storage.local.get(['userLanguage'], (result) => {
    const lang = result.userLanguage || 'fr';
    const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

    // Afficher la date d'analyse
    const analysisDate = metadata?.analyzed_at
      ? new Date(metadata.analyzed_at).toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      : new Date().toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

    const analyzedLabel = i18n.t('analyzedOn', lang);
    document.getElementById('analysisDate').textContent = `${analyzedLabel} ${analysisDate}`;

    // Afficher l'URL analysée
    const analyzedUrl = metadata?.analyzed_url || 'URL inconnue';
    document.getElementById('analyzedUrl').textContent = analyzedUrl;
    document.getElementById('analyzedUrl').dataset.fullUrl = analyzedUrl;

    // Ordre des catégories (selon schema.json)
    const categoryOrder = [
      'data_collection',
      'data_usage',
      'data_sharing',
      'user_rights',
      'data_retention',
      'security_measures',
      'policy_changes',
      'legal_compliance',
      'cookies_tracking',
      'children_privacy',
      'user_content_rights',
      'dispute_resolution'
    ];

    // Trier par couleur d'abord (red > amber > green), puis par ordre du schema
    const sortOrder = { red: 0, amber: 1, green: 2, 'n/a': 3 };
    const sortedCategories = Object.entries(categories)
      .filter(([_, cat]) => cat.status !== 'n/a')
      .sort(([keyA, a], [keyB, b]) => {
        // D'abord par couleur
        const colorDiff = sortOrder[a.status] - sortOrder[b.status];
        if (colorDiff !== 0) return colorDiff;

        // Ensuite par ordre du schema
        return categoryOrder.indexOf(keyA) - categoryOrder.indexOf(keyB);
      });

    // Générer les cartes de catégories avec traduction
    const categoriesEl = document.getElementById('categoriesList');
    const categoryColors = {
      green: 'bg-emerald-50 border-emerald-500',
      amber: 'bg-amber-50 border-amber-500',
      red: 'bg-red-50 border-red-500'
    };

    categoriesEl.innerHTML = sortedCategories
      .map(([key, cat]) => `
        <div class="p-3 rounded-md border-l-4 ${categoryColors[cat.status]}">
          <div class="text-sm font-semibold text-gray-900 mb-1.5">${i18n.t(`categories.${key}`, lang)}</div>
          <div class="text-xs text-gray-600 leading-relaxed">${cat.comment}</div>
        </div>
      `)
      .join('');
  });

  // Afficher le grade avec Tailwind colors
  const gradeEl = document.getElementById('grade');
  gradeEl.textContent = grade;
  const gradeColors = {
    A: 'bg-emerald-500',
    B: 'bg-lime-500',
    C: 'bg-amber-500',
    D: 'bg-red-500',
    E: 'bg-red-600'
  };
  gradeEl.className = `w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0 ${gradeColors[grade] || 'bg-gray-400'}`;

  // Compter les badges
  const statusCounts = { green: 0, amber: 0, red: 0 };
  Object.values(categories).forEach(cat => {
    if (cat.status !== 'n/a') {
      statusCounts[cat.status]++;
    }
  });

  // Afficher les badges avec Tailwind
  const badgesEl = document.getElementById('badges');
  badgesEl.innerHTML = `
    <div class="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">${statusCounts.green} ✓</div>
    <div class="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">${statusCounts.amber} ⚠</div>
    <div class="px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-700">${statusCounts.red} ✗</div>
  `;

  // Afficher la section rapport
  document.getElementById('reportSection').classList.remove('hidden');

  // Afficher le contenu déplié par défaut
  const content = document.getElementById('reportContent');
  content.classList.remove('hidden');

  // Ajouter l'événement toggle pour l'accordéon
  const toggleBtn = document.getElementById('reportToggle');
  toggleBtn.onclick = () => {
    content.classList.toggle('hidden');
  };

  // Sauvegarder le rapport
  chrome.storage.local.set({ lastReport: report });
}

/**
 * Met à jour le statut (mode textuel moderne)
 */
function updateStatus(messageKey, type = '') {
  const statusEl = document.getElementById('status');

  const icons = {
    loading: '<svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>',
    success: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
    error: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
  };

  const styles = {
    loading: 'text-blue-600 bg-blue-50',
    success: 'text-green-600 bg-green-50',
    error: 'text-red-600 bg-red-50'
  };

  if (type && messageKey) {
    // Récupérer la langue pour traduire le message
    chrome.storage.local.get(['userLanguage'], (result) => {
      const lang = result.userLanguage || 'fr';

      // Si le message commence par "statusError:", on concatène
      let message;
      if (messageKey.startsWith('ERROR:')) {
        const errorText = messageKey.substring(6);
        message = `${i18n.t('statusError', lang)} ${errorText}`;
      } else {
        message = i18n.t(messageKey, lang);
      }

      statusEl.innerHTML = `
        <div class="flex items-center gap-2 mt-3 p-3 rounded-md ${styles[type] || ''}">
          ${icons[type] || ''}
          <span class="text-xs font-medium">${message}</span>
        </div>
      `;
    });
  } else {
    statusEl.innerHTML = '';
  }
}
