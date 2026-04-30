# V5.3.A4f - Review Job Watchdog + Last Position Recovery

## Objectif

Empêcher un job Review standard/deep de rester indefiniment `running`, en
particulier sur la derniere position d'une partie.

## Heartbeat et watchdog

La table `review_jobs` ajoute :

- `heartbeat_at`
- `last_progress_at`
- `current_fen_key`
- `current_phase`
- `stalled_reason`
- `current_position_started_at`
- `attempts_for_current_position`

Le job met a jour son heartbeat :

- au demarrage ;
- au debut d'une position ;
- apres l'ecriture d'une position ;
- avant la finalisation ;
- apres la finalisation.

Le polling ne met pas a jour la base en situation normale. Il peut seulement
declencher une reconciliation si le job est stale ou si toutes les positions
sont deja disponibles.

## Etat stalled

`review_jobs.status` accepte maintenant `stalled`.

Un job `running` ou `finalizing` devient `stalled` / retryable si :

- la position courante depasse son hard timeout ;
- le heartbeat est trop ancien ;
- la finalisation depasse 60 secondes ;
- le job voit du travail `running` mais aucune analyse `pending` a lancer.

Message utilisateur :

`Analyse bloquee temporairement. Vous pouvez reprendre l'analyse.`

Pour un timeout moteur :

`Stockfish n'a pas repondu sur une position. Vous pouvez reprendre l'analyse.`

## Timeout externe Stockfish

Chaque analyse persistante est executee avec un hard timeout externe :

`min(180s, max(60s, 3 * per_position_time_ms))`

Les tests peuvent reduire ce timeout via un override moteur.

Si Stockfish ne repond pas :

- le moteur est stoppe en best effort ;
- la position est marquee failed ;
- le job devient failed/stalled retryable ;
- `Reprendre` ne refait pas les positions deja valides.

## Positions terminales

Avant d'appeler Stockfish, le backend verifie :

- `board.is_checkmate()`
- `board.is_stalemate()`
- `board.is_insufficient_material()`
- `board.is_game_over(claim_draw=True)`
- `legal_moves_count`

Les positions terminales generent une analyse deterministe :

- `analysis_limit_mode = "terminal"`
- `top_moves = []`
- checkmate : `mate_in` signe depuis le POV Blancs ;
- nulle terminale : `eval_cp = 0`
- `settings_json.terminal_position = true`

Ces analyses satisfont le cache quality gate du profil demande sans appel
Stockfish.

## MultiPV

Le MultiPV effectif envoye au moteur est clampé au nombre de coups legaux :

`effective_multipv = min(requested_multipv, legal_moves_count)`

Les positions sans coup legal sont traitees comme terminales.

## Reconciliation

`reconcile_review_job(job_id)` recalcule la verite depuis la base :

- si `89/89` analyses valides existent, le job passe en `finalizing` puis
  `completed` sans relancer Stockfish ;
- si `88/89` existent, seules les positions manquantes/failed restent a faire ;
- si un job `completed` n'a pas de Review finale, il est finalise de nouveau ;
- si un job `running` est stale, il devient `stalled` retryable.

## UI

L'UI affiche :

- `running` : progression X/Y, settings, bouton Annuler ;
- `running` a 95 %+ sur une position : message de verification de derniere
  position ;
- `stalled` : message propre, Reprendre, Relancer depuis zero, debug replie ;
- `finalizing` : construction du score et des moments, sans score/moments ;
- `completed` : Review finale seulement quand le backend est completed.

## Checklist navigateur

1. Relancer l'analyse deep de la partie qui restait a `88/89`.
2. Verifier qu'elle finit en `completed` ou devient `stalled/failed retryable`.
3. Confirmer qu'elle ne reste jamais `running` indefiniment.
4. Cliquer `Reprendre` et verifier que les 88 positions valides ne sont pas
   refaites.
5. Tester une partie finissant par mat ou pat.
6. Verifier que la derniere FEN terminale ne lance pas Stockfish et ne bloque
   pas.
7. Annuler pendant la derniere position et verifier `cancelled`.

## Limites

- Le timeout externe stoppe le moteur en best effort ; python-chess ne fournit
  pas une interruption preemptive parfaite de tous les appels natifs.
- Le test navigateur reel reste necessaire sur la partie precise qui bloquait.
- La reconciliation reste locale SQLite et adaptee a une application mono-user.
