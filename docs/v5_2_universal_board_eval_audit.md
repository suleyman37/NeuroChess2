# V5.2 Universal Board Evaluation Audit

## Verdict lecture seule

Avant V5.2, la barre et l'echiquier etaient deja proteges contre une confusion
grossiere, mais la barre restait partiellement dependante des analyses deep
existantes ou des valeurs stockees par la review. Une position historique ou de
review pouvait donc rester en fallback neutre meme si Stockfish live pouvait
analyser la FEN affichee.

## FEN affichee

Le frontend utilisait `viewedFen ?? currentFen` pour alimenter
`ChessBoardPanel`. V5.2 formalise cette expression sous le nom `boardFen`.

- `LIVE`: `boardFen = currentFen`.
- `HISTORICAL`: `boardFen = fen_after` du coup consulte, ou `initial_fen` pour
  la position initiale.
- `REVIEW`: `boardFen = fen_before` du moment de review.
- Position finale: `boardFen = currentFen` / `current_fen` backend.

## Barre avant V5.2

`EvaluationBar` recevait un etat derive:

- `LIVE`: evaluation courante/live.
- `HISTORICAL`: analyse deep existante si disponible, sinon fallback neutre.
- `REVIEW`: `eval_before_cp` / `mate_before` si disponibles, sinon fallback
  neutre.

Cette logique etait correcte pour ne pas mentir, mais pas universelle: elle ne
demandait pas systematiquement une analyse live pour la FEN visible.

## Live analysis existante

Le backend expose deja:

- `POST /live-analysis/start`;
- `POST /live-analysis/stop`;
- `GET /live-analysis/stream`;
- SSE avec `EventSource` cote frontend.

`POST /live-analysis/start` acceptait deja une FEN arbitraire. V5.2 ajoute un
contexte optionnel (`live`, `historical`, `review`, `final`, `initial`) et un
`review_moment_id` optionnel afin que les updates SSE puissent etre filtrees
par FEN et par contexte.

## Arret et stale updates

Avant V5.2, les updates etaient filtrees par `session_id`, FEN courante de la
partie et parfois `ply`. Cette logique etait insuffisante pour une barre liee a
la position visible, car une position historique/review n'est pas la FEN live de
la partie.

V5.2 filtre maintenant par:

- `session_id` courant;
- `update.fen === boardFen`;
- `update.context === boardEvaluationContext` quand le contexte est present.

## Risques identifies

- Clics rapides dans l'historique: risque de demarrer trop de sessions live.
  Mitigation: debounce frontend et stop/invalidation de l'ancienne session.
- Update tardive apres changement de position: mitigation par `session_id`,
  `fen` et `context`.
- Moteur indisponible: la partie reste jouable; la barre affiche un fallback
  clair sans presenter `0.00` comme absence d'analyse.
- Pollution DB: les updates live restent en memoire/SSE et ne sont pas ecrites
  dans `position_analyses`.

