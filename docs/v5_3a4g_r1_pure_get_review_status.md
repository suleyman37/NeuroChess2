# V5.3.A4g-R1 - Pure GET Review Status

## Objectif

Supprimer les mutations declenchees par le polling Review. Les endpoints GET
servent uniquement a lire l'etat courant et a calculer des indicateurs derives
en memoire.

## Contrat API

Read-only :

```text
GET /review/jobs/{job_id}
GET /review/jobs/{job_id}/diagnostics
```

Mutation explicite :

```text
POST /review/jobs/{job_id}/reconcile
```

Le POST `reconcile` peut appeler `reconcile_review_job(job_id)`, finaliser une
Review complete, ou marquer un job stale comme retryable/stalled.

## Champs derives

Le payload GET peut inclure :

- `derived_is_stale`
- `derived_needs_reconcile`
- `can_reconcile`
- `derived_reconcile_reason`

Ces champs n'ecrivent rien en base. Ils indiquent seulement que l'utilisateur ou
le frontend peut lancer une action explicite.

## Frontend

Le polling GET ne lance pas `POST reconcile` en boucle. Si un job a besoin d'une
verification explicite, l'UI affiche un etat propre et un bouton
`Verifier / reparer l'analyse`.

## Limites

`POST reconcile` ne remplace pas le flux de reprise complet. Si des positions
sont manquantes, le bouton `Reprendre` continue de relancer le job pour analyser
uniquement ce qui manque.
