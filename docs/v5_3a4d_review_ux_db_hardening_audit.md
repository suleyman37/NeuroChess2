# V5.3.A4d - Audit rapide UX/DB Review

## Backend

- `review_job_service.start_job()` creait un nouveau `review_jobs` a chaque
  clic, sans reutiliser un job `queued/running` pour le meme jeu/profil.
- Les jobs Review utilisent des connexions courtes et ne gardent pas une
  transaction ouverte pendant Stockfish : la selection de l'analyse suivante est
  faite en base, puis `analysis_service.run_analysis()` calcule hors transaction.
- Les ecritures `position_analyses` et `review_jobs` n'avaient pas de retry
  explicite en cas de lock SQLite.
- `get_connection()` activait seulement `foreign_keys` et `busy_timeout=5000`,
  sans WAL ni `synchronous=NORMAL`.
- `GET /review/jobs/{job_id}` est read-only sauf rafraichissement derive de la
  progression du job ; le polling ne declenche pas d'analyse Stockfish.
- Une erreur `OperationalError('database is locked')` etait stockee comme message
  brut et remontait dans l'UI principale.

## Frontend

- L'etat `activeTab`, `gameId`, `reviewJob` et `displayedPositionPly` etait
  uniquement en memoire React. Un refresh perdait donc l'onglet Review et le job
  actif.
- Le live etait stoppe uniquement lorsque `positionMode === "REVIEW"`. Dans
  l'onglet Review, une navigation normale pouvait repasser en `HISTORICAL` ou
  `LIVE` et relancer l'analyse live.
- Le panneau Review proposait encore `Rapide` dans le select utilisateur.
- `Relancer depuis zero` appelait directement `force_reanalysis=true` avec le
  profil courant, sans choix explicite Standard/Approfondie.
- Les etats failed/incomplete affichaient le message technique principal, avec
  peu de separation entre erreur utilisateur et debug.

## Conclusion

La cause probable du `database is locked` observe a 88/89 est une combinaison de
writers SQLite proches dans le temps : updates de progression/job, writes
`position_analyses`, live encore actif en Review, WAL absent et pas de retry
cible. La correction doit donc reduire la concurrence, rendre les transactions
courtes plus resilientes, et transformer les locks transitoires en etats
retryables plutot qu'en Review echouee definitive.
