# V5.3.A4g-R1 - Pure GET Review Status Audit

## Constats

- `GET /review/jobs/{job_id}` appelait `ReviewJobService.get_job()`.
- `get_job()` recalculait la couverture, puis pouvait muter la base :
  - `reconcile_review_job(job_id)` si un job `completed` n'avait plus de Review finale ;
  - `finalize_review_job(job_id)` si la couverture etait complete ;
  - `_mark_job_stalled(...)` si le watchdog detectait un job bloque.
- `GET /review/jobs/{job_id}/diagnostics` etait deja concu comme diagnostic read-only,
  avec calculs de couverture et de watchdog en memoire.
- Le frontend pollait `GET /review/jobs/{job_id}` pour suivre la progression. Toute
  mutation cachee dans ce GET pouvait donc recreer de la pression SQLite pendant le
  polling.

## Cause de la reserve

Le statut GET ne faisait plus de write de progression, mais conservait une
reparation watchdog indirecte. Cela contredisait la regle produit : un polling
GET ne doit jamais debloquer, finaliser, marquer stalled ou ecrire un event.

## Decision

Les endpoints GET Review deviennent strictement read-only. Ils peuvent retourner
des champs derives (`derived_is_stale`, `derived_needs_reconcile`,
`can_reconcile`, `derived_reconcile_reason`), mais la mutation passe uniquement
par le worker ou par `POST /review/jobs/{job_id}/reconcile`.
