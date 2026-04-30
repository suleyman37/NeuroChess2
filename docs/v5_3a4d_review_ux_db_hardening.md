# V5.3.A4d - Review UX/DB Hardening

## Objectif

Durcir le cycle Review apres les jobs asynchrones V5.3.A4c :

- eviter les echecs `database is locked` en fin d'analyse ;
- suspendre l'analyse live pendant l'onglet Review ;
- restaurer l'etat apres refresh navigateur ;
- permettre `Relancer depuis zero` avec choix Standard/Approfondie ;
- cacher `quick` de l'UI normale ;
- garder le complete-only : pas de score ni moments tant que la Review n'est pas
  complete a 100 %.

## Cause probable du lock SQLite

Le pipeline Review ecrit beaucoup de petites mises a jour :

- passage `pending -> running -> done` sur `position_analyses` ;
- progression `review_jobs` ;
- polling frontend frequent ;
- live encore actif pendant l'onglet Review.

SQLite n'aime pas plusieurs writers concurrents. Sans WAL, avec un
`busy_timeout` court et sans retry explicite, un write transitoirement bloque
pouvait finir en `OperationalError('database is locked')`, par exemple a 88/89
positions.

## Mesures SQLite

Les connexions projet appliquent maintenant :

- `PRAGMA journal_mode=WAL`;
- `PRAGMA synchronous=NORMAL`;
- `PRAGMA busy_timeout=15000`;
- `PRAGMA foreign_keys=ON`.

Les ecritures courtes critiques passent par `execute_with_retry(...)` avec
backoff progressif en cas de verrou SQLite temporaire.

Les appels Stockfish restent hors transaction longue : le job selectionne une
analyse, ferme la transaction, laisse Stockfish calculer, puis rouvre une
transaction courte pour ecrire le resultat.

## Jobs Review

Un demarrage de job standard/deep verifie d'abord s'il existe deja un job
`queued` ou `running` pour le meme `game_id` et le meme profil. Si oui, le
backend retourne ce job au lieu d'en creer un second.

`force_reanalysis=true` annule les jobs actifs du meme jeu/profil, ignore le
cache courant pour les FEN de la partie, et cree un nouveau job propre.

Les echecs de lock sont maintenant exposes proprement :

- message utilisateur : `Analyse interrompue par un verrou temporaire de la base locale.`
- `failed_reason = sqlite_locked`
- `retryable = true`
- erreur brute conservee dans `last_error` pour debug replie.

## Reprendre

`Reprendre` relance un job sans `force_reanalysis`. Les positions deja valides
restent en cache ; le pipeline reprogramme les positions manquantes ou failed.
Une erreur a 88/89 ne produit donc pas de Review finale, mais peut etre reprise.

## Relancer Depuis Zero

Le bouton `Relancer depuis zero` ouvre un choix explicite :

- Standard recommandee ;
- Approfondie.

Le profil `quick` reste interne/debug et n'est plus propose dans l'UI normale.

## Live Suspendu En Review

Quand `activeTab === "review"` ou qu'un job Review est `queued/running` :

- aucune nouvelle analyse live n'est lancee ;
- la session live courante est arretee ;
- l'UI affiche `Live suspendu pendant la Review` ;
- les positions explorees en Review ne retombent pas sur le live comme fallback.

Le live peut reprendre quand l'utilisateur quitte l'onglet Review.

## Refresh Navigateur

Le frontend persiste dans `localStorage` :

- `gameId` courant ;
- onglet actif ;
- ply affiche ;
- `activeReviewJobId` ;
- dernier profil Review demande.

Au demarrage, l'app recharge la partie, restaure l'onglet Review si besoin,
retrouve le job via `GET /review/jobs/{job_id}`, reprend le polling si le job
tourne encore, ou charge la Review finale si le job est termine.

## Complete-Only

Une Review incomplete, failed ou cancelled n'affiche pas score/moments dans
l'interface normale. L'utilisateur voit seulement l'etat du job, la progression,
et les actions `Reprendre` / `Relancer depuis zero`.

## Checklist Navigateur

1. Lancer une analyse deep sur une partie longue.
2. Verifier qu'il n'y a plus d'erreur principale `OperationalError(...)`.
3. Si un lock transitoire arrive, verifier le message utilisateur et `Reprendre`.
4. Explorer les coups dans l'onglet Review : verifier que le live est suspendu.
5. Lancer une analyse, faire F5, verifier que l'onglet Review et le job sont
   restaures.
6. Cliquer `Relancer depuis zero`, choisir Standard puis Approfondie.
7. Verifier que `Rapide` n'est plus propose dans l'UI normale.

## Limites

- La restauration est locale navigateur via `localStorage`, pas une route URL
  complete.
- L'annulation reste cooperative entre positions.
- La serialisation est au minimum par `game_id` et profil actif ; elle evite le
  double lancement local le plus courant sans refondre toute l'architecture.
