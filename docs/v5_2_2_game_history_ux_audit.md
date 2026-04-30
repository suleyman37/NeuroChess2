# V5.2.2 - Audit historique de parties

## Objectif

Comprendre l'etat reel de l'historique avant de transformer l'onglet en
bibliotheque lisible.

## Parties actuellement visibles

- Les parties terminees de la table `games` sont lues par
  `PgnImportService.history()`.
- Avant V5.2.2, l'endpoint retournait surtout des champs bruts :
  `white_name`, `black_name`, `result`, `source_platform`, ouverture et
  `review_status`.
- Les parties importees PGN etaient visibles.
- Les parties locales terminees existaient dans `games`, mais l'UI etait
  orientee "historique PGN" et ne les distinguait pas clairement.

## Cause des lignes "? - ?"

- Les parties locales creees dans NeuroChess ne stockent pas forcement
  `white_name` et `black_name`.
- L'UI affichait directement :
  `item.white_name ?? "?"` et `item.black_name ?? "?"`.
- Pour une partie locale sans noms PGN, cela produisait donc `? - ?`.

## Creation des parties locales

- Les parties locales sont creees via `Repository.create_game()` puis jouees via
  le recorder/session existant.
- Elles ont `source='local'` par defaut depuis la migration V5.2 PGN Import.
- Elles n'ont pas toujours de metadata PGN : noms, Elo, plateforme ou cadence.

## Stockage des parties importees

- Les parties PGN importees sont stockees dans `games` avec :
  `source='pgn_import'`, `source_platform`, `source_url`, `moves_uci_hash`,
  noms, Elo, cadence, date, ouverture PGN, alias utilisateur si connu.
- Les coups importes sont stockes dans `moves` avec UCI/SAN et
  `fen_before`/`fen_after`.
- L'import ne lance pas Stockfish et ne genere pas de review automatiquement.

## Champs disponibles

- `source`
- `source_platform`
- `source_url`
- `user_color`
- `opponent_name`
- `result_from_user_pov`
- `white_elo`
- `black_elo`
- `time_control`
- `date_played`
- `eco_code_pgn`
- `opening_name_pgn`
- `opponent_type`

## Champs manquants avant V5.2.2

- `game_category` pour distinguer explicitement :
  `local_manual`, `local_ai`, `imported_user`, `imported_observed`,
  `analysis_sandbox`, `unknown`.
- Labels prets pour l'UI :
  `display_title`, `display_subtitle`, `metadata_quality`,
  `review_summary_status`, `time_control_category`.

## Ouverture et review status

- L'ouverture est recuperee depuis `game_opening_classifications` avec fallback
  sur les headers PGN `ECO` / `Opening`.
- Le statut Review est recupere depuis la derniere ligne `game_reviews`.
- Avant V5.2.2, l'endpoint n'exposait pas encore un etat d'analyse resume comme
  `Review disponible`, `A analyser`, `Trop courte` ou `Echec analyse`.

## Contraintes

- Ne pas masquer les vraies parties locales.
- Ne pas supprimer de parties anciennes ou inconnues.
- Ne pas lancer Stockfish automatiquement.
- Ne pas inventer de score global.
- Garder les parties observees accessibles via scope explicite.
