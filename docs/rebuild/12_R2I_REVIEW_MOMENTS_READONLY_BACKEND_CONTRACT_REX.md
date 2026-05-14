# R2I Review Moments Read-Only Backend Contract - NeuroChess REX

## 1. Statut

Statut :
Contrat backend read-only pour future mission R2J.

But :
Definir une route safe permettant a REX Truth Chain d'afficher de vrais moments Review sans side effect.

R2I ne code rien.
R2I prepare R2J.

## 2. Probleme

Aujourd'hui :
- REX peut lire l'historique et les moves/FEN en GET safe.
- REX peut afficher une Truth Chain moves-only.
- Mais REX ne peut pas lire les vrais moments Review sans risque.

Probleme identifie :
`GET /games/{game_id}/review` n'est pas safe pour REX car il peut enrichir le payload en creant ou assurant des `training_items`.

Le risque vient du chemin existant dans `backend/neurochess/api/game_routes.py` :
- `GET /games/{game_id}/review` appelle `review_service.get_review(...)`.
- La reponse passe ensuite par `_ensure_training_items_for_review_payload(...)`.
- Ce helper peut appeler `training_item_service.ensure_training_items_for_game(...)`.
- Ce service peut creer des `training_items`.

Donc :
Cette route ne doit pas etre utilisee par REX Truth Chain.

## 3. Decision centrale

Creer une future route dediee, strictement read-only, pour les moments Review.

Route recommandee :

```text
GET /games/{game_id}/truth-chain/moments
```

Justification :
- Le nom indique l'usage REX Truth Chain sans reutiliser la route Review existante.
- La route est moins ambigue que `/games/{game_id}/review/moments/read-only`, qui reste trop proche du chemin Review dangereux.
- Elle peut exposer un payload deja filtre pour l'instrument visuel, sans raw metrics et sans enrichissement automatique.
- Elle force un nouveau chemin backend explicitement read-only au lieu d'ajouter une option fragile a `GET /games/{game_id}/review`.

Alternative acceptable si les conventions backend l'exigent :

```text
GET /games/{game_id}/review/moments/read-only
```

Cette alternative n'est acceptable que si elle n'appelle jamais le chemin `get_review` existant ni les helpers d'enrichissement training.

Regle :
Cette route ne doit jamais :
- creer `training_items` ;
- creer `practice_attempts` ;
- modifier Daily Plan ;
- modifier `due_at` ;
- declencher Stockfish ;
- recompute review ;
- importer PGN ;
- ecrire en DB.

## 4. Non-objectifs R2J

R2J ne doit PAS :
- modifier l'algorithme Review ;
- creer de nouveaux moments ;
- recalculer Stockfish ;
- creer `training_items` ;
- creer exercices ;
- modifier `due_at` ;
- modifier Daily Plan ;
- exposer raw WDL ;
- exposer centipawn loss brut ;
- exposer `criticality_score` ;
- exposer `diagnostic_gap` ;
- exposer ETV ;
- creer XP ;
- creer Transfer Score ;
- creer Opening Mastery ;
- ajouter Spline/WebGL ;
- modifier frontend REX sauf future mission R2K dediee.

## 5. Sources de donnees autorisees

La route read-only peut lire uniquement des donnees deja persistees.

Sources possibles a inspecter :
- `games`
- `moves`
- analyses persistees
- `review_moments` persistés si table existante
- review summary persiste si existe
- `training_items` existants uniquement en lecture si necessaire, mais ne jamais en creer
- opening data existante en lecture

Interdit :
- engine call
- Stockfish analysis
- recompute
- rebuild review
- ensure training items
- schedule update
- `due_at` update

Si les moments ne sont pas persistés :
La route doit retourner une reponse vide ou limitee, pas les creer.

## 6. Response contract

Payload stable attendu :

