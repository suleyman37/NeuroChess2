# V5.1.4d Review No Significant Moments

## Différence entre pending et no_significant_moments

`pending` signifie que la review ne peut pas encore conclure parce que des
analyses deep nécessaires manquent encore.

`no_significant_moments` signifie que la review est possible, que la couverture
deep est suffisante, mais qu'aucun coup ne mérite une carte de review.

L'UI ne doit donc pas afficher `analyse en arrière-plan` quand le backend a déjà
conclu qu'il n'y a aucun moment majeur.

## Définition d'un moment significatif

Un moment est sélectionné si le coup dépasse le seuil existant
`MIN_CP_LOSS_FOR_MOMENT = 50`, ou si un changement de mate significatif est
détecté.

Les moments sont ensuite triés par `importance_score` et limités à
`MAX_REVIEW_MOMENTS = 5`.

## Pourquoi ne pas forcer 3 à 5 moments

La review doit rester utile et non culpabilisante. Si aucun coup ne dépasse le
seuil existant, `moments=[]` est une sortie valide.

Forcer des moments faibles créerait une review artificielle et pourrait
présenter une partie équilibrée comme une suite d'erreurs.

## Payload backend

Les réponses `GET /games/{game_id}/review` et
`POST /games/{game_id}/review/generate` exposent maintenant :

- `empty_reason = "game_too_short"` pour les parties trop courtes ;
- `empty_reason = "no_significant_moments"` pour une review terminée sans
  moment significatif ;
- `empty_reason = null` sinon.

Si `status = "pending"`, le payload contient :

- `missing_deep_count`
- `analyzed_deep_count`
- `total_required_deep_count`
- `message`

Si une ancienne review `pending` est relue alors que la couverture deep est
devenue suffisante, `GET /review` finalise la review et peut retourner
`no_significant_moments` au lieu de rester pending.

## Comportement UI

Priorité d'affichage Review :

1. `not_reviewable` / `game_too_short`
2. `failed`
3. `timeout`
4. `done` ou `partial` avec `empty_reason = "no_significant_moments"`
5. `done` ou `partial` avec moments
6. `pending_background`
7. `pending` / `generating`
8. `idle`

Message sans moment significatif :

`Aucun moment majeur détecté : la partie est restée trop équilibrée pour générer une review utile.`

Message pending en arrière-plan :

`L'analyse approfondie continue en arrière-plan. Vérifiez à nouveau dans quelques instants.`

Dans ce cas, le bouton s'appelle `Vérifier à nouveau` et lance un `GET /review`
avant de décider quoi afficher.

## Protocole de test manuel

1. Lancer backend et frontend.
2. Jouer une partie de 10 demi-coups ou moins, terminer, puis ouvrir Review.
3. Vérifier que l'UI affiche :
   `Partie trop courte pour générer une review fiable.`
4. Jouer ou charger une partie assez longue avec analyses deep disponibles mais
   sans coup au-dessus du seuil.
5. Vérifier que l'UI affiche :
   `Aucun moment majeur détecté : la partie est restée trop équilibrée pour générer une review utile.`
6. Vérifier qu'aucun spinner et aucun message `analyse en arrière-plan` ne sont
   affichés dans ce cas.
7. Créer une partie reviewable avec analyses deep manquantes.
8. Vérifier que le spinner disparaît après 3 secondes maximum.
9. Vérifier que l'UI affiche :
   `L'analyse approfondie continue en arrière-plan. Vérifiez à nouveau dans quelques instants.`
10. Vérifier que le bouton affiché est `Vérifier à nouveau`.
11. Cliquer `Vérifier à nouveau` et confirmer dans Network que la requête est
    `GET /games/{game_id}/review`.
12. Quand la review est `done` ou `partial`, vérifier que l'UI affiche soit les
    cartes de review, soit le message `no_significant_moments`.
