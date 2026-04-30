# V5.3.A4c - Review job lifecycle

## Objectif

A4c met en place un cycle de vie explicite pour l'analyse Review :

- demarrer une analyse comme job asynchrone ;
- afficher une progression X/Y positions ;
- permettre l'annulation ;
- permettre une relance forcee ;
- interdire l'affichage d'une Review standard/deep partielle ;
- afficher scores et moments seulement quand l'analyse est complete a 100 %.

Aucune categorie de coups, aucun Study Mode, aucun V6 et aucun Syzygy Trainer
n'ont ete ajoutes.

## Endpoints

`POST /games/{game_id}/review/jobs`

Demarre un job Review et retourne rapidement :

```json
{
  "job_id": "...",
  "status": "queued",
  "profile": "standard",
  "required_position_count": 16,
  "completed_position_count": 0,
  "failed_position_count": 0,
  "percent": 0,
  "can_cancel": true
}
```

Body :

```json
{
  "profile": "quick | standard | deep",
  "force_reanalysis": false
}
```

`GET /review/jobs/{job_id}`

Retourne la progression courante : status, X/Y positions, pourcentage, budget,
temps ecoule, estimation restante, settings moteur et `review_pipeline_version`.

`POST /review/jobs/{job_id}/cancel`

Marque le job comme annule. L'interruption est cooperative : si Stockfish est
deja en train d'analyser une position, l'arret prend effet au plus tard apres la
position courante.

## Complete-only gate

Une Review finale standard/deep est visible seulement si :

- `completed_position_count == required_position_count` ;
- `failed_position_count == 0` ;
- `coverage == 1.0` ;
- le cache quality gate satisfait le profil demande ;
- le pipeline correspond a
  `review_pipeline_version = "v5_3_a4c_complete_only_review_v1"`.

Sinon, le backend retourne un etat d'analyse (`pending`, `incomplete` ou
`failed`) sans `moments` et sans scores utilisateur.

## Force reanalysis

`force_reanalysis=true` ignore le cache existant pour les FEN de la partie et
le profil demande. Les parties, coups et donnees PGN ne sont pas supprimes.
Les analyses de la partie sont remises en `pending` pour etre recalculees et la
Review finale precedente est invalidee.

## UI

Etats affiches par le panneau Review :

- No review : boutons `Analyser la partie`, `Standard recommande`,
  `Approfondie`.
- Running : `Analyse standard en cours`, barre de progression, X/Y positions,
  temps ecoule, estimation restante, settings Stockfish et bouton `Annuler`.
- Completed : `Analyse complete`, score/moments, boutons recalcul/reset.
- Incomplete : `Analyse incomplete`, X/Y positions, boutons reprendre/reset,
  sans score et sans moments.
- Failed : message d'echec lisible, reprise/reset, debug dev replie.
- Cancelled : `Analyse annulee`, reprise/reset.

## Tests manuels

1. Lancer une Review standard sur une partie sans cache standard.
2. Verifier que le POST retourne rapidement un `job_id`.
3. Verifier la progression X/Y positions.
4. Annuler pendant l'analyse et verifier qu'aucun score/moment partiel ne
   s'affiche.
5. Relancer depuis zero avec `force_reanalysis=true`.
6. Verifier qu'une ancienne analyse legacy/depth12 ne satisfait pas standard.
7. Verifier qu'une Review 12/16 reste incomplete et n'affiche pas les resultats.
8. Verifier qu'une Review 16/16 affiche les scores et les moments.

## Limites

- Le registry principal est persiste en SQLite via `review_jobs`, mais le
  traitement background reste local au process FastAPI.
- L'annulation est cooperative et non preemptive au milieu d'une position
  Stockfish.
