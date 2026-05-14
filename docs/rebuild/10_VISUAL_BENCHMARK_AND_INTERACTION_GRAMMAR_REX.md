# Visual Benchmark and Interaction Grammar - NeuroChess REX

## 1. Statut

Statut :
Document de direction artistique, interaction design et methode d'execution.

But :
Guider les futures missions UI REX pour eviter :

- UI generique ;
- polish infini ;
- empilement de cards ;
- effets decoratifs ;
- design qui passe les tests mais ne donne pas envie.

Ce document ne remplace pas `plan/Plan1.txt`, `plan/Plan2.txt` ou `plan/Plan3.md`.
Il complete `docs/rebuild/08_VISUAL_DIRECTION_DECISION_RECORD_REX.md`.

R2D n'autorise aucune feature. Il definit un operating system visuel pour les prochaines missions.

## 2. Diagnostic brutal de l'UI actuelle

Le shell REX actuel est :

- stable ;
- sombre ;
- plus premium qu'avant ;
- mieux structure ;
- compatible avec la nouvelle doctrine ;
- capable de prouver un premier lien read-only Parties via R2B/R2C.

Mais il reste :

- trop card/panel ;
- trop proche d'un SaaS dashboard ;
- pas assez proprietaire ;
- pas assez "systeme de progression" ;
- pas assez transforme par la donnee reelle ;
- pas encore memorable ;
- trop dependant de titres et labels ;
- pas encore assez porte par des objets visuels uniques.

Point central :
Le probleme n'est pas React, TypeScript ou Python.
Le probleme est la grammaire visuelle.

La prochaine amelioration ne doit pas ajouter plus de decoration. Elle doit changer la structure de perception :
l'utilisateur doit voir un instrument NeuroChess avant de voir une grille de cards.

## 3. Regle fondamentale

NeuroChess ne doit plus penser en "pages avec cards".
NeuroChess doit penser en "surfaces avec instruments".

| Transformation | Ce que ca veut dire | Exemple concret | Anti-pattern |
|---|---|---|---|
| Cards -> Instruments | Un bloc UI doit faire sentir une action, un etat ou une preuve, pas seulement contenir du texte. | Truth Chain qui s'allume selon PGN, analyse, decision, exercice. | Trois cards identiques "Derniere partie", "Review", "Decision" sans relation visuelle. |
| Pages -> Surfaces | Chaque espace repond a une question utilisateur dominante. | Parties repond : "Que disent mes vraies parties ?" | Une page qui melange historique, debug, stats, CTA et doctrine au meme poids. |
| Stats -> Artefacts | Une donnee devient un objet lisible, pas un chiffre pose dans une tuile. | Review ready devient une etape active dans Truth Chain. | "2 pretes" dans une card sans transformation de l'artefact principal. |
| Progression -> Monde personnel | La progression doit creer une identite qui se construit dans le temps. | Profil comme Progression Map et Opening Constellation. | Profil reduit a parametres ou a liste de pourcentages. |
| Review -> Chaine de verite | La partie brute doit devenir une sequence causale. | PGN -> Analyse -> Decision -> Exercice. | Liste morte de parties avec badge "review available". |
| Training -> Forge d'effort | L'entrainement doit montrer l'effort actif et la transformation d'une erreur. | Forge Core : Erreur -> Drill -> Revision -> Retour. | Puzzle trainer generique hors contexte. |
| Transfer -> Arene mesurable | Le transfert doit montrer si l'apprentissage tient en conditions reelles. | Transfer Lanes par cadence et palier prudent. | Transfer Gap brut, leaderboard force ou score anxiogene. |
| Profil -> Identite vivante | Le Profil doit montrer qui le joueur devient, sans diagnostic mental. | Rank Totem, Habit Signal, Opening Constellation. | "Ton profil = settings + stats infinies". |

## 4. Benchmark - references a etudier

