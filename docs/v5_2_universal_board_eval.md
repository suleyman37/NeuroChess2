# V5.2 Universal Board Evaluation Bar

## Objectif

V5.2 fait de la barre d'evaluation la barre de la position affichee a l'ecran.
Elle n'est plus seulement la barre de la position live de la partie.

## Source de verite

`boardFen` est la FEN reellement envoyee a `ChessBoardPanel`.

- `LIVE`: `boardFen = currentFen`.
- `HISTORICAL`: `boardFen = fen_after` du coup selectionne.
- `REVIEW`: `boardFen = fen_before` du moment selectionne.
- Position initiale: `boardFen = initial_fen`.
- Position finale: `boardFen = currentFen` / `current_fen`.

`EvaluationBar` ne doit jamais afficher une evaluation dont la FEN source
differe de `boardFen`.

## Session live universelle

Quand `boardFen` change, le frontend:

1. invalide et stoppe l'ancienne session live si elle existe;
2. attend un debounce court;
3. appelle `POST /live-analysis/start` avec `fen=boardFen`;
4. ouvre `EventSource` sur la session retournee;
5. applique uniquement les updates qui correspondent a la session, a la FEN et
   au contexte courant.

Les contexts utilises sont:

- `live`;
- `historical`;
- `review`;
- `final`;
- `initial`.

## Anti stale updates

Une update SSE est acceptee seulement si:

- `update.session_id` correspond a la session courante;
- `update.fen` correspond a `boardFen`;
- `update.context` correspond au contexte courant quand il est present.

Une update obsolète est ignoree silencieusement. Elle ne remplace pas la barre,
ne change pas la source visible et ne declenche pas de warning.

## Valeur initiale

Avant la premiere update live valide:

- en `LIVE`, l'evaluation courante peut etre affichee seulement si sa FEN
  source correspond a `boardFen`;
- en `REVIEW`, `eval_before_cp` / `mate_before` du moment sont affiches comme
  valeur sauvegardee quand ils existent;
- en `HISTORICAL`, une analyse deep deja en cache peut etre affichee;
- sinon la barre affiche `analyse en cours` ou `analyse indisponible`.

Une evaluation absente ne doit jamais etre presentee comme `0.00`.

## Sources visibles

- `live`: position live courante.
- `historical_live`: position historique analysee en live.
- `review_live`: position de review analysee en live.
- `final_live`: position finale analysee en live.
- `initial_live`: position initiale analysee en live.
- `review_saved`: evaluation stockee par la review.
- `historical_deep`: analyse deep existante d'une position historique.

## Backend

`POST /live-analysis/start` accepte maintenant:

- `fen`;
- `context`;
- `game_id`;
- `ply`;
- `review_moment_id`.

Les updates live restent non canoniques et ne sont pas stockees dans
`position_analyses`.

## Limites restantes

- V5.2 ne change pas la profondeur live ni Stockfish.
- V5.2 ne modifie pas shallow/deep/calibration.
- V5.2 ne modifie pas la review V4, `cp_loss` ou `importance_score`.
- V5.2 ne cree pas de fonctionnalite d'apprentissage d'ouverture.

