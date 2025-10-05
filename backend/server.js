const express = require('express');
const cors = require('cors');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------
// Configuration
// -----------------------------
const MODEL = "gemini-2.0-flash"; 
// ⚠️ Mets ici le modèle exact que tu as vu dans ta liste /models
// Exemple : "gemini-1.5-flash-latest" ou "gemini-2.0-flash"
// Ne mets PAS de "/" au début

app.use(cors());
app.use(express.json());

// -----------------------------
// Route principale
// -----------------------------
app.post('/api/test-gemini', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message requis' });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    // Appel à l’API Gemini
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }]
      })
    });

    // Lecture de la réponse brute (texte)
    const raw = await response.text();

    if (!raw) {
      throw new Error("Réponse vide reçue de l'API Gemini.");
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.error("Réponse non JSON reçue :", raw);
      throw new Error("Réponse non JSON valide reçue de l'API Gemini.");
    }

    if (!response.ok) {
      throw new Error(data.error?.message || `Erreur HTTP ${response.status}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Aucune réponse générée";

    res.json({ success: true, response: text });

  } catch (error) {
    console.error('Erreur Gemini:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// -----------------------------
// Lancement du serveur
// -----------------------------
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
});
