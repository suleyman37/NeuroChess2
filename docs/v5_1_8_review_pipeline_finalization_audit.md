# V5.1.8 - Audit finalisation pipeline Review

## Objectif

Auditer le flux reel Review apres les correctifs V5.1.4 a V5.1.7, avec le cas
observe :

- `reviewUiState = stalled`
- `review.status = stalled`
- `review_work_active = false`
- `scheduled_deep_count = 0`
- `failed_deep_count = 1`

Conclusion : le probleme n'est plus un spinner frontend seul. Le backend doit
finaliser clairement les cas `partial`, `no_significant_moments`, `pending`
actif ou `stalled/failed`.

## FEN necessaires

Pour une partie reviewable de `N` demi-coups, la review a besoin de :

- `fen_before` de chaque coup ;
- `fen_after` de chaque coup, reconstruit depuis `fen_before + uci`.

Cela donne `2 * N` references de FEN, mais les positions successives se
recouvrent. En pratique, une partie lineaire de `N` demi-coups utilise souvent
`N + 1` FEN uniques.

Exemple : une partie de 11 demi-coups peut demander 12 FEN uniques.

## Creation des analyses deep

Le pipeline construit les `MoveContext`, calcule les FEN requises, puis cherche
dans `position_analyses` une analyse :

- `analysis_kind = 'deep'`
- `status = 'done'`
- `schema_version = 'engine_analysis_v2'`

Si une FEN requise n'a pas de deep `done`, elle est comptee comme manquante.
`ReviewService._ensure_missing_deep_analyses()` appelle ensuite
`AnalysisService.get_or_create_analysis(..., kind='deep')` pour creer les lignes
`pending` absentes.

## Comptage done / pending / running / failed

`_coverage_for_contexts()` retourne les compteurs :

- `total_required_deep_count` : nombre de FEN uniques requises ;
- `analyzed_deep_count` : FEN avec analyse deep `done` ;
- `missing_deep_count` : FEN sans analyse deep `done` ;
- `scheduled_deep_count` : FEN avec analyse deep `pending` ou `running` ;
- `failed_deep_count` : FEN avec analyse deep `failed` ;
- `failed_deep_details` : FEN, status, message d'erreur, engine, depth,
  schema/version, dates disponibles ;
- `review_work_active` : vrai si au moins une deep requise est `pending` ou
  `running`.

## Pourquoi failed_deep_count peut etre > 0

Une analyse deep requise peut etre `failed` si :

- Stockfish est indisponible ;
- le budget temps moteur est depasse ;
- une FEN est invalide ou mal reconstruite ;
- une erreur moteur survient ;
- une ancienne tentative a laisse une ligne failed stale.

Avant V5.1.7/V5.1.8, le debug pouvait montrer seulement
`failed_deep_count = 1`, sans details suffisants. Le payload expose maintenant
`failed_deep_details`.

## Batch processing insuffisant

Avant V5.1.8, la route `POST /games/{game_id}/review/generate` planifiait :

```text
process_pending_analyses(limit=10)
```

Ce batch fixe peut etre insuffisant pour une review qui requiert plus de 10 FEN
uniques. Exemple : 11 demi-coups peuvent demander 12 FEN uniques.

Correctif V5.1.8 :

```text
limit = max(10, total_required_deep_count)
```

Le backend programme donc un batch au moins aussi grand que le nombre de FEN
requises par la review.

## Relance des failed

Si `force_retry_failed=true`, le backend :

- identifie les FEN requises dont la derniere analyse deep est `failed` ;
- remet ces lignes en `pending` ;
- nettoie `error_message` et `completed_at` ;
- retourne `pending` avec `review_work_active=true` si un vrai travail est
  programme.

La relance reste explicite : aucun retry automatique infini.

## Coverage

La couverture est calculee par coup reviewable :

```text
coverage = reviewable_context_count / total_context_count
```

Un coup est reviewable si `fen_before` et `fen_after` ont tous les deux une
analyse deep `done`.

Seuils :

- `REVIEW_FULL_COVERAGE_THRESHOLD = 0.95`
- `REVIEW_PARTIAL_COVERAGE_THRESHOLD = 0.70`

Si `coverage >= 0.70`, la review peut se finaliser en `partial` meme si une ou
plusieurs deep ont echoue.

## no_significant_moments

Quand `missing_deep_count = 0` et qu'aucun candidat ne depasse le seuil de
moment significatif :

```text
status = done
moments = []
empty_reason = "no_significant_moments"
```

Le message devient :

```text
Aucun moment majeur detecte : la partie est restee trop equilibree pour generer une review utile.
```

Ce cas ne doit jamais retourner `pending`.

## Cause racine V5.1.8

La cause residuelle principale etait le batch background fixe a 10 analyses.
Il pouvait etre trop petit pour traiter toutes les FEN requises par une review,
ce qui renforcait les situations `pending/stalled` difficiles a comprendre.

Le pipeline distingue maintenant :

- pending reel : travail `pending/running` actif ;
- stalled/failed : pas de travail actif, details failed exposes ;
- partial : couverture suffisante malgre certaines FEN failed/manquantes ;
- no_significant_moments : analyse terminee sans coup significatif.
