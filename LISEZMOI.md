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
3. Clique sur **uploading an existing file**. Glisse les **9 fichiers** de l'app : les 5 indispensables (`index.html`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`) et les 4 icônes des raccourcis (`sc-rec.png`, `sc-cours.png`, `sc-ask.png`, `sc-tasks.png`), puis **Commit changes**. Inutile d'y mettre `relais-plaud-cloudflare.js` (il va chez Cloudflare, étape 6) ni le dossier `tests/`.
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

Le serveur de Plaud refuse les appels venant d'un autre site. Il faut donc un petit **relais** : un programme d'une centaine de lignes que tu héberges gratuitement chez Cloudflare. Il ne transmet que les requêtes utiles à l'import (et la lecture de ton emploi du temps, voir plus bas), n'accepte que ton site, et ne stocke rien.

> **Tu as déjà un relais ? Mets-le à jour (version 33, sécurité renforcée).** Page du Worker → **Edit code**, remplace tout le code par le nouveau `relais-plaud-cloudflare.js`, puis **Deploy**. Vérifie que la variable `ALLOWED_ORIGIN` est bien remplie (étape A.4) : le nouveau relais **refuse tout** sans elle. « Tester la connexion » te signale un relais trop ancien.

**A. Créer le relais (10 min, plus simple sur PC)**

1. Crée un compte gratuit sur **https://dash.cloudflare.com/sign-up**.
2. Menu **Compute (Workers)** → **Workers & Pages** → **Create** → **Start with Hello World** (ou « Create Worker »). Donne-lui un nom, par exemple `plaud-relais`, puis **Deploy**.
3. Touche **Edit code**, efface tout le code, colle le contenu du fichier **`relais-plaud-cloudflare.js`** fourni avec l'app, puis **Deploy**.
4. Retourne sur la page du Worker → **Settings** → **Variables and Secrets** → **Add** : type *Text*, nom `ALLOWED_ORIGIN`, valeur l'adresse de ton site **sans / à la fin**, par exemple `https://ton-pseudo.github.io`. Enregistre (**Deploy**). Cette variable est **obligatoire** : sans elle, le relais refuse toutes les demandes.
5. Copie l'adresse du relais, affichée sur la page du Worker : `https://plaud-relais.ton-compte.workers.dev`.

L'offre gratuite de Cloudflare permet 100 000 requêtes par jour : un import en utilise 2 ou 3 par enregistrement.

**B. Récupérer ton jeton Plaud**

Le jeton est la « clé de session » du site web de Plaud. L'app ne te demande pas ton mot de passe exprès : une connexion par mot de passe ouvrirait une nouvelle session et **déconnecterait l'app Plaud de ton téléphone**.

L'app trouve le jeton toute seule, quel que soit le nom que Plaud lui donne (Plaud change ce nom de temps en temps).

- *Sur ordinateur :* connecte-toi à **https://web.plaud.ai**, appuie sur **F12**, onglet **Console**. Dans Notes Plaud → Réglages → Import depuis Plaud, touche **Copier la commande**, colle-la dans la console et fais Entrée : le message « Jeton copié » apparaît et le jeton est dans ton presse-papier. (Si Chrome refuse de coller, tape d'abord `allow pasting` puis Entrée, et recommence.)
- *Sur le téléphone seulement :* dans Notes Plaud, Réglages → Import depuis Plaud → **Copier le code du favori**. Dans Chrome, ajoute n'importe quelle page aux favoris, modifie ce favori, nomme-le `jeton` et remplace son adresse par le code copié. Ouvre **web.plaud.ai** et connecte-toi (si le site ne s'affiche pas bien, menu ⋮ → **Version pour ordinateur**). Tape ensuite `jeton` dans la barre d'adresse et touche le favori proposé : le jeton s'affiche dans une fenêtre, sélectionne-le entièrement et copie-le.

**C. Brancher l'app**

Réglages → **Import depuis Plaud** : colle l'adresse du relais (elle commence par `https://`) et le jeton, touche **Tester la connexion** (tu dois voir « Connecté : N enregistrements… » et la date d'expiration du jeton), puis **Enregistrer**.

**Comment ça marche ensuite**

