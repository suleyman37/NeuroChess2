# V4 Post-game Review Audit

Audit realise avant les modifications fonctionnelles V4.

## 1. Schema actuel

### games

Source: migration `0001_v0_schema`.

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `created_at TEXT NOT NULL`
- `completed_at TEXT NULL`
- `mode TEXT NOT NULL`
- `opponent_type TEXT NULL`
- `opponent_level INTEGER NULL`
- `result TEXT NULL`
- `pgn TEXT NULL`
- `completed INTEGER NOT NULL DEFAULT 0`

Statut de partie actuel:

- partie en cours: `completed = 0`, `completed_at = NULL`, `result = NULL`;
- partie terminee automatiquement: `completed = 1`, `result` vaut le resultat
  python-chess si disponible;
- partie terminee manuellement: `completed = 1`, `result = "*"`.

### moves

Source: migrations `0001_v0_schema` et `0002_v3_5_durable_analysis_pipeline`.

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `game_id INTEGER NOT NULL`
- `ply INTEGER NOT NULL`
- `fen_before TEXT NOT NULL`
- `uci TEXT NOT NULL`
- `san TEXT NOT NULL`
- `is_player INTEGER NOT NULL`
- `time_spent REAL NULL`
- `eval_before_cp INTEGER NULL`
- `eval_after_cp INTEGER NULL`
- `best_move_uci TEXT NULL`
- `cp_loss INTEGER NULL`
- `classification TEXT NULL`
- `created_at TEXT NOT NULL`
- `annotations TEXT NOT NULL DEFAULT '{}'`

Index:

- `idx_moves_game_id ON moves(game_id)`
- `idx_moves_game_id_ply ON moves(game_id, ply)`

FK:

- `moves.game_id -> games(id)`

### position_analyses

Source: migration `0002_v3_5_durable_analysis_pipeline`.

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `fen TEXT NOT NULL`
- `analysis_json TEXT NOT NULL DEFAULT '{}'`
- `engine TEXT NOT NULL DEFAULT 'stockfish'`
- `depth INTEGER NOT NULL DEFAULT 12`
- `schema_version TEXT NOT NULL DEFAULT 'engine_analysis_v2'`
- `created_at TEXT NOT NULL`
- `engine_version TEXT NOT NULL DEFAULT 'unknown'`
- `multipv INTEGER NOT NULL DEFAULT 3`
- `analysis_time_ms INTEGER NULL`
- `reliability_score REAL NULL`
- `reliability_label TEXT NULL`
- `status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'done', 'failed'))`
- `error_message TEXT NULL`
- `completed_at TIMESTAMP NULL`
- `analysis_kind TEXT NOT NULL DEFAULT 'deep' CHECK(analysis_kind IN ('shallow', 'deep'))`

Index:

- `idx_position_analyses_fen ON position_analyses(fen)`
- `idx_position_analyses_unique_v3_5` unique sur
  `(fen, engine, engine_version, depth, multipv, analysis_kind, schema_version)`

## 2. Emplacement des donnees de coup

- `fen_before`: colonne `moves.fen_before`.
- `fen_after`: non stockee en colonne; calculee au moment du coup par
  `GameSession.preview_uci()` et reconstructible en rejouant les coups.
- `uci`: colonne `moves.uci`.
- `san`: colonne `moves.san`.
- `ply`: colonne `moves.ply`.
- `side_to_move`: derive de `chess.Board(fen_before).turn`.
- `played_by`: identique a `side_to_move_before`.
- statut global: `games.completed`, `games.completed_at`, `games.result`.

## 3. Analyses deep associees a une partie

La couche V3.5 expose `AnalysisService.get_game_deep_analyses(game_id)`, qui
parcourt les positions apres les coups et lit les analyses `kind='deep'`.

Pour V4, il faut une vue plus precise:

- analyse deep de `fen_before` pour identifier le meilleur coup disponible au
  moment du choix;
- analyse deep de `fen_after` pour mesurer l'evolution apres le coup joue;
- ignorer strictement shallow/live/calibration.

## 4. Identification before/after

Les moves stockent seulement `fen_before`. Pour obtenir `fen_after`, V4 doit
rejouer chaque `moves.uci` avec `python-chess` depuis la position initiale, ou
utiliser `chess.Board(move.fen_before)` puis pousser `move.uci`.

La source la plus locale et robuste pour un coup est:

1. lire `move.fen_before`;
2. construire `board = chess.Board(move.fen_before)`;
3. parser `move.uci`;
4. calculer `played_san = board.san(move)` si possible;
5. pousser le coup sur une copie pour obtenir `fen_after`.

## 5. Partie terminee

Une partie est reviewable si:

- `games.completed` est vrai;
- au moins 10 demi-coups existent.

Une partie en cours est refusee par V4.

## 6. Statuts existants

Il n'existe pas encore de table review. Les statuts existants sont:

- `games.completed` booleen;
- `games.result` nullable ou `"*"` pour fin manuelle;
- `position_analyses.status`: `pending`, `running`, `done`, `failed`.

## 7. Fin manuelle

`POST /games/{game_id}/finish` appelle `GameRecorder.finish_game()`. Si aucun
resultat n'est donne et que la partie n'est pas mate/pat/etc., le resultat
stocke est `"*"`. Le champ `completed` passe a `1`.

## 8. Integration endpoints review

Emplacement naturel:

- routes FastAPI dans `backend/neurochess/api/game_routes.py`;
- service dedie a creer: `backend/neurochess/review_service.py`;
- dependance FastAPI proche de `get_analysis_service`.

Endpoints V4 a ajouter:

- `POST /games/{game_id}/review/generate`;
- `GET /games/{game_id}/review`.

## 9. Integration frontend

Emplacement naturel:

- types et clients dans `frontend/src/api/client.ts`;
- etat + handlers dans `frontend/src/App.tsx`;
- composant dedie minimal possible: `frontend/src/components/ReviewPanel.tsx`.

Le bouton "Voir la review" peut etre place pres de "Terminer partie". Il doit
etre visible seulement si la partie est terminee et contient au moins 10
demi-coups.

## 10. Tests susceptibles d'etre impactes

Backend:

- tests DB/migrations;
- tests API `test_game_api.py`;
- tests de logique moteur si les analyses deep sont manipulees.

Frontend:

- tests statiques dans `test_calibration_logic.py`, notamment recherche de
  termes interdits ou de champs UI.

Risque principal:

- creer une review a partir de shallow/live par erreur;
- prendre `top_moves` de `fen_after` au lieu de `fen_before`;
- afficher un vocabulaire interdit;
- laisser une generation partielle en DB en cas d'erreur.
