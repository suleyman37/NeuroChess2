# V3.5 Audit - Durable Analysis Pipeline

Audit réalisé avant la migration `0002_v3_5_durable_analysis_pipeline`.
La base locale `neurochess.db` contenait `0` ligne dans `position_analyses`.
La migration vérifie transactionnellement que le nombre de lignes avant/après rebuild
est identique; sur cette base locale, le résultat attendu et vérifié est `0 -> 0`.

## Schéma Actuel Avant V3.5

### `games`

Colonnes:

| Colonne | Type | NOT NULL | Défaut | Contraintes |
| --- | --- | --- | --- | --- |
| `id` | INTEGER | non | aucun | PRIMARY KEY AUTOINCREMENT |
| `created_at` | TEXT | oui | aucun | |
| `completed_at` | TEXT | non | NULL | |
| `mode` | TEXT | oui | aucun | |
| `opponent_type` | TEXT | non | NULL | |
| `opponent_level` | INTEGER | non | NULL | |
| `result` | TEXT | non | NULL | |
| `pgn` | TEXT | non | NULL | |
| `completed` | INTEGER | oui | `0` | |

Index: aucun index explicite.  
Clés étrangères: aucune.

### `moves`

Colonnes:

| Colonne | Type | NOT NULL | Défaut | Contraintes |
| --- | --- | --- | --- | --- |
| `id` | INTEGER | non | aucun | PRIMARY KEY AUTOINCREMENT |
| `game_id` | INTEGER | oui | aucun | FK vers `games(id)` |
| `ply` | INTEGER | oui | aucun | |
| `fen_before` | TEXT | oui | aucun | |
| `uci` | TEXT | oui | aucun | |
| `san` | TEXT | oui | aucun | |
| `is_player` | INTEGER | oui | aucun | |
| `time_spent` | REAL | non | NULL | |
| `eval_before_cp` | INTEGER | non | NULL | |
| `eval_after_cp` | INTEGER | non | NULL | |
| `best_move_uci` | TEXT | non | NULL | |
| `cp_loss` | INTEGER | non | NULL | |
| `classification` | TEXT | non | NULL | |
| `created_at` | TEXT | oui | aucun | |

Index:

- `idx_moves_game_id` sur `(game_id)`.
- `idx_moves_game_id_ply` sur `(game_id, ply)`.

Clés étrangères:

- `game_id` référence `games(id)`.

### `position_analyses`

Colonnes:

| Colonne | Type | NOT NULL | Défaut | Contraintes |
| --- | --- | --- | --- | --- |
| `id` | INTEGER | non | aucun | PRIMARY KEY AUTOINCREMENT |
| `fen` | TEXT | oui | aucun | |
| `analysis_json` | TEXT | oui | aucun | |
| `engine` | TEXT | non | NULL | |
| `depth` | INTEGER | non | NULL | |
| `schema_version` | TEXT | oui | aucun | |
| `created_at` | TEXT | oui | aucun | |

Index:

- `idx_position_analyses_fen` sur `(fen)`.

Contraintes:

- Pas d'index unique d'idempotence.
- Pas de contrainte sur le statut ou le type d'analyse.

## Champs Déjà Utiles Pour V3.5

- `position_analyses.fen`: clé de position.
- `position_analyses.analysis_json`: stockage du contenu riche, dont `top_moves`.
- `position_analyses.engine`: couvre le besoin `engine`; ne pas créer `engine_name`.
- `position_analyses.depth`: couvre le besoin `analysis_depth`; ne pas créer de doublon.
- `position_analyses.schema_version`: couvre le besoin `analysis_schema_version`; ne pas créer de doublon.
- `position_analyses.created_at`: ordre FIFO pour `process_pending_analyses`.

## Champs À Ajouter

Sur `position_analyses`:

- `engine_version TEXT NOT NULL DEFAULT 'unknown'`
- `multipv INTEGER NOT NULL DEFAULT 3`
- `analysis_time_ms INTEGER`
- `reliability_score REAL`
- `reliability_label TEXT`
- `status TEXT NOT NULL DEFAULT 'pending'`
- `error_message TEXT`
- `completed_at TIMESTAMP`
- `analysis_kind TEXT NOT NULL DEFAULT 'deep'`

`analysis_json` et `schema_version` existent déjà et ne sont pas dupliqués.

Sur `moves`:

- `annotations TEXT NOT NULL DEFAULT '{}'`

## Incohérences Détectées

- `engine` et `depth` existent déjà mais sont nullable; ils doivent être `NOT NULL`
  pour que l'index unique soit fiable avec SQLite.
- `analysis_json` n'a pas de défaut avant V3.5; les nouvelles lignes pending doivent
  pouvoir stocker `{}`.
- Aucun statut ne distingue `pending`, `running`, `done`, `failed`.
- Aucun champ ne sépare `shallow` et `deep`.
- Aucun index unique ne protège l'idempotence des analyses.
- Les anciennes analyses `v0` peuvent contenir un JSON non canonique; elles sont
  préservées avec leur `schema_version` existant et ne sont pas converties en
  analyse `engine_analysis_v2`.
- Si plusieurs anciennes lignes deviennent identiques sous la nouvelle clé unique,
  la migration conserve toutes les lignes et attribue `engine_version='unknown'`
  à la première, puis `unknown-legacy-<id>` aux doublons historiques.

## Stratégie De Migration

SQLite ne permet pas de transformer directement `engine` et `depth` en
`NOT NULL DEFAULT` avec un simple `ALTER COLUMN`. La migration V3.5 reconstruit
uniquement `position_analyses` dans une transaction:

1. compter les lignes existantes;
2. renommer l'ancienne table;
3. créer la table V3.5 stricte;
4. copier toutes les lignes en préservant `id`, `fen`, `analysis_json`, `engine`,
   `depth`, `schema_version`, `created_at`;
5. vérifier que le nombre de lignes après copie est identique;
6. recréer les index;
7. supprimer l'ancienne table seulement après vérification.

En cas d'erreur, `apply_migrations()` exécute `rollback()` et ne marque pas la
migration comme appliquée.

## Thread-Safety SQLite

Avant V3.5, le repository ouvre une connexion SQLite par opération et la ferme
immédiatement. Il n'y a pas de connexion globale partagée entre threads.

V3.5 conserve cette stratégie:

- une connexion SQLite par opération et par thread;
- pas de `check_same_thread=False`;
- `PRAGMA foreign_keys = ON`;
- `PRAGMA busy_timeout = 5000`;
- transactions courtes;
- idempotence par `INSERT OR IGNORE` puis `SELECT`, protégée par l'index unique.