| Reference | Principe a voler | Ce qu'on refuse | Application NeuroChess | Risque si mal applique | Surface concernee |
|---|---|---|---|---|---|
| Raycast | Command-first, rapidite, focus action, densite maitrisee, energie keyboard/command. | Simple clone de launcher. | QG = Command Hub : une priorite, une action principale, acces rapide. | Interface froide qui oublie la progression long terme. | QG, navigation, actions rapides. |
| Apple Fitness | Anneaux lisibles, progression immediate, objectifs compacts, visualisation d'effort. | Anneaux decoratifs non relies a une preuve. | Forge Core, Pressure Ring, XP Ledger. | Jauges jolies mais arbitraires. | Forge, Arene, Profil. |
| Spotify Wrapped | Data personnelle transformee en recit, sequence memorable, "voici qui tu es". | Storytelling creux sans donnees. | Profil, repertoire, bilan de partie, fin de saison. | Persona fake ou trop marketing. | Profil, Parties, recap. |
| Duolingo | Motivation, XP, ligues, retour quotidien. | Casino, pression toxique, streak punitif, infantilisation. | Forge, Arene, rang opt-in, XP utile. | Produit enfantin ou dopamine cheap. | Forge, Arene, QG. |
| Strava | Segments, terrain reel, competition avec soi-meme, preuve sur le terrain. | Leaderboard humiliant ou force. | Arene = transfert en vraie partie. | Comparaison sociale qui remplace la progression. | Arene, Transfer Lanes. |
| Loona | Calme immersif, espace emotionnel habitable, visuel doux. | Decoration molle sans action. | Profil et Progression Map respirables. | Wallpaper relaxant qui ne guide rien. | Profil. |
| Monument Valley | Geometrie memorable, simplicite iconique, monde abstrait lisible. | Puzzle visuel incomprehensible. | Opening Constellation, Progression Map, Rank Totem. | Forme belle mais impossible a comprendre. | Profil, Forge. |
| Blackbox | Interaction originale, sentiment de decouverte, pas juste "beau". | Gimmick. | Rejouer, prouver, transferer deviennent des interactions proprietaires. | Interaction surprenante mais inutile. | Review future, Forge, Arene. |
| Game HUD / diegetic UI | Information integree a l'action, instrument plutot que panneau, statut contextuel. | HUD sature. | Truth Chain, Mission Core, Transfer Lanes. | Trop de signaux simultanes. | QG, Parties, Arene. |
| Apple visionOS / Liquid Glass / premium material systems | Profondeur, couches, hierarchie contenu/controles, materiaux subtils. | Glass partout, lisibilite faible, effet de mode. | Instruments NeuroChess sombres avec couches discrètes. | UI floue et trendy, pas decisive. | Shell global, instruments. |

## 5. Principes synthetises

| Principe | Definition | Exemple NeuroChess | Interdit |
|---|---|---|---|
| Command-first | L'ecran doit pousser une action utile avant de montrer tout le systeme. | QG montre une mission dominante. | Dashboard complet des stats. |
| One dominant artifact | Chaque surface a un objet principal qui porte la perception. | Parties = Truth Chain. | Cinq cards au meme niveau. |
| Data becomes story | Une donnee personnelle change la narration et l'apparence. | Loaded Parties montre la derniere partie comme matiere brute. | Donnee affichee comme simple chiffre. |
| Proof before reward | Pas de celebration sans preuve observable. | XP Ledger explique effort, revision, transfert. | XP magique ou recompense de clic. |
| Motion proves state | Le mouvement signale une priorite, une disponibilite ou un flux. | Flow entre PGN, Analyse, Decision, Exercice. | Glow anime sans etat. |
| Transfer is terrain | L'Arene montre les conditions reelles, pas un score abstrait. | Blitz/Rapide/Classique comme lanes. | Leaderboard force. |
| Profile is world | Le Profil est un espace personnel de progression. | Progression Map + Opening Constellation. | Settings page avec statistiques infinies. |
| Progression is object | Le progres doit prendre forme dans un artefact. | Rank Totem, Pressure Ring, Habit Signal. | Pourcentage isole non explique. |
| Depth supports hierarchy | Les couches visuelles servent la priorite de lecture. | Instrument sombre, accent local, support secondaire. | Glass et blur partout. |
| No decoration without contract | Chaque effet doit avoir un role utilisateur. | Scan = analyse ; Sweep = action disponible. | Animation parce que "ca fait premium". |

