# V5.3.A4g - Audit Review Regression Harness

## Scope

Audit court des corrections V5.3.A4e/A4f autour des jobs Review, du moteur et de
SQLite. Cette mission ne change pas la formule de score et n'ajoute aucune
feature V5.3.B/V6.

## Points verifies

- `review_job_service.py` expose deja `finalizing`, `stalled`,
  `finalize_review_job(job_id)` et `reconcile_review_job(job_id)`.
- La finalisation est idempotente : une seconde execution remplace la Review du
  game courant sans dupliquer `review_moments`.
- La couverture est recalculee depuis `position_analyses` via
  `_current_coverage_details`, pas seulement depuis les compteurs stockes.
- Un job a 89/89 analyses peut finaliser meme si son compteur stocke indique
  88/89.
- Un job running sans pending utilisable est marque `stalled`/retryable.
- Les positions terminales sont traitees sans Stockfish avec
  `analysis_limit_mode="terminal"`.
- MultiPV est deja clampe au nombre de coups legaux avant l'appel moteur.
- Le frontend suspend le live si `activeTab === "review"` ou si un job Review
  est `queued/running/finalizing`.
- Le refresh restaure `gameId`, onglet, position et `activeReviewJobId` depuis
  `localStorage`.
- Les scores et moments restent caches tant que le job n'est pas `completed`.

## Manques trouves

- Le backend rejetait les FEN qui ne parsait pas, mais ne verifiait pas encore
  `board.is_valid()` avant Stockfish.
- Le retry SQLite utilisait un backoff fixe, sans jitter.
- Il manquait un fake engine deterministe configurable par environnement pour
  reproduire les bugs 88/89 sans Stockfish reel.
- Il manquait un endpoint Diagnostic Pack copiable pour un job Review.
- Il manquait un smoke test reproductible couvrant progression, refresh-style
  restore, last-position hang, reprise et completion.

## Note GET job status

Le polling normal de `GET /review/jobs/{job_id}` ne fait pas de write de
progression. Le service garde toutefois une transition de reparation quand un
watchdog detecte un job stale ou une couverture complete a finaliser, afin
d'eviter un `running` infini. Le Diagnostic Pack ajoute un chemin strictement
read-only pour observer l'etat complet sans mutation.

## Conclusion

Les protections A4e/A4f etaient majoritairement presentes. A4g durcit les
dernieres zones non couvertes par tests : fake engine, validite FEN complete,
retry jitter, diagnostics et smoke de regression.
