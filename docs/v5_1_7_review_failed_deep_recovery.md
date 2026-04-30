# V5.1.7 — Review failed deep recovery

## Objectif

Corriger le cas où la Review reste bloquée en `stalled` parce qu'une analyse deep requise est en `failed`.

## États

- `pending` : des analyses deep sont manquantes et un vrai travail est actif.
- `stalled` : des analyses manquent, aucun travail n'est actif, et la couverture est insuffisante.
- `failed` : erreur explicite non récupérable ou erreur API.
- `partial` : assez de coups sont analysés pour afficher une review utile malgré certaines positions manquantes ou failed.
- `done` : couverture complète ou quasi complète.

## Règle de couverture

La couverture est calculée par coups reviewables :

```text
coverage = reviewable_moves / candidate_moves
```

Un coup est reviewable si :

- `fen_before` a une analyse deep `done` ;
- `fen_after` a une analyse deep `done`.

Seuils :

- `coverage >= 0.95` : `done`
- `0.70 <= coverage < 0.95` : `partial`
- `coverage < 0.70` + analyses `pending/running` : `pending`
- `coverage < 0.70` + failed sans travail actif : `stalled`

## No significant moments

Si la couverture est suffisante mais qu'aucun coup ne dépasse le seuil de moment Review :

- `status = "done"` ou `"partial"` selon couverture ;
- `moments = []` ;
- `empty_reason = "no_significant_moments"` ;
- message : `Aucun moment majeur détecté avec les analyses disponibles.`

La Review ne retourne pas `stalled` dans ce cas.

## failed_deep_details

Le payload expose maintenant les détails des analyses deep failed :

- `fen`
- `error_message`
- `status`
- `analysis_kind`
- `engine`
- `engine_version`
- `depth`
- `multipv`
- `schema_version`
- `created_at`
- `completed_at`

Exemple :

```json
{
  "fen": "...",
  "error_message": "time_budget_exceeded",
  "status": "failed",
  "analysis_kind": "deep"
}
```

## Retry explicite

Le bouton `Relancer l'analyse` appelle :

```http
POST /games/{game_id}/review/generate?force_retry_failed=true
```

Backend :

1. Identifie les analyses deep required en `failed`.
2. Les remet en `pending`.
3. Efface `error_message`.
4. Efface `completed_at`.
5. Retourne `pending` avec `scheduled_deep_count > 0` et `review_work_active=true`.
6. Lance `process_pending_analyses(10)` via `BackgroundTasks`.

Le retry est volontairement explicite. Il n'y a pas de boucle automatique infinie.

## Comportement UI

Si `status="stalled"` et `failed_deep_count > 0`, l'UI affiche :

`L'analyse approfondie a échoué sur une ou plusieurs positions.`

Bouton :

`Relancer l'analyse`

Si `status="partial"`, l'UI affiche les moments disponibles et une note :

`Review partielle : certaines positions n'ont pas pu être analysées.`

Si `empty_reason="no_significant_moments"`, l'UI affiche :

`Aucun moment majeur détecté avec les analyses disponibles.`

Sans spinner et sans bouton `Vérifier à nouveau`.

## Règle anti-fausse attente

Le message :

`L'analyse approfondie continue en arrière-plan. Vérifiez à nouveau dans quelques instants.`

ne peut apparaître que si :

- `review_work_active=true` ;
- et des analyses deep sont `pending/running`.

Si `review_work_active=false` avec `failed_deep_count > 0`, l'UI affiche l'échec deep, pas un message d'attente.

## Protocole de test manuel

1. Ouvrir une partie terminée avec une seule analyse deep failed mais couverture >= 0.70.
   - Attendu : Review `partial` ou `no_significant_moments`, pas `stalled`.
2. Ouvrir une partie avec couverture < 0.70 et failed deep.
   - Attendu : message d'échec deep + bouton `Relancer l'analyse`.
3. Cliquer `Relancer l'analyse`.
   - Attendu : POST avec `force_retry_failed=true`.
   - Attendu backend : failed remis en `pending`, `review_work_active=true`.
4. Si les analyses deviennent `done`, cliquer `Vérifier à nouveau` ou rouvrir Review.
   - Attendu : `GET /review` finalise en `done`, `partial` ou `no_significant_moments`.
5. Vérifier le bloc debug dev.
   - Attendu : `failed_deep_details` visible avec FEN et erreur.

## Validation

Commandes :

```powershell
python -m unittest discover backend/tests
```

```powershell
cd frontend
npm run build
```

Sur ce PC, si `python` ou `npm` ne sont pas installés globalement, utiliser le venv Python du repo et le runtime Node local.
