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

## Étape 5 (facultative) : des IA de secours

Si Gemini est saturé, l'app peut passer toute seule à d'autres IA gratuites, dans l'ordre **Gemini → Cerebras → Mistral → Groq** (seulement celles qui ont une clé) :

- **Cerebras** : clé gratuite sur https://cloud.cerebras.ai (menu API Keys). Très rapide, limite par minute large.
- **Mistral** : clé gratuite sur https://console.mistral.ai/api-keys (offre « Experiment »). Très bon en français ; sur l'offre gratuite, Mistral peut utiliser les textes envoyés pour entraîner ses modèles.

Colle-les dans Réglages → Résumé. Tu peux aussi choisir l'une d'elles comme IA principale.

## Étape 6 (facultative) : importer directement depuis le cloud Plaud

Plus besoin d'exporter chaque enregistrement à la main : l'app Plaud envoie déjà tes enregistrements dans son cloud (c'est gratuit, seule la transcription est limitée), et Notes Plaud va les y chercher en MP3.

Le serveur de Plaud refuse les appels venant d'un autre site. Il faut donc un petit **relais** : un programme de 75 lignes que tu héberges gratuitement chez Cloudflare. Il ne transmet que les 5 requêtes utiles à l'import, n'accepte que ton site, et ne stocke rien.

**A. Créer le relais (10 min, plus simple sur PC)**

1. Crée un compte gratuit sur **https://dash.cloudflare.com/sign-up**.
2. Menu **Compute (Workers)** → **Workers & Pages** → **Create** → **Start with Hello World** (ou « Create Worker »). Donne-lui un nom, par exemple `plaud-relais`, puis **Deploy**.
3. Touche **Edit code**, efface tout le code, colle le contenu du fichier **`relais-plaud-cloudflare.js`** fourni avec l'app, puis **Deploy**.
4. Retourne sur la page du Worker → **Settings** → **Variables and Secrets** → **Add** : type *Text*, nom `ALLOWED_ORIGIN`, valeur l'adresse de ton site **sans / à la fin**, par exemple `https://ton-pseudo.github.io`. Enregistre (**Deploy**).
5. Copie l'adresse du relais, affichée sur la page du Worker : `https://plaud-relais.ton-compte.workers.dev`.

L'offre gratuite de Cloudflare permet 100 000 requêtes par jour : un import en utilise 2 ou 3 par enregistrement.

**B. Récupérer ton jeton Plaud**

Le jeton est la « clé de session » du site web de Plaud. L'app ne te demande pas ton mot de passe exprès : une connexion par mot de passe ouvrirait une nouvelle session et **déconnecterait l'app Plaud de ton téléphone**.

L'app trouve le jeton toute seule, quel que soit le nom que Plaud lui donne (Plaud change ce nom de temps en temps).

- *Sur ordinateur :* connecte-toi à **https://web.plaud.ai**, appuie sur **F12**, onglet **Console**. Dans Notes Plaud → Réglages → Import depuis Plaud, touche **Copier la commande**, colle-la dans la console et fais Entrée : le message « Jeton copié » apparaît et le jeton est dans ton presse-papier. (Si Chrome refuse de coller, tape d'abord `allow pasting` puis Entrée, et recommence.)
- *Sur le téléphone seulement :* dans Notes Plaud, Réglages → Import depuis Plaud → **Copier le code du favori**. Dans Chrome, ajoute n'importe quelle page aux favoris, modifie ce favori, nomme-le `jeton` et remplace son adresse par le code copié. Ouvre **web.plaud.ai** et connecte-toi (si le site ne s'affiche pas bien, menu ⋮ → **Version pour ordinateur**). Tape ensuite `jeton` dans la barre d'adresse et touche le favori proposé : le jeton s'affiche dans une fenêtre, sélectionne-le entièrement et copie-le.

**C. Brancher l'app**

Réglages → **Import depuis Plaud** : colle l'adresse du relais et le jeton, touche **Tester la connexion** (tu dois voir « Connecté : N enregistrements… » et la date d'expiration du jeton), puis **Enregistrer**.

**Comment ça marche ensuite**