## 6. Artefacts proprietaires NeuroChess

| Artefact | Surface | Role | Inspiration principale | Donnee future probable | Interaction | Motion | Risque | Interdit | Critere de reussite visuelle |
|---|---|---|---|---|---|---|---|---|---|
| Mission Core | QG | Repondre "quoi faire maintenant ?" | Raycast + Game HUD | priorite du jour, revisions dues, prochain levier | Selectionner ou ouvrir la mission utile | pulse de priorite, respiration lente | loader generique | dashboard complet, vraie donnee inventee | En 5 secondes, l'utilisateur sait quoi faire. |
| Truth Chain | Parties | Transformer PGN -> analyse -> decision -> exercice. | Spotify Wrapped + tactical pipeline | game history, review status, moments, training availability | Ouvrir une partie, voir l'etape active, aller vers Review/Forge plus tard | scan/flow d'etapes, unlock progressif | 4 rectangles vides | analyse lancee, exercice cree, debug dominant | Une partie reelle change visuellement la chaine. |
| Forge Core | Forge | Transformer erreur en drill, revision et ligne. | Apple Fitness + RPG adulte | training item, due review, opening line | Entrer dans un drill ou une revision | ring fill, heat pulse controle | casino, jeu mobile | mastery reel non valide, confetti | Donne envie de faire un effort actif. |
| Transfer Lanes | Arene | Prouver si l'apprentissage passe en conditions reelles. | Strava segments + tactical proof | cadence, opportunites, paliers de transfert | Comparer entrainement et vraie partie | lane glow localise, tension lente | leaderboard toxique | Transfer Gap brut, humiliation | Differencie entrainement et vraie partie sans score brutal. |
| Progression Map | Profil | Montrer qui le joueur devient. | Spotify Wrapped + Loona + constellation | repertoire, rang, habits, pression | Explorer son monde personnel | drift de noeuds, liens subtils | cosmic wallpaper | cerveau, fake science, stats infinies | Donne envie d'ouvrir Profil. |
| Opening Constellation | Profil / Forge | Repertoire comme carte. | Monument Valley + constellation | ouvertures jouees, variations, seuils | Selectionner ouverture/variation | activation de branche, liens doux | trop de noeuds | pourcentage sans seuil | Une ouverture ou variation est lisible rapidement. |
| Rank Totem | Profil / Arene | Identite de progression. | Game HUD + RPG adulte | rang interne, saison opt-in | Voir statut, palier suivant, preuve requise | shimmer rare, unlock court | trophee cheap | promesse Elo, casino | Statut motivant sans promettre Elo. |
| Habit Signal | Profil | Montrer pattern automatique a corriger. | Tactical alert + coach prudent | coups reflexes, exemples de positions | Ouvrir les preuves et exercices futurs | warning doux, contraction courte | juger la personne | diagnostic mental, etiquette humiliante | Montre un pattern, pas une identite negative. |
| Pressure Ring | Arene | Robustesse par cadence. | Apple Fitness + Strava | blitz/rapid/classical, zeitnot | Comparer les contextes | arc pulse lent, stabilisation | score anxiogene | score punitif ou absolu | Difference blitz/rapid/classical claire. |
| XP Ledger | QG / Profil | Expliquer d'ou vient l'XP utile. | Duolingo discipline + ledger financier | effort, reussite, revision, transfert confirme | Ouvrir la preuve de progression | increment court, sweep leger | XP magique | XP pour clic passif | XP reliee a effort, revision, transfert. |

## 7. Interaction grammar