- Enregistre avec ton Plaud, puis ouvre l'app Plaud pour qu'elle synchronise (Bluetooth → cloud). Pas besoin de lancer la transcription Plaud.
- À chaque ouverture de Notes Plaud (au plus toutes les 5 min), les **nouveaux** enregistrements sont importés et traités automatiquement, l'un après l'autre. La note prend la date de l'enregistrement.
- Seuls les enregistrements faits **après** la mise en service sont importés tout seuls. Pour les anciens : bouton **Importer depuis Plaud** sur l'accueil, coche ceux que tu veux. Ceux déjà importés sont marqués.
- Si Plaud n'a pas encore préparé la version MP3 d'un enregistrement tout juste synchronisé, il est marqué « en attente » et retenté à la prochaine ouverture. Si ça dure, ouvre-le une fois dans l'app Plaud.
- Tu peux désactiver l'import automatique (case à cocher dans les réglages) et ne garder que le bouton.
- Le jeton expire au bout de quelques semaines ou mois (la date s'affiche au test). L'app te le dira : il suffit de le recopier.

⚠️ Cette API de Plaud n'est **pas officielle** : Plaud peut la modifier ou la bloquer du jour au lendemain. Dans ce cas, le partage manuel (Exporter → MP3 → Partager) continue de fonctionner.

## Emploi du temps et matières (onglet Cours)

Notes Plaud lit le calendrier de tes cours (Moodle / WebCampus, ADE, Google Agenda…) et s'en sert partout :

- **Rangement automatique :** un enregistrement fait pendant un cours (même 20 min avant ou 10 min après) est rangé tout seul dans sa **matière** : pastille colorée sur la note et dans la liste, tag de la matière.
- **L'IA sait de quel cours il s'agit :** le nom complet de la matière, le type de séance (cours, TP), la date et l'enseignant sont donnés à la transcription (meilleure reconnaissance du vocabulaire et des noms) et au résumé.
- **Onglet Cours** (en bas) : le cours **en cours** ou le **prochain** (compte à rebours, salle, bouton **Enregistrer** avec le téléphone si tu n'as pas ton Plaud), la semaine jour par jour (flèches pour changer de semaine) avec, pour chaque séance passée, ✓ si elle est enregistrée. Touche une séance pour ouvrir sa note, ou pour y **associer** une note du même jour. Une pastille rouge sur l'onglet signale un cours en ce moment. L'accueil montre aussi le prochain cours.
- **Page d'une matière :** séances enregistrées, heures d'audio, prochaine séance, et quatre boutons :
  - **Synthèse de la matière** : l'IA rassemble toutes les séances en une fiche de révision (vue d'ensemble, plan séance par séance, notions, définitions et formules, ce que l'enseignant a souligné, **questions d'examen probables avec éléments de réponse**, points à retravailler) ;
  - **Poser une question** à toute la matière (« Dans quelle séance a-t-on vu… ? ») ;
  - **Réviser les fiches** de toutes ses séances ;
  - **PDF pour NotebookLM** : une seule source avec la synthèse et toutes les séances (au choix avec ou sans les transcriptions).
  - En bas : **Renommer** la matière, ou la **Masquer** (un cours que tu ne suis pas ; réversible dans Réglages → Emploi du temps).
- **Échéances :** les devoirs à remettre présents dans le calendrier deviennent des **tâches** datées (une seule fois chacun), avec la matière en tag.
- **Rappel avant chaque cours** (Réglages → Emploi du temps) : une notification « pense à lancer ton Plaud » 5 à 30 min avant.
- Sur une note, touche la pastille de la matière pour **changer de matière** ou la **détacher**.

**Ajouter ton calendrier**

1. Sur WebCampus (Moodle) : **Calendrier → Exporter le calendrier** → « Tous les événements » et « Événements récents et à venir » → **Obtenir l'URL du calendrier**. Copie l'adresse (elle contient une clé personnelle : ne la partage pas).
2. Dans l'app : Réglages → **Emploi du temps** → colle l'adresse → **Synchroniser**. L'adresse reste dans le téléphone (elle n'est même pas dans les sauvegardes, sauf si tu coches « inclure mes clés »).
3. La synchronisation passe par ton **relais Cloudflare** (étape 6, version à jour) : les serveurs d'université n'autorisent pas une app web à lire le calendrier directement. Elle se refait toute seule à l'ouverture de l'app (si la dernière date de plus de 12 h), et quand tu **tires l'accueil vers le bas**.

