# V5.2.za - Review Pedagogy Polish

## Objectif

Rendre la Review plus lisible et plus pedagogique sans toucher a l'historique, a V6, a Stockfish, a l'opening book, a la classification, au score 100, a l'Elo NeuroChess ou a la logique de criticite.

## Problemes UX observes

- L'animation du coup etait encore trop rapide.
- Le passage avant -> coup -> apres pouvait ressembler a une teleportation.
- La barre bougeait, mais la perte n'etait pas assez visible.
- Le delta etait present, mais pas assez integre a la barre.
- Le bloc debug etait trop visible en usage normal.
- La difference entre le coup joue et le meilleur coup n'etait pas assez explicite.

## Replay before -> move -> after

Le replay utilise maintenant des durees humaines :

- pause avant coup : `850 ms`
- animation board : `820 ms`
- maintien apres coup : `850 ms`

La sequence reste :

1. `showing_before` : afficher `fen_before` et le bandeau `Position avant le coup`.
2. `animating_move` : afficher le coup joue ou le meilleur coup.
3. `showing_after` : afficher la position apres.

Si l'animation native de la piece n'est pas perceptible, le fallback reste clair : position avant visible, flèche visible, puis position apres.

## Fleches

`react-chessboard` supporte `customArrows`, utilise ici pour rendre le coup visible :

- coup joue : fleche orange/rouge discrete ;
- meilleur coup : fleche verte.

Les highlights source/destination restent presents, avec une intensite plus forte pour le mode actif.

## Coup joue vs meilleur coup

Chaque carte Review propose deux actions :

- `Voir le coup joue`
- `Voir le meilleur coup`

`Voir le coup joue` :

- repart de `fen_before` ;
- anime le coup utilisateur ;
- affiche la barre before -> after ;
- affiche le delta de perte/gain.

`Voir le meilleur coup` :

- repart de `fen_before` ;
- anime le coup moteur si `best_move_uci` est disponible ;
- affiche une fleche verte ;
- garde la barre sur l'evaluation before si l'evaluation apres meilleur coup n'existe pas.

On ne fabrique pas d'evaluation apres meilleur coup si elle n'est pas disponible.

## Barre et delta

La barre Review reste basee uniquement sur les snapshots du `ReviewMoment` :

- `eval_before_cp` / `mate_before`
- `eval_after_cp` / `mate_after`
- source `review_deep_snapshot`

Pour le coup joue, le delta est rendu a deux endroits :

- badge rouge/vert pres du label ;
- overlay vertical dans la barre montrant le segment de perte/gain.

La barre ne depend pas du live/shallow et ne flashe pas a 50.

## Toggle evaluation

Le toggle `Masquer l'evaluation` reste global et persistant via :

```text
localStorage["neurochess.hideEvaluation"]
```

Quand il est actif :

- barre masquee ;
- valeurs numeriques masquees ;
- delta masque ;
- replay echiquier toujours utilisable.

## Debug

Le debug Review reste disponible uniquement en `import.meta.env.DEV`, mais il est maintenant replie par defaut :

```html
<details>
  <summary>Debug Review</summary>
</details>
```

Il n'est plus affiche directement dans l'interface normale.

## Checklist navigateur

1. Ouvrir une partie avec moments Review.
2. Cliquer `Voir le coup joue`.
3. Verifier `Position avant le coup`.
4. Verifier la pause lisible.
5. Verifier la fleche orange et le passage vers l'apres.
6. Verifier la barre before -> after.
7. Verifier le badge delta et l'overlay de delta dans la barre.
8. Cliquer `Voir le meilleur coup`.
9. Verifier la fleche verte et l'animation depuis `fen_before`.
10. Activer `Masquer l'evaluation`.
11. Verifier que la barre, les valeurs et les deltas disparaissent mais que le replay fonctionne.
12. En dev, verifier que `Debug Review` est replie par defaut.
