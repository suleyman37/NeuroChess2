# R2G Real Truth Chain Data Contract - NeuroChess REX

## 1. Statut

Statut :
Contrat de donnees et d'implementation future.

But :
Preparer R2H sans coder trop large.

R2G ne cree pas de feature.
R2G definit la donnee minimale necessaire pour transformer Parties / Truth Chain en vrai instrument echiqueen.

Ce document complete :
- `docs/rebuild/08_VISUAL_DIRECTION_DECISION_RECORD_REX.md` ;
- `docs/rebuild/09_R2A_FIRST_BACKEND_CONNECTION_CONTRACT_REX.md` ;
- `docs/rebuild/10_VISUAL_BENCHMARK_AND_INTERACTION_GRAMMAR_REX.md`.

## 2. Decision centrale

La prochaine vraie etape de Parties n'est pas un nouvel effet visuel.

La prochaine etape est :

> afficher une vraie chaine de 5 moments critiques issus d'une vraie partie ou fixture controlee.

Formule :

> Donnee echiqueenne reelle d'abord. Effet visuel ensuite.

R2H doit rendre la Truth Chain lisible par les coups, les positions, les moments et le board. Les effets du FX Lab peuvent inspirer la forme, mais ils ne doivent pas remplacer la donnee.

## 3. Probleme a resoudre

Aujourd'hui :

- Parties peut lire l'historique en read-only ;
- le loaded state peut afficher une fixture Najdorf ;
- l'etat read-only est propre ;
- la surface reste encore partiellement card-like ;
- les effets FX Lab ne sont pas encore pilotes par des coups reels.

Le probleme :
La Truth Chain ne peut pas devenir iconique tant qu'elle ne montre pas :

- coups ;
- positions ;
- moments ;
- gravite ;
- mini-board ;
- lien entre decision et exercice.

Les retours DA recents disent que "plus d'effets" ne suffit plus. L'instrument doit etre pilote par une matiere echiqueenne observable.

## 4. Non-objectifs R2H

R2H ne doit PAS :

- declencher une analyse Stockfish ;
- importer un PGN reel ;
- ecrire en DB ;
- creer `training_items` ;
- modifier Daily Plan ;
- modifier `due_at` ;
- creer XP ;
- creer une nouvelle metrique reelle ;
- creer Transfer Score ;
- creer Opening Mastery ;
- afficher raw WDL ;
- afficher centipawn loss brut ;
- afficher `criticality_score` ;
- afficher `diagnostic_gap` ;
- creer un nouveau systeme d'analyse ;
- ajouter Spline ;
- ajouter WebGL ;
- ajouter dependance.

R2H doit rester une connexion/representation read-only de donnees deja disponibles ou d'une fixture QA controlee.

## 5. Source de donnees a inspecter

R2H doit inspecter ces sources avant tout appel reseau.

### Frontend

- `frontend/src/api/client.ts`
  - `getGameHistory(limit, offset, scope)` appelle `GET /games/history?...`.
  - `getGameMoves(gameId)` appelle `GET /games/{game_id}/moves`.
  - `getReview(gameId)` appelle `GET /games/{game_id}/review`.
  - Les types `GameHistoryItem`, `GameMoveHistory`, `ReviewMoveAnnotation`, `ReviewSections` et `ReviewResponse` exposent les champs candidats.
- `frontend/src/rex/data/useRexPartiesSnapshot.ts`
  - view-model REX actuel limite a l'historique.
- `frontend/src/rex/data/rexPartiesTypes.ts`
  - route R2B deja documentee : `GET /games/history?limit=50&offset=0&scope=mine`.
- `scripts/browser_rex_parties_loaded_fixture_smoke.mjs`
  - fixture QA actuelle pour l'etat loaded Parties.
- Anciens composants Games / Review :
  - `frontend/src/App.tsx` utilise deja moves, review, annotations et focus de position.
  - `frontend/src/components/review/*` contient des patterns de lecture de `ReviewMoveAnnotation`.
  - `frontend/src/components/ChessBoardPanel.tsx` et composants board existants sont a evaluer avant de creer un mini-board.

