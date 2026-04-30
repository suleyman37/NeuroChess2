# V5.3.A2 - Review Score Calibration Fix

Note : V5.3.A3 remplace la formule courante par
`neuro_review_score_v1_1`, qui conserve mean/harmonic/worst-tail mais adoucit
les caps de pire perte et ajoute l'audit coup par coup.

## Probleme corrige

Le score V5.3.A pouvait rester trop haut, souvent proche de 90 %, sur des parties volontairement mauvaises. La cause principale etait une agregation trop permissive : une moyenne ponderee simple diluait les grosses erreurs dans les coups neutres.

## Source de donnees

Le score reste calcule uniquement depuis les analyses deep done / snapshots Review stables.

Exclusions strictes :

- pas de live ;
- pas de shallow ;
- pas de currentFen ;
- pas de fallback 50 % ;
- pas de fallback 100 %.

Un coup est scorables si `fen_before` et `fen_after` ont une evaluation deep exploitable.

## Unite Win%

`eval_cp` est POV Blancs :

```text
white_percent = 100 / (1 + exp(-0.00368208 * eval_cp))
```

Mats :

- `mate_in > 0` => 100
- `mate_in < 0` => 0

Pour le joueur qui vient de jouer :

```text
win_loss = max(0, P_before - P_after)
```

`win_loss` est en points de Win%, pas en centipions.

## Accuracy par coup

```text
move_accuracy = 103.1668 * exp(-0.04354 * win_loss) - 3.1669
move_accuracy = clamp(move_accuracy, 0, 100)
```

## Formule `neuro_review_score_v1`

### Poids

Si `criticality_score` est disponible :

```text
move_weight = 1 + min(4.0, criticality_score / 20)
```

Sinon :

```text
move_weight = 1 + min(2.0, win_loss / 15)
```

### Moyenne ponderee

```text
weighted_mean = sum(weight_i * move_accuracy_i) / sum(weight_i)
```

### Moyenne harmonique ponderee

```text
safe_accuracy_i = max(move_accuracy_i, 5)
weighted_harmonic = sum(weight_i) / sum(weight_i / safe_accuracy_i)
```

Role : penaliser davantage les tres mauvais coups.

### Worst-tail

```text
worst_count = max(1, ceil(0.15 * n))
worst_tail = moyenne des worst_count plus faibles move_accuracy_i
```

Role : eviter qu'une partie avec plusieurs tres mauvais coups obtienne encore une note tres haute.

### Score brut

```text
raw_score =
  0.50 * weighted_mean
  + 0.30 * weighted_harmonic
  + 0.20 * worst_tail
```

### Cap par pire perte

```text
if max_win_loss >= 50: score_cap = 55
elif max_win_loss >= 40: score_cap = 65
elif max_win_loss >= 30: score_cap = 75
elif max_win_loss >= 20: score_cap = 85
else: score_cap = 100

final_score = min(raw_score, score_cap)
```

Role : une enorme gaffe ne doit pas permettre un score final tres eleve.

## Confidence

Par joueur :

- `high` : `analyzed_moves >= 20` et `deep_coverage >= 0.95`
- `medium` : `analyzed_moves >= 10` et `deep_coverage >= 0.70`
- `low` : sinon

Si moins de 5 coups sont analysables pour un joueur, le score est `null` et la confiance reste low.

## Source transparency

Le payload expose :

- `review_analysis_origin`
- `review_analysis_state`
- `required_position_count`
- `deep_done_count`
- `deep_missing_count`
- `deep_failed_count`
- `deep_coverage`

L'UI affiche par exemple `Analyse deja disponible` quand le cache deep est complet.

## Debug dev

En DEV seulement, un panneau replie expose :

- `analyzed_moves`
- `missing_moves`
- `avg_win_loss`
- `max_win_loss`
- `weighted_mean`
- `weighted_harmonic`
- `worst_tail`
- `score_cap`
- `raw_score`
- `final_score`
- `confidence`

## Limites

- Le score reste une v1 pratique et calibrable.
- Ce n'est pas un Elo.
- ACPL reste absent par defaut.
- La formule ne cree pas de categories de coups.
- Les scores avec faible couverture restent indicatifs ou `null`.
