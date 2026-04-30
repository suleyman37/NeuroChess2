# V5.2 PGN Import Minimal - Audit

Audit rapide effectue avant implementation V5.2.

## Schema actuel games / moves

Avant V5.2, la table `games` contenait le socle local : `id`, `created_at`,
`completed_at`, `mode`, `opponent_type`, `opponent_level`, `result`, `pgn`,
`completed`.

V5.2 ajoute uniquement des colonnes additives pour l'import PGN :
`source`, `source_platform`, `source_url`, `source_game_id`, `imported_at`,
`moves_uci_hash`, `white_name`, `black_name`, `white_elo`, `black_elo`,
`time_control`, `date_played`, `eco_code_pgn`, `opening_name_pgn`,
`termination`, `user_color`, `opponent_name`, `result_from_user_pov`.

Avant V5.2, la table `moves` contenait notamment `ply`, `fen_before`, `uci`,
`san`, `is_player`, `time_spent`, `eval_before_cp`, `eval_after_cp`,
`best_move_uci`, `cp_loss`, `classification`, `annotations`.

V5.2 ajoute uniquement des colonnes additives pour les donnees PGN de temps :
`time_spent_ms`, `white_clock_ms`, `black_clock_ms`, `clock_source`.

La table `moves` ne stocke pas `fen_after` : le backend le reconstruit en
rejouant `uci` depuis `fen_before`.

## Champs deja utiles pour PGN

- `games.pgn` peut stocker le PGN source.
- `games.result` stocke le resultat brut PGN.
- `moves.ply`, `moves.fen_before`, `moves.uci`, `moves.san` permettent de
  reconstruire la partie.
- `game_opening_classifications` permet de relier l'ouverture classifiee a une
  partie importee.

## Endpoint history

Avant V5.2, aucun endpoint `GET /games/history` dedie a l'historique minimal
PGN n'a ete observe.

V5.2 ajoute `GET /games/history?limit=50&offset=0` avec une liste simple :
partie, date, joueurs, resultat, Elo externes, cadence, source et ouverture.

## Service opening classification disponible

`backend/neurochess/opening_service.py` expose `OpeningService` et
`classify_game_opening(game_id)`.

Ce service utilise le book local en base et les coups stockes. Il ne lance pas
Stockfish. L'import PGN l'appelle apres insertion, et transforme un echec de
classification en warning au lieu de faire echouer l'import.

`backend/neurochess/opening_book_preparer.py` existe pour preparer le book local
depuis les sources Lichess locales vers `openings_book.json`.

## Contraintes respectees

- Import PGN local manuel uniquement.
- Pas d'appel API Chess.com ou Lichess.
- Pas de sync automatique.
- Pas de lancement Stockfish automatique sur les parties importees.
- Pas de generation automatique de review.
- Pas de changement `cp_loss`, `importance_score`, formule d'evaluation,
  opening book, opening classification ou moteur.
- Pas de V6, pas de SRS, pas de recommandations, pas de LLM, pas de Maia,
  pas de Tension Lab.