Sans relais : sur WebCampus, **Exporter** (au lieu de « Obtenir l'URL ») télécharge un fichier `.ics` ; dans l'app, **Importer un .ics** (ou partage le fichier vers Notes Plaud : l'app demande alors confirmation avant de remplacer l'emploi du temps). Il faudra le refaire quand l'horaire change.

L'export Moodle « récents et à venir » couvre environ deux mois : l'app **garde l'historique** des séances passées à chaque synchronisation (même quand tu partages un fichier `.ics` vers l'app), et retire les séances annulées. Les cours qui se répètent (Google Agenda, Outlook, ADE) sont bien lus, y compris plusieurs jours par semaine, les séances déplacées ou annulées une seule fois, et les fuseaux horaires d'Outlook. Les événements « journée entière » ne sont gardés que s'il s'agit d'une échéance ou d'un examen (pas les congés ni les fêtes), et ne sont jamais pris pour un cours en cours. Pour un autre hébergeur que l'UNamur, Google Agenda ou Outlook, ajoute-le dans la variable `ICS_HOSTS` du relais (ex. `ade.univ-exemple.fr`).

## Apparence (thèmes)

Réglages → **Apparence** : choisis parmi 8 thèmes — **Système** (suit le mode clair/sombre du téléphone), **Clair**, **Sombre**, **Parchemin**, **Océan**, **Forêt**, **Nuit** et **Prune**. Le changement est immédiat et retenu. « Système » bascule tout seul entre clair et sombre selon l'heure/les réglages Android. Juste en dessous, **Taille du texte des notes** agrandit ou réduit le texte des résumés, cours et transcriptions (pratique pour réviser).

Les 8 thèmes respectent les contrastes recommandés pour l'accessibilité (WCAG niveau AA) : textes lisibles en plein soleil, contour des champs et des cases à cocher bien visible. Si tu as activé **Supprimer les animations** dans les réglages d'accessibilité d'Android, l'app n'anime plus rien.

## Accessibilité (TalkBack, clavier)

- **TalkBack** (lecteur d'écran d'Android) : chaque bouton annonce ce qu'il fait (« Modifier le titre », « Retirer le tag algo », « Terminée : Refaire l'exercice 3 »…), les filtres disent s'ils sont actifs, et les titres de rubriques (Épinglées, Aujourd'hui, Matières, parties des Réglages…) se parcourent avec la navigation par titres. En changeant d'écran, la lecture reprend au titre du nouvel écran ; les fenêtres du bas (tâche, tags, date…) gardent la lecture à l'intérieur jusqu'à leur fermeture (geste Retour), puis reviennent au bouton qui les avait ouvertes. Le nombre de résultats d'une recherche et les échecs de traitement sont annoncés.
- **Clavier Bluetooth** : **Tab** pour passer d'un élément à l'autre (un contour épais montre où l'on est), **Entrée** ou **Espace** pour activer, **flèches** pour changer d'onglet ou d'option (thème, taille du texte, priorité), **Échap** pour fermer une fenêtre ou la photo. Dans les fiches de révision, le focus passe tout seul à la réponse puis à la question suivante.

## Utilisation

- **Depuis Plaud :** automatiquement si l'import depuis le cloud est configuré (étape 6). Sinon, ouvre l'enregistrement, puis **Exporter → Audio → MP3 → Partager → Notes Plaud**.
- **Depuis un fichier :** dans l'app, touche **Choisir un fichier audio**. Si un traitement est déjà en cours, le fichier est gardé et transcrit juste après.
- **Avec le micro du téléphone :** touche **Enregistrer avec le téléphone** (la première fois, autorise le micro). Pendant l'enregistrement : **Pause/Reprendre**, et **Marquer** pour signaler un passage important (il sera repéré par une ★ dans la transcription). Touche le **carré rouge** pour terminer : transcription et résumé se lancent tout seuls. Tu peux revenir à l'accueil pendant l'enregistrement (une bannière rouge permet d'y revenir). L'écran reste allumé par défaut (bouton « Écran allumé » pour changer) ; l'audio est sauvegardé toutes les 5 secondes, donc si l'app se ferme, l'enregistrement est **récupéré** à la réouverture. Un cours de 3 h ne pose pas de problème : l'enregistrement est découpé automatiquement pour la transcription.
- **Pendant le traitement :** l'écran reste allumé tout seul. Tu peux aussi **réduire l'app** : le traitement continue en arrière-plan (Réglages → Notifications → « Continuer les traitements en arrière-plan », activé par défaut). L'app se maintient active grâce à un **son silencieux** — Android peut donc l'afficher comme si un média jouait, c'est normal. Selon l'économie de batterie du téléphone, Android peut quand même finir par la suspendre ; dans ce cas tout **reprend à la réouverture** (pour un long enregistrement, les parties déjà résumées sont gardées). **Sans réseau** (métro, amphi), le traitement se met en pause et reprend tout seul dès le retour de la connexion. Active les **notifications** pour être prévenu quand une note est prête ou si un traitement se met en pause (quota, erreur).
- **Sur une note :** **Copier**, **Partager** (vers Keep, Gmail, WhatsApp, Drive…) ou **.md** (téléchargement).
- **Améliorer la transcription :** dans l'onglet Transcription, touche **Améliorer avec l'IA**. L'IA corrige les mots mal reconnus d'après le contexte, enlève les hésitations et reformule en phrases claires, sans rien résumer. Tu peux passer de la version **Améliorée** à la version **Brute** à tout moment. Avec Gemini, ça prend quelques secondes ; avec Groq, compte quelques minutes pour 1 h d'audio.
- **Cours rédigé :** dans l'onglet **Cours**, touche **Rédiger le cours**. À la différence du résumé (condensé) et de la transcription améliorée (le parlé nettoyé), l'IA écrit ici une **version longue, développée et structurée** de tout le cours — titres, paragraphes, définitions et formules — comme un chapitre de manuel ou un polycopié, idéale pour réviser. Rien n'est résumé : tout est repris et expliqué. Sur un long enregistrement, la rédaction se fait morceau par morceau (barre de progression) ; si elle s'interrompt, **Reprendre** continue là où ça s'était arrêté. Le cours est inclus dans **Copier** (depuis l'onglet Cours) et dans l'export **.md**.

