# V5.2.PGN-R1 - Robust PGN Import Audit

## Constats

- L'import PGN utilisait `python-chess.pgn` et stockait deja les coups avec
  `fen_before`. `python-chess` sait lire `SetUp=1` + `FEN`, donc les coups From
  Position etaient parsables.
- La table `games` ne stockait pas explicitement `initial_fen`,
  `current_position_fen`, `variant`, `import_status` ou warnings d'import.
- `GET /games/{game_id}/moves` renvoyait toujours `chess.STARTING_FEN` comme
  `initial_fen`, meme pour une partie importee depuis une position speciale.
- `GameRecorder.load_session()` reconstruisait toujours depuis une session
  standard. Une partie From Position pouvait donc etre importee, puis echouer a
  l'ouverture ou afficher un echiquier faux.
- Chess.com `CurrentPosition` n'etait pas specialement traite. Il ne faut pas
  l'utiliser comme position initiale : ce header represente la position courante
  ou finale exportee par Chess.com.
- Chess.com n'a pas toujours `GameId`; le bon identifiant peut venir du header
  `Link`, par exemple `/analysis/game/live/<id>/analysis`.
- L'historique frontend ouvrait deja via `item.game_id`, donc le probleme
  principal n'etait pas le bouton lui-meme mais la reconstruction backend.
- La classification d'ouverture utilisait une position 0 standard. Sur une
  position initiale speciale, le matching classique doit etre marque non
  applicable au lieu de bloquer l'import ou la Review.

## Cause

Les PGN etaient stockes avec des `fen_before` corrects, mais la position de
depart n'etait pas promue en metadata canonique de partie. Les endpoints et la
session runtime retombaient donc sur le plateau standard, ce qui cassait
l'ouverture/analyse des PGN Lichess From Position. Cote Chess.com, le manque
d'extraction explicite de `Link`/`CurrentPosition` rendait l'identite et la
position finale ambigues.
