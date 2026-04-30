# V5.2.z2 - Audit Review Replay Visible

## Bouton et handler

- Le bouton `Voir sur l'echiquier` est rendu par `frontend/src/components/ReviewPanel.tsx`.
- Il appelle `onShowMoment(moment, index)`.
- `frontend/src/App.tsx` branche ce callback vers `handleShowReviewMoment`.
- Le handler recoit bien `fen_before`, `fen_after`, `played_uci`, `eval_before_cp`, `eval_after_cp`, `mate_before` et `mate_after` via le `ReviewMoment`.

## Ancien comportement V5.2.z

- Le handler placait l'echiquier sur `fen_before`, puis passait a `fen_after` apres `140 ms`.
- La barre passait aussi de `before` a `after`.
- Le board recevait bien `animationDuration`.
- Le toggle `Masquer l'evaluation` etait dans la top bar.

## Pourquoi le changement pouvait etre invisible

- `140 ms` etait trop court pour qu'un humain voie clairement la position avant.
- Aucun `reviewReplayState` explicite n'etait visible a l'ecran.
- Si `react-chessboard` ne declenchait pas une animation native perceptible, il ne restait qu'un saut tres rapide avant/apres.
- Le debug DEV ne montrait pas l'etat du replay, donc il etait difficile de confirmer si le clic avait vraiment lance la sequence.

## Barre Review

- La barre Review utilise deja `reviewMomentEvaluation(moment, reviewBarPhase)`.
- `reviewMomentEvaluation` lit `eval_before_cp/mate_before` puis `eval_after_cp/mate_after`.
- Les valeurs `mate_before` et `mate_after` sont valides meme sans `eval_cp`.

## Toggle evaluation

- Le toggle est present dans l'UI principale avec le libelle `Masquer l'evaluation`.
- Il persiste via `localStorage` avec la cle `neurochess.hideEvaluation`.
- V5.2.z2 conserve ce comportement et ajoute des donnees debug pour confirmer son etat.

## Conclusion

La cause principale du "aucun changement visible" etait un replay techniquement branche mais trop rapide et non observable. V5.2.z2 ajoute une state machine visible, une pause de `500 ms` sur l'avant, une phase de coup joue, un badge de replay et un debug DEV dedie.
