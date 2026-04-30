# V5.3.A5-1 - Review Metric Core

## Objectif

V5.3.A5-1 separe deux mesures qui ne doivent pas raconter la meme chose :

- `Lichess-like Accuracy` : score public, neutre, base sur la perte de Win%.
- `NeuroChess Score` : score diagnostique, plus sensible aux pertes
  persistantes ou groupees, mais regulier et borne.

Aucune categorie de coups, aucun Study Mode, aucun V6, aucun LLM et aucun Elo
NeuroChess ne sont introduits.

## Base Win%

`eval_cp` est toujours en POV Blancs.

```text
white_percent = 100 / (1 + exp(-0.00368208 * eval_cp))
```

Mats :

- `mate_in > 0` => `white_percent = 100`
- `mate_in < 0` => `white_percent = 0`

POV joueur :

- Blancs : `P = white_percent`
- Noirs : `P = 100 - white_percent`

Perte par coup :

```text
win_loss = max(0, P_before - P_after)
```

L'unite est le point de Win%, pas le centipion.

## Move Accuracy Lichess-like

Version :

```text
move_accuracy_formula_version = "lichess_exp_uncertainty_v1"
```

Formule :

```text
raw_accuracy =
103.1668100711649 * exp(-0.04354415386753951 * win_loss)
- 3.166924740191411

move_accuracy = clamp(raw_accuracy + 1, 0, 100)
```

Le `+1` est le bonus d'incertitude de la logique Lichess-like.

## Game Accuracy Lichess-like

Version :

```text
game_accuracy_formula_version = "lichess_weighted_harmonic_v1"
```

Pour chaque couleur :

```text
n = nombre de coups analysables
window_size = clamp(floor(n / 10), 2, 8)
volatility_i = standard deviation locale des Win% joueur
weight_i = clamp(volatility_i, 0.5, 12.0)
weighted_mean = sum(move_accuracy_i * weight_i) / sum(weight_i)
harmonic_mean = n / sum(1 / max(move_accuracy_i, 1e-6))
lichess_like_game_accuracy = (weighted_mean + harmonic_mean) / 2
```

Ce score n'utilise pas :

- `criticality_score`
- persistence
- cluster
- worst-tail
- cap par pire perte
- NeuroScore

## NeuroChess Score Regulier

Version :

```text
neuro_score_formula_version = "neuro_diagnostic_regularized_v1"
```

Pour chaque coup :

```text
L_t = win_loss
```

Persistence :

```text
future_avg = moyenne des Win% joueur futurs disponibles
persistent_loss = max(0, P_before - future_avg)
persistence_ratio = clamp(persistent_loss / max(L_t, 1), 0, 1)
R_t = 1.0 + 0.25 * persistence_ratio
```

Cluster :

```text
K_t = 1.0 + 0.25 * clamp(cluster_memory / 50, 0, 1)
cluster_memory = 0.6 * cluster_memory + L_t
```

Diagnostic :

```text
Omega_t = clamp(R_t * K_t, 1.0, 1.75)
D_t = L_t * Omega_t
```

Agregation :

```text
mu = mean(D_t)
tail_count = min(max(3, ceil(0.10 * n)), n)
tau = mean(top tail_count D_t)
Z = 0.65 * mu + 0.35 * tau
neuro_score = 100 * exp(-0.035 * Z)
```

Le NeuroScore V1 n'utilise pas :

- criticality global weight
- sharpness
- max-loss cap
- cap arbitraire par pire perte

## Diagnostic Gap

```text
diagnostic_gap = lichess_like_accuracy - neuro_score
```

Un gap faible signifie que les deux lectures racontent une histoire similaire.
Un gap eleve indique que la partie peut etre correcte en moyenne mais contenir
des erreurs persistantes ou groupees.

## Payload Review

Champs exposes par couleur ou par POV utilisateur :

- `white_lichess_like_accuracy`
- `black_lichess_like_accuracy`
- `user_lichess_like_accuracy`
- `opponent_lichess_like_accuracy`
- `white_neuro_score`
- `black_neuro_score`
- `user_neuro_score`
- `opponent_neuro_score`
- `white_diagnostic_gap`
- `black_diagnostic_gap`
- `user_diagnostic_gap`
- `opponent_diagnostic_gap`
- `move_accuracy_formula_version`
- `game_accuracy_formula_version`
- `neuro_score_formula_version`

Les anciens champs `*_review_score` restent des alias de l'accuracy publique
pour eviter de casser les clients existants.

## UI

Le resume Review affiche apres `completed` :

- Accuracy Lichess-like
- Score NeuroChess
- Ecart diagnostique
- Confiance

Le texte court explique que l'accuracy mesure la qualite moyenne des coups,
tandis que le Score NeuroChess penalise davantage les erreurs persistantes ou
groupees.

## Evidence JSON

Un contrat minimal `review_evidence_v1` est prepare pour chaque coup audite.
Il contient les FEN, evals, Win%, pertes, accuracy, diagnostic loss, zones,
top moves, profil moteur, profondeur, fiabilite et instructions de prudence.

Aucun LLM n'est appele.

## Limites

- Pas de calibration contre un corpus Chess.com/Lichess dans cette version.
- Pas de categories de coups.
- Pas de Study Mode.
- Pas de moyenne harmonique NeuroChess punitive hors formule regulee.
- Les anciennes Reviews peuvent ne pas contenir les nouveaux champs et doivent
  etre recalculees pour profiter du nouveau payload complet.
