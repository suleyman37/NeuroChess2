# V5.2.z - Audit Review Playback + Barre + Toggle Evaluation

## Voir sur l'echiquier

- Le bouton Review appelle `handleShowReviewMoment(moment, index)` dans `frontend/src/App.tsx`.
- Le flux place deja l'echiquier sur `moment.fen_before`, positionne `reviewBarPhase="before"`, puis passe a `moment.fen_after` et `reviewBarPhase="after"` apres un court delai.
- La librairie `react-chessboard` recoit `animationDuration`; l'animation native est donc le chemin minimal retenu.
- Le coup precedent n'est pas rejoue aujourd'hui. Le fallback officiel reste `fen_before -> coup joue -> fen_after`.

## Donnees disponibles

- `ReviewMoment` expose `fen_before`, `fen_after`, `played_uci`, `best_move_uci`, `eval_before_cp`, `eval_after_cp`, `mate_before`, `mate_after`, `played_by`, `mover_win_loss` et `criticality_score`.
- Les coups importes ou locaux peuvent aussi etre lus via `moveHistory.moves`, mais cette mission ne depend pas du coup precedent.

## Barre Review

- La barre en mode `REVIEW` est calculee par `evaluationBarStateForBoardFen`.
- Elle utilise `reviewMomentEvaluation(moment, reviewBarPhase)`.
- `reviewMomentEvaluation` lit `eval_before_cp/mate_before` ou `eval_after_cp/mate_after`.
- La source UI est `review_deep_snapshot`.
- Le live/shallow n'est pas requis pour afficher la Review.

## Gestion mate

- `makeEvaluationDisplayFromEngineScore` sait convertir `mate_in > 0` en `white_percent=100` et `mate_in < 0` en `white_percent=0`.
- Un moment Review avec mate peut donc etre affiche sans `eval_cp`.
- Le risque restant etait surtout un test/contrat insuffisant autour du cas `mate_before` / `mate_after`.

## Toggle evaluation

- Aucun toggle global persistant n'existait avant cette mission.
- Le meilleur emplacement minimal est la barre d'actions globale.
- Le toggle doit masquer l'affichage de l'evaluation, pas les calculs internes.

## Debug visible

- Le debug Review est deja limite a `import.meta.env.DEV`.
- Aucun debug visible ne doit etre ajoute en production.
