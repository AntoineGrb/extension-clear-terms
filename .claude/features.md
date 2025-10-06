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

## 🧭 V2 — Détection automatique + toast

### Objectifs
- Détecter automatiquement la présence de CGU
- Alerter via un toast rapide
- Déclencher l’analyse ou ouvrir le rapport cache

### Actions
- [ ] Script d’analyse DOM (liens et modales)
- [ ] Heuristiques internationales (terms|privacy|cgu…)
- [ ] Création du toast (Shadow DOM, Tailwind)
- [ ] Personnalisation du toast dans les paramètres (activation, emplacement...)
- [ ] Workflow "analyse en cours" → "rapport disponible"
- [ ] Gestion des jobs en arrière-plan
- [ ] Gestion des erreurs IA ou réseau
- [ ] Vérifier qu'on est bien sur des CGs sur l'analyse manuelle.

---

## 🕒 V3 — Historique et persistance locale

### Objectifs
- Historiser les analyses (locales)
- Offrir une interface de consultation

### Actions
- [ ] Page “Historique” des rapports.
- [ ] Cartes repliables : score, catégories, détails
- [ ] Recherche / tri (domaine, score, date)
- [ ] Export / import JSON
- [ ] Synchronisation avec `chrome.storage.local`
- [ ] Terms of service (disclaimer juridique, utilisation des données...)

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
