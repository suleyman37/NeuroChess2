# V5.2.4 - Audit Review Stabilized Snapshots

## Objectif

Verifier comment les evaluations Stockfish utilisees par la Review sont
produites, stockees et relues, puis identifier pourquoi une evaluation trop
rapide pouvait encore influencer un moment Review.

## Appel Stockfish avant V5.2.4

- `backend/neurochess/engines/stockfish_service.py` appelait
  `engine.analyse()` via `StockfishService.analyze_fen`.
- Le service recuperait surtout le resultat final retourne par
  `python-chess`, avec `eval_cp`, `mate_in`, `pv` et `top_moves`.
- Le streaming `engine.analysis()` n'etait pas utilise dans le pipeline deep
  courant.
- Les metadonnees accessibles cote Stockfish incluent au minimum, selon le
  type d'appel : `depth`, `seldepth`, `nodes`, `time`, `score`, `pv`.
- Le code de calibration lisait deja `depth_reached`, `seldepth`, `nodes` et
  `time_ms`, mais les analyses deep persistantes ne les exposaient pas comme
  snapshot de stabilite.

## Donnees utilisees par Review avant V5.2.4

- `ReviewService` lit uniquement des analyses `analysis_kind="deep"` avec
  `status="done"`.
- La selection de moments utilise `analysis_json.eval_cp` et
  `analysis_json.mate_in` pour `fen_before` et `fen_after`.
- Les analyses shallow/live ne sont pas utilisees pour selectionner les moments.
- La barre Review affichait l'evaluation stockee dans le moment de review, mais
  gardait un fallback vers l'analyse de position si l'evaluation du moment etait
  absente.

## Risque identifie

Une ligne Stockfish peut passer par plusieurs evaluations pendant les premieres
centaines de millisecondes. Sans snapshot stabilise :

- on ne sait pas si le score final etait stable dans la fenetre finale ;
- on ne distingue pas une evaluation convergente d'une evaluation encore
  oscillante ;
- la Review ne peut pas penaliser les candidats dont l'evaluation est fragile ;
- une ancienne analyse deep sans metadonnees de stabilite peut continuer a etre
  interpretee comme aussi fiable qu'une analyse stable.

## Correction retenue

V5.2.4 ajoute un snapshot stabilise dans `analysis_json.stabilized_eval` pour
les analyses deep :

- le score canonique reste le score final Stockfish ;
- une fenetre finale mesure la stabilite ;
- `reliability_score` et `reliability_label` sont stockes avec le snapshot ;
- la Review lit `final_eval_cp` et `final_mate_in` si le snapshot existe ;
- la criticite est ponderee par la fiabilite ;
- la barre Review exige la source `review_stabilized_deep`.

## Limite assumee

La passe 2 scan/confirmation complete n'est pas encore implementee. V5.2.4
installe le minimum robuste : un snapshot stabilise pour les deep analyses
utilisees par Review. La passe de confirmation des candidats instables reste une
etape suivante possible.
