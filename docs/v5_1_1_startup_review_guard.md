# V5.1.1 Startup Engine Warning + Short Game Review Guard

## Objectif

V5.1.1 corrige deux problemes UX:

- ne pas afficher un warning moteur definitif si le moteur live est seulement
  en train de demarrer;
- ne jamais laisser la review spinner sur une partie trop courte.

## Warning moteur

Le frontend distingue maintenant un etat transitoire d'un etat definitif:

1. premiere erreur live-analysis: etat discret `Initialisation du moteur...`;
2. retry apres 500 ms;
3. retry apres 1500 ms;
4. si tout echoue encore, affichage du warning reel
   `analyse live indisponible`.

Pendant cette periode de grace, les warnings API
`analysis_engine_unavailable`, `engine_unavailable` et
`live_analysis_unavailable` sont filtres pour eviter un faux warning jaune.

Des qu'une update live valide arrive:

- l'etat d'initialisation est efface;
- les warnings moteur obsoletes sont retires;
- la barre reprend son comportement normal.

Si le moteur est vraiment absent, le warning reste affiche apres les retries.

## Review partie courte

La constante backend reste:

```text
MIN_HALF_MOVES_FOR_REVIEW = 10
```

`POST /games/{game_id}/review/generate` ne retourne plus `pending` pour une
partie trop courte. Il retourne une reponse 400 structuree:

```json
{
  "status": "not_reviewable",
  "reason": "game_too_short",
  "min_half_moves": 10,
  "actual_half_moves": 3,
  "message": "Partie trop courte pour générer une review fiable."
}
```

`GET /games/{game_id}/review` retourne aussi `not_reviewable` pour une partie
terminee trop courte sans review.

## Frontend review

`ReviewPanel` gere `status="not_reviewable"` avec un message stable:

```text
Partie trop courte pour générer une review fiable.
```

Il n'affiche pas de spinner dans cet etat. Le bouton `Voir la review` reste
cache tant que la partie terminee a moins de 10 demi-coups.

## Anti-spinner infini

- `pending` garde le polling existant, limite a 60 secondes.
- `not_reviewable` stoppe immediatement.
- `failed` affiche le message d'echec existant.
- `done` sans moments affiche le message neutre existant.

## Limites

V5.1.1 ne modifie pas Stockfish, la formule d'evaluation, le book d'ouvertures,
la classification, `cp_loss`, `importance_score` ou l'algorithme de selection
des moments au-dela du garde partie trop courte.

