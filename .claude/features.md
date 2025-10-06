# Fonctionnalités & plan d’action par version

---

## 🧩 V1 — MVP : Scan manuel + rapport IA

### Objectifs
- Définir le format JSON de rapport
- Intégrer Gemini via backend
- Permettre un scan manuel sur la page active
- Afficher le résultat synthétique dans la popup

### Actions
- [ ] Création du schéma JSON (voir schema.json)
- [ ] Extraction de texte de la page (content script)
- [ ] Envoi à `/scan`
- [ ] Polling `/jobs/:id` pour récupérer le résultat
- [ ] Validation JSON côté extension
- [ ] Calcul du score + grade (renormalisation N/A)
- [ ] UI popup : score global + 3 catégories clés
- [ ] Sauvegarde du dernier rapport
- [ ] Paramètres de base : langue, quota, disclaimer

---

## 🧭 V2 — Détection automatique + toast

### Objectifs
- Détecter automatiquement la présence de CGU
- Alerter via un toast rapide
- Déclencher l’analyse ou ouvrir le rapport cache

### Actions
- [ ] Script d’analyse DOM (liens et modales)
- [ ] Heuristiques internationales (terms|privacy|cgu…)
- [ ] Création du toast (Shadow DOM, Tailwind)
- [ ] Workflow "analyse en cours" → "rapport disponible"
- [ ] Gestion des jobs en arrière-plan
- [ ] Gestion des erreurs IA ou réseau

---

## 🕒 V3 — Historique et persistance locale

### Objectifs
- Historiser les analyses (locales)
- Offrir une interface de consultation

### Actions
- [ ] Page “Historique”
- [ ] Cartes repliables : score, catégories, détails
- [ ] Recherche / tri (domaine, score, date)
- [ ] Export / import JSON
- [ ] Synchronisation avec `chrome.storage.local`

---

## ☁️ V4 — Backend cache, Auth & Paiements

### Objectifs
- Réduire les coûts via cache partagé
- Mettre en place un système d’utilisateurs et de quotas
- Gérer le paiement via Stripe

### Actions
- [ ] Implémentation SQLite (ou KV)
- [ ] Endpoints `/auth`, `/me`, `/stripe/webhook`
- [ ] Stripe Checkout + Customer Portal
- [ ] Système de quotas mensuels
- [ ] Cache global par `domain + content_hash`
- [ ] Tableau admin (liste des scans récents)
- [ ] Choix de la langue (anglai ou français sur l'appli)

---

## 📚 V5 — Rapport approfondi & alertes

### Objectifs
- Ajouter plus de détails et de transparence
- Permettre un suivi des changements de CGU

### Actions
- [ ] Détails par catégorie : citations, exemples
- [ ] Export PDF
- [ ] Alerte lors de modification détectée (diff texte)
- [ ] Mode comparatif : anciennes vs nouvelles CGU
- [ ] Optimisation des prompts IA (contextualisation)

---

## 🧱 Étapes transversales

- [ ] Tests unitaires (parseur DOM, validator JSON, scoring)
- [ ] Accessibilité (focus, contrastes, clavier)
- [ ] i18n (FR/EN)
- [ ] Logs et télémétrie anonymes (opt-in)
