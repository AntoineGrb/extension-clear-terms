// ========================================
// TOAST UI - Interface de notification utilisateur
// ========================================

/**
 * Crée et affiche le toast de notification
 * Utilise Shadow DOM pour l'isolation CSS
 */
function createToast() {
  // Vérifier si le toast existe déjà
  if (document.getElementById('clear-terms-toast-container')) {
    console.log('[Clear Terms] Toast déjà affiché');
    return;
  }

  // Récupérer la langue de l'utilisateur
  chrome.storage.local.get(['userLanguage'], (result) => {
    const lang = result.userLanguage || 'fr';

    const translations = {
      fr: {
        title: 'Rapport CGU disponible',
        subtitle: 'Cliquez pour voir l\'analyse'
      },
      en: {
        title: 'Terms Report Available',
        subtitle: 'Click to view analysis'
      }
    };

    const t = translations[lang];

    // Créer le container
    const toastContainer = document.createElement('div');
    toastContainer.id = 'clear-terms-toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      animation: slideIn 0.3s ease-out;
    `;

    // Créer Shadow DOM
    const shadow = toastContainer.attachShadow({ mode: 'open' });

    // Injecter le style et le HTML
    shadow.innerHTML = `
      <style>
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .toast {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          padding: 16px;
          max-width: 320px;
          border-left: 4px solid #6366f1;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .toast:hover {
          box-shadow: 0 15px 50px rgba(0, 0, 0, 0.25);
          transform: translateY(-2px);
        }

        .toast-content {
          display: flex;
          align-items: start;
          gap: 12px;
        }

        .icon-container {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          background: #eef2ff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon {
          width: 24px;
          height: 24px;
          color: #6366f1;
        }

        .text-content {
          flex: 1;
          min-width: 0;
        }

        .title {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 4px 0;
        }

        .subtitle {
          font-size: 12px;
          color: #6b7280;
          margin: 0;
        }

        .close-btn {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          border: none;
          background: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .close-btn:hover {
          color: #4b5563;
        }

        .close-icon {
          width: 20px;
          height: 20px;
        }
      </style>
      <div class="toast">
        <div class="toast-content">
          <div class="icon-container">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div class="text-content">
            <p class="title">${t.title}</p>
            <p class="subtitle">${t.subtitle}</p>
          </div>
          <button class="close-btn" id="close-toast" aria-label="Close">
            <svg class="close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(toastContainer);

    // Event listener: Ouvrir la popup au clic
    const toastElement = shadow.querySelector('.toast');
    toastElement.addEventListener('click', (e) => {
      if (!e.target.closest('#close-toast')) {
        chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        toastContainer.remove();
      }
    });

    // Event listener: Fermer le toast
    shadow.querySelector('#close-toast').addEventListener('click', (e) => {
      e.stopPropagation();
      toastContainer.remove();
    });

    // Auto-fermeture après 5 secondes
    setTimeout(() => {
      if (document.getElementById('clear-terms-toast-container')) {
        toastContainer.remove();
      }
    }, 5000);
  });
}
