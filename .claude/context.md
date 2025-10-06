# Projet : Clear Terms — Extension Chrome

## 🎯 Objectif
Clear Terms est une extension Chrome qui analyse automatiquement ou sur demande les **Conditions Générales d’Utilisation (CGU)** ou **Politiques de Confidentialité** d’un site web, puis génère :
- Un **résumé synthétique** ;
- Un **score global** (A → E) ;
- Une **évaluation par 10 catégories clés**.

L’objectif est de **rendre compréhensibles les CGU** pour les utilisateurs ordinaires, tout en contrôlant le coût des requêtes IA via cache et optimisation.

---

## ⚙️ Architecture générale

### 1. Monorepo
Le projet est organisé en deux applications :
- `frontend/` : extension Chrome (Manifest V3)
- `backend/` : serveur Node.js pour les appels IA, le cache, et la gestion des quotas/utilisateurs

### 2. Frontend (Extension Chrome)
- **Tech stack** :
  - Preact + Vite
  - TailwindCSS (aucun CSS externe)
  - Motion One pour les animations (transitions, loaders)
- **Architecture interne** :
  - `popup/` → interface principale (analyse, dernier rapport, historique, paramètres)
  - `content/` → script injecté pour détecter les liens de CGU et afficher le toast
  - `service-worker/` → gestion des messages, du stockage et de la communication backend
  - `options/` → paramètres de l’extension
  - `pages/history/` → page d’historique des rapports

### 3. Backend
- **Tech stack** :
  - Node.js (Express)
  - SQLite (ou Cloudflare KV) pour la persistance minimale
  - Appels IA via **Google Gemini 2.0 Flash** (attention à prévoir des fallbacks en cas de dépreciation)
  - Stripe (plus tard) pour la monétisation

- **Endpoints (MVP)** :
  - `POST /scan` : reçoit une URL, renvoie un `job_id`
  - `GET /jobs/:id` : retourne l’état d’avancement (`queued|running|done|error`) et le rapport final
  - `GET /report?domain=&hash=` : recherche dans le cache
  - (future V4) Auth & Stripe Webhooks

  - **Fichiers input/output pour l'IA**
    - prompt-template: le prompt de contexte injecté à l'IA avant chaque requête
    - schema.json : le schéma de réponse attendu 
    - schema-example.json : un exemple de schéma de réponse


### 4. Communication
- Le frontend **ne communique jamais directement avec Gemini**.  
- L’appel IA est effectué **uniquement par le backend**, qui :
  - Nettoie le texte
  - Gère le cache (`content_hash`)
  - Contrôle le quota utilisateur

---

## 💾 Stockage

| Élément | Stockage | Contenu |
|----------|-----------|----------|
| Rapports récents | `chrome.storage.local` | 20 derniers rapports |
| Préférences utilisateur | `chrome.storage.sync` | Langue, limites, thème |
| Cache backend | SQLite ou KV | Domain, content_hash, rapport JSON |
| Jobs | mémoire (MVP) ou KV (plus tard) | Statut d’analyse en cours |

---

## 🧩 Composants clés

- **Toast** (content script)  
  Petit message flottant s’affichant dès qu’une page contient un lien vers des CGU.
  - Phase 1 : “CGU détectées — analyse en cours…”
  - Phase 2 : “Rapport disponible — voir” (quand job terminé)

- **Popup principale**
  - Bouton “Analyser la page”
  - Affichage du dernier rapport avec score global + 3 badges avec le nombre d'items red/amber/green + 1 catégorie affichée en couleur (priorité aux red)
  - Liens vers Historique / Paramètres / À propos

- **Historique**
  - Liste des rapports précédents
  - Cards repliables avec score, catégories, commentaires
  - Filtrage et recherche par domaine ou score (plus tard)

---

## 🧠 Fonctionnement du flux IA

1. L’utilisateur clique “Analyser” ou la détection automatique repère une CGU.
2. L’extension envoie une requête à `/scan` avec l’URL.
3. Le backend :
   - Télécharge et nettoie la page CGU
   - Calcule un `content_hash`
   - Vérifie si le rapport existe déjà en cache (à terme pourquoi pas en base également)
   - Si oui : renvoie immédiatement le rapport
   - Si non : crée un `job_id`, lance un appel Gemini
4. Le frontend poll `/jobs/:id` jusqu’à obtention du rapport
5. Le rapport est stocké et affiché (avec score, catégories, etc.)

---

## 🔒 Sécurité

- Pas de clé API dans le frontend (seulement côté backend).
- Auth minimaliste :
  - MVP : anonyme avec quota par IP/device_id
  - V4 : magic link email / OAuth + Stripe
- Disclaimer affiché :  
  > “Clear Terms fournit un résumé non-juridique. Consultez toujours le texte original des conditions. Soumis à l'IA donc hallucinations possibles.”

---

## 💰 Monétisation (prévision V4)
A affiner mais dans l'idée : 
- **Gratuit** : 10 analyses/mois, historique limité
- **Pro (2 €/mois ou 6€ par an ou 15€ life-time)** : 200 analyses/mois, historique illimité, rapport détaillé, export PDF, alertes
- **Backend cache** partagé pour réduire les coûts IA

---

## 📈 Roadmap technique synthétique

| Version | Objectif principal |
|----------|--------------------|
| **V1** | Lancer une analyse manuelle, afficher le rapport |
| **V2** | Détection automatique + toast instantané |
| **V3** | Historique des rapports |
| **V4** | Backend cache + Auth + Paiement |
| **V5** | Rapport approfondi + citations + alertes |

