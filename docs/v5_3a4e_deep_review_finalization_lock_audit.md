# V5.3.A4e - Audit finalisation Review deep

## Symptome observe

Une analyse approfondie pouvait echouer presque a la fin, par exemple `88/89`
positions, avec :

- message utilisateur : verrou temporaire de la base locale ;
- erreur technique : `OperationalError('database is locked')`.

Le live etant suspendu depuis A4d, la cause restante la plus probable etait la
phase de finalisation : derniere ecriture d'analyse, progression du job,
construction `game_reviews`, insertion `review_moments`, ou update final du job.

## Points verifies

- Les appels Stockfish ne sont pas effectues sous transaction longue dans
  `ReviewJobService.run_job()` : l'analyse suivante est selectionnee, la
  connexion est fermee, puis `analysis_service.run_analysis()` calcule.
- `ReviewService.generate_review()` ouvrait auparavant une transaction large qui
  couvrait la completion Review et la construction du payload.
- `GET /review/jobs/{job_id}` recalculait la couverture et ecrivait la progression
  en base pendant le polling. Ce polling pouvait donc concourir avec la
  finalisation.
- La finalisation supprimait/recreait `game_reviews` et inserait les moments dans
  le meme chemin qui pouvait etre appele depuis `generate_review()` ou `get_review()`.
- Il n'existait pas d'etat explicite entre `running` et `completed`.

## Conclusion

Le verrou a 88/89 n'etait pas un probleme de score ou de live. Le point fragile
etait la concurrence de petites ecritures SQLite autour de la finalisation,
notamment le polling qui pouvait encore ecrire pendant que le job finalisait, et
une transaction de completion trop large.
