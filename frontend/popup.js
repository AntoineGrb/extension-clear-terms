document.getElementById('testButton').addEventListener('click', async () => {
  const button = document.getElementById('testButton');
  const responseDiv = document.getElementById('response');

  // Désactiver le bouton et afficher le chargement
  button.disabled = true;
  responseDiv.textContent = 'Envoi de la requête à Gemini...';
  responseDiv.className = 'loading';

  try {
    const response = await fetch('http://localhost:3000/api/test-gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Bonjour Gemini ! Peux-tu me confirmer que tu fonctionnes bien ?'
      })
    });

    const data = await response.json();

    if (data.success) {
      responseDiv.textContent = `Réponse de Gemini :\n\n${data.response}`;
      responseDiv.className = 'success';
    } else {
      responseDiv.textContent = `Erreur : ${data.error}`;
      responseDiv.className = 'error';
    }

  } catch (error) {
    responseDiv.textContent = `Erreur de connexion : ${error.message}\n\nAssurez-vous que le serveur backend est démarré sur le port 3000.`;
    responseDiv.className = 'error';
  } finally {
    button.disabled = false;
  }
});
