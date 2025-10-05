# Test Gemini 2.0 Flash API

Projet simple pour tester l'API Gemini 2.0 Flash avec un backend Node.js et une extension Chrome.

## Installation

### Backend

1. Aller dans le dossier backend :
```bash
cd backend
```

2. Installer les dépendances :
```bash
npm install
```

3. Créer un fichier `.env` à partir de `.env.example` :
```bash
cp .env.example .env
```

4. Ajouter votre clé API Gemini dans le fichier `.env` :
```
GEMINI_API_KEY=votre_cle_api_google
PORT=3000
```

5. Démarrer le serveur :
```bash
npm start
```

### Extension Chrome

1. Ouvrir Chrome et aller à `chrome://extensions/`
2. Activer le "Mode développeur" en haut à droite
3. Cliquer sur "Charger l'extension non empaquetée"
4. Sélectionner le dossier `frontend`

## Utilisation

1. S'assurer que le serveur backend est démarré
2. Cliquer sur l'icône de l'extension dans Chrome
3. Cliquer sur le bouton "Envoyer requête test à Gemini"
4. La réponse de Gemini s'affichera en dessous

## Note

Pour obtenir une clé API Gemini, visitez : https://aistudio.google.com/app/apikey
