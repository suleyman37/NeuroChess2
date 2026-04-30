# V5.1.4b Short Review Frontend Guard

## Cause probable du bug restant

V5.1.4 traitait `not_reviewable` côté state machine et backend, mais le clic
`Voir la review` pouvait encore ouvrir localement un état `generating` avant que
le backend réponde. Sur une partie de 10 demi-coups, le navigateur pouvait donc
afficher `Analyse approfondie en cours...` même si la partie devait être refusée
immédiatement.

## Source utilisée pour `halfMovesCount`

Le frontend utilise :

`moveHistory?.moves.length ?? moves.length`

`moveHistory.moves` est préféré parce que cette liste contient un élément par
demi-coup avec un `ply` individuel. Elle n'est pas la liste groupée par coups
complets affichée dans `MoveHistory`. Si l'historique n'est pas encore chargé,
le fallback est `moves.length`, qui vient du `GameState` courant.

## Règle

La fonction `isShortGameForReview(halfMovesCount)` applique :

`halfMovesCount <= MIN_REVIEW_HALF_MOVES`

avec `MIN_REVIEW_HALF_MOVES = 10`.

Donc :

- 9 demi-coups : trop court ;
- 10 demi-coups : trop court ;
- 11 demi-coups ou plus : review normale.

## Garde avant POST generate

Dans `handleReview()`, le garde `currentGameIsShortForReview` est évalué avant :

- `setReviewLoading(true)` ;
- `dispatchReviewEvent({ type: "generate_started" })` ;
- `POST /games/{game_id}/review/generate`.

Si la partie est trop courte, le frontend :

- n'appelle pas `generateReview()` ;
- ne crée pas de polling ;
- force un payload local `not_reviewable` ;
- affiche `Partie trop courte pour générer une review fiable.`

## Garde anti-polling

Si une partie courte est détectée pendant un polling existant :

- `clearReviewPolling()` nettoie l'interval ;
- `reviewPollIntervalRef` revient à `null` ;
- `reviewPendingStartedAtRef` revient à `null` ;
- `reviewPollInFlightRef` revient à `false` ;
- la state machine passe à `not_reviewable`.

`not_reviewable` continue de gagner contre `loading`, `generating`, `pending`,
un ancien pending local et une ancienne réponse `GET` pending.

## Debug navigateur en dev

En `import.meta.env.DEV`, l'onglet Review affiche un bloc discret `Review debug`
avec :

- `game_id`
- `halfMovesCount`
- `MIN_REVIEW_HALF_MOVES`
- `isShortGameForReview`
- `reviewUiState`
- `review.status reçu`
- `loading`
- `pollingActive`
- `pendingStartedAt`
- `lastGenerateStatus`
- `lastGetStatus`

Ce bloc est gardé par `import.meta.env.DEV` et n'est pas destiné au build de
production.

## Protocole de test manuel

1. Lancer le backend et le frontend.
2. Créer une partie.
3. Jouer 5 coups Blancs + 5 coups Noirs, soit 10 demi-coups.
4. Terminer la partie.
5. Ouvrir Review et cliquer `Voir la review`.
6. Vérifier que le message affiché est :
   `Partie trop courte pour générer une review fiable.`
7. Vérifier dans l'onglet Network qu'aucun
   `POST /games/{game_id}/review/generate` n'est envoyé.
8. Vérifier qu'aucun `GET /games/{game_id}/review` de polling ne démarre.
9. Vérifier qu'aucun spinner `Analyse approfondie en cours...` n'apparaît.
10. Refaire un test avec 11 demi-coups : le comportement Review normal doit
    rester possible.
