# V5.2.x - Audit Review Criticality + Stable Review Bar

## Selection actuelle des moments

- La selection est centralisee dans `backend/neurochess/review_service.py`.
- Le pipeline construit des `MoveContext`, recupere les analyses `deep` `fen_before` et `fen_after`, puis selectionne les coups via Win% joueur, zones et `criticality_score`.
- Avant cette mission, un prefiltre `mover_win_loss >= 10` existait encore avant le calcul de criticite. Il pouvait exclure un coup dont la perte brute etait sous 10 mais dont la criticite ponderee meritait une carte.
- Avant cette mission, les candidats proches etaient seulement penalises par `novelty_weight`; ils pouvaient encore etre selectionnes ensemble.

## Source d'evaluation

- La Review backend lit uniquement des analyses `analysis_kind='deep'` et `status='done'`.
- `shallow`, `live` et `currentFen` ne sont pas utilises pour selectionner les moments Review.
- Si un `stabilized_eval` existe dans `analysis_json`, la Review utilise `final_eval_cp` / `final_mate_in`.
- Sinon, elle utilise le score final deep stocke dans `analysis_json`.

## Champs ReviewMoment existants

Le payload expose deja :

- `eval_before_cp`, `eval_after_cp`
- `mate_before`, `mate_after`
- `mover_win_loss`
- `criticality_score`
- `moment_type`
- `zone_before`, `zone_after`, `zone_transition`
- `eval_source_kind`
- `eval_depth_before`, `eval_depth_after`
- `reliability_score`, `reliability_label`

Pas de migration lourde necessaire.

## Barre Review

- La barre est calculee dans `frontend/src/App.tsx`.
- Avant cette mission, la barre Review utilisait deja les champs `eval_before_cp` / `eval_after_cp` du `ReviewMoment`.
- Le bouton `Voir sur l'echiquier` place l'echiquier sur `fen_before`, puis passe a `fen_after`.
- Avant cette mission, un effet pouvait encore lancer une session live en mode `REVIEW` ou `HISTORICAL`, meme si l'affichage Review lisait le snapshot du moment.

## Version d'algorithme

- Une version d'algorithme existe dans `SELECTION_ALGORITHM_VERSION`.
- Elle a ete rebasculee vers `moment_selection_criticality_v4` pour que les anciennes reviews ne soient pas reutilisees comme verite courante.

## Conclusion

La base Review etait deja proche du modele attendu, mais trois ecarts restaient :

1. filtrage candidat encore base sur la perte brute avant criticite ;
2. absence de temporal NMS strict ;
3. live analysis encore demarrable en mode Review/Historical cote frontend.
