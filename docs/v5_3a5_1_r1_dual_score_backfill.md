# V5.3.A5-1-R1 - Dual Score Backfill

## Objectif

Garantir qu'une Review complete avec coverage 100 % expose toujours les trois
metriques A5-1 pour chaque couleur analysable :

- `lichess_like_accuracy`
- `neuro_score`
- `diagnostic_gap`

Le rebuild ne relance jamais Stockfish. Il utilise seulement les analyses deja
presentes dans `position_analyses`.

## Endpoint

```http
POST /games/{game_id}/review/rebuild-metrics?profile=standard
```

Comportement :

- recharge la partie ;
- recharge la Review courante ;
- recalcule la couverture pour le profil demande ;
- si la couverture est incomplete, retourne un payload incomplete sans scores ;
- si la couverture est complete, reconstruit les metriques depuis les analyses
  cachees ;
- si une Review est pending/partial mais que toutes les positions existent,
  finalise la Review sans relancer le moteur.

## Disponibilite des scores

Le payload expose :

```json
{
  "score_availability": {
    "lichess_like": "available",
    "neuro_score": "available",
    "diagnostic_gap": "available",
    "reason": "available",
    "white": {
      "lichess_like": "available",
      "neuro_score": "available",
      "diagnostic_gap": "available",
      "move_count_analyzed": 42
    },
    "black": {
      "lichess_like": "available",
      "neuro_score": "available",
      "diagnostic_gap": "available",
      "move_count_analyzed": 41
    }
  }
}
```

Raisons possibles :

- `available`
- `missing_data`
- `insufficient_moves`
- `legacy_needs_rebuild`
- `missing_dependency`

## Alias legacy

Les champs historiques restent presents :

- `white_review_score`
- `black_review_score`
- `user_review_score`
- `opponent_review_score`

Ils sont explicitement des alias de `lichess_like_accuracy` :

```json
{
  "review_score_deprecated": true,
  "review_score_alias_of": "lichess_like_accuracy"
}
```

Ils ne doivent jamais etre interpretes comme NeuroScore.

## UI

Si les deux scores sont disponibles, le resume affiche :

- Accuracy Lichess-like ;
- Score NeuroChess ;
- Ecart diagnostique ;
- confiance.

Si la Review est complete mais qu'un payload legacy fournit seulement
`*_review_score`, l'UI affiche :

> Cette analyse complete doit etre mise a jour avec les nouvelles metriques.

et propose :

> Recalculer les metriques

Ce bouton appelle l'endpoint de rebuild et ne relance pas Stockfish.

## Texte UI

Les mojibakes visibles ont ete corriges dans `ReviewPanel.tsx` :

- `temps prévu`
- `Standard recommandé`
- separateur `·`
- `qualité`
- `pénalise`

## Limites

- Les metriques ne sont pas persistees dans une colonne `score_json`, car le
  schema actuel n'en possede pas.
- Le rebuild est donc un recalcul de payload depuis les analyses cachees.
- Aucune calibration corpus Chess.com/Lichess n'est ajoutee.
- Aucun LLM n'est appele.
