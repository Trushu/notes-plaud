# Feuille de route des améliorations

Écrite en se mettant à la place d'un étudiant qui enregistre **tous ses cours** et **révise ses examens** avec Notes Plaud,
et en regardant ce que font les meilleures apps du genre :

- **Plaud** et **Otter** : modèles de résumé, vocabulaire personnalisé, qui parle, recherche puissante ;
- **Notion** : organisation, filtres, vues ;
- **Anki** : révision espacée, statistiques, export et import de paquets ;
- **NotebookLM** : questions sur ses sources, glossaire, quiz, cartes mentales ;
- **Goodnotes** : examens blancs et quiz, lecture confortable sur tablette.

Les contraintes ne changent pas : pas d'étape de build, interface en français, aucun serveur à nous, uniquement des services gratuits, et rien de ce qui existe ne doit casser.

**Légende.**
- **Effort** : S = moins d'une demi-journée, M = une journée, L = plusieurs jours.
- **Priorité** :
  - P1 = forte valeur pour les révisions ou la fiabilité ;
  - P2 = confort net ;
  - P3 = finition.
- Une case cochée renvoie à la pull request qui a fait l'amélioration.

## Révisions et examens

- [x] **R1. Réviser toutes les fiches dues depuis l'accueil.** Une carte « N fiches à réviser » sur l'accueil lance une séance avec toutes les matières, au lieu de passer par chaque note ou chaque matière. *Bénéfice : la révision quotidienne en un toucher, comme dans Anki.* · Effort S · **P1** — [PR #7](https://github.com/Trushu/notes-plaud/pull/7)
- [x] **R2. Statistiques de révision.** Fiches dues, nouvelles, maîtrisées, taux de réussite, série de jours, prévision sur 7 jours, détail par matière. *Bénéfice : savoir où on en est et rester motivé.* · Effort M · **P1** — [PR #7](https://github.com/Trushu/notes-plaud/pull/7)
- [x] **R3. Export Anki.** Fichier texte importable dans Anki ou AnkiDroid, avec les colonnes recto, verso et tags, et la matière comme paquet. Possible par note, par matière ou pour tout. *Bénéfice : réviser dans l'outil de référence, sur ordinateur et sur téléphone.* · Effort S · **P1** — [PR #7](https://github.com/Trushu/notes-plaud/pull/7)
- [x] **R4. Créer et modifier ses fiches.** Ajouter une fiche à la main, corriger une question ou une réponse de l'IA. *Bénéfice : des fiches justes et personnelles.* · Effort S · **P1** — [PR #7](https://github.com/Trushu/notes-plaud/pull/7)
- [ ] **R5. Quiz type examen (QCM).** L'IA prépare 10 questions à 4 choix sur une note ou une matière. Le quiz se fait en temps limité facultatif, avec la correction expliquée et le passage du cours à réécouter. Le score est gardé. *Bénéfice : s'entraîner comme à l'examen (Goodnotes et NotebookLM le proposent).* · Effort M · **P1**
- [ ] **R6. Planning de révision avant les examens.** Les examens sont repérés dans le calendrier ou datés à la main par matière. Le planning répartit, jour par jour, les séances à relire et les fiches à revoir jusqu'à l'examen. Un compte à rebours s'affiche sur l'accueil. *Bénéfice : ne plus improviser ses révisions.* · Effort M · **P1**
- [x] **R7. Rappel quotidien de révision.** À l'heure choisie, une notification « 12 fiches à réviser » s'affiche s'il y a des fiches dues. *Bénéfice : l'habitude quotidienne, clé de la révision espacée.* · Effort S · **P2** — [PR #7](https://github.com/Trushu/notes-plaud/pull/7)
- [ ] **R8. Glossaire par matière.** Les définitions et formules de toutes les séances sont rassemblées par ordre alphabétique, avec un lien vers la séance d'origine. Il est cherchable et exportable. *Bénéfice : la fiche de vocabulaire de la matière, prête pour l'examen.* · Effort M · **P2**
- [ ] **R9. Carte mentale d'une note.** Le plan du résumé est dessiné en carte mentale, avec des branches dépliables. On peut l'exporter en image. *Bénéfice : vue d'ensemble visuelle du cours (comme NotebookLM).* · Effort M · **P2**
- [ ] **R10. Révision audio des fiches.** Les questions sont lues à voix haute, puis la réponse après un délai, mains libres. *Bénéfice : réviser en marchant ou dans les transports.* · Effort S · **P2**
- [ ] **R11. Liens entre séances.** Sous le glossaire et dans une note : « Notion vue aussi le 12 octobre ». *Bénéfice : relier les chapitres d'une matière.* · Effort L · P3

## Qualité de l'IA

- [ ] **I1. Vocabulaire de la matière.** Une liste de termes par matière (noms propres, jargon) est donnée à la reconnaissance vocale (Whisper) et à l'IA. Elle se remplit aussi toute seule avec les termes définis dans les résumés précédents. *Bénéfice : moins de mots mal reconnus, comme le « vocabulaire personnalisé » d'Otter.* · Effort S · **P1**
- [ ] **I2. Choix automatique du fournisseur.** Une IA qui a renvoyé « limite atteinte » est écartée pendant le délai indiqué : l'app passe directement à la suivante au lieu de réessayer. *Bénéfice : des résumés plus rapides et moins d'échecs avec les offres gratuites.* · Effort S · **P1**
- [ ] **I3. Questions posées en classe.** Le résumé d'un cours ajoute une rubrique « Questions posées en classe » : les questions des étudiants et la réponse de l'enseignant, repérées dans la transcription. *Bénéfice : retrouver les éclaircissements, distinguer qui parle.* · Effort S · **P2**
- [ ] **I4. Prompts plus précis.** Résumé, cours rédigé et fiches demandent des formules en LaTeX cohérentes, des exemples chiffrés repris tels quels et des fiches qui ne se répètent pas. Les fiches portent aussi un niveau de difficulté. *Bénéfice : des documents de révision plus fiables.* · Effort S · **P2**
- [ ] **I5. Résumé express.** Trois lignes « En bref » en tête de chaque note et dans l'aperçu de l'accueil. *Bénéfice : savoir en 5 secondes de quoi parlait la séance.* · Effort S · P3

## Expérience utilisateur

- [ ] **U1. Bouton « Tester la clé ».** Pour Groq, Gemini, Cerebras et Mistral, un appel minimal affiche « Clé valide », « Clé refusée » ou « Limite atteinte » avec la marche à suivre. *Bénéfice : un premier réglage sans tâtonner.* · Effort S · **P1**
- [ ] **U2. Premier lancement guidé.** Un assistant en trois étapes : clé Groq testée, clé Gemini facultative, puis emploi du temps et import Plaud facultatifs. Chaque étape a un lien direct et des explications pour débutant. *Bénéfice : être prêt en deux minutes, sans lire le mode d'emploi.* · Effort M · **P1**
- [ ] **U3. Messages d'erreur avec action.** Chaque erreur fréquente (clé refusée, limite, fichier trop gros, format inconnu, stockage plein) affiche un bouton qui mène au bon endroit : Réglages, Réessayer plus tard… *Bénéfice : savoir quoi faire.* · Effort S · **P2**
- [ ] **U4. Mode tablette et ordinateur.** Sur grand écran, la liste des notes reste à gauche et la note s'ouvre à droite, et les fiches sont plus larges. *Bénéfice : réviser confortablement sur tablette ou PC.* · Effort M · **P2**
- [ ] **U5. États vides utiles.** Accueil, tâches, cours et recherche sans résultat proposent l'action suivante : « Importer ton emploi du temps », « Essaie sans guillemets »… *Bénéfice : ne jamais rester bloqué devant un écran vide.* · Effort S · P3
- [ ] **U6. Retour haptique.** Une légère vibration accompagne « Marquer », le début et la fin d'un enregistrement et une tâche cochée. *Bénéfice : une confirmation sans regarder l'écran, en plein cours.* · Effort S · P3

## Organisation

- [ ] **O1. Recherche avancée.** La recherche accepte `"expression exacte"`, `-mot` pour exclure, `tag:algo`, `matière:physique`, `avant:2026-11-01`, `après:…`, `type:cours`, et une aide intégrée. *Bénéfice : retrouver en une ligne « le passage sur les graphes en algo avant novembre ».* · Effort M · **P1**
- [ ] **O2. Chercher aussi dans les fiches et les questions posées.** *Bénéfice : une seule barre pour tout.* · Effort S · **P2**
- [ ] **O3. Archiver une note.** La note est masquée de l'accueil sans être supprimée : elle reste dans la recherche, la matière et les fiches. Un filtre « Archivées » permet de la retrouver. *Bénéfice : un accueil centré sur le semestre en cours.* · Effort S · **P2**
- [ ] **O4. Vue semestre d'une matière.** Toutes les séances du semestre, enregistrées ou manquées, les heures d'audio, les fiches maîtrisées et la date de l'examen. *Bénéfice : voir d'un coup d'œil les trous à combler.* · Effort M · **P2**
- [ ] **O5. Tâches récurrentes.** Une tâche peut revenir chaque semaine ou chaque jour (« Relire le cours de la semaine »). *Bénéfice : les routines d'étude dans l'app.* · Effort M · P3
- [ ] **O6. Vue « Cette semaine » des tâches.** Les tâches de la semaine sont regroupées par jour, avec glisser pour cocher. *Bénéfice : planifier sa semaine d'étude.* · Effort S · P3

## Fiabilité

- [ ] **F1. Sauvegarde en un toucher vers Drive.** Le fichier de sauvegarde est partagé vers Google Drive, Gmail ou Fichiers, via le menu Partager d'Android, au lieu d'un simple téléchargement. Les rappels se règlent (toutes les semaines, tous les mois). *Bénéfice : une copie hors du téléphone, vraiment faite.* · Effort S · **P1**
- [ ] **F2. Sauvegarde chiffrée par mot de passe.** Le chiffrement se fait dans le téléphone (AES-GCM, WebCrypto), et le mot de passe est demandé à la restauration. Il est conseillé dès que la sauvegarde contient les clés d'API. *Bénéfice : une sauvegarde sur Drive sans exposer ses notes ni ses clés.* · Effort M · **P1**
- [ ] **F3. File d'attente visible.** La liste des fichiers en attente s'affiche avec leur état. On peut retirer un fichier, et un fichier en échec peut être relancé. *Bénéfice : garder la main quand on importe plusieurs cours d'un coup.* · Effort M · **P2**
- [ ] **F4. Questions hors ligne.** Une question posée sans réseau part toute seule au retour de la connexion. *Bénéfice : poser ses questions dans le métro.* · Effort S · P3
- [ ] **F5. Rapport de diagnostic.** Un texte à copier (version, navigateur, stockage, dernières erreurs), sans aucune clé ni contenu de note. *Bénéfice : obtenir de l'aide facilement.* · Effort S · P3

## Design

- [ ] **D1. Police de lecture.** Choix entre serif et sans-serif, et interligne confortable pour les résumés et le cours rédigé. *Bénéfice : un confort de lecture adapté à chacun (dyslexie, longues sessions).* · Effort S · P3
- [ ] **D2. Uniformisation des cartes de l'accueil.** Les cartes de rappel (sauvegarde, révision, examen) partagent le même gabarit et un ordre de priorité, et une seule s'affiche à la fois. *Bénéfice : un accueil lisible même quand tout est activé.* · Effort S · **P2**
- [ ] **D3. Thème « Contraste élevé ».** Noir et blanc purs, contours marqués. *Bénéfice : lisibilité en plein soleil ou en cas de basse vision.* · Effort S · P3

## Accessibilité, performance, sécurité et vie privée

- [ ] **A1. La taille du texte s'applique aussi aux fiches, au quiz et au glossaire.** · Effort S · **P2**
- [ ] **A2. Vérifier les nouveaux écrans avec axe-core.** Les nouveaux écrans sont ajoutés à l'audit d'accessibilité dans les 8 thèmes. · Effort S · **P1** (fait à chaque PR)
- [ ] **S1. Verrouillage par code.** Un code à 4 à 8 chiffres est demandé à l'ouverture, après une durée réglable. C'est un écran de confidentialité, pas un chiffrement, et c'est expliqué. *Bénéfice : un téléphone prêté n'ouvre pas les notes.* · Effort M · P3
- [ ] **S2. « Tout effacer ».** Un bouton supprime les notes, l'audio, les réglages et le cache, avec une double confirmation. *Bénéfice : rendre ou revendre son téléphone en toute tranquillité.* · Effort S · **P2**
- [ ] **S3. Clés masquées dans les exports et les diagnostics.** · Effort S · P3
- [ ] **P1. Mesures de performance des nouvelles fonctions.** Statistiques, glossaire et recherche avancée doivent rester rapides avec 500 notes. · Effort S · **P2**

## Documentation

- [ ] **Doc1. Rubrique « Nouveautés » en tête de LISEZMOI.** Un guide de démarrage pour débutant en 5 étapes, et chaque nouvelle fonction décrite à sa place. · Effort S · **P1**
- [ ] **Doc2. Guide « Réviser un examen avec Notes Plaud ».** La méthode complète : enregistrer, résumer, fiches, quiz, planning, glossaire. · Effort S · **P2**

## Écartées (et pourquoi)

- **Synchronisation entre appareils** : il faudrait un serveur. La sauvegarde partagée vers Drive (F1, F2) couvre le besoin sans serveur.
- **Séparation automatique des voix (diarisation)** : Whisper sur Groq ne la fait pas, et les services gratuits qui la font demandent d'envoyer l'audio à un tiers de plus. I3 couvre l'essentiel pour un cours : les questions des étudiants et les réponses de l'enseignant.
- **Schémas générés (Mermaid)** : nouvelle bibliothèque lourde pour un gain faible ; les photos du tableau lues par l'IA couvrent déjà les schémas du cours. La carte mentale (R9) est dessinée sans bibliothèque.
- **Import direct dans Anki** : AnkiConnect ne fonctionne que sur ordinateur, avec Anki ouvert. Le fichier texte (R3) s'importe partout, AnkiDroid compris.
