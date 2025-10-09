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

## 🕒 V3 — Historique et persistance locale ✅ TERMINÉE

### Objectifs
- Historiser les analyses (locales)
- Offrir une interface de consultation

### Actions
- [x] Page "Historique" des rapports (pages/history/history.html)
- [x] Cartes repliables : score, catégories, détails
- [x] Recherche / tri (domaine, score, date)
- [x] Synchronisation avec `chrome.storage.local` (max 100 rapports)
- [x] Personnalisation position et durée du toast dans les paramètres
- [x] Suppression totale de l'historique
- [x] **Cache intelligent** : Système de hash multilingue
- [x] **Timestamps cohérents** : Nouvelle analyse = nouvelle date
- [x] **Filtrage éléments dynamiques** : Bannières cookies, modales
- [x] **Détection SPAs** : Attente dynamique du contenu (React/Vue)
- [x] **Conformité RGPD** : Conditions de service conformes (préavis 30j, opt-out explicite)
- [x] Export CSV/JSON individuel par rapport

---

## ☁️ V4 — Backend cache, Auth & Paiements

### Objectifs
- Réduire les coûts via cache partagé
- Mettre en place un système d’utilisateurs et de quotas
- Gérer le paiement

### Actions
- [ ] Endpoints `/auth`, `/me`, `/stripe/webhook`
- [ ] Mettre en place le paiement avec la solution choisie
- [ ] Système de quotas mensuels
- [ ] Cache global par `domain + content_hash`

---

## 📚 V5 — Rapport approfondi & alertes

### Objectifs
- Ajouter plus de détails et de transparence
- Permettre un suivi des changements de  CGU

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
- [x] i18n (FR/EN) - Système complet avec auto-détection langue navigateur
- [x] Logs détaillés pour débogage (content script + background + backend)
- [ ] Télémétrie anonymes (opt-in)

---

## 🔧 Améliorations techniques récentes (V3)

### Gestion du cache
- [x] Cache multilingue : un rapport par langue (FR/EN)
- [x] Hash du contenu pour déduplication
- [x] Filtrage des éléments dynamiques (cookies, modales) pour stabilité du hash
- [x] Copie profonde des rapports pour éviter mutations par référence

### Timestamps et historisation
- [x] Timestamps mis à jour à chaque nouvelle analyse (même si cache)
- [x] Affichage cohérent du dernier rapport global dans popup
- [x] Détection analyse en cours vs rapport historique
- [x] Format relatif des dates (il y a X minutes/heures/jours)

### Détection améliorée
- [x] Attente dynamique du contenu pour SPAs (React, Vue, etc.)
- [x] Détection "contenu réel" vs messages "JavaScript required"
- [x] Retry logic avec timeout de 10 secondes
- [x] Logs détaillés pour debug des détections

### Conformité et qualité
- [x] Conditions de service conformes RGPD
- [x] Mention explicite RGPD dans section "Conformité légale"
- [x] Préavis de 30 jours pour modifications + opt-out explicite
- [x] Instructions IA renforcées pour respect de la langue demandée
- [x] README.md complet et à jour
