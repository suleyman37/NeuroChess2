# V5.3.A2 - Audit Score Review

## Objet

Auditer le score Review V5.3.A apres observation utilisateur : scores souvent proches de 90 %, meme sur des parties volontairement mauvaises.

## Pourquoi une Review peut sembler instantanee

Le pipeline Review peut repondre immediatement si les analyses deep requises existent deja dans `position_analyses`.

Cas possibles :

- `cached_full` : toutes les FEN requises ont une analyse deep done.
- `cached_partial` : couverture deep suffisante pour une Review partielle.
- `newly_scheduled` : des analyses deep manquent et viennent d'etre programmees.
- `failed` : une ou plusieurs deep sont failed et la couverture est insuffisante.
- `insufficient` : couverture trop faible sans travail actif exploitable.

Conclusion : une reponse instantanee n'implique pas que live/shallow soit utilise. Elle peut simplement venir d'un cache deep complet.

## Donnees utilisees par le score V5.3.A

V5.3.A calculait le score sur les coups analysables, pas seulement sur les moments Review :

- `fen_before` et `fen_after` doivent avoir une analyse deep done ;
- les coups sans deep sont exclus ;
- les coups exclus incrementent `score_missing_moves_white` ou `score_missing_moves_black`.

Le score ne doit jamais utiliser :

- live ;
- shallow ;
- current evaluation ;
- fallback 50 % ;
- fallback 100 %.

## Couverture exposee

Les champs utiles pour comprendre la couverture sont :

- `required_position_count`
- `deep_done_count`
- `deep_missing_count`
- `deep_failed_count`
- `deep_coverage`
- `score_analyzed_moves_white`
- `score_analyzed_moves_black`
- `score_missing_moves_white`
- `score_missing_moves_black`

## Cause du score trop haut

La source principale n'etait pas une contamination live/shallow dans le calcul V5.3.A. Le probleme etait surtout mathematique :

- la moyenne arithmetique ponderee diluait trop les grosses erreurs ;
- un joueur pouvait jouer beaucoup de coups neutres et quelques tres mauvais coups tout en gardant un score eleve ;
- les coups manquants etaient exclus correctement, mais une faible taille d'echantillon devait etre rendue plus visible ;
- aucun plafond ne limitait le score apres une tres grosse perte de Win%.

## Correctif attendu

V5.3.A2 remplace la formule par `neuro_review_score_v1` :

- tous les coups analysables restent inclus ;
- les grosses erreurs pesent plus lourd ;
- la moyenne harmonique penalise les tres faibles accuracies ;
- `worst_tail` capture les pires coups ;
- `score_cap` plafonne la note en fonction de `max_win_loss` ;
- les composants sont exposes en debug dev.
