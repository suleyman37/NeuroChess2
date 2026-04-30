# V5.3.A - Audit Review Score

## Scope

Mission limitee au calcul mathematique et a l'affichage resume du score Review 0-100. Aucun changement historique, moteur, opening book, classification, criticity_score ou V6.

## Evaluations deep disponibles

- Les analyses deep sont stockees dans `position_analyses` avec `analysis_kind='deep'`, `status='done'` et `schema_version='engine_analysis_v2'`.
- `review_service.py` lit les analyses via `_deep_done_analysis()`.
- La valeur canonique Review est extraite par `_stable_eval_from_analysis_json()` :
  - `analysis_json.stabilized_eval.final_eval_cp` / `final_mate_in` si present ;
  - sinon fallback `analysis_json.eval_cp` / `mate_in`.
- La Review ne doit pas utiliser live, shallow ou currentFen pour le score.

## Donnees par coup

- Les coups sont reconstruits par `_build_move_contexts()` depuis la table `moves`.
- `fen_before`, `fen_after`, `played_uci`, `played_san` et `played_by` sont deduits de la position avant coup.
- Les coups scorables sont ceux dont `fen_before` et `fen_after` ont chacun une analyse deep done exploitable.

## Criticite disponible

- Les moments Review stockent `importance_score`.
- Dans l'algorithme courant, ce champ represente le `criticality_score`.
- Pour le score V5.3.A, les coups selectionnes comme moments peuvent donc recevoir un poids plus fort.
- Les coups sans moment explicite gardent `move_weight = 1.0`.

## Couleur utilisateur

- `games.user_color` existe depuis l'import PGN et peut valoir `white`, `black` ou `NULL`.
- Si `user_color` est connu, le payload peut exposer `user_review_score` et `opponent_review_score`.
- Sinon l'UI affiche les scores Blancs / Noirs.

## Frontend

- `ReviewPanel` affiche actuellement les messages d'etat Review et la liste des moments.
- Le resume de score doit etre ajoute en haut du panneau Review sans remplacer les cartes.
- Le toggle `Masquer l'evaluation` masque les barres, valeurs moteur et deltas, mais le score resume peut rester visible : il s'agit d'un resume de precision, pas d'une evaluation instantanee.

## Conclusion

V5.3.A peut etre implemente sans migration : les scores sont calcules a la volee dans le payload Review depuis les snapshots deep deja disponibles.