### Lire, écouter, annoter une note

- **Glisser** vers la gauche ou la droite passe d'un onglet à l'autre (Résumé → Transcription → Cours).
- **Reprendre la lecture :** chaque note se rouvre à l'onglet et à l'endroit où tu t'étais arrêté (bouton « En haut » dans le message) ; l'accueil propose **Reprendre « … »** pour la dernière note entamée.
- **Chapitres :** les enregistrements de plus de 8 minutes sont découpés automatiquement en chapitres titrés (avec Groq seul, touche **Créer** dans l'onglet Transcription). Liste cliquable en haut de la transcription, titres insérés au fil du texte, repères sur la barre du lecteur et nom du chapitre en cours.
- **Photos du tableau :** sous le résumé, **appareil photo** ou **Galerie**. Les photos prises pendant le cours (même avec l'appareil photo habituel, ajoutées plus tard depuis la galerie) se placent **toutes seules au bon moment** de l'enregistrement, grâce à leur heure de prise de vue ; elles apparaissent dans la transcription. Avec une clé Gemini, l'IA **lit le tableau** (texte, formules, tableaux) : ce contenu nourrit le résumé, le cours rédigé, les questions et le PDF NotebookLM. Touche une photo pour l'agrandir (glisser pour passer à la suivante), voir ce que l'IA a lu, aller au moment de la photo ou la supprimer. Pendant un enregistrement au téléphone, le bouton **Photo** ajoute une photo horodatée (si Android ferme l'app pendant la prise de vue, l'enregistrement est récupéré à la réouverture — sinon, prends les photos avec l'appareil photo et ajoute-les ensuite).
- **Mes notes :** sous le résumé, écris tes propres remarques (questions pour le prof, liens, rappels ; Markdown et formules acceptés). Le brouillon est gardé même si tu quittes. Tes notes sont dans la recherche, les exports, le PDF, et l'IA en tient compte quand tu poses une question.
- **Expliquer un passage :** sélectionne du texte (appui long) dans le résumé, le cours ou la transcription : une barre propose **Expliquer** (l'IA l'explique simplement, avec les passages de l'enregistrement) ou **Question…** (la question commence par ce passage).
- **Lecture à voix haute :** icône **haut-parleur** en haut d'une note : l'app lit l'onglet affiché (résumé, cours rédigé ou transcription) avec la voix française du téléphone, en surlignant le passage lu, à partir de l'endroit où tu es. Pause, vitesse, arrêt dans la barre du bas. Les formules sont dites en français (« a sur b », « x au carré »).

### Réécouter un passage

L'audio de chaque note est **gardé dans le téléphone** (réglable : Réglages → « Garder l'audio après la transcription »). Sur une note, un **lecteur** apparaît en bas :

- Dans l'onglet **Transcription**, **touche une phrase** : la lecture démarre à cet endroit. Le passage en cours est surligné et la transcription défile toute seule (elle s'arrête de défiler quelques secondes si tu fais défiler toi-même).
- **−10 / +30** pour reculer/avancer, **1× → 1,25× → 1,5× → 1,75× → 2× → 0,75×** pour la vitesse (retenue d'une note à l'autre), et la barre pour aller n'importe où.
- La lecture continue écran verrouillé, avec les commandes Android (notification média). Elle se met en pause si tu quittes la note.
- Une note **fusionnée** se lit d'un bloc : l'app enchaîne l'audio de chaque partie.
- Place prise : environ 30 Mo par heure d'audio. Réglages → **Mes données** montre le total et permet de **tout supprimer** ; sur une note, **Supprimer l'audio** (en bas) ne supprime que le son — transcription, résumé, cours et fiches restent.