- Enregistre avec ton Plaud, puis ouvre l'app Plaud pour qu'elle synchronise (Bluetooth → cloud). Pas besoin de lancer la transcription Plaud.
- À chaque ouverture de Notes Plaud (au plus toutes les 5 min), les **nouveaux** enregistrements sont importés et traités automatiquement, l'un après l'autre. La note prend la date de l'enregistrement.
- Seuls les enregistrements faits **après** la mise en service sont importés tout seuls. Pour les anciens : bouton **Importer depuis Plaud** sur l'accueil, coche ceux que tu veux. Ceux déjà importés sont marqués.
- Si Plaud n'a pas encore préparé la version MP3 d'un enregistrement tout juste synchronisé, il est marqué « en attente » et retenté à la prochaine ouverture. Si ça dure, ouvre-le une fois dans l'app Plaud.
- Tu peux désactiver l'import automatique (case à cocher dans les réglages) et ne garder que le bouton.
- Le jeton expire au bout de quelques semaines ou mois (la date s'affiche au test). L'app te le dira : il suffit de le recopier.

⚠️ Cette API de Plaud n'est **pas officielle** : Plaud peut la modifier ou la bloquer du jour au lendemain. Dans ce cas, le partage manuel (Exporter → MP3 → Partager) continue de fonctionner.

## Apparence (thèmes)

Réglages → **Apparence** : choisis parmi 8 thèmes — **Système** (suit le mode clair/sombre du téléphone), **Clair**, **Sombre**, **Parchemin**, **Océan**, **Forêt**, **Nuit** et **Prune**. Le changement est immédiat et retenu. « Système » bascule tout seul entre clair et sombre selon l'heure/les réglages Android.

## Utilisation

- **Depuis Plaud :** automatiquement si l'import depuis le cloud est configuré (étape 6). Sinon, ouvre l'enregistrement, puis **Exporter → Audio → MP3 → Partager → Notes Plaud**.
- **Depuis un fichier :** dans l'app, touche **Choisir un fichier audio**.
- **Pendant le traitement :** garde l'app au premier plan. L'écran reste allumé tout seul.
- **Sur une note :** **Copier**, **Partager** (vers Keep, Gmail, WhatsApp, Drive…) ou **.md** (téléchargement).
- **Améliorer la transcription :** dans l'onglet Transcription, touche **Améliorer avec l'IA**. L'IA corrige les mots mal reconnus d'après le contexte, enlève les hésitations et reformule en phrases claires, sans rien résumer. Tu peux passer de la version **Améliorée** à la version **Brute** à tout moment. Avec Gemini, ça prend quelques secondes ; avec Groq, compte quelques minutes pour 1 h d'audio.
- **Cours rédigé :** dans l'onglet **Cours**, touche **Rédiger le cours**. À la différence du résumé (condensé) et de la transcription améliorée (le parlé nettoyé), l'IA écrit ici une **version longue, développée et structurée** de tout le cours — titres, paragraphes, définitions et formules — comme un chapitre de manuel ou un polycopié, idéale pour réviser. Rien n'est résumé : tout est repris et expliqué. Sur un long enregistrement, la rédaction se fait morceau par morceau (barre de progression) ; si elle s'interrompt, **Reprendre** continue là où ça s'était arrêté. Le cours est inclus dans **Copier** (depuis l'onglet Cours) et dans l'export **.md**.

### Envoyer une note vers NotebookLM

NotebookLM (version gratuite) n'a pas d'API : impossible d'y pousser une note automatiquement. Mais on peut le faire en un geste.

