# Tests de Notes Plaud

Ce dossier n'est **pas** nécessaire au fonctionnement de l'app : il ne sert qu'à vérifier le code avant une mise en ligne.
L'app reste du HTML/JS natif, sans étape de construction ; les tests lisent `index.html` tel quel.

## Lancer les tests (sur un ordinateur)

Il faut [Node.js](https://nodejs.org) 20 ou plus récent.

```sh
cd tests
npm install
npx playwright install chromium   # une seule fois : télécharge le navigateur de test
npm test                          # tests unitaires puis tests de bout en bout
```

Commandes séparées :

- `npm run test:unit` : fonctions pures, en quelques dixièmes de seconde, sans navigateur ;
- `npm run test:e2e` : parcours complets dans Chrome, en émulation de téléphone Android (Pixel 7) ;
- `npm run test:perf` : mesures de performance (500 notes dont 100 enregistrements de 3 h, processeur ralenti ×4 comme un téléphone) ;
- `npx playwright test --ui` : mode visuel pour suivre les tests pas à pas.

## Ce qui est testé

**Tests unitaires** (`unit/`, exécutés avec `node --test`) : le script d'`index.html` est chargé dans un bac à sable Node
(`helpers/load-app.js`), avec un faux DOM. Les fonctions de l'app sont donc testées sans être recopiées ni modifiées :

| Fichier | Fonctions |
|---|---|
| `ics.test.js` | `icsParse`, `icsDate`, `icsDur`, `zonedToUtc`, `expandRule`, `icsEvents` |
| `tasks.test.js` | `parseTask`, `buildTask`, `tasksOf`, `autoRemind`, `remindFor` |
| `text.test.js` | `splitText`, `parseChapters`, `parseCards`, `splitQA`, `parseClean`, `splitMeta`, `splitTitle`, utilitaires |
| `markdown.test.js` | `md`, `protectMath`, `mathify`, `quizHtml` |
| `dates.test.js` | `dateFromName` |
| `search.test.js` | recherche sans accents : `findAll`, `markHits` |
| `audio.test.js` | découpage des longs fichiers MP3 et WAV (`splitAudio`, `mp3Sync`, `mp3Duration`) |
| `search.test.js` (suite) | index léger : `headOf`, `wordsOf`, refus d'enregistrer une fiche à la place d'une note |
| `revision.test.js` | statistiques de révision (`revStats`, série de jours), export Anki (`ankiField`, `ankiText`), réglage du rappel |
| `quiz.test.js` | quiz type examen : lecture des questions de l'IA (`parseQuiz`), texte horodaté envoyé (`quizSource`) |
| `planning.test.js` | planning de révision avant un examen (`buildPlan`) |
| `security.test.js` | nettoyage des sauvegardes (`sanitizeNote`, `settingOk`), relais en https, options de KaTeX |
| `relay.test.js` | relais Cloudflare : contrôle d'origine, chemins autorisés, redirections, en-têtes (chargé comme module ES) |

Les dates sont figées (option `now` du chargeur) et le fuseau est celui de Bruxelles, pour des résultats reproductibles.

**Tests de bout en bout** (`e2e/`, Playwright) : l'app est servie comme sur GitHub Pages (`helpers/server.js`) et pilotée
dans un téléphone émulé. **Aucun appel ne sort de la machine** : Groq, Gemini et le relais Plaud sont simulés
(`e2e/fixtures.js`), avec de petits fichiers audio générés à la volée.

| Fichier | Parcours |
|---|---|
| `note-from-file.spec.js` | fichier audio → transcription → résumé → note ; Groq ou Gemini ; clé manquante ou refusée |
| `search.spec.js` | recherche sans accents dans résumés, transcriptions, cours rédigés, « Mes notes » |
| `tasks.spec.js` | onglet Tâches : groupes, filtres, cocher, ajouter, modifier, supprimer |
| `backup.spec.js` | sauvegarde (avec ou sans clés) et restauration sur un navigateur vierge |
| `plaud.spec.js` | import depuis le cloud Plaud (bouton et automatique), test de connexion, jeton expiré |
| `courses.spec.js` | import d'un calendrier `.ics`, rangement des notes par matière, tour de tous les écrans |
| `security.spec.js` | contenus piégés (IA, transcription, calendrier, fausse sauvegarde), relais http refusé, jeton, KaTeX modifié refusé |
| `index.spec.js` | index des notes : création après mise à jour, mise à jour à chaque modification, liste par pages |
| `audio-long.spec.js` | enregistrement WebM/Opus réel (micro simulé) découpé en morceaux WAV, horodatages continus |
| `sw.spec.js` | service worker : installation sans les icônes facultatives, hors ligne, réseau lent, cible de partage |
| `revision.spec.js` | révisions : fiches dues de toutes les matières depuis l'accueil, statistiques, fiches écrites ou corrigées, export Anki, rappel quotidien |
| `quiz.spec.js` | quiz : correction immédiate, passage à réécouter, mode examen chronométré, temps écoulé, quiz d'une matière, fiches créées depuis les erreurs |
| `planning.spec.js` | examen trouvé dans l'emploi du temps ou saisi à la main, planning jour par jour, compte à rebours, cases gardées |
| `a11y.spec.js` | accessibilité : audit [axe-core](https://github.com/dequelabs/axe-core) (règles WCAG 2.2 niveau AA) de tous les écrans et fenêtres dans les 8 thèmes, téléphone en mode clair et sombre ; contour des champs et cases à cocher (contraste 3:1) ; clavier et lecteur d'écran (focus, fenêtres, onglets, filtres, annonces) |
| `bugs.spec.js`, `bugs-rec.spec.js` | un test par bug corrigé : partage reçu, file d'attente, hors connexion, délais réseau, reprise du résumé, stockage plein ou illisible, mise à jour pendant un enregistrement (micro simulé) |

Chaque test de bout en bout vérifie aussi qu'aucune erreur JavaScript et aucune violation de la politique de sécurité (CSP) ne s'est produite.

Chaque bug corrigé a son test, dans une rubrique « Bugs corrigés » : il échouait avec l'ancien code et passe avec la correction.

`A11Y_REPORT=1 npx playwright test a11y` affiche la liste des problèmes d'accessibilité trouvés (par thème, avec les couleurs en cause) au lieu de faire échouer le test.

## Mesures de performance (`perf/`)

`perf/dataset.js` génère dans la page 500 notes (69 millions de caractères), dont 100 enregistrements de 3 h
(transcription brute et améliorée, cours rédigé, fiches). `perf/perf.spec.js` mesure l'ouverture de l'app,
l'accueil, la recherche, l'onglet Tâches, l'ouverture d'une note de 3 h et la mémoire, avec un processeur ralenti
×4 (`PERF_CPU=1` pour la vitesse réelle). Les mesures sont affichées et jointes au rapport ; des seuils larges
font échouer le test en cas de régression nette (`PERF_LIMITS=0` pour seulement mesurer).

## Intégration continue

Le fichier `.github/workflows/tests.yml` lance ces tests sur GitHub à chaque pull request.
En cas d'échec, le rapport Playwright (captures, traces) est joint au résultat.
