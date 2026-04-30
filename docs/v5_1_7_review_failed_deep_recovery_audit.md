# V5.1.7 — Audit Review failed deep recovery

## Symptôme réel

Le debug frontend affichait :

- `reviewUiState = stalled`
- `review.status reçu = stalled`
- `review_work_active = false`
- `scheduled_deep_count = 0`
- `failed_deep_count = 1`

Conclusion : le spinner infini n'était plus la cause principale. La Review était bloquée parce qu'au moins une analyse deep requise était en `failed`, sans job actif pour la relancer.

## Où l'échec est stocké

Les analyses deep sont stockées dans `position_analyses`.

Colonnes utiles pour diagnostiquer un failed :

- `fen`
- `status`
- `analysis_kind`
- `error_message`
- `engine`
- `engine_version`
- `depth`
- `multipv`
- `schema_version`
- `created_at`
- `completed_at`

Pour la Review, seules les lignes suivantes sont pertinentes :

- `analysis_kind = "deep"`
- `schema_version = "engine_analysis_v2"`
- FEN présente dans les positions requises par la partie.

## Cause exacte

Avant V5.1.7, le payload exposait seulement `failed_deep_count`.

Il manquait :

- la liste des FEN en échec ;
- le message d'erreur associé ;
- une stratégie de retry explicite ;
- une sortie `partial` quand la couverture était déjà suffisante.

Résultat : une seule position failed pouvait maintenir toute la Review en `stalled`, même si la majorité des coups étaient déjà reviewables.

## Détail exposé

Le payload Review expose maintenant :

```json
"failed_deep_details": [
  {
    "fen": "...",
    "error_message": "...",
    "status": "failed",
    "analysis_kind": "deep",
    "engine": "stockfish",
    "engine_version": "unknown",
    "depth": 12,
    "multipv": 3,
    "schema_version": "engine_analysis_v2",
    "created_at": "...",
    "completed_at": "..."
  }
]
```

Ce détail permet de distinguer :

- FEN invalide ;
- timeout ;
- moteur indisponible ;
- tentative failed stale ;
- autre exception Stockfish ou système.

## Couverture par coups

La couverture Review est calculée par coups :

- `candidate_moves` = nombre total de coups de la partie ;
- `reviewable_moves` = coups dont `fen_before` et `fen_after` ont une analyse deep `done` ;
- `coverage = reviewable_moves / candidate_moves`.

Seuils :

- `coverage >= 0.95` : `done`
- `0.70 <= coverage < 0.95` : `partial`
- `coverage < 0.70` avec `pending/running` actif : `pending`
- `coverage < 0.70` sans travail actif et avec failed : `stalled`

## Bouton retry

Le bouton `Relancer l'analyse` ne doit pas seulement relire le même état.

V5.1.7 ajoute `force_retry_failed=true` sur `POST /games/{game_id}/review/generate`.

Quand ce flag est présent :

1. Les analyses deep required en `failed` sont remises en `pending`.
2. `error_message` est remis à `NULL`.
3. `completed_at` est remis à `NULL`.
4. Le payload retourne `pending` avec `review_work_active=true`.
5. L'endpoint lance `process_pending_analyses(10)` via `BackgroundTasks`.

## Conclusion

Le stalled observé venait d'une analyse deep failed non relancée. V5.1.7 rend ces échecs visibles, relançables, et non bloquants si la couverture permet une review partielle.
