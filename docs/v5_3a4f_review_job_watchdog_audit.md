# V5.3.A4f - Audit Review Job Watchdog

## Symptome

En navigateur reel, une analyse deep pouvait rester indefiniment a `88/89`
positions et `99 %`, avec le statut utilisateur `Analyse deep en cours`.

Le job ne passait ni en `finalizing`, ni en `completed`, ni en `failed`.

## Diagnostic code

Le cas le plus fragile etait le suivant :

- une ligne `position_analyses` peut rester en `status='running'` ;
- le coverage considere alors qu'un travail est actif ;
- mais `ReviewJobService._next_pending_analysis_id()` ne prend que les analyses
  `pending` ;
- le worker ne trouve donc plus de FEN a lancer ;
- sans watchdog, le job peut rester `running` pour toujours.

Autres risques constates :

- il n'existait pas de heartbeat de job ;
- aucune limite externe ne protegeait un appel Stockfish qui ne rendrait pas la
  main ;
- la derniere FEN peut etre terminale, ou n'avoir aucun coup legal ;
- MultiPV 3 pouvait etre demande meme si la position a moins de 3 coups legaux ;
- un compteur `completed_position_count` stocke pouvait diverger de la verite
  recalculable depuis `position_analyses`.

## Conclusion

Le blocage `88/89` vient probablement d'un etat incoherent `running` sans
analyse `pending`, ou d'une derniere position moteur qui ne termine pas. La
correction doit donc etre un filet de securite systemique : heartbeat,
watchdog, timeout externe, positions terminales deterministes et reconciliation
depuis les analyses réellement presentes en base.
