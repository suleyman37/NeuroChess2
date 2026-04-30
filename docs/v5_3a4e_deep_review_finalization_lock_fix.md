# V5.3.A4e - Deep Review Finalization Lock Fix

## Objectif

Rendre une analyse Review approfondie robuste jusqu'a 100 %, en particulier
lorsque toutes les positions sont presque analysees et que la Review finale doit
etre construite.

## Etat `finalizing`

`review_jobs.status` accepte maintenant :

- `queued`
- `running`
- `finalizing`
- `completed`
- `failed`
- `cancelled`
- `incomplete`

Quand toutes les positions requises sont disponibles mais que `game_reviews` et
`review_moments` ne sont pas encore reconstruits, le job passe par
`finalizing`.

L'UI affiche :

- `Finalisation de la Review...`
- progression a 100 %
- aucun score/moment tant que le job n'est pas `completed`.

## Finalisation idempotente

`ReviewJobService.finalize_review_job(job_id)` peut etre appele plusieurs fois.

Comportement :

1. Recharger le job.
2. Recalculer la couverture via le cache quality gate du profil.
3. Si des positions manquent, rester `running` ou `incomplete`.
4. Si toutes les positions sont disponibles, passer `finalizing`.
5. Appeler la generation Review.
6. Passer `completed` seulement si la couverture est encore complete.

Si le job est deja `completed`, la fonction retourne simplement le payload du
job. Un double appel ne duplique pas `game_reviews` ni `review_moments`.

## Transactions courtes

La selection des moments est calculee en memoire avant l'ecriture finale.

La transaction courte de finalisation couvre uniquement :

- suppression de la Review courante du `game_id` ;
- insertion de `game_reviews` ;
- insertion de `review_moments` ;
- update final du statut Review ;
- commit.

Stockfish n'est jamais appele dans cette transaction.

## SQLite write coordinator

Les writes critiques passent par `execute_sqlite_write_with_retry(...)`, qui :

- utilise un `threading.RLock` global cote backend ;
- applique un retry/backoff sur `database is locked` ;
- garde les lectures simples hors lock ;
- ne couvre pas les appels Stockfish.

Les connexions appliquent a chaque ouverture :

- `PRAGMA journal_mode=WAL`;
- `PRAGMA synchronous=NORMAL`;
- `PRAGMA busy_timeout=30000`;
- `PRAGMA foreign_keys=ON`.

## GET job status read-only

`GET /review/jobs/{job_id}` ne met plus a jour la base. Il lit le job, recalcule
la couverture pour le payload, et retourne l'etat sans ecriture de type
progress/last_seen.

Cela reduit la pression SQLite pendant la finalisation.

## Reprendre

Cas `88/89` :

- `Reprendre` relance un job normal sans `force_reanalysis` ;
- les positions deja done restent valides ;
- seule la position manquante ou failed est reprise ;
- le job passe ensuite en `finalizing`, puis `completed`.

Cas `89/89` mais Review finale absente :

- `Reprendre` ne relance pas Stockfish ;
- `finalize_review_job()` reconstruit directement `game_reviews` /
  `review_moments` ;
- le job devient `completed`.

Cas lock retryable :

- message principal lisible ;
- `retryable=true` ;
- l'erreur brute reste dans le debug technique.

## Test navigateur

1. Lancer une analyse approfondie sur la partie qui echouait a `88/89`.
2. Verifier la progression jusqu'a `89/89`.
3. Verifier le passage eventuel par `Finalisation de la Review...`.
4. Verifier que les scores/moments apparaissent seulement apres `completed`.
5. Si un lock est reproduit, cliquer `Reprendre` et verifier que l'analyse ne
   repart pas de zero.
6. Ouvrir deux onglets et relancer deep : le second doit retrouver le job actif
   plutot que creer un doublon.
7. Refresh pendant `finalizing` : l'etat doit etre restaure sans score partiel.

## Limites

- Le test navigateur reel reste necessaire pour confirmer la disparition du lock
  sur la machine utilisateur.
- L'annulation reste cooperative entre positions ; `finalizing` est trop court
  pour proposer une annulation utile.
- La serialisation est adaptee a l'application locale SQLite, pas a un backend
  multi-utilisateur.