| Interaction | Trigger | Feedback visuel | Surface concernee | Interdit |
|---|---|---|---|---|
| Importer une partie | Une partie est fournie ou selectionnee. | La partie entre dans Truth Chain comme source, pas dans une liste morte. | Parties | Import reel dans REX sans mission dediee. |
| Analyse prete | Un statut read-only prouve que la Review ou l'analyse existe. | La Truth Chain s'allume progressivement. | Parties | Simple badge "ready" sans changement de l'artefact. |
| Decision critique detectee | Une Review future expose un moment. | La decision devient un objet rejouable. | Parties, Review future, Forge | Texte seul ou jugement vague. |
| Tentative joueur | Le joueur tente un coup dans Practice/Forge. | Le systeme juge le coup, pas la personne. | Forge, Review future | Humiliation, etiquette personnelle. |
| Correction | Le bon coup ou pattern est compris/rejoue. | Le coup et le pattern deviennent memorables. | Forge | Confetti ou XP sans preuve. |
| Revision due | Un objet d'entrainement revient a echeance. | L'objet revient dans QG/Forge avec priorite visible. | QG, Forge | Mutation `due_at` non contractee. |
| Transfert observe | Une opportunite reelle apparait en partie. | Arene met a jour une preuve par palier. | Arene | Transfer Gap brut. |
| Profil evolue | Une preuve reelle existe. | Progression Map ou Rank Totem se met a jour. | Profil | Profil qui evolue par donnee fake. |

## 8. Motion grammar

| Motion | Signification | Usage |
|---|---|---|
| Pulse | Priorite active. | Mission Core, Habit Signal. |
| Sweep | Action disponible. | CTA principal, action safe. |
| Scan | Analyse / verite moteur. | Truth Chain, Review future. |
| Flow | Transformation entre etapes. | PGN -> Analyse -> Decision -> Exercice. |
| Drift | Progression long terme. | Progression Map, Opening Constellation. |
| Lane glow | Pression / transfert. | Transfer Lanes. |
| Ring fill | Effort ou completion. | Forge Core, Pressure Ring. |
| Unlock | Preuve obtenue. | Review ready, rang, palier. |
| Dim | Indisponible / non branche. | Etape future ou backend unavailable. |
| Collapse | Detail replie. | Details techniques, limitations. |

Regles :

- 1 animation dominante maximum par surface ;
- 2 animations secondaires maximum ;
- motion ambiante 5-18s ;
- micro-interactions 150-300ms ;
- no strobe ;
- no flashing ;
- no camera movement ;
- reduced motion obligatoire ;
- aucune animation essentielle a la comprehension.

## 9. Visual intensity budget

Chaque surface a un budget de 100 points d'attention.

Repartition recommandee :

- 45 points artefact dominant ;
- 25 points action principale ;
- 15 points contexte/contrat ;
- 15 points support secondaire.

Interdits :

- 5 elements a 20 points chacun ;
- glow partout ;
- chaque card avec la meme importance ;
- CTA non branche visuellement plus fort que l'artefact ;
- details techniques visibles comme contenu principal ;
- plusieurs objets de progression concurrents sur la meme surface.

Application pratique :
Si l'artefact dominant ne porte pas au moins 45% de l'attention, la surface retombe en dashboard.

## 10. Density and fold rules

Chaque surface au-dessus du fold doit contenir :

- 1 artefact dominant ;
- 1 CTA principal ;
- 1 contrat/etat ;
- maximum 3 supports secondaires ;
- pas plus de 2 niveaux de badges/pills ;
- pas de paragraphes longs ;
- pas de debug visible par defaut.

Tests obligatoires :

| Test | Definition | Echec typique |
|---|---|---|
| Test des 5 secondes | En 5 secondes, l'utilisateur sait la question, l'etat, l'action. | Il lit cinq cards pour comprendre. |
| Silhouette check | De loin, la surface reste reconnaissable par composition. | QG, Parties et Forge ont la meme grille. |
| Blur check | En floutant mentalement, la hierarchie reste visible. | Tous les blocs ont le meme poids. |
| Screenshot review | Un screenshot seul doit raconter l'etat. | Le commentaire humain doit expliquer ce que l'image ne montre pas. |
| Reduced-motion check | La page reste lisible sans mouvement. | Animation indispensable pour comprendre. |