Les notes créées avant cette version n'ont pas d'audio gardé (il était supprimé après le traitement) : le lecteur n'apparaît que pour les nouvelles.

### Poser une question à ses notes

Sur une note, touche l'icône **bulle ?** en haut (ou **Demander** sous le résumé), puis pose ta question : « Qu'a dit le prof sur le théorème de Gauss ? », « Qu'est-ce qui tombe à l'examen ? »… L'IA répond **uniquement d'après l'enregistrement** et cite les passages sous forme d'horodatages ▷ 12:34 : **touche-en un** pour ouvrir la transcription à cet endroit (et l'écouter si l'audio est gardé).

- **Cette note / La matière / Toutes** : en haut de l'écran. « La matière » interroge toutes les séances du cours (si l'emploi du temps est configuré) ; « Toutes » cherche dans l'ensemble des enregistrements (les réponses indiquent de quelle note vient chaque passage). Aussi en appui long sur l'icône de l'app → **Question**.
- Les échanges sont gardés avec la note (icône corbeille pour effacer). Les questions suivantes tiennent compte des précédentes.
- Sur un très long enregistrement avec Groq, l'app n'envoie que les passages les plus pertinents pour la question (limite de l'offre gratuite) ; avec Gemini, tout l'enregistrement est lu.

### Réviser avec des fiches

- Sous le résumé d'une note, **Fiches de révision → Créer** : l'IA prépare 8 à 20 questions-réponses sur les notions importantes (définitions, formules, théorèmes, pièges signalés, points d'examen). Touche ensuite le bouton pour **réviser**, voir la **liste** ou **recréer** les fiches.
- Il n'y a plus d'onglet « Réviser » : la séance se lance depuis la note (bouton sous le résumé, qui indique combien de fiches sont à revoir) ou depuis la page d'une **matière** (**Réviser les fiches** de toutes ses séances). « Retour » ou « Terminer » ramène là où tu étais.
- En séance : lis la question, réfléchis, **touche la carte** pour voir la réponse, puis note-toi : **À revoir** (revient dans 10 min, dans la même séance), **Difficile** (revient plus tôt : demain pour une nouvelle fiche) ou **Je savais** (3 jours, puis 7, 16, 35, 80 jours à chaque réussite). C'est la **révision espacée** : chaque fiche revient juste avant que tu l'oublies. Pendant la séance, une fiche se **modifie** ou se **supprime**.
- **Toutes les matières d'un coup :** quand des fiches sont à revoir, l'accueil affiche **« 12 fiches à réviser »** : **Réviser** lance la séance du jour avec toutes les matières.
- **Statistiques** (icône graphique sur cette carte, ou bouton sous le résumé → **Statistiques de révision**) : fiches à réviser, maîtrisées, **jours d'affilée**, taux de réussite sur 30 jours, fiches qui reviennent les 7 prochains jours, et l'avancement **par matière** (avec un bouton pour réviser une seule matière).
- **Tes propres fiches :** dans le menu des fiches, **Écrire une fiche** en ajoute une ; **Voir et modifier les fiches** permet de corriger une question ou une réponse de l'IA (crayon). La progression est gardée.
- **Anki / AnkiDroid :** **Exporter vers Anki** (menu des fiches d'une note), **Fiches vers Anki** (page d'une matière) ou **Exporter toutes les fiches** (statistiques) télécharge un fichier texte. Dans Anki : **Fichier → Importer** ; dans AnkiDroid : **⋮ → Importer**. Chaque matière devient un paquet « Notes Plaud::Matière », les tags suivent, les formules s'affichent. Réimporter le même fichier met les fiches à jour sans doublon.
- **Rappel quotidien :** Réglages → Notifications → **Rappel quotidien de révision** : une notification à l'heure choisie s'il reste des fiches à réviser (une par jour au plus).

### Rechercher, épingler, sauvegarder

- **Recherche :** la barre de l'accueil cherche dans les titres, résumés, cours rédigés **et** transcriptions, sans tenir compte des accents. Chaque résultat montre l'extrait trouvé ; le toucher ouvre la note **au bon onglet, passage surligné**. Elle reste rapide même avec des centaines de notes de plusieurs heures. Les longues listes (notes, tâches) s'affichent par tranches : la suite arrive en faisant défiler, ou avec **Afficher plus**.
- **Épingler :** l'icône punaise en haut d'une note la garde en tête de l'accueil.
- **Supprimer** une ou plusieurs notes affiche **Annuler** pendant quelques secondes.
- **Sauvegarde :** Réglages → **Mes données → Sauvegarder** télécharge un fichier avec toutes tes notes (résumés, cours, transcriptions, tâches, fiches, questions). **Restaurer** le réimporte (sur ce téléphone ou un autre) sans rien écraser. Les clés d'API ne sont incluses que si tu coches la case ; à la restauration, l'app **demande avant de reprendre** des clés, un jeton ou l'adresse d'un relais (ne réponds « OK » que pour tes propres fichiers). Le contenu d'un fichier de sauvegarde est vérifié : une note mal formée est ignorée. L'audio n'est pas inclus (trop lourd). Un rappel apparaît sur l'accueil quand ta dernière sauvegarde date.
- **Protéger le stockage :** si « Stockage non protégé » s'affiche dans Mes données, touche **Protéger** pour qu'Android n'efface jamais les notes en cas de manque de place (l'app doit être installée).
- **Bouton Retour d'Android :** il ferme d'abord le panneau ouvert, puis revient à l'écran précédent (par exemple : matière → note → retour à la matière) ; à l'accueil, un deuxième appui quitte l'app.
- **Tirer l'accueil vers le bas** vérifie les nouveaux enregistrements Plaud et met à jour l'emploi du temps.

### Raccourcis, tags NFC et télécommande (Flipper Zero…)

- **Appui long sur l'icône** de l'app : **Enregistrer un cours**, **Mes cours**, **Poser une question**, **Mes tâches**. Tu peux glisser un raccourci sur l'écran d'accueil.
- **Tag NFC** (autocollant NTAG, ou ton Flipper Zero en émulation NFC) : écris-y l'adresse de ton app suivie de `?action=rec`, par exemple `https://ton-pseudo.github.io/notes-plaud/?action=rec`. Approcher le téléphone du tag ouvre l'app et **lance l'enregistrement**. Autres actions : `?action=cours`, `?action=question`, `?action=taches`. (L'appli gratuite « NFC Tools » écrit un tag en 30 secondes : Écrire → Ajouter un enregistrement → URL.)
- **Télécommande Bluetooth** — clicker de présentation, clavier, ou Flipper Zero (Apps → Bluetooth → Remote, appairé au téléphone) — pendant un enregistrement au téléphone : **→ / Entrée / Page suivante** = marquer un moment, **Espace** = pause/reprise. Avec des **écouteurs Bluetooth** : « piste suivante » (souvent un double appui) = marquer, lecture/pause = pause, souvent même écran verrouillé (selon le téléphone). Dans le lecteur d'une note : **Espace** lecture/pause, **← / →** reculer de 10 s / avancer de 30 s. Si tu navigues au clavier avec **Tab**, ces touches agissent d'abord sur le bouton qui a le focus (toucher l'écran rend aux touches leur rôle de télécommande).

### Envoyer une note vers NotebookLM

NotebookLM (version gratuite) n'a pas d'API : impossible d'y pousser une note automatiquement. Mais on peut le faire en un geste.

Sur une note, touche **Envoyer vers NotebookLM (PDF)**. L'app prépare un PDF propre (résumé + cours rédigé + transcription, avec **tableaux, formules et accents** correctement rendus), puis ouvre la fenêtre d'impression : choisis **« Enregistrer au format PDF »**.

- **Sur téléphone :** une fois le PDF enregistré, ouvre l'app NotebookLM et ajoute-le comme source (ou partage-le vers NotebookLM depuis tes fichiers). L'app NotebookLM accepte au partage les PDF, sites web et vidéos YouTube.
- **Sur ordinateur :** dans NotebookLM, **Ajouter une source → Importer / PDF** et choisis le fichier. Encore plus simple : bouton **Copier** → **Ajouter une source → Texte collé**. L'export **.md** s'importe aussi directement.

Le PDF est produit par le navigateur (moteur d'impression) : rien à installer, et le texte est parfaitement lu par NotebookLM.

### Renommer une note

Touche le **titre** en haut d'une note (il a un petit crayon) pour le modifier. Le nouveau titre est repris partout : accueil, exports, PDF et nom du fichier PDF.

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

- **Transcription :** 2 h d'audio par heure, 8 h par jour, 25 Mo par envoi. L'app découpe automatiquement les fichiers plus gros (MP3, WAV, M4A et enregistrements faits avec le téléphone).
- **Résumé avec Groq :** environ 8 000 tokens par minute et par modèle. L'app utilise deux modèles en alternance pour aller deux fois plus vite.
- **Résumé avec Gemini Flash :** largement suffisant pour plusieurs résumés par jour, même d'enregistrements de plusieurs heures. Si le quota du jour est atteint, l'app essaie le modèle suivant de la liste.

Ces limites peuvent changer. Si un modèle disparaît, remplace-le dans les **Réglages**. Les listes à jour sont sur https://console.groq.com/docs/models et https://ai.google.dev/gemini-api/docs/models.

## Confidentialité

Avec l'import depuis le cloud (étape 6), l'audio passe par ton relais Cloudflare, qui ne garde rien. Ton jeton Plaud reste dans le téléphone et n'est envoyé qu'au relais puis à Plaud. L'audio est envoyé uniquement à Groq, pour la transcription. Ensuite, l'app en garde une copie **dans le téléphone seulement**, pour la réécoute (désactivable dans les Réglages, et supprimable à tout moment). Les questions posées aux notes, les chapitres, les synthèses de matière et la création de fiches envoient la transcription (ou les passages utiles) à l'IA de résumé choisie, comme pour un résumé. Les photos du tableau restent dans le téléphone ; si tu as une clé Gemini, chaque photo est envoyée une fois à Gemini pour être lue. L'emploi du temps est lu via ton relais Cloudflare (qui ne garde rien) et reste dans le téléphone. Pour le résumé, seule la transcription écrite est envoyée, à Gemini ou à Groq selon ton réglage. Sur l'offre gratuite de Gemini, Google peut utiliser ces textes pour améliorer ses modèles. Pour les conversations vraiment sensibles, utilise plutôt le script PC 100 % local (`plaud_local.py`).

**Sécurité :**
- Tes clés et ton jeton sont gardés dans le stockage du navigateur pour l'adresse `https://ton-pseudo.github.io`. Tous les sites GitHub Pages **de ton compte** partagent cette adresse, et donc ce stockage : n'y héberge pas de pages d'autres personnes ni de code que tu ne connais pas. Au besoin, utilise un compte GitHub dédié à Notes Plaud.
- L'app n'exécute jamais le contenu des transcriptions, des réponses de l'IA, des calendriers ou des sauvegardes : tout est affiché en texte. La bibliothèque des formules (KaTeX) est chargée dans une version précise, et le navigateur la refuse si elle a été modifiée.
- Le relais doit être en `https://` (sinon le jeton Plaud circulerait en clair) ; il n'accepte que ton site et ne transmet le jeton qu'à Plaud.
- L'adresse de ton calendrier passe par le relais dans l'adresse de la requête ; Cloudflare ne garde pas ces adresses, sauf si tu actives toi-même les journaux du Worker.

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
| « Le relais refuse cette app » | La variable `ALLOWED_ORIGIN` du Worker doit être exactement l'adresse de ton site (`https://ton-pseudo.github.io`, sans / final). Depuis la version 33 du relais, elle est obligatoire. |
| « Adresse du relais invalide : elle doit commencer par https:// » | Recopie l'adresse du Worker telle qu'affichée par Cloudflare (`https://…workers.dev`). |
| « Ton relais est une ancienne version » | Remplace le code du Worker par le nouveau `relais-plaud-cloudflare.js` (étape 6, encadré), puis **Deploy**. |
| « Jeton Plaud refusé ou expiré » | Recopie le jeton depuis web.plaud.ai (étape 6 B). |
| « La version MP3 n'est pas encore prête » | Ouvre l'enregistrement dans l'app Plaud, attends quelques minutes, puis réessaie. |
| « Le relais n'accepte pas l'hébergeur … » | Plaud a changé d'hébergeur de fichiers : ajoute le nom indiqué à la ligne `AUDIO_HOSTS` du relais, puis **Deploy**. |
| « Micro refusé » | Touche le cadenas à gauche de l'adresse (ou Réglages Android → Applis → Chrome → Autorisations → Micro) et autorise le micro, puis réessaie. |
| L'enregistrement s'arrête écran éteint | Laisse l'app au premier plan (« Écran allumé » activé), et mets la batterie de Chrome sur « Sans restriction ». Ce qui a été enregistré est récupéré à la réouverture. |
| Pas de lecteur sur une note | L'audio n'est gardé que pour les notes traitées avec cette version, si « Garder l'audio » est activé. |
| « Lecture impossible : format audio non pris en charge » | Rare (format exotique) : réexporte l'audio en MP3 depuis Plaud. La transcription n'est pas concernée. |
| « L'IA n'a pas renvoyé de fiches exploitables » | Réessaie (le modèle a mal formaté sa réponse) ; avec Gemini, c'est plus fiable. |
| « Calendrier non synchronisé : ton relais Cloudflare est une ancienne version » | Remplace le code du Worker par le nouveau `relais-plaud-cloudflare.js` (étape 6, encadré), puis **Deploy**. |
| « Hébergeur de calendrier non autorisé » | Ajoute le nom indiqué dans la variable `ICS_HOSTS` du relais (Settings → Variables and Secrets), puis **Deploy**. |
| « Cette adresse ne renvoie pas un calendrier » | Recopie l'URL depuis Moodle (Calendrier → Exporter → Obtenir l'URL du calendrier). Si tu as changé ton mot de passe Moodle, l'ancienne URL peut ne plus marcher. |
| Une note n'est pas rangée dans la bonne matière | Touche la pastille de la matière sur la note → choisis la bonne séance ou matière (ou « Aucune matière »). |
| Les photos ne sont pas lues par l'IA | Il faut une clé Gemini (étape 4). Dans la visionneuse, touche **Lire avec l'IA** pour réessayer. |
| Pas de voix pour la lecture à voix haute | Réglages Android → Accessibilité → Synthèse vocale : choisis le moteur Google et installe la voix française. |
| Mettre l'app à jour | Remplace les fichiers sur GitHub. Le téléphone reçoit la nouvelle version à la prochaine ouverture (si tu enregistres ou si un traitement tourne, elle attend la fin). Avec un réseau très lent, l'app s'ouvre d'abord avec la version en cache et se met à jour pour la fois suivante. |
| « Préparation de la liste après la mise à jour… » | Une seule fois après la version 34 : l'app crée un index de tes notes pour aller plus vite. Quelques secondes avec beaucoup de notes ; ne ferme pas l'app pendant ce temps. |
| « Plus assez de place dans le téléphone » | Supprime l'audio des anciennes notes (Réglages → Mes données), puis partage ou choisis de nouveau le fichier. |
| « Impossible de lire tes notes » | Ferme complètement l'app (multitâche) puis rouvre-la. En navigation privée, ouvre plutôt l'app installée. |

## Pour les développeurs : tests automatiques

Le dossier `tests/` contient des tests automatiques (fonctions de l'app et parcours complets dans un téléphone Android émulé, avec Groq, Gemini et Plaud simulés). Il n'est **pas nécessaire** au fonctionnement de l'app : pour l'installation, seuls les fichiers de l'étape 2 comptent. Mode d'emploi : `tests/README.md`. Sur GitHub, ils se lancent tout seuls à chaque pull request (onglet **Actions**).
