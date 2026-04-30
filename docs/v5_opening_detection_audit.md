# V5 Opening Detection Audit

## Schema actuel

### games

Colonnes principales:

- `id`
- `created_at`
- `completed_at`
- `mode`
- `opponent_type`
- `opponent_level`
- `result`
- `pgn`
- `completed`

Une partie est consideree terminee quand `completed = 1`. En V4/V4.1.1,
`result = '*'` correspond a une terminaison manuelle.

### moves

Colonnes principales:

- `id`
- `game_id`
- `ply`
- `fen_before`
- `uci`
- `san`
- `is_player`
- `time_spent`
- `eval_before_cp`
- `eval_after_cp`
- `best_move_uci`
- `cp_loss`
- `classification`
- `created_at`
- `annotations`

`fen_after` n'est pas stocke en colonne. Il est reconstruit cote backend avec
`python-chess` a partir de `fen_before + uci`, notamment dans
`GET /games/{game_id}/moves`.

## Historique de partie

L'historique complet se recupere via `Repository.get_moves_for_game(game_id)`,
ordonne par `ply, id`.

`GET /games/{game_id}/moves` expose deja:

- `initial_fen`;
- `current_fen`;
- `ply`;
- `side_to_move_before`;
- `played_uci`;
- `played_san`;
- `fen_before`;
- `fen_after`.

Cet endpoint suffit pour afficher une classification, mais le service V5 peut
classifier directement depuis la DB pour eviter de dependre d'un appel HTTP
interne.

## FEN et matching

Les FEN de partie sont produites ou validees par `python-chess`. Pour V5, le
matching d'ouverture doit utiliser une cle normalisee `fen_key` composee de:

- placement des pieces;
- trait;
- droits de roque;
- case en passant.

Le halfmove clock et le fullmove number sont ignores pour eviter des faux
negatifs.

## Nouvelles tables

Les tables V5 peuvent etre ajoutees dans une migration additive:

- `opening_lines`;
- `opening_line_nodes`;
- `game_opening_classifications`.

Elles sont independantes de V4 review, `position_analyses` et live analysis.

## Import seed local

Le seed local doit vivre dans
`backend/neurochess/data/openings_seed.json`.

L'import doit:

- valider `schema_version`;
- valider chaque UCI avec `python-chess`;
- creer ou mettre a jour les lignes;
- reconstruire les nodes de la ligne uniquement si la ligne change;
- rester idempotent;
- ne pas supprimer les lignes orphelines absentes du seed.

## Transpositions

V5 utilise un matching sequentiel. Une partie doit suivre les positions d'une
ligne dans l'ordre depuis la position initiale. Les transpositions par ordre de
coups different ne sont pas gerees en V5.

Cette limite est volontaire. Un index FEN avance ou une reconnaissance par
transposition appartient a V5.1+.

## Impact V4/V4.1.1

V5 ne doit pas modifier:

- Stockfish;
- shallow/deep/live/calibration;
- la barre d'evaluation;
- V4 review;
- V4.1 navigation;
- V4.1.1 coherence position/barre.

La classification d'ouverture ne declenche aucune analyse moteur.

## Limites V5

- Petit book interne uniquement.
- Pas d'appel API externe.
- Pas d'explorer.
- Pas de revision d'ouverture.
- Pas de SRS.
- Pas de score de maitrise.
- Pas de recommandation.
- Matching sequentiel uniquement.
- ECO absent si incertain.