### Backend

- `backend/neurochess/api/game_routes.py`
  - `GET /games/history` retourne l'historique PGN via `PgnImportService.history`.
  - `GET /games/{game_id}` retourne un etat de partie mais peut charger une session ; a verifier pour les effets de bord.
  - `GET /games/{game_id}/moves` retourne `initial_fen`, `current_fen`, `status` et `moves`.
  - `GET /games/{game_id}/review` retourne le payload Review mais appelle `_ensure_training_items_for_review_payload`, donc R2H doit verifier si cela cree ou hydrate des training items.
  - `GET /review/jobs/{job_id}` donne le statut d'un job existant.
  - `GET /games/{game_id}/review/practice/sessions` liste des sessions existantes sans en creer.
  - `GET /games/{game_id}/opening` retourne l'ouverture deja classifiee.
- `backend/neurochess/review_service.py`
  - `MAX_REVIEW_MOMENTS = 5`.
  - source candidate des moments, annotations, sections et limites de review.
- `backend/neurochess/training_item_service.py`
  - cree/hydrate des training items depuis review moments ; ne doit pas etre declenche par R2H.
- `backend/neurochess/opening_service.py`
  - source opening read-only candidate si deja classifiee.
- `backend/neurochess/data/models.py`
  - `Game` expose `initial_fen`, `current_position_fen`, source et import fields.
  - `Move` expose `ply`, `fen_before`, `uci`, `san`.
- `backend/neurochess/data/repositories.py`
  - `get_moves_for_game(game_id)` lit les coups existants.
- `backend/neurochess/data/migrations.py`
  - table `review_moments` contient `ply`, `fen_before`, `fen_after`, `played_uci`, `played_san`, `best_move_uci`, `best_move_san`, labels et scores internes.
  - table `training_items` existe mais ne doit pas etre creee par R2H.

Regle :
R2H doit utiliser des routes existantes si elles suffisent.
Si aucune route existante ne fournit FEN/moments/coups necessaires en read-only, R2H doit STOP et proposer un contrat backend read-only separe.

## 6. Data contract minimal

R2H doit creer un view-model REX dedie, sans remplacer les types API existants.

```ts
type RexTruthChainSnapshot = {
  backendStatus: "loading" | "ready" | "empty" | "unavailable";
  game?: RexTruthChainGame;
  moments: RexTruthChainMoment[];
  limitations: string[];
  routesUsed: string[];
  readOnlyProof: {
    methodsObserved: string[];
    writesObserved: boolean;
    dailyPlanTouched: boolean;
    trainingItemsCreated: boolean;
    dueAtTouched: boolean;
  };
};

type RexTruthChainGame = {
  id: string;
  white?: string;
  black?: string;
  result?: string;
  openingName?: string;
  eco?: string;
  userColor?: "white" | "black" | "unknown";
  importedAt?: string;
  moveCount?: number;
  reviewStatus?: string;
};

type RexTruthChainMoment = {
  id: string;
  gameId: string;
  ply: number;
  moveNumber?: number;
  sideToMove?: "white" | "black";
  san?: string;
  uci?: string;
  fenBefore?: string;
  fenAfter?: string;
  label: string;
  visualSeverity: "low" | "medium" | "high" | "critical" | "positive" | "unknown";
  momentKind: "tactical" | "strategic" | "opening_exit" | "conversion" | "defense" | "unknown";
  reviewAvailable: boolean;
  exerciseAvailable: boolean;
  source: "review_moment" | "training_item" | "fixture" | "unknown";
  limitations: string[];
};
```

Important :

- `visualSeverity` ne doit pas exposer raw WDL, centipawns, `criticality_score` ou `diagnostic_gap`.
- `visualSeverity` doit etre un mapping prudent et explicable depuis des donnees deja disponibles.
- Le mapping peut utiliser des categories publiques ou semi-publiques deja calculees, par exemple `primary_category`, `moment_importance`, `moment_label`, `impact_label`, `is_good_decision`, `is_training_recommended`, ou `cp_loss_label`, mais jamais comme score brut visible.
- `cp_loss_label`, s'il existe, ne peut etre utilise que comme categorie qualitative deja validee, jamais comme proxy chiffre visible.
- Si la source ne suffit pas a justifier une gravite, utiliser `unknown`.