- **Sur téléphone :** sur une note, touche **Envoyer vers NotebookLM (PDF)**. L'app fabrique un PDF propre (résumé + cours rédigé + transcription) et ouvre le partage Android → touche **NotebookLM**, qui l'ajoute comme source. (L'app NotebookLM n'accepte au partage que les PDF, sites web et vidéos YouTube — d'où le PDF.)
- **Sur ordinateur :** deux options, sans rien installer :
  - **Copier** la note, puis dans NotebookLM : **Ajouter une source → Texte collé** → coller.
  - ou **Envoyer vers NotebookLM (PDF)** télécharge le PDF, que tu importes dans NotebookLM (**Ajouter une source → Importer un fichier**). L'export **.md** marche aussi à l'import.

Le PDF se génère sur l'appareil ; la première fois, l'app télécharge une petite bibliothèque (connexion Internet requise une fois).

### Organiser ses notes

- **Type de résumé :** l'IA reconnaît s'il s'agit d'un cours, d'une réunion ou d'une note perso. Pour un cours, le résumé contient : points sur lesquels le prof a insisté, à retenir pour l'examen, à retravailler à la maison, définitions et formules, exemples, devoirs, et des questions pour réviser (touche une question pour voir la réponse). Tu peux fixer le type par défaut dans les Réglages, ou le choisir avec « Refaire le résumé ».
- **Tags :** l'IA en propose 2 à 4 par note. Sur une note, touche « + Tag » pour en ajouter, la croix pour en retirer. Sur l'accueil, la barre de tags filtre la liste. Renommer ou supprimer un tag : Réglages → Tags.
- **Date :** si le nom du fichier contient une date (« 2025-03-12 14-30.mp3 », « 20250312_143005.m4a », « 12-03-2025 »…), la note la reprend. Sinon c'est la date du jour. Pour la changer, touche la date en haut de la note.
- **Calendrier :** sur l'accueil, bascule « Liste / Calendrier », puis touche un jour pour voir ses notes.
- **Sélection :** « Sélectionner » sur l'accueil permet de taguer ou supprimer plusieurs notes d'un coup. Une note seule se supprime aussi depuis son écran (bouton « Supprimer » en bas).

### Plusieurs enregistrements pour un même cours

- Sur l'accueil, touche « Sélectionner », coche les enregistrements, puis **Fusionner**.
- Les transcriptions sont mises bout à bout dans l'ordre (un séparateur par enregistrement, horodatages continus) et **un seul résumé** est fait sur l'ensemble. Les notes d'origine peuvent être gardées ou supprimées.

### Onglet Tâches

- **D'où viennent les tâches :** chaque résumé liste des tâches précises (« Refaire l'exercice 3 du TD 2 »), avec leur échéance quand elle est dite ou déductible, et une priorité si c'est important. Elles arrivent toutes dans l'onglet **Tâches** (en bas de l'écran), avec les tags de leur note.
- **Affichages :** par **échéance** (en retard, aujourd'hui, demain, cette semaine…), **par tag**, ou en **calendrier**. Les tuiles du haut filtrent en un toucher ; la barre de tags aussi.
- **Cocher** une tâche, ici ou dans la note, revient au même. Les terminées sont masquées (bouton pour les revoir).
- **Modifier** : touche une tâche pour changer son texte, son échéance, son rappel, sa priorité et ses tags, ouvrir sa note, ou la supprimer. Le bouton **+** ajoute une tâche à la main.
- **Rappels** : un rappel automatique est placé la veille à 18 h des échéances (réglable dans Réglages → Notifications). Ils s'affichent quand l'app est ouverte ou peu après ; pour un rappel garanti même téléphone éteint, touche **Google Agenda** dans la fiche de la tâche.
- **⋯ en haut** : partager la liste en texte, ou exporter les tâches datées vers un agenda (.ics).
- Dans l'export .md, les tâches suivent le format du plugin Obsidian Tasks (📅 échéance, ⏰ rappel, ⏫ priorité).

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

Avec l'import depuis le cloud (étape 6), l'audio passe par ton relais Cloudflare, qui ne garde rien. Ton jeton Plaud reste dans le téléphone et n'est envoyé qu'au relais puis à Plaud. L'audio est envoyé uniquement à Groq, pour la transcription. L'app supprime sa copie de l'audio une fois la note terminée. Pour le résumé, seule la transcription écrite est envoyée, à Gemini ou à Groq selon ton réglage. Sur l'offre gratuite de Gemini, Google peut utiliser ces textes pour améliorer ses modèles. Pour les conversations vraiment sensibles, utilise plutôt le script PC 100 % local (`plaud_local.py`).

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
| « Relais Plaud injoignable » | Vérifie l'adresse du relais dans les réglages (elle finit par `.workers.dev`), et que le Worker est bien déployé. |
| « Le relais refuse cette app » | La variable `ALLOWED_ORIGIN` du Worker doit être exactement l'adresse de ton site (`https://ton-pseudo.github.io`, sans / final). |
| « Jeton Plaud refusé ou expiré » | Recopie le jeton depuis web.plaud.ai (étape 6 B). |
| « La version MP3 n'est pas encore prête » | Ouvre l'enregistrement dans l'app Plaud, attends quelques minutes, puis réessaie. |
| « Le relais n'accepte pas l'hébergeur … » | Plaud a changé d'hébergeur de fichiers : ajoute le nom indiqué à la ligne `AUDIO_HOSTS` du relais, puis **Deploy**. |
| Mettre l'app à jour | Remplace les fichiers sur GitHub. Le téléphone reçoit la nouvelle version à la prochaine ouverture. |
