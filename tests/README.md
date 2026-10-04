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

## Intégration continue

Le fichier `.github/workflows/tests.yml` lance ces tests sur GitHub à chaque pull request.
En cas d'échec, le rapport Playwright (captures, traces) est joint au résultat.