## 11. Screenshot review protocol

Avant commit UI majeure, Codex doit fournir :

- screenshot desktop normal ;
- screenshot de chaque surface touchee ;
- screenshot etat empty/degraded/loaded si pertinent ;
- auto-evaluation /10 ;
- comparaison avant/apres ;
- surface la plus faible ;
- surface la plus forte ;
- risque de gadget ;
- elements a supprimer, pas seulement a ajouter.

Score minimal :

- moyenne >= 7.5 ;
- aucun critere critique < 6 ;
- review humaine avant commit si surface majeure.

Critères :

- clarte 5s ;
- identite ;
- premium ;
- originalite ;
- instrument dominant ;
- motion utile ;
- sobriete ;
- scalability ;
- risque gadget faible ;
- potentiel long terme.

Pour risque gadget :
10 = risque faible/maitrise.

Un test PASS ne prouve jamais que la direction artistique est bonne.
Il prouve seulement que l'interface n'a pas casse.

## 12. Codex execution method for design missions

Regles d'execution :

1. Lire contrat.
2. Audit avant modification.
3. Backup externe si WIP.
4. Une surface ou un artefact par mission.
5. Reduire avant d'ajouter.
6. Pas de backend pendant polish UI.
7. Pas de package nouveau sans mission dediee.
8. Pas de Spline hors Visual Lab.
9. Pas de commit avant review screenshot.
10. Ne jamais repondre "tests PASS donc design bon".

Anti-patterns :

- "rends ca incroyable" ;
- ajouter 10 effets ;
- cards partout ;
- CSS monolithe ;
- `App.tsx` grossit ;
- fake metrics ;
- route hardcodee sans source ;
- debug visible dans produit ;
- QA artifacts dans repo ;
- Serena staged ;
- Spline injecte sans role ;
- Design Lab promu sans decision ;
- data fixture presentee comme vraie donnee ;
- CTA placeholder visuellement plus fort qu'une action reelle future.

## 13. R2E - Prochaine mission recommandee

R2E doit etre :

> Truth Chain Loaded State Redesign.

Objectif :
La donnee reelle/mockee doit transformer la Truth Chain.
La page Parties ne doit plus ressembler presque pareil en degraded et loaded.

R2E doit :

- rester `frontend/src/rex` only ;
- utiliser le smoke loaded fixture R2C ;
- ne pas toucher backend ;
- ne pas modifier `docs/rebuild/` sans mission dediee ;
- ne pas ecrire DB ;
- ne pas creer endpoint ;
- ne pas declencher analyse ;
- ne pas creer exercice ;
- ne pas afficher XP ;
- ne pas afficher Transfer Score ;
- rendre la derniere partie visible comme matiere brute ;
- rendre l'ouverture Najdorf utile ;
- rendre Review ready visible comme etape ;
- garder read-only proof.

R2E doit livrer :

- screenshot loaded avant/apres ;
- screenshot degraded inchange/propre ;
- shell smoke ;
- loaded fixture smoke ;
- V1 smoke ;
- auto-score visuel.

R2E ne doit pas refaire tout le shell.
R2E doit cibler uniquement Parties / Truth Chain.

## 14. GO / NO-GO

GO_FOR_R2E seulement si :

- ce document est valide humainement ;
- repo clean ;
- R2E reste Truth Chain only ;
- R2E ne touche pas backend ;
- l'objectif est de transformer la representation loaded, pas de creer une feature.

NO_GO_FOR_R2E si :

- la mission veut brancher une nouvelle API ;
- la mission veut creer un vrai import ;
- la mission veut declencher Review ;
- la mission veut creer un exercice ;
- la mission veut creer de nouvelles metriques reelles ;
- la mission veut ajouter XP, Transfer Score ou Opening Forge ;
- la mission veut modifier `App.tsx` ;
- la mission veut toucher `docs/rebuild` sans mission dediee.

GO_FOR_R2E_AFTER_HUMAN_REVIEW: pending
