# V5.2.3 - Review Critical Moment Scoring

## Objectif

Mieux selectionner les moments Review en detectant les vrais tournants de la
partie, pas seulement les plus grosses pertes brutes.

## Pourquoi la perte brute ne suffit pas

Deux coups peuvent perdre 20 points de barre, mais ne pas avoir la meme
importance produit.

Exemple :

- `50 -> 30` : la position passe d'equilibree a difficile.
- `30 -> 10` : la position etait deja difficile et devient presque perdue.

La perte brute est identique, mais le premier coup est souvent le tournant.

## Pourcentage joueur

La Review utilise la meme logique que la barre :

```text
white_percent = 100 / (1 + exp(-0.00368208 * eval_cp))
```

Raccourcis mate :

- `mate_in > 0` => `white_percent = 100`
- `mate_in < 0` => `white_percent = 0`

Pour le joueur qui vient de jouer :

- Blancs : `P = white_percent`
- Noirs : `P = 100 - white_percent`

Perte immediate :

```text
L = max(0, P_before - P_after)
```

Un coup devient candidat si :

- `L >= MIN_KEY_MOMENT_WIN_LOSS`
- ou evenement de mate significatif

Valeur actuelle :

```text
MIN_KEY_MOMENT_WIN_LOSS = 10.0
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

Chaque candidat expose :

- `zone_before`
- `zone_after`
- `zone_transition`

## Score de criticite

```text
criticality_score =
  immediate_loss
  * leverage_weight
  * transition_weight
  * persistence_weight
  * novelty_weight
```

### Leverage

```text
leverage_weight = 0.75 + 0.5 * (P_before * (100 - P_before) / 2500)
```

Les positions proches de l'equilibre portent davantage de levier.

### Transition

Poids principaux :

- `balanced -> worse` : `1.35`
- `better -> balanced` : `1.25`
- `winning -> better` : `1.10`
- `worse -> losing` : `1.20`
- `losing -> lost` : `1.15`
- `won/winning/better -> worse/losing/lost` : `1.40`

### Persistance

La Review regarde jusqu'a 10 demi-coups suivants disponibles.

```text
future_avg = moyenne du pourcentage joueur futur
persistent_loss = max(0, P_before - future_avg)
persistence_weight =
  0.75 + 0.5 * clamp(persistent_loss / max(L, 1), 0, 1)
```

Si aucune donnee future n'est disponible, le poids vaut `1.0`.

### Nouveaute

Un candidat situe a +/-2 plies d'un candidat deja plus fort recoit
`novelty_weight = 0.5`, sauf si :

- c'est un evenement de mate ;
- ou sa perte immediate vaut au moins `1.5x` la perte du voisin.

But : eviter plusieurs cartes pour le meme effondrement.

## Type de moment

`moment_type` :

- `turning_point` : Tournant de partie
- `lost_advantage` : Avantage laisse filer
- `aggravation` : Aggravation
- `decisive` : Moment decisif
- `standard_loss` : Ecart important

## Selection finale

1. Construire les candidats avec `L >= 10` ou mate event.
2. Calculer `criticality_score`.
3. Appliquer la penalite de nouveaute.
4. Trier par criticite decroissante.
5. Garder max 5.
6. Reordonner par `ply` croissant pour l'affichage.

La Review ne force jamais 5 moments.

## Aucun moment significatif

Si aucune position ne depasse le seuil :

```json
{
  "status": "done",
  "moments": [],
  "empty_reason": "no_significant_moments"
}
```

Message :

```text
Aucun moment majeur detecte : la partie est restee trop equilibree pour generer une review utile.
```

## Limites

- Le score reste base sur la barre Stockfish et la couverture deep disponible.
- La persistance utilise une fenetre simple, pas une modelisation de phase de
  partie.
- Les transitions sont des poids produit simples, faciles a auditer.

## Direction future

Expected Score Loss / WDL Loss pourra remplacer ou completer la barre Win% dans
une version ulterieure, quand le modele de performance sera stabilise.