## 7. Minimum viable visual loaded state

R2H doit afficher :

- une chaine avec maximum 5 noeuds au depart ;
- chaque noeud represente un moment ;
- chaque noeud est focusable au clavier ;
- chaque noeud a :
  - move number ou ply ;
  - SAN si disponible ;
  - gravite visuelle prudente ;
  - statut review/exercice ;
- une mini-board ou placeholder board au focus/hover si FEN disponible ;
- si FEN indisponible, afficher `position non disponible` sans crash.

Regle :
Si moins de 5 vrais moments sont disponibles :

- afficher les moments disponibles ;
- ne completer avec aucun faux moment ;
- ne pas inventer.

Si plus de 5 moments sont disponibles :

- afficher les 5 premiers moments prioritaires selon le payload Review ou la fixture controlee ;
- ne pas recalculer une nouvelle priorisation metier dans le frontend ;
- documenter la limitation dans le view-model.

## 8. Mini-board contract

R2H doit reutiliser un composant board existant si possible.

Sources candidates :

- `frontend/src/components/ChessBoardPanel.tsx` ;
- logique board deja utilisee par l'ancien `App.tsx` ;
- composants Review existants qui affichent ou selectionnent une position.

Si c'est trop large :

- creer un placeholder board minimal non interactif ;
- ou STOP et proposer mission mini-board dediee.

Le mini-board doit :

- etre read-only ;
- afficher FEN si disponible ;
- ne pas permettre de jouer un coup ;
- ne pas declencher analyse ;
- ne pas creer practice attempt ;
- rester accessible ;
- rester lisible en reduced motion ;
- ne pas masquer la chaine principale.

## 9. Visual grammar

La Truth Chain reelle doit etre une polyligne / chaine / timeline, pas un groupe de cards.

Regles :

- la chaine occupe la largeur principale ;
- les noeuds ont une hierarchie visuelle ;
- la donnee pilote la forme ;
- les moments critiques ressortent sans chiffres bruts ;
- le texte reste minimal ;
- aucun paragraphe long ;
- le board donne le contexte echiqueen ;
- degraded state reste propre.

Mapping visuel prudent :

- `positive` = teal/emerald subtil ;
- `low` = graphite/cyan faible ;
- `medium` = amber faible ;
- `high` = orange/amber dense ;
- `critical` = terracotta/rose eteint, jamais rouge agressif ;
- `unknown` = gris/bleu.

R2H doit eviter que `critical` devienne une sanction visuelle contre le joueur. Le systeme juge la decision, pas la personne.

## 10. Interaction contract

Interactions autorisees :

- hover/focus noeud ;
- selectionner un noeud ;
- afficher mini-board ;
- afficher SAN / statut court ;
- naviguer clavier entre noeuds.

Interactions interdites :

- jouer un coup ;
- lancer analyse ;
- creer exercice ;
- reveal solution ;
- practice attempt ;
- mutation DB ;
- afficher une correction comme disponible si elle ne l'est pas.

Accessibilite :

- chaque noeud doit etre atteignable au clavier ;
- focus visible obligatoire ;
- l'information essentielle ne doit pas dependre uniquement de la couleur ;
- le mini-board doit avoir un label lisible ou un fallback textuel.

## 11. Read-only network contract

R2H peut faire uniquement des GET existants.

Interdit :

- `POST` ;
- `PATCH` ;
- `PUT` ;
- `DELETE` ;
- recompute ;
- analyze ;
- import ;
- practice ;
- training creation ;
- daily plan ;
- `due_at` mutation.

Le smoke doit prouver :

- methodes reseau observees ;
- aucun write ;
- routes utilisees ;
- source de verite des routes ;
- aucun appel a `review/generate`, `review/jobs`, `review/rebuild-metrics`, `opening/classify`, `practice/attempts`, `daily-plan/practice` ou import PGN.

