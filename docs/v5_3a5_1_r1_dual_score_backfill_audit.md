# V5.3.A5-1-R1 - Dual Score Backfill Audit

## Bug observe

Une Review complete `standard` avec `89/89` positions et confiance elevee
pouvait afficher :

- Accuracy Lichess-like disponible ;
- Score NeuroChess indisponible ;
- Ecart diagnostique indisponible.

## Cause

Le frontend acceptait encore les anciens champs `*_review_score` comme fallback
pour afficher l'accuracy publique. Si une reponse legacy ou restauree ne
contenait pas les nouveaux champs A5-1 `*_neuro_score` et
`*_diagnostic_gap`, l'UI affichait une accuracy via l'alias, puis affichait
`non disponible` pour les nouveaux scores sans expliquer la situation.

Cote backend, les metriques duales sont reconstructibles depuis les
`position_analyses` existantes : il n'est pas necessaire de relancer Stockfish.
Le probleme est donc un probleme de backfill/compatibilite de payload, pas de
calcul moteur.

## Points verifies

- Les analyses standard/deep completees contiennent deja les evals before/after.
- `review_service.py` peut reconstruire les scores via `_review_score_payload`.
- Il n'existe pas de colonne `score_json` persistante dans `game_reviews`.
- Les scores sont donc reconstruits a la lecture ou via endpoint explicite.
- Aucun appel moteur n'est necessaire pour reconstruire :
  - `lichess_like_accuracy` ;
  - `neuro_score` ;
  - `diagnostic_gap` ;
  - `review_evidence`.

## Decision

- Ajouter un rebuild explicite `POST /games/{game_id}/review/rebuild-metrics`.
- Garder le GET Review capable de retourner les metriques recalculees.
- Ajouter `score_availability` pour expliquer les absences.
- Marquer `*_review_score` comme alias legacy de `lichess_like_accuracy`.
- En UI, afficher un message et un bouton de rebuild si une Review complete a
  une accuracy legacy mais pas de NeuroScore.
