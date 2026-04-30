# V5.2.z2 - Review Replay Visiblement Observable

## Objectif

Rendre le replay Review perceptible et testable en navigateur, sans modifier la logique mathematique Review, l'historique, Stockfish, l'opening book ou la classification.

## Cause trouvee

V5.2.z branchait deja `Voir sur l'echiquier` vers `handleShowReviewMoment`, mais la pause avant/apres etait de `140 ms`. Cette duree etait trop courte pour garantir une perception humaine, surtout si React ou `react-chessboard` rendaient la transition trop vite.

Il manquait aussi un etat visible indiquant ce que le replay etait en train de faire.

## Handler branche

Le flux est :

```text
ReviewPanel button
-> onShowMoment(moment, index)
-> App.handleShowReviewMoment(moment, index)
```

Le handler utilise les champs du `ReviewMoment` :

- `fen_before`
- `fen_after`
- `played_uci`
- `eval_before_cp`
- `eval_after_cp`
- `mate_before`
- `mate_after`

## Replay state

V5.2.z2 ajoute :

```text
reviewReplayState =
  idle
  showing_before
  animating_move
  showing_after
```

Sequence :

1. `showing_before` : board sur `fen_before`, barre sur before.
2. attente `500 ms`.
3. `animating_move` : board vers `fen_after`, barre vers after.
4. attente `500 ms`.
5. `showing_after` : etat final visible.

## Badge visible

Un badge de replay apparait pres du board :

- `Position avant le coup`
- `Coup joue...`
- `Position apres le coup`

Il reste volontairement visible en production, car il clarifie la lecture de la Review.

## Fallback animation

Si l'animation native de piece n'est pas perceptible, le fallback reste obligatoire :

- `fen_before` visible pendant `500 ms` ;
- puis `fen_after` visible ;
- highlights conserves ;
- barre synchronisee.

L'utilisateur doit donc voir un avant/apres meme sans animation native parfaite.

## Barre Review

La barre continue d'utiliser uniquement les snapshots Review :

- before : `eval_before_cp` / `mate_before`
- after : `eval_after_cp` / `mate_after`
- source : `review_deep_snapshot`

Les cas mate restent valides et ne doivent pas tomber en indisponible si `mate_before` ou `mate_after` existe.

## Toggle evaluation

Le toggle `Masquer l'evaluation` reste visible dans la top bar et persiste via :

```text
localStorage["neurochess.hideEvaluation"]
```

Quand il est actif, la barre, les valeurs et les deltas sont masques, mais la Review et les calculs internes continuent.

## Debug DEV

En `import.meta.env.DEV`, le bloc `reviewReplayDebug` expose :

- `reviewReplayState`
- `positionMode`
- `displayedFenKind`
- `playedUci`
- `hasFenBefore`
- `hasFenAfter`
- `hasEvalBefore`
- `hasEvalAfter`
- `hideEvaluation`
- `animationDuration`

Ce bloc est absent du build production Vite.

## Protocole navigateur

1. Ouvrir une partie avec moments Review.
2. Cliquer `Voir sur l'echiquier`.
3. Verifier le badge `Position avant le coup`.
4. Verifier que le board montre la position avant.
5. Verifier le badge `Coup joue...`.
6. Verifier le passage vers la position apres.
7. Verifier le badge `Position apres le coup`.
8. Verifier que la barre passe de before a after.
9. Verifier le delta rouge/vert.
10. Activer `Masquer l'evaluation`.
11. Verifier que barre, valeurs et delta sont masques.
12. Rafraichir et confirmer la persistance.
