# Data Model V3.5

V3.5 stabilise la couche d'analyse moteur. Les colonnes SQL servent à filtrer,
indexer et joindre; le contenu riche reste dans `position_analyses.analysis_json`.

## Position Analyses

Clé d'idempotence:

```sql
UNIQUE (
  fen,
  engine,
  engine_version,
  depth,
  multipv,
  analysis_kind,
  schema_version
)
```

Toutes les colonnes de cette clé sont `NOT NULL` avec défaut. SQLite considère
deux `NULL` comme distincts dans un index unique, donc V3.5 interdit `NULL` sur
ces champs.

Statuts autorisés:

- `pending`
- `running`
- `done`
- `failed`

Types d'analyse:

- `shallow`: analyse immédiate pour l'évaluation visible pendant le jeu.
- `deep`: analyse durable pour lecture future.

V4+ ne doit lire que `analysis_kind='deep' AND status='done'`.

## Format `analysis_json`

Pour `status='done'`, le JSON canonique est:

```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  "engine": "stockfish",
  "engine_version": "unknown",
  "depth": 12,
  "multipv": 3,
  "analysis_kind": "deep",
  "eval_cp": 35,
  "mate_in": null,
  "top_moves": [
    {
      "rank": 1,
      "uci": "e7e5",
      "eval_cp": 35,
      "eval_pov_side_to_move_cp": -35,
      "mate_in": null,
      "pv": ["e7e5", "g1f3"]
    }
  ],
  "schema_version": "engine_analysis_v2",
  "analysis_time_ms": 850
}
```

`top_moves`, `mate_in`, `eval_cp`, `eval_pov_side_to_move_cp` et `pv` ne sont
pas des colonnes SQL séparées.

## POV CP

`eval_cp` est toujours du point de vue des Blancs.

- `eval_cp > 0`: avantage Blancs.
- `eval_cp < 0`: avantage Noirs.
- `eval_cp = 0`: position égale selon l'analyse.

`eval_pov_side_to_move_cp` est dérivé pour chaque ligne:

- si les Blancs sont au trait: `eval_pov_side_to_move_cp = eval_cp`;
- si les Noirs sont au trait: `eval_pov_side_to_move_cp = -eval_cp`.

Exemple: si les Blancs ont `+35` mais que les Noirs sont au trait,
`eval_cp=35` et `eval_pov_side_to_move_cp=-35`.

## POV Mate

`mate_in` est toujours du point de vue des Blancs.

- `mate_in > 0`: les Blancs matent.
- `mate_in < 0`: les Blancs se font mater.
- `mate_in = null`: pas de mat forcé annoncé.

## PV

La PV V3.5 contient uniquement des coups UCI. Aucun SAN n'est stocké dans la PV.
Le SAN dans une PV est fragile avec `python-chess`, car il faut pousser les coups
un par un sur un board temporaire.

## Shallow Vs Deep

`shallow` et `deep` peuvent coexister pour la même FEN parce que
`analysis_kind` fait partie de la clé unique.

- `shallow`: `depth=8`, `multipv=1`, budget `300ms`, utilisé pour la barre
  d'évaluation immédiate.
- `deep`: `depth=12`, `multipv=3`, budget `5000ms`, stock durable.

`POST /games/{game_id}/moves` peut retourner une évaluation shallow. La réponse
ne doit pas attendre deep et ne contient aucune conclusion issue de deep.

## `moves.annotations`

`moves.annotations` est un JSON texte avec défaut `{}`. En V3.5 il reste vide et
aucun code métier ne le consomme.

## Versionnage `schema_version`

La version V3.5 est `engine_analysis_v2`.

Procédure de bump:

1. définir une nouvelle constante de version;
2. ajouter ou adapter les tests du format JSON;
3. garder les anciennes lignes lisibles par leur version;
4. ne pas réinterpréter silencieusement une ancienne version comme une nouvelle;
5. créer les nouvelles analyses avec la nouvelle `schema_version`, ce qui permet
   leur coexistence grâce à l'index unique.

## Idempotence Et Race Conditions

`get_or_create_analysis()` ne fait pas de check-then-insert non protégé. Il fait:

1. `INSERT OR IGNORE` avec la clé complète;
2. `SELECT` de la même clé.

Deux appels concurrents avec la même FEN et les mêmes paramètres créent une seule
ligne. Deux appels avec deux `schema_version` différentes créent deux lignes.

## Thread-Safety SQLite

NeuroChess utilise une connexion SQLite par opération/thread. V3.5 ne désactive
pas `check_same_thread` et ne partage pas une connexion globale.

Paramètres de connexion:

- `PRAGMA foreign_keys = ON`
- `PRAGMA busy_timeout = 5000`

Les écritures restent courtes et transactionnelles. La migration rebuild de
`position_analyses` vérifie le nombre de lignes avant/après et rollback en cas
d'erreur.
