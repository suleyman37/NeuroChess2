# V5.1.4 Review Spinner State Audit

## Objectif

Auditer le flux réel de l'onglet Review après V5.1.3, car le navigateur peut
encore afficher `Analyse approfondie en cours...` indéfiniment.

## Flux frontend observé

- Le clic utilisateur sur `Voir la review` appelle `handleReview()` dans
  `frontend/src/App.tsx`.
- `handleReview()` appelle `POST /games/{game_id}/review/generate` via
  `generateReview(gameId)`.
- Si la réponse est `pending`, le frontend démarre le polling avec
  `startReviewPending()`.
- Le polling appelle `GET /games/{game_id}/review` via `getReview(gameId)`.
- Le polling s'arrête via `clearReviewPolling()` sur `timeout`,
  `not_reviewable`, `done`, `partial`, `failed`, changement de game, nouvelle
  partie, nouveau coup, erreur de poll ou unmount.

## Cause exacte trouvée

Le blocage venait du frontend, pas de Stockfish ni de la logique `cp_loss` :

- `ReviewPanel` pouvait encore afficher le spinner via `loading`, sans statut
  Review explicite.
- Le polling était une boucle async `while` locale, pas un interval réellement
  stocké et nettoyé.
- `clearReviewPolling()` invalidait un compteur mais ne pouvait pas arrêter une
  boucle déjà en cours.
- Un ancien pending pouvait donc continuer à appliquer des réponses après un
  changement de game ou après une transition terminale.
- `not_reviewable` dépendait encore d'un fallback local si le backend répondait
  en erreur HTTP, ce qui rendait le chemin frontend moins direct.

## State qui déclenchait le spinner

Avant correction, le spinner pouvait venir de :

- `loading === true` dans `ReviewPanel`;
- `review.status === "pending"` ou `"running"`.

Après correction, le spinner ne peut être rendu que si le statut explicite de
la state machine est `generating` ou `pending`.

## Timeout

Le timeout attendu est `REVIEW_PENDING_TIMEOUT_MS = 60000`.

Après correction :

- `reviewPendingStartedAtRef` est défini une seule fois quand pending commence ;
- chaque poll calcule `Date.now() - reviewPendingStartedAtRef.current` ;
- le timeout n'est pas réinitialisé à chaque poll ;
- à 60 secondes, `triggerReviewTimeout()` arrête le polling et force le statut
  `timeout`.

## not_reviewable

Après correction, `not_reviewable` gagne toujours contre loading/pending :

- `status === "not_reviewable"` gagne ;
- `reviewable === false` gagne ;
- `reason === "game_too_short"` gagne ;
- aucune réponse `not_reviewable` ne peut être suivie par un pending local.

## Logs dev ajoutés

Les logs sont émis uniquement via `debugLog()`, donc en dev :

- `review_generate_request`
- `review_generate_response`
- `review_get_request`
- `review_get_response`
- `review_state_transition`
- `review_poll_created`
- `review_poll_cleared`
- `review_pending_started_at`
- `review_pending_elapsed_ms`
- `review_timeout_triggered`
- `review_not_reviewable_wins`

## Backend vérifié

`ReviewService` renvoie maintenant un payload normal `not_reviewable` pour une
partie trop courte. Le payload contient :

- `status`
- `reviewable`
- `half_moves_count`
- `min_half_moves_for_review`
- `reason`
- `missing_deep_count`
- `total_required_deep_count`

Pour un pending reviewable, les compteurs `missing_deep_count` et
`total_required_deep_count` sont conservés dans les réponses API.
