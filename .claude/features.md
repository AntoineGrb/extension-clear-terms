# Fonctionnalités & plan d’action par version

---

## 🧩 V1 — MVP : Scan manuel + rapport IA

### Objectifs
- Définir le format JSON de rapport
- Intégrer Gemini via backend
- Permettre un scan manuel sur la page active
- Afficher le résultat synthétique dans la popup

### Actions
- [x] Création du schéma JSON (voir schema.json)
- [x] Extraction de texte de la page (content script)
- [x] Envoi à `/scan`
- [x] Polling `/jobs/:id` pour récupérer le résultat
- [x] Validation JSON côté extension
- [x] Calcul du score + grade (renormalisation N/A)
- [x] UI popup : score global + 3 catégories clés
- [x] Sauvegarde du dernier rapport
- [x] Paramètres de base : langue, quota, disclaimer
- [x] Ajouter une page à propos (intégrée au pop up qui s'ouvre au clic) avec explication du scoring, de la méthode...

---

## 🧭 V2 — Détection automatique + toast ✅ TERMINÉE

### Objectifs
- Détecter automatiquement la présence de CGU
- Alerter via un toast rapide
- Déclencher l'analyse ou ouvrir le rapport cache

### Actions
- [x] Script d'analyse DOM avec détection à deux niveaux (filtre léger + validation approfondie)
- [x] Heuristiques internationales (terms|privacy|cgu…) FR/EN
- [x] Création du toast (Shadow DOM, Tailwind) avec traductions
- [x] Personnalisation du toast dans les paramètres (activation on/off)
- [x] Workflow "analyse en cours" → "rapport disponible" en arrière-plan
- [x] Gestion des jobs en arrière-plan (background.js avec polling)
- [x] Gestion des erreurs IA ou réseau avec messages explicites
- [x] Vérification CGU sur l'analyse manuelle (même validation que l'auto)
- [x] Exclusion des moteurs de recherche et pages navigables
- [x] Harmonisation extraction contenu (même hash auto/manuel)
- [x] Affichage URL analysée dans le rapport + copie presse-papier
- [x] **Refactoring code V2** : Backend (utils/, services/) + Frontend (utils/, services/, content-script/)

---

## 🕒 V3 — Historique et persistance locale

### Objectifs
- Historiser les analyses (locales)
- Offrir une interface de consultation

### Actions
- [ ] Page “Historique” des rapports.
- [ ] Cartes repliables : score, catégories, détails
- [ ] Recherche / tri (domaine, score, date)
- [ ] Synchronisation avec `chrome.storage.local`
- [ ] Personnalisation apparition toast 1 fois ou plus par rapport
- [ ] Export CSV & JSON

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
