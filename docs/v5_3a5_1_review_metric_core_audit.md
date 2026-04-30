# V5.3.A5-1 - Review Metric Core Audit

## Etat avant changement

- Le score Review 0-100 etait calcule dans `backend/neurochess/review_service.py`.
- La version exposee etait issue de la famille `neuro_review_score_v1_1`.
- Le score melangeait plusieurs composants diagnostiques : moyenne ponderee,
  harmonic, worst-tail et cap par pire perte.
- Les champs publics `white_review_score`, `black_review_score`,
  `user_review_score` et `opponent_review_score` exposaient ce score unique.
- Les audits par coup existaient deja via `review_score_audit_rows`.
- Le frontend affichait le resume dans `ReviewPanel`.

## Limites constatees

- Le score public et le score diagnostique etaient confondus.
- La formule publique pouvait etre interpretee comme une accuracy neutre alors
  qu'elle contenait des penalites NeuroChess.
- La logique etait concentree dans `review_service.py`, donc moins testable que
  des helpers purs.
- Les futures explications IA n'avaient pas encore de contrat evidence
  versionne, meme si aucun LLM ne doit etre appele maintenant.

## Sources confirmees

- Les evaluations utilisees pour scorer restent les snapshots Review
  standard/deep deja gates par A4.
- Le score ne s'appuie pas sur live, shallow, currentFen ou eval UI courante.
- `eval_cp` reste en POV Blancs et `mate_in` reste separe.
- Les Reviews incompletes/finalizing/stalled restent gatees par le pipeline A4 :
  elles ne doivent pas exposer score ou moments comme resultat final.

## Decision d'implementation

- Centraliser les formules dans `backend/neurochess/metrics/review_metrics.py`.
- Exposer deux scores separes :
  - `lichess_like_accuracy`, neutre et public ;
  - `neuro_score`, diagnostique et regulier.
- Garder les anciens champs `*_review_score` comme alias de l'accuracy publique
  pour compatibilite de payload.
- Ajouter un `diagnostic_gap = lichess_like_accuracy - neuro_score`.
- Ajouter un contrat minimal `review_evidence_v1` sans appel LLM.