Attention :
`GET /games/{game_id}/review` est read-only au niveau HTTP, mais le backend actuel enrichit le payload via `_ensure_training_items_for_review_payload`. R2H doit verifier par code, smoke ou STOP contract que cet appel ne cree pas de nouveaux `training_items` avant de l'utiliser dans REX.

## 12. Fixture strategy

R2H peut utiliser une fixture navigateur dans un smoke pour prouver l'UI loaded si les donnees reelles ne sont pas disponibles.

Mais :

- la fixture doit respecter le vrai view-model REX ;
- elle ne doit pas mentir sur l'origine des donnees ;
- elle doit rester dans le script QA ou data test REX clairement marque ;
- aucune fixture ne doit etre presentee comme donnee utilisateur reelle ;
- elle doit contenir 1 vraie partie de test coherent, 5 moments maximum, SAN/UCI, FEN before/after quand possible, et statuts review/exercice explicites.

Fixture minimale recommandee :

- game : `bahij vs ClubRival`, `0-1`, `Sicilian Defense: Najdorf`, `B90` ;
- moments : 5 noeuds maximum ;
- chaque moment : `ply`, `moveNumber`, `san`, `uci`, `fenBefore`, `fenAfter`, `visualSeverity`, `momentKind`, `reviewAvailable`, `exerciseAvailable`, `source: "fixture"` ;
- exercice : disponible seulement si la fixture declare explicitement un training item existant ; sinon `exerciseAvailable: false`.

## 13. Screenshots attendus R2H

R2H devra fournir :

- Parties loaded avec 5 noeuds ;
- Parties loaded avec un noeud selectionne + mini-board ;
- Parties degraded still OK ;
- etat keyboard focus si possible ;
- screenshot ou note prouvant que le CTA import reste secondaire.

Les screenshots doivent etre stockes en artefacts QA externes, pas dans le repo.

## 14. Tests attendus R2H

Obligatoires :

- `git diff --check` ;
- frontend build ;
- `tsc` ;
- smoke truth chain loaded ;
- smoke read-only methods ;
- smoke degraded ;
- smoke shell ;
- smoke design lab ;
- smoke V1.

Si un composant board est utilise :

- test no interaction / read-only ;
- test no POST on hover/click/focus ;
- test focus clavier ;
- test FEN indisponible sans crash.

## 15. Criteres GO R2H

GO_FOR_R2H seulement si :

- ce contrat est valide ;
- routes existantes ou fixture propre identifiees ;
- R2H reste `frontend/src/rex` only sauf STOP contract ;
- aucune ecriture ;
- aucune metrique interdite ;
- aucun backend mutating endpoint ;
- mini-board scope maitrise.

NO_GO_FOR_R2H si :

- R2H veut creer ou modifier une route backend ;
- R2H veut declencher Stockfish, Review generation, import ou recompute ;
- R2H veut creer `training_items` ;
- R2H veut toucher Daily Plan ou `due_at` ;
- R2H veut afficher raw WDL, centipawn loss brut, `criticality_score`, `diagnostic_gap`, XP, Transfer Score ou Opening Mastery ;
- R2H veut utiliser Spline/WebGL/dependance nouvelle ;
- R2H veut promouvoir un effet FX Lab dans le shell principal sans preuve de donnee.

GO_FOR_R2H_AFTER_HUMAN_REVIEW: pending

## 16. Criteres de reussite artistique R2H

R2H est reussi si :

- un oeil neutre comprend qu'il y a une partie et 5 moments ;
- la gravite relative est visible sans chiffres ;
- le board rappelle clairement que c'est une app d'echecs ;
- le texte visible diminue ;
- la chaine est plus memorable que la version R2E.1 ;
- aucun effet FX Lab n'est necessaire pour comprendre ;
- le degraded state reste calme, lisible et non-debug ;
- la lecture read-only reste visible sans dominer l'instrument.

R2H n'est pas reussi si :

- les noeuds ressemblent encore a cinq cards ;
- la mini-board est decorative mais ne clarifie pas le moment ;
- la gravite ressemble a un score cache ;
- la page a besoin d'un paragraphe pour expliquer ce qu'elle montre ;
- le smoke passe mais la DA reste generique.
