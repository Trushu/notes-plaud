# Notes Plaud : transcription et résumé depuis ton Android

Le principe : dans l'app Plaud, tu fais **Exporter → Audio → MP3 → Partager → Notes Plaud**. Quelques instants plus tard, tu as un titre, un résumé, les points clés, les décisions, les actions à faire et la transcription horodatée.

Tout est gratuit : l'hébergement sur GitHub Pages et l'API Groq. Tu n'as besoin d'aucune carte bancaire.

---

## Étape 1 : créer ta clé Groq (2 min)

1. Va sur **https://console.groq.com**, puis crée un compte (connexion Google possible).
2. Va dans **API Keys**, puis **Create API Key**. Donne-lui un nom, par exemple « Notes Plaud ».
3. Copie la clé (elle commence par `gsk_…`). Garde-la de côté : elle ne s'affiche qu'une seule fois.

## Étape 2 : mettre l'app en ligne sur GitHub Pages (5 min, plus simple sur PC)

L'app doit être en ligne, en HTTPS, pour qu'Android accepte de l'installer et de l'ajouter au menu « Partager ».

1. Crée un compte sur **https://github.com**, s'il te manque.
2. Clique sur **+**, puis **New repository**. Nom : `notes-plaud`. Coche **Public**, puis **Create repository**.
3. Clique sur **uploading an existing file**. Glisse les **5 fichiers** du dossier (`index.html`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`), puis **Commit changes**.
4. Va dans **Settings**, puis **Pages**. Dans « Branch », choisis **main** et **/ (root)**, puis **Save**.
5. Attends 1 à 2 minutes. Ton app est alors en ligne à l'adresse
   `https://TON-PSEUDO.github.io/notes-plaud/`

Le dépôt est public, mais il ne contient que le code de l'app. Ta clé Groq et tes notes restent uniquement sur ton téléphone.

## Étape 3 : installer l'app sur le téléphone

1. Ouvre l'adresse ci-dessus dans **Chrome** sur ton Android.
2. Ouvre le menu **⋮**, puis **Installer l'application** (ou **Ajouter à l'écran d'accueil**, puis **Installer**).
3. Ouvre **Notes Plaud** depuis l'écran d'accueil. Touche **Ajouter ma clé Groq**, colle la clé, puis **Enregistrer**.

L'app doit être *installée* pour apparaître dans le menu « Partager ». Un simple favori ne suffit pas.

## Étape 4 (recommandée) : ajouter une clé Gemini pour des résumés plus rapides

Groq reste utilisé pour la transcription. Pour le résumé, Gemini Flash est plus rapide sur les longs enregistrements et généralement meilleur en français.

1. Va sur **https://aistudio.google.com/apikey** et connecte-toi avec ton compte Google.
2. Touche **Create API key** (ou « Créer une clé API »), puis copie la clé (elle commence par `AIza…`).
3. Dans l'app : roue dentée → **Clé API Gemini** → colle la clé → **Enregistrer**.

Avec « Résumé avec : Auto », l'app utilise Gemini dès qu'une clé Gemini est enregistrée, et Groq sinon. Ton abonnement Gemini n'est pas utilisé ici : cette clé API est gratuite, et c'est un service séparé.

## Utilisation

- **Depuis Plaud :** ouvre l'enregistrement, puis **Exporter → Audio → MP3 → Partager → Notes Plaud**.
- **Depuis un fichier :** dans l'app, touche **Choisir un fichier audio**.
- **Pendant le traitement :** garde l'app au premier plan. L'écran reste allumé tout seul.
- **Sur une note :** **Copier**, **Partager** (vers Keep, Gmail, WhatsApp, Drive…) ou **.md** (téléchargement).

### Temps de traitement (à peu près)

| Durée de l'audio | Transcription | Résumé |
|---|---|---|
| 10 min | quelques secondes | quelques secondes |
| 1 h | 10 à 30 s | quelques secondes avec Gemini, 2 à 4 min avec Groq |

Si le résumé se fait avec Groq, les longs enregistrements prennent quelques minutes, car son offre gratuite limite le volume de texte traité par minute. L'app découpe le texte et fait les pauses nécessaires toute seule : tu verras un compte à rebours. Avec Gemini, tout se fait en une seule fois.

## Limites des offres gratuites (septembre 2026)

- **Transcription :** 2 h d'audio par heure, 8 h par jour, 25 Mo par envoi. L'app découpe automatiquement les fichiers plus gros.
- **Résumé avec Groq :** environ 8 000 tokens par minute et par modèle. L'app utilise deux modèles en alternance pour aller deux fois plus vite.
- **Résumé avec Gemini Flash :** largement suffisant pour plusieurs résumés par jour, même d'enregistrements de plusieurs heures. Si le quota du jour est atteint, l'app essaie le modèle suivant de la liste.

Ces limites peuvent changer. Si un modèle disparaît, remplace-le dans les **Réglages**. Les listes à jour sont sur https://console.groq.com/docs/models et https://ai.google.dev/gemini-api/docs/models.

## Confidentialité

L'audio est envoyé uniquement à Groq, pour la transcription. L'app supprime sa copie de l'audio une fois la note terminée. Pour le résumé, seule la transcription écrite est envoyée, à Gemini ou à Groq selon ton réglage. Sur l'offre gratuite de Gemini, Google peut utiliser ces textes pour améliorer ses modèles. Pour les conversations vraiment sensibles, utilise plutôt le script PC 100 % local (`plaud_local.py`).

Rappel : en France, enregistrer une conversation privée à l'insu des personnes est interdit. Préviens les participants.

## En cas de problème

| Problème | Solution |
|---|---|
| « Notes Plaud » absent du menu Partager | Vérifie que l'app est bien *installée* (étape 3). Si besoin, désinstalle-la puis réinstalle-la. |
| « Clé API Gemini refusée » | Recrée une clé sur aistudio.google.com/apikey, puis colle-la dans les Réglages. |
| « Aucun modèle Gemini utilisable » | Remplace le modèle dans Réglages → Modèles Gemini, ou choisis « Résumé avec : Groq ». |
| « Clé API Groq refusée » | Recolle la clé dans les Réglages, sans espace avant ou après. |
| « Impossible de joindre Groq » | Vérifie ta connexion Internet, puis touche **Réessayer**. |
| Un modèle n'existe plus | Change-le dans Réglages → Modèles de résumé. |
| Une note est marquée « Résumé à refaire » | Ouvre-la, puis touche **Générer le résumé**. La transcription est déjà enregistrée. |
| Mettre l'app à jour | Remplace les fichiers sur GitHub. Le téléphone reçoit la nouvelle version à la prochaine ouverture. |
