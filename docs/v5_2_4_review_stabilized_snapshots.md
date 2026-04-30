# V5.2.4 - Review Stabilized Engine Snapshots

## Objectif

Stabiliser les evaluations utilisees par la Review pour eviter qu'un score
Stockfish trop precoce decide seul d'un moment critique.

## Pourquoi Stockfish oscille

Stockfish peut afficher une premiere estimation rapide, puis changer de score
apres avoir atteint une profondeur plus utile ou trouve une meilleure PV.

Exemple :

```text
100 ms  : +0.20
400 ms  : +0.35
900 ms  : +0.80
1600 ms : +0.78
2000 ms : +0.82
```

Le bon snapshot est le score final proche de `+0.82`. Une moyenne totale serait
trop basse, car elle melangerait des valeurs de faible profondeur avec les
valeurs finales.

## Budget Review

La fonction `compute_review_time_budget(half_moves_count)` definit le budget
global recommande pour une review :

```text
budget = clamp(30 + 1.0 * half_moves_count, 45, 150)
```

Exemples :

- 11 demi-coups : 45 s
- 30 demi-coups : 60 s
- 60 demi-coups : 90 s
- 100 demi-coups : 130 s
- 120+ demi-coups : 150 s max

Le pipeline actuel garde les deep analyses a la demande de la Review et ajoute
un snapshot stabilise a chaque deep analysis. La strategie complete en deux
passes reste preparee comme prochaine etape.

## Snapshot stabilise

`analyze_stabilized_fen(fen, time_budget_sec, min_depth=None)` produit un
`StabilizedEval` contenant :

- `final_eval_cp`
- `final_mate_in`
- `final_depth`
- `final_seldepth`
- `nodes`
- `time_ms`
- `pv`
- `tail_scores_cp`
- `tail_depths`
- `tail_median_cp`
- `stability_cp`
- `reliability_score`
- `reliability_label`
- `engine_version`

Si le streaming `python-chess` est disponible, la fenetre finale est construite
depuis les infos successives. Sinon, le code garde un fallback final-only avec
`reliability_label="unknown"`.

## Fenetre finale

La fenetre finale vaut :

```text
tail_window_ms = clamp(0.25 * time_budget_ms, 400, 800)
```

Seuls les scores centipawn non-mate de cette fenetre sont utilises pour mesurer
la stabilite.

Le score canonique reste le dernier score final atteint par Stockfish. La
mediane de fin sert a mesurer la stabilite, pas a remplacer le score final.

## Reliability

Pour les scores centipawn :

```text
reliability_score = exp(-stability_cp / 80)
```

Puis le score est ajuste prudemment selon la profondeur :

- profondeur finale < 12 : reduction ;
- profondeur finale >= 16 : conserve ;
- profondeur finale >= 20 : bonus leger.

Labels :

- `stable` si `stability_cp <= 30`
- `medium` si `30 < stability_cp <= 80`
- `unstable` si `stability_cp > 80`
- `unknown` si la fenetre finale n'a pas assez de scores
- `mate_detected` si un mate final existe

## Utilisation dans Review

La Review lit en priorite :

- `analysis_json.stabilized_eval.final_eval_cp`
- `analysis_json.stabilized_eval.final_mate_in`
- `reliability_score`
- `reliability_label`

La criticite devient :

```text
criticality_score =
  mover_win_loss
  * reliability_score
  * leverage_weight
  * transition_weight
  * persistence_weight
  * novelty_weight
```

Un candidat instable n'est pas ignore automatiquement, mais son poids est reduit
par `reliability_score`.

## Barre Review

En mode Review, la barre affiche uniquement le snapshot du moment :

- source : `review_stabilized_deep`
- score : `eval_before_cp` issu du snapshot stabilise
- pas de live ;
- pas de shallow ;
- pas de reset silencieux a 50.

Si le moment n'a pas de snapshot stabilise, la barre affiche :

```text
analyse indisponible
```

En mode historique, la barre affiche l'analyse deep/stabilisee disponible dans
le cache de position. Le live courant ne remplace pas cette valeur.

## Deux passes

La strategie visee reste :

1. Scan rapide de toutes les positions requises.
2. Confirmation des meilleurs candidats avec plus de temps.

V5.2.4 n'implemente pas encore cette confirmation separee. Elle stabilise
d'abord le score final des deep analyses deja utilisees par Review.

## Limites

- Les anciennes analyses deep sans `stabilized_eval` peuvent encore exister en
  base ; la nouvelle version d'algorithme evite de reutiliser les anciennes
  reviews comme etat courant.
- La passe 2 de reanalyse des candidats instables est documentee mais repoussee.
- La formule de barre n'est pas modifiee.
