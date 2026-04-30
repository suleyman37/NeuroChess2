# V5.1.6 — Audit du pipeline de génération Review

## Contexte

Le spinner Review avait été limité côté frontend, mais le flux pouvait encore rester dans une boucle utilisateur :

- `Analyse approfondie en cours...`
- puis `L’analyse approfondie continue en arrière-plan. Vérifiez à nouveau dans quelques instants.`
- puis clics répétés sur le bouton de vérification sans résultat clair.

Le problème n’était donc plus seulement visuel. Il fallait vérifier si le backend lançait réellement les analyses deep manquantes et si `GET /games/{game_id}/review` pouvait finaliser une review prête.

## Flux backend audité

### POST `/games/{game_id}/review/generate`

Fonction principale : `ReviewService.generate_review(game_id)`.

Flux réel :

1. Charge la partie et ses coups.
2. Refuse les parties trop courtes avec `status="not_reviewable"` si `half_moves_count <= 10`.
3. Construit les positions nécessaires à la review :
   - `fen_before` de chaque coup ;
   - `fen_after` de chaque coup ;
   - dédoublonnage des FEN requis.
4. Vérifie les analyses deep `done` dans `position_analyses`.
5. Si des analyses manquent, crée une `game_review` en `pending`.
6. Les FEN manquantes doivent être créées via `AnalysisService.get_or_create_analysis(... kind="deep")`.
7. L’endpoint FastAPI programme ensuite `AnalysisService.process_pending_analyses(10)` en `BackgroundTasks` seulement si le payload est encore `pending`.

### GET `/games/{game_id}/review`

Fonction principale : `ReviewService.get_review(game_id)`.

Flux attendu après V5.1.6 :

1. Recalcule les analyses deep manquantes depuis `position_analyses`.
2. Si la review stockée est `pending` mais que `missing_deep_count == 0`, elle ne doit pas rester pending.
3. Elle sélectionne les moments Review.
4. Si aucun moment significatif n’existe, elle retourne :
   - `status="done"` ;
   - `moments=[]` ;
   - `empty_reason="no_significant_moments"`.

## Cause exacte trouvée

Avant V5.1.6, `pending` pouvait être trop ambigu :

- le payload n’exposait pas si des analyses deep étaient réellement planifiées ;
- `missing_deep_count > 0` ne disait pas si des lignes `position_analyses` existaient en `pending/running` ;
- une ancienne review `pending` pouvait rester lisible tant que la couverture n’était pas jugée suffisante ;
- le frontend ne pouvait pas distinguer un vrai travail backend actif d’un état bloqué.

La conséquence UX était un `pending_background` qui suggérait qu’un travail continuait, même sans preuve explicite qu’un job deep actif existait.

## État des analyses deep

V5.1.6 distingue maintenant :

- `analyzed_deep_count` : FEN requis avec analyse deep `done`.
- `missing_deep_count` : FEN requis sans analyse deep `done`.
- `scheduled_deep_count` : FEN requis avec analyse deep `pending` ou `running`.
- `failed_deep_count` : FEN requis avec dernière analyse deep `failed`.
- `review_work_active` : `true` seulement si `scheduled_deep_count > 0`.

## Règle auditée

`pending` est valide seulement si :

- `missing_deep_count > 0` ;
- des analyses deep manquantes ont été créées ou retrouvées ;
- `review_work_active=true`.

Si `missing_deep_count > 0` mais `review_work_active=false`, l’état Review devient `stalled` avec le message :

`L’analyse approfondie n’a pas pu être lancée. Réessayez plus tard.`

## Boutons frontend

- `Vérifier à nouveau` fait uniquement `GET /review`.
- `Relancer l’analyse` fait `POST /review/generate` via l’action de génération existante, seulement sur état bloqué/erreur.

## Conclusion

Le bug n’était pas seulement le spinner. La faiblesse était l’absence de preuve explicite qu’un `pending` correspondait à un vrai travail deep actif. V5.1.6 ajoute cette preuve dans le payload et empêche le frontend d’afficher une analyse en arrière-plan quand `review_work_active=false`.
