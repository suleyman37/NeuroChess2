# NeuroChess Rebuild Doctrine

Statut : draft REX v1.

Source : Grand REX Forensic Export V2, rapports de recovery deep Review, backlog recherche, et lecture des plans canoniques Plan1, Plan2 et Plan3.

Decision : rebuild partiel.

Ce dossier ne remplace pas encore physiquement `plan/Plan1.txt`, `plan/Plan2.txt` ou `plan/Plan3.md`. Il sert de base de travail pour reecrire les futurs plans produit et execution apres REX. Tant que les plans canoniques ne sont pas officiellement remplaces, ils restent la source de gouvernance courante.

## Pourquoi Ce Dossier Existe

Le REX conclut que NeuroChess ne doit ni repartir de zero, ni continuer l'ancien WIP visuel Product Vision. Le bon chemin est une metamorphose controlee :

- garder backend, Stockfish, Review, Practice, Daily Plan, openings, contrats data/API et discipline Plan3 ;
- reecrire UX, navigation, profil, metriques visibles, frontend shell et doctrine produit ;
- transformer la prudence actuelle en produit plus ambitieux, plus lisible et plus motivant ;
- isoler les explorations visuelles 3D dans un Visual Lab avant toute promotion produit.

## Ordre De Lecture

1. `00_REBUILD_README.md` - contexte et mode d'emploi.
2. `01_PRODUCT_DOCTRINE_REX.md` - doctrine produit.
3. `02_NAVIGATION_AND_SURFACES_REX.md` - surfaces principales.
4. `03_VISIBLE_METRICS_AND_PROFILE_REX.md` - metriques et Profil.
5. `04_VISUAL_3D_AND_SPLINE_GOVERNANCE_REX.md` - gouvernance 3D/Spline.
6. `05_REBUILD_ROADMAP_REX.md` - sequence R0 a R8.
7. `06_CODEX_EXECUTION_GUARDRAILS_REX.md` - garde-fous d'execution.

## Resume Obligatoire

NeuroChess garde le socle dur : backend, Stockfish, Review, Practice, Daily Plan et openings. NeuroChess reecrit la couche experience : UX, navigation, profil, metriques visibles et frontend shell.

La navigation cible n'est plus l'ancien carcan trois onglets. Les cinq surfaces principales deviennent :

- QG ;
- Parties ;
- Forge ;
- Arene ;
- Profil.

La doctrine de feedback change : jugement dur sur les coups, jamais sur la personne. Une mauvaise decision doit etre nommee clairement, mais l'utilisateur ne doit jamais etre humilie.

Spline et la 3D restent en quarantaine Visual Lab avant promotion. Aucun asset 3D ne devient produit sans role utilisateur clair, fallback, reduced motion, performance acceptable et validation humaine.

## Prochaine Etape

Apres R0 : R1 greenfield frontend shell. R1 doit creer un shell frontend isole pour les cinq surfaces, sous feature flag ou route dev, sans refactor massif de l'ancien `App.tsx` et sans changement backend.