```ts
type ReviewMomentsReadOnlyResponse = {
  game: {
    id: string
    white?: string
    black?: string
    result?: string
    openingName?: string
    eco?: string
    moveCount?: number
    reviewStatus?: string
  }
  moments: ReviewMomentReadOnly[]
  limitations: string[]
  readOnlyProof: {
    route: string
    methodsAllowed: ["GET"]
    writesPerformed: false
    trainingItemsCreated: false
    dailyPlanTouched: false
    dueAtTouched: false
    engineInvoked: false
  }
}

type ReviewMomentReadOnly = {
  id: string
  gameId: string
  ply: number
  moveNumber?: number
  san?: string
  uci?: string
  fenBefore?: string
  fenAfter?: string
  label: string
  momentKind:
    | "tactical"
    | "strategic"
    | "opening_exit"
    | "conversion"
    | "defense"
    | "unknown"
  visualSeverity: "positive" | "low" | "medium" | "high" | "critical" | "unknown"
  reviewAvailable: boolean
  exerciseAvailable: boolean
  source:
    | "persisted_review_moment"
    | "persisted_training_item"
    | "persisted_review_summary"
    | "none"
  limitations: string[]
}
```

Notes :
- `moments` doit contenir au maximum 5 moments au depart.
- `san`, `uci`, `fenBefore` et `fenAfter` doivent venir de donnees persistees.
- Si FEN ou SAN manque, la route doit l'indiquer dans `limitations` sans inventer.
- `exerciseAvailable` peut etre vrai uniquement si un objet persiste existant le prouve en lecture seule.
- La route ne doit pas creer un exercice pour rendre `exerciseAvailable` vrai.
- `readOnlyProof` is declarative; the actual read-only guarantee must be validated by before/after DB mutation tests.

## 7. visualSeverity contract

`visualSeverity` doit etre une categorie qualitative prudente.

Interdit :
- raw WDL visible
- centipawn loss brut visible
- `criticality_score` visible
- `diagnostic_gap` visible
- ETV visible

Autorise :
- mapping qualitatif deja valide
- labels existants deja utilises en frontend si safe
- `cp_loss_label` seulement s'il existe deja comme categorie validee et jamais comme proxy chiffre visible

Le mapping doit etre documente et teste.

Mapping visuel cible pour REX :
- `positive` = teal/emerald subtil
- `low` = graphite/cyan faible
- `medium` = amber faible
- `high` = orange/amber dense
- `critical` = terracotta/rose eteint, jamais rouge agressif
- `unknown` = gris/bleu

## 8. No side-effect guarantees

R2J doit ajouter des tests backend prouvant l'absence de mutation.

Avant appel :
- count `training_items`
- count `practice_attempts` si table existe
- valeurs `due_at` pertinentes
- Daily Plan / schedule state si applicable

Apres appel :
- memes counts
- memes `due_at`
- aucun nouvel item
- aucune mutation detectee

La route doit etre safe meme appelee plusieurs fois.

Test obligatoire :
- appeler la route 2 fois
- comparer DB avant/apres
- aucune difference autorisee

## 9. Allowed service design

La route doit utiliser un service dedie, par exemple :

```text
ReviewMomentsReadOnlyService
```

Ce service doit :
- lire uniquement ;
- ne jamais appeler `ensure_training_items_for_game` ;
- ne jamais appeler `_ensure_training_items_for_review_payload` ;
- ne jamais appeler `create_training_item` ;
- ne jamais appeler scheduling / due logic ;
- ne jamais appeler engine / analysis ;
- filtrer les champs dangereux avant serialisation.

Si les services existants melangent lecture et side effects :
Creer un nouveau chemin read-only dedie.

Regle d'implementation :
Le service peut reutiliser des repositories ou queries read-only, mais ne doit pas reutiliser un service dont le contrat inclut creation, enrichissement ou scheduling.

## 10. Frontend integration contract futur R2K

R2J ne doit pas obligatoirement integrer frontend.

Separation recommandee :
- R2J = backend route read-only + tests.
- R2K = REX frontend consumes read-only review moments.

