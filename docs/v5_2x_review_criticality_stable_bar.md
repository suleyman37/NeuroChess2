# V5.2.x - Review Criticality + Stable Review Bar

## Objectif

Ameliorer la Review post-game pour selectionner les vrais moments cles et afficher une barre stable en mode Review.

Cette mission reste limitee a la Review. Elle ne lance pas V6, ne modifie pas Stockfish, ne touche pas l'opening book, ne lance pas d'analyse massive et n'invente pas de score sur 100.

## Pourquoi `cp_loss` brut est insuffisant

Une perte brute identique ne signifie pas toujours la meme chose.

Exemple :

- `50% -> 30%` : passage d'une position equilibree a une position difficile.
- `30% -> 10%` : aggravation d'une position deja difficile.

La Review doit donc mesurer la criticite du moment, pas seulement l'amplitude brute.

## Win% joueur

La formule de barre reste la source :

```text
white_percent = 100 / (1 + exp(-0.00368208 * eval_cp))
```

`eval_cp` reste POV Blancs.

Raccourcis mate :

- `mate_in > 0` => `white_percent = 100.0`
- `mate_in < 0` => `white_percent = 0.0`

Pour le joueur qui vient de jouer :

- Blanc : `P = white_percent`
- Noir : `P = 100 - white_percent`

La perte immediate est :

```text
L = max(0, P_before - P_after)
```

## Zones

`player_eval_zone(P)` :

- `won` : `P >= 90`
- `winning` : `75 <= P < 90`
- `better` : `60 <= P < 75`
- `balanced` : `40 <= P < 60`
- `worse` : `25 <= P < 40`
- `losing` : `10 <= P < 25`
- `lost` : `P < 10`

Chaque moment expose `zone_before`, `zone_after` et `zone_transition`.

## Criticality score

Seuil unique :

```text
CRITICALITY_THRESHOLD = 10.0
```

Formule :

```text
criticality_score =
  L
  * leverage_weight
  * transition_weight
  * persistence_weight
  * reliability_weight
```

Il n'y a pas de `RAW_LOSS_FLOOR`.

Un coup est candidat si :

- `mate_event = true`
- ou `criticality_score >= 10.0`

## Leverage

```text
leverage_weight = 0.75 + 0.5 * (P_before * (100 - P_before) / 2500)
```

Le poids est maximal pres de 50%, plus faible aux extremes.

## Transition weights

Transitions principales :

- `won -> winning` : `0.85`
- `winning -> better` : `0.90`
- `better -> balanced` : `1.25`
- `balanced -> worse` : `1.35`
- `balanced -> losing/lost` : `1.40`
- `better/winning/won -> worse/losing/lost` : `1.40`
- `worse -> losing` : `1.15`
- `losing -> lost` : `1.10`
- meme zone `won/winning/lost` : `0.80`
- default : `1.0`

## Persistance

La Review regarde les demi-coups suivants disponibles et calcule la moyenne future du pourcentage joueur.

```text
persistent_loss = max(0, P_before - future_avg)
persistence_weight = 0.75 + 0.5 * clamp(persistent_loss / max(L, 1), 0, 1)
```

Si les donnees futures manquent, le poids vaut `1.0`.

## Reliability

Version simple :

- deep fiable : `1.0`
- deep faible : `0.7`
- reliability inconnue : `0.8`
- pas de deep : pas de candidat

## Moment types

- `turning_point` : Tournant de partie
- `lost_advantage` : Avantage laisse filer
- `aggravation` : Aggravation
- `decisive` : Moment decisif
- `standard_loss` : Ecart important

## Temporal NMS

La selection applique `temporal_non_max_suppression` :

- candidats tries par `criticality_score` decroissant ;
- un candidat est rejete s'il est a `<= 2` plies d'un moment deja garde ;
- exception : `mate_event`;
- exception : score au moins `1.5x` le voisin deja garde ;
- maximum `5` moments ;
- affichage final trie par ply croissant.

La Review affiche donc `0` a `5` moments, jamais forces.

## no_significant_moments

Si la couverture deep est suffisante et qu'aucun candidat ne passe le seuil :

```json
{
  "status": "done",
  "moments": [],
  "empty_reason": "no_significant_moments"
}
```

Message UI :

`Aucun moment majeur detecte : la partie est restee trop equilibree pour generer une review utile.`

## Stable Review Bar

En mode Review, la barre lit uniquement le payload `ReviewMoment` :

- `eval_before_cp` / `mate_before`
- `eval_after_cp` / `mate_after`

Elle n'utilise pas live, shallow ou `currentFen`.

Source UI :

```text
review_deep_snapshot
```

Si les donnees manquent, le fallback est :

`Evaluation non disponible pour ce moment.`

Pas de message `moteur indisponible`.

## Animation

`Voir sur l'echiquier` :

1. place le board sur `fen_before` ;
2. passe a `fen_after` apres un court delai ;
3. laisse `react-chessboard` animer le deplacement ;
4. conserve les highlights Review ;
5. anime la barre before -> after ;
6. affiche le delta joueur rouge/vert.

## Limites

- Pas de deux passes scan/confirmation dans cette version.
- Pas de nouveau score global.
- Pas de recalcul massif automatique des anciennes reviews.
- Validation navigateur humaine encore necessaire.
