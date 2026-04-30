# V5.2.z - Review Playback + Barre Stable + Toggle Evaluation

## Objectif

Ameliorer la pedagogie de la Review sans toucher a l'historique, a V6, a Stockfish, a l'opening book, a la classification, au score 100, a l'Elo NeuroChess ou a la logique de criticite.

## Probleme UX initial

Le bouton `Voir sur l'echiquier` pouvait donner l'impression de sauter directement sur une position deja jouee. La barre devait aussi mieux faire sentir la variation avant/apres, et l'utilisateur n'avait pas de moyen global pour masquer l'evaluation.

## Playback Review

Le comportement retenu pour V5.2.z est le fallback robuste :

1. placer l'echiquier sur `fen_before` ;
2. attendre `REVIEW_REPLAY_INITIAL_DELAY_MS = 140` ;
3. basculer vers `fen_after` avec l'animation native du board ;
4. conserver les highlights source/destination ;
5. synchroniser la barre de `before` vers `after`.

Le replay du coup precedent reste hors scope. Il pourra etre ajoute plus tard si l'architecture board le rend utile sans fragiliser la Review.

## Barre before -> after

En mode `REVIEW`, la barre utilise uniquement les donnees du `ReviewMoment` :

- `eval_before_cp` / `mate_before` pour l'etat avant ;
- `eval_after_cp` / `mate_after` pour l'etat apres ;
- source UI `review_deep_snapshot`.

Elle ne depend pas du moteur live, du shallow, de `currentFen` ou de l'etat `engine ready`.

## Delta visuel

Le delta reste calcule du point de vue du joueur qui vient de jouer :

- delta negatif : perte, affiche en rouge ;
- delta positif : gain, affiche en vert ;
- delta neutre : affichage neutre.

Quand l'evaluation est masquee, le delta est masque aussi.

## Gestion des mates

Les valeurs `mate_before` et `mate_after` sont des donnees Review valides. Elles doivent alimenter la barre meme si `eval_cp` est absent.

Rappel :

- `mate_in > 0` : barre blanche a 100%.
- `mate_in < 0` : barre blanche a 0%.

La Review ne doit donc pas afficher `evaluation indisponible` si un mate est disponible dans le payload.

## Toggle Masquer l'evaluation

Le toggle global `Masquer l'evaluation` est stocke dans `localStorage` via la cle `neurochess.hideEvaluation`.

Quand il est actif :

- la barre globale affiche un etat neutre `Evaluation masquee` ;
- les valeurs numeriques sont masquees ;
- les deltas Review sont masques ;
- les cartes Review restent navigables ;
- les calculs backend et frontend continuent normalement.

La portee couvre la barre LIVE, HISTORICAL et REVIEW, ainsi que les valeurs/deltas visibles dans `ReviewPanel`.

## Limites

- Pas de replay du coup precedent dans cette version.
- L'animation de piece depend de l'animation native de `react-chessboard`; si elle ne se declenche pas dans un cas navigateur, le fallback avant/apres reste le comportement attendu.
- Pas de modification de la selection des moments Review.

## Tests manuels

1. Ouvrir une partie avec moments.
2. Aller dans Review.
3. Cliquer `Voir sur l'echiquier`.
4. Verifier que l'echiquier part de la position avant le coup fautif.
5. Verifier l'animation ou au minimum un avant/apres clair.
6. Verifier que la barre passe de before a after.
7. Verifier le delta rouge/vert.
8. Verifier qu'un moment avec mate ne rend pas la barre indisponible.
9. Activer `Masquer l'evaluation`.
10. Verifier que barre, valeurs et deltas sont masques.
11. Rafraichir.
12. Verifier que la preference persiste.
