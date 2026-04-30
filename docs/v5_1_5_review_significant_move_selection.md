# V5.1.5 Review Significant Move Selection

## Pourquoi `cp_loss` brut est insuffisant

`cp_loss` reste utile comme métrique simple V4, mais un seuil en centipions ne
reflète pas toujours l'impact perçu par le joueur. Une variation de 50 cp peut
être très faible selon la zone d'évaluation, tandis qu'une perte plus large
près de l'égalité peut changer nettement la barre.

La Review doit donc sélectionner des coups significatifs, pas remplir une liste
avec des micro-variations.

## Perte de Win% / barre

La sélection V5.1.5 utilise la même courbe que la barre d'évaluation :

`white_percent = 100 / (1 + exp(-0.00368208 * eval_cp))`

Convention :

- `eval_cp` est toujours POV Blancs ;
- `eval_cp > 0` avantage Blancs ;
- `eval_cp < 0` avantage Noirs.

Pour un coup Blanc :

`mover_win_loss = white_percent_before - white_percent_after`

Pour un coup Noir :

`mover_win_loss = black_percent_before - black_percent_after`

avec :

`black_percent = 100 - white_percent`

Puis :

`mover_win_loss = max(0, mover_win_loss)`

## Seuil

`MIN_SIGNIFICANT_WIN_LOSS = 10.0`

Un coup devient un moment Review si la perte du joueur qui vient de jouer est
au moins 10 points de Win%.

Ce seuil évite de générer une review artificielle sur :

- une variation d'environ 0.10 pion ;
- une variation d'environ 0.50 pion ;
- des oscillations faibles dans une partie équilibrée.

Une perte autour de 1.50 pion dans une position équilibrée devient
significative.

## Mates

`mate_in` ne passe jamais par la sigmoïde :

- `mate_in > 0` donne `white_percent = 100.0` ;
- `mate_in < 0` donne `white_percent = 0.0`.

Un changement de mate significatif est toujours un moment Review et reçoit le
label `moment décisif`.

## Labels

Les labels Review V5.1.5 sont fondés sur `mover_win_loss` :

- `10 <= loss < 15` : `écart notable`
- `15 <= loss < 25` : `écart important`
- `25 <= loss < 35` : `écart majeur`
- `loss >= 35` ou événement de mate : `moment décisif`

Le champ historique `cp_loss` reste stocké brut, mais l'affichage Review utilise
le label issu de la perte de Win%.

## États Review

`pending` :

- il manque des analyses deep ;
- `missing_deep_count > 0` ;
- message : `Analyse approfondie en cours : X positions restantes.`

`no_significant_moments` :

- toutes les analyses nécessaires sont disponibles ;
- aucun coup ne dépasse `MIN_SIGNIFICANT_WIN_LOSS` ;
- `status = done` ou `partial` ;
- `moments = []` ;
- `empty_reason = "no_significant_moments"`.

`not_reviewable` :

- la partie a 10 demi-coups ou moins ;
- `empty_reason = "game_too_short"`.

Règle absolue :

`missing_deep_count = 0` et `moments = []` ne doit jamais rester `pending`.

## Pas de remplissage artificiel

La Review ne force jamais 5 moments. Si un seul coup est significatif, la Review
affiche un seul moment. Si aucun coup n'est significatif, elle affiche la sortie
claire `Aucun moment majeur détecté`.

## Version d'algorithme

`selection_algorithm_version = "moment_selection_winloss_v2"`

Les anciennes reviews générées ou pending avec l'ancien algorithme ne sont plus
considérées comme la version courante.

## Protocole de test manuel

1. Jouer une partie de 10 demi-coups ou moins et terminer.
2. Ouvrir Review : vérifier `Partie trop courte pour générer une review fiable.`
3. Jouer une partie assez longue avec analyses deep disponibles mais sans perte
   de Win% >= 10.
4. Ouvrir Review : vérifier
   `Aucun moment majeur détecté : la partie est restée trop équilibrée pour générer une review utile.`
5. Jouer une partie où un coup fait perdre au joueur au moins 10 points de Win%.
6. Ouvrir Review : vérifier qu'une carte de moment apparaît.
7. Vérifier qu'une variation faible, comme environ 0.10 pion ou 0.50 pion, ne
   crée pas de carte.
8. Forcer une review avec analyses deep manquantes : vérifier que le spinner
   dure au maximum 3 secondes puis passe à l'état d'arrière-plan.
9. Recliquer `Vérifier à nouveau` quand les analyses sont prêtes.
10. Confirmer qu'aucun ancien pending d'algorithme V1 ne bloque la review V2.
