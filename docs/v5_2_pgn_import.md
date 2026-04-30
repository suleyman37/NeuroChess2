# V5.2 - PGN Import Minimal

## Objectif

V5.2 permet d'importer manuellement un ou plusieurs PGN pour remplir
l'historique utilisateur des le premier jour.

Le scope est volontairement minimal : import local fiable, deduplication,
metadonnees utiles, classification d'ouverture si le book local existe, et
historique simple.

## Endpoints

### POST /games/import-pgn/preview

Accepte :

- `multipart/form-data` avec un fichier `.pgn` ;
- ou JSON `{ "pgn_text": "..." }`.

Retourne le nombre de parties valides, invalides, doublons, les joueurs
detectes, un indicateur `needs_user_alias`, des exemples et les erreurs.

### POST /games/import-pgn

Accepte :

- `multipart/form-data` avec un fichier `.pgn` ;
- ou JSON `{ "pgn_text": "...", "user_alias": "...", "platform": "..." }`.

Retourne `imported_count`, `duplicate_count`, `invalid_count`,
`classified_count`, `warnings` et `imported_game_ids`.

### GET /games/history

Retourne un historique minimal pagine :

- `game_id` ;
- `date_played` ;
- `white_name`, `black_name` ;
- `user_color`, `opponent_name` ;
- `result`, `result_from_user_pov` ;
- `white_elo`, `black_elo` ;
- `time_control` ;
- `source_platform`, `source_url` ;
- `opening_name`, `eco_code` ;
- `review_status`.

## Modele de donnees

Migration additive `0005_v5_2_pgn_import`.

`games` recoit les champs PGN et historique :
`source`, `source_platform`, `source_url`, `source_game_id`, `imported_at`,
`moves_uci_hash`, `white_name`, `black_name`, `white_elo`, `black_elo`,
`time_control`, `date_played`, `eco_code_pgn`, `opening_name_pgn`,
`termination`, `user_color`, `opponent_name`, `result_from_user_pov`.

`moves` recoit les champs de cadence :
`time_spent_ms`, `white_clock_ms`, `black_clock_ms`, `clock_source`.

Nouvelle table `user_aliases` :
`id`, `username`, `username_normalized`, `platform`, `created_at`,
`updated_at`, avec unicite `(username_normalized, platform)`.

## Parsing PGN

Le service `backend/neurochess/pgn_import_service.py` utilise
`python-chess.pgn`.

Il supporte :

- fichier `.pgn` ;
- texte PGN colle ;
- plusieurs parties dans un meme PGN ;
- headers standards : `Event`, `Site`, `Date`, `White`, `Black`, `Result`,
  `WhiteElo`, `BlackElo`, `TimeControl`, `ECO`, `Opening`, `Termination`,
  `Link` / `URL` ;
- mainline uniquement ;
- SAN, UCI, `fen_before` ;
- clocks `[%clk ...]` si presentes.

Les variantes et commentaires sont ignores pour la logique. Une partie invalide
est ignoree sans casser le batch.

## Deduplication

Chaque partie calcule :

```text
moves_uci_hash = sha256(" ".join(moves_uci))
```

Deduplication :

1. si `source_url` existe deja, la partie est doublon ;
2. sinon, doublon si `white_name`, `black_name`, `date_played`, `result` et
   `moves_uci_hash` correspondent.

## User alias minimal

La preview detecte les joueurs.

L'import peut recevoir `user_alias`. La comparaison est insensible a la casse et
aux espaces superflus via `username_normalized`.

Si l'alias correspond aux Blancs, `user_color='white'`. S'il correspond aux
Noirs, `user_color='black'`. Sinon `user_color` et `result_from_user_pov`
restent `null`.

`result_from_user_pov` vaut `win`, `loss`, `draw`, `unknown` ou `null`.

## Classification ouverture

Apres insertion, l'import appelle `classify_game_opening(game_id)`.

Si le book local est absent ou si la classification echoue, l'import continue et
retourne un warning. Aucune analyse Stockfish n'est lancee pour classifier
l'ouverture.

## Pas de Stockfish automatique

V5.2 n'appelle pas :

- analyse shallow ;
- analyse deep ;
- analyse live ;
- generation Review.

Les parties importees remplissent l'historique et les coups, mais ne demarrent
pas d'analyse moteur massive.

## Limites V5.2

- Pas de dashboard avance.
- Pas de filtres avances dans l'historique.
- Pas de sync Chess.com / Lichess.
- Pas d'appel API externe.
- Pas d'import automatique.
- Pas de calcul Elo NeuroChess.
- Pas de recommandations.
- Pas de SRS / rehearsal.
- Pas de LLM, Maia ou Tension Lab.

## Repousse

Repousse a une version future :

- statistiques globales ;
- modeles de rating NeuroChess ;
- import enrichi depuis API externes ;
- entrainement, rehearsal ou memoire ;
- analyse massive planifiee des parties importees.
