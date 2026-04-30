# V5.2.PGN-R1 - Robust PGN Import

## Objectif

Durcir l'import PGN sans toucher a la Review, au moteur, aux formules de score
ou a V6.

## Changements

- `games` recoit des champs additifs :
  `initial_fen`, `current_position_fen`, `variant`, `import_status`,
  `import_warnings_json`, `import_error`.
- Lichess From Position est accepte si `Variant="From Position"`,
  `SetUp="1"` et `FEN` legal sont presents.
- `initial_fen` vaut le header `FEN` uniquement dans ce cas. Les coups sont
  rejoues depuis cette position.
- Chess.com `CurrentPosition` est stocke comme `current_position_fen`, jamais
  comme `initial_fen`.
- Chess.com `external_game_id` est extrait depuis `Link` pour les formes
  `/game/live/<id>` et `/analysis/game/live/<id>/analysis`.
- Si aucun id externe n'existe, un hash stable du PGN normalise sert de fallback
  de deduplication.
- `GameRecorder.load_session()` et `GET /games/{game_id}/moves` utilisent
  `initial_fen`.
- L'historique expose les metadata PGN et un badge `Position speciale`.
- Les actions historique continuent d'utiliser le `game_id` local.
- La classification d'ouverture retourne
  `not_applicable_from_position` pour une position initiale non standard.
- Les variantes non supportees sont refusees sans creer de carte analysable.

## Regles

- `CurrentPosition` Chess.com n'est jamais une position de depart.
- From Position ne lance pas le book d'ouverture classique.
- Une partie importee legalement reste ouvrable et reviewable a la demande.
- L'import ne lance pas Stockfish automatiquement.

## Validation Navigateur

1. Importer le fixture Chess.com.
2. Verifier que l'historique affiche Chess.com et que `Ouvrir` charge la partie.
3. Verifier que la position initiale est standard malgre `CurrentPosition`.
4. Importer le fixture Lichess From Position.
5. Verifier le badge `Position speciale`.
6. Ouvrir la partie et verifier que l'echiquier part du FEN header.
7. Cliquer `Analyser` et verifier qu'un job Review demarre.
8. Verifier que l'ouverture indique non applicable au lieu d'une erreur.
