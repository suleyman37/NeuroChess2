# V5.3.A3 - Review Score Validation

## Objectif

Rendre le score Review 0-100 verifiable et plus facile a calibrer :

- expliquer pourquoi une Review peut etre instantanee ;
- afficher la qualite et la couverture de l'analyse ;
- exposer les composants du score en debug DEV ;
- recalibrer les caps trop punitifs de V5.3.A2 ;
- garder le score strictement base sur des analyses deep / snapshots Review.

## Ce que le score utilise

Le score utilise tous les coups analysables, pas seulement les cartes Review.

Un coup est analysable si :

- le joueur qui vient de jouer est connu ;
- `fen_before` et `fen_after` ont des evaluations deep `done` exploitables ;
- les champs eval ou mate avant/apres existent.

Exclusions strictes :

- pas de live ;
- pas de shallow ;
- pas de currentFen ;
- pas de fallback 50 % ;
- pas de fallback 100 %.

## Win% et perte par coup

`eval_cp` est POV Blancs :

```text
white_percent = 100 / (1 + exp(-0.00368208 * eval_cp))
```

Mats :

```text
mate_in > 0 => white_percent = 100
mate_in < 0 => white_percent = 0
```

Pour Blancs :

```text
P = white_percent
```

Pour Noirs :

```text
P = 100 - white_percent
```

Perte du joueur :

```text
win_loss = max(0, P_before - P_after)
```

L'unite est le point de Win%, pas le centipion.

## Score coup

```text
move_score = 103.1668 * exp(-0.04354 * win_loss) - 3.1669
move_score = clamp(move_score, 0, 100)
```

Le score coup baisse quand la perte de Win% augmente.

## Formule `neuro_review_score_v1_1`

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
weighted_mean = sum(weight_i * move_score_i) / sum(weight_i)
```

### Moyenne harmonique ponderee

```text
safe_score_i = max(move_score_i, 5)
weighted_harmonic = sum(weight_i) / sum(weight_i / safe_score_i)
```

Role : rendre les tres mauvais coups plus visibles dans le score final.

### Worst-tail

```text
worst_count = max(1, ceil(0.15 * n))
worst_tail = moyenne des worst_count plus faibles move_score_i
```

Role : ne pas laisser plusieurs mauvais coups se perdre dans une moyenne globale.

### Score brut

```text
raw_score =
  0.50 * weighted_mean
  + 0.30 * weighted_harmonic
  + 0.20 * worst_tail
```

### Caps V5.3.A3

V5.3.A2 pouvait etre trop punitive. V5.3.A3 adoucit les caps :

```text
if max_win_loss >= 60: score_cap = 60
elif max_win_loss >= 45: score_cap = 70
elif max_win_loss >= 35: score_cap = 78
elif max_win_loss >= 25: score_cap = 86
else: score_cap = 100

final_score = min(raw_score, score_cap)
```

Le cap empeche une enorme gaffe de garder un score artificiellement haut, sans
ecraser trop fortement une partie autrement correcte.

## Qualite d'analyse

Le payload expose `review_analysis_quality` :

- `cached` : analyses deep deja disponibles ;
- `standard` : analyses deep programmees par le pipeline actuel ;
- `fast` : reserve, non pretendu si non supporte ;
- `deep` : reserve, non pretendu si non supporte.

La Review expose aussi :

- `review_analysis_origin`
- `review_analysis_state`
- `required_position_count`
- `deep_done_count`
- `deep_missing_count`
- `deep_failed_count`
- `deep_coverage`

Si une Review est instantanee, l'UI peut maintenant afficher que l'analyse etait
deja disponible via cache.

## Debug score

En DEV seulement, le panneau replie expose par couleur :

- coups analyses ;
- coups manquants ;
- moyenne Win% loss ;
- pire Win% loss ;
- weighted_mean ;
- weighted_harmonic ;
- worst_tail ;
- score_cap ;
- raw_score ;
- final_score ;
- depth min/max/moyenne ;
- engine_versions.

Le tableau `review_score_audit_rows` expose en plus chaque coup, ses evaluations,
sa perspective, sa perte, son poids et ses sources.

## Comparaison avec Chess.com

NeuroChess ne vise pas l'egalite exacte avec Chess.com.

Chess.com utilise CAPS2, une formule proprietaire. Les ecarts peuvent venir :

- du moteur ;
- de la profondeur ;
- de la conversion Win% ;
- de la ponderation ;
- de la gestion des positions gagnees/perdues ;
- de la couverture deep disponible.

Ordre de grandeur attendu :

- 3 a 8 points d'ecart peuvent etre normaux ;
- 20+ points doivent etre audites avec les composants par coup.

## Limites

- Le score reste calibrable apres usage reel.
- `fast` et `deep` ne sont pas encore des modes moteur garantis si
  l'infrastructure ne les supporte pas.
- Le score n'est pas un Elo.
- ACPL n'est pas affiche par defaut.
- Aucun mode V5.3.B, categorie de coups ou mode Essayer n'est introduit.

## Protocole manuel

1. Lancer une Review sur une partie deja analysee.
2. Verifier que l'UI affiche `Analyse deja disponible` si le cache est complet.
3. Verifier couverture et confiance.
4. En DEV, ouvrir le debug replie.
5. Comparer les coups a forte `win_loss` avec le score final.
6. Verifier qu'une mauvaise partie ne reste pas proche de 90.
7. Comparer a Chess.com comme ordre de grandeur, pas comme egalite stricte.