R2K devra :
- remplacer moves-only par moments reels si disponibles ;
- garder fallback moves-only ;
- garder mini-board ;
- garder read-only proof ;
- ne pas appeler `/games/{game_id}/review` ;
- ne pas afficher raw WDL, cp brut, `criticality_score`, `diagnostic_gap` ou ETV.

## 11. API behavior cases

La route doit gerer :

1. Game not found
- 404 propre.

2. Game exists, no review
- 200 avec `moments: []` et limitation `"no persisted review moments"`.

3. Review exists, moments persisted
- 200 avec moments.

4. Moves/FEN missing
- 200 avec moments sans FEN ou limitation `"position unavailable"`.

5. Training items existants mais non necessaires
- ne pas creer, ne pas modifier.

6. Review route would normally enrich
- la route read-only ne le fait pas.

7. Game belongs to another user
- meme comportement d'autorisation que les routes games existantes.

## 12. Tests attendus R2J

Backend tests obligatoires :
- route returns 200 for game with persisted moments fixture.
- route returns empty moments without creating anything.
- repeated calls do not mutate DB.
- `training_items` count unchanged.
- `practice_attempts` count unchanged si table existe.
- `due_at` unchanged.
- Daily Plan / schedule unchanged si applicable.
- no engine/recompute called.
- no `ensure_training_items_for_game` called.
- no `_ensure_training_items_for_review_payload` called.
- route does not expose banned raw metrics.
- response schema stable.
- ownership/scope is respected.

Static tests possibles :
- ensure forbidden function names not referenced in read-only route/service:
  - `ensure_training_items_for_game`
  - `_ensure_training_items_for_review_payload`
  - `create_training_item`
  - `schedule`
  - `due_at` mutation
  - engine invocation
  - recompute / rebuild review

Frontend smoke R2K plus tard :
- REX Truth Chain uses new route.
- no POST/PATCH/PUT/DELETE.
- no `/games/{game_id}/review` call.

## 13. Security / safety

The route must:
- respect same access scope as existing game routes;
- not expose other users' games;
- not bypass ownership filters;
- not leak internal engine metrics;
- use existing auth/scope conventions.

The response must not expose:
- raw WDL;
- centipawn loss brut;
- `criticality_score`;
- `diagnostic_gap`;
- ETV;
- engine internals;
- internal scheduling metadata.

## 14. Rollback

Rollback R2J:
- remove new route
- remove read-only service
- remove tests
- no migration rollback if no schema changes
- no DB cleanup needed because no writes

## 15. GO / NO-GO

GO_FOR_R2J only if:
- this contract is validated;
- route can be implemented without side effects;
- tests can prove no DB mutation;
- no forbidden metrics are exposed;
- no frontend integration is bundled unless explicitly authorized.

NO-GO if:
- implementation requires calling `/games/{game_id}/review`;
- implementation requires `ensure_training_items_for_game`;
- implementation requires `_ensure_training_items_for_review_payload`;
- moments are not persisted and would need recompute;
- the route cannot prove no DB mutation;
- ownership/scope rules are unclear;
- frontend REX integration is bundled into R2J without explicit authorization.

## 16. Risques identifies

- Reutiliser par confort la route Review existante et declencher la creation de `training_items`.
- Exposer des metriques internes sous pretexte de donner une gravite visuelle.
- Confondre `cp_loss_label` qualitatif avec un score chiffre visible.
- Lire des `training_items` existants puis les modifier indirectement via un service partage.
- Ajouter un endpoint qui contourne les filtres d'ownership.
- Transformer R2J en integration frontend REX trop tot.
- Retourner une reponse vide si les moments ne sont pas persistés, ce qui est acceptable mais doit etre explicite.
- Ecrire un test qui verifie seulement le status code sans prouver l'absence de mutation DB.

GO_FOR_R2J_AFTER_HUMAN_REVIEW: pending
