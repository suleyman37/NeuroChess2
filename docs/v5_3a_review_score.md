# V5.3.A - Review Score 0-100

Note V5.3.A2 : la formule V5.3.A initiale `weighted_winloss_accuracy_v0` a ete
remplacee par `neuro_review_score_v1`, documentee dans
`docs/v5_3a2_review_score_calibration_fix.md`, car la moyenne simple etait trop
permissive sur les parties avec grosses erreurs.

## Objectif

Ajouter un score de precision 0-100 dans la Review pour les Blancs, les Noirs, et l'utilisateur si `user_color` est connu.

Ce score n'est pas un Elo, pas un rating et pas une promesse de niveau. C'est une synthese locale de precision sur les coups analysables de la partie.

## Win% utilise

`eval_cp` reste en POV Blancs.

```text
white_percent = 100 / (1 + exp(-0.00368208 * eval_cp))
```

Les mats ne passent pas par la sigmoide :

- `mate_in > 0` => `white_percent = 100.0`
- `mate_in < 0` => `white_percent = 0.0`

Pour les Noirs :

```text
black_percent = 100 - white_percent
```

## Perte Win% par coup

Pour chaque coup joue par un camp :

```text
P_before = pourcentage du joueur avant le coup
P_after = pourcentage du joueur apres le coup
win_loss = max(0, P_before - P_after)
```

`win_loss` est mesure en points de Win%, pas en centipions.

Exemples :

- 60 -> 58 : `win_loss = 2`
- 50 -> 30 : `win_loss = 20`
- 30 -> 50 : `win_loss = 0`

## Accuracy par coup

V5.3.A utilise :

```text
move_accuracy = 103.1668 * exp(-0.04354 * win_loss) - 3.1669
move_accuracy = clamp(move_accuracy, 0, 100)
```

La formule attend `win_loss` en points de Win%, pas en cp.

## Score joueur v0

Un coup est scorables si :

- `eval_before_cp` ou `mate_before` est disponible depuis deep ;
- `eval_after_cp` ou `mate_after` est disponible depuis deep ;
- le camp qui a joue est connu ;
- la source est deep done / snapshot Review stable.

Les coups sans donnees deep exploitables sont exclus et comptes dans `score_missing_moves_*`.

Poids V5.3.A :

```text
move_weight = 1 + min(3.0, criticality_score / 25)
```

Si `criticality_score` est absent :

```text
move_weight = 1.0
```

Score :

```text
player_review_score_v0 =
  sum(move_weight_i * move_accuracy_i) / sum(move_weight_i)
```

Version :

```text
score_formula_version = "weighted_winloss_accuracy_v0"
```

## Pourquoi pas de moyenne harmonique

V5.3.A reste une premiere version calibrable. Une moyenne harmonique pourrait etre trop punitive ou trop instable sans donnees utilisateur reelles. Elle est repoussee a une etude future si les scores semblent trop permissifs.

## Confiance

`review_score_confidence` :

- `high` : au moins 20 coups analysables pour le joueur et `deep_coverage >= 0.95`
- `medium` : au moins 10 coups analysables pour le joueur et `deep_coverage >= 0.70`
- `low` : sinon

Si la confiance est `low`, l'UI affiche `Score indicatif - donnees limitees`.

## Payload Review

Les reponses Review exposent :

- `white_review_score`
- `black_review_score`
- `user_review_score`
- `opponent_review_score`
- `review_score_confidence`
- `score_formula_version`
- `score_analyzed_moves_white`
- `score_analyzed_moves_black`
- `score_missing_moves_white`
- `score_missing_moves_black`
- `deep_coverage`

Si un score ne peut pas etre calcule, il reste `null`. Le backend n'invente jamais 0 ou 100.

## UI

Le panneau Review affiche un bloc `Score de precision` :

- si `user_color` est connu : `Mon score` et `Adversaire` ;
- sinon : `Blancs` et `Noirs` ;
- toujours avec un niveau de confiance.

Le toggle `Masquer l'evaluation` masque les barres, valeurs moteur et deltas. Il ne masque pas le score de precision, car ce score est un resume post-game et non une evaluation live.

## Limites

- Le score depend de la couverture deep disponible.
- Le score n'est pas calibre comme un rating.
- ACPL n'est pas affiche par defaut.
- Aucune categorie de coups n'est ajoutee en V5.3.A.
- Aucune analyse massive automatique n'est lancee.

## Protocole navigateur

1. Ouvrir une partie avec Review done ou partial.
2. Verifier que le bloc `Score de precision` apparait.
3. Si `user_color` est connu, verifier `Mon score` et `Adversaire`.
4. Si `user_color` est inconnu, verifier `Blancs` et `Noirs`.
5. Verifier que `Score indicatif` apparait sur une petite partie / couverture faible.
6. Verifier qu'aucun Elo, ACPL ou score global NeuroChess n'est affiche.
