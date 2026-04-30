# V5.1.4 Hard Stop Review Spinner

## Cause exacte

Le spinner infini Review venait d'une priorité frontend incorrecte et d'un
polling non annulable :

- `loading` pouvait afficher `Analyse approfondie en cours...` sans statut
  Review explicite ;
- l'ancien polling était une boucle async qui survivait aux transitions locales ;
- un ancien pending pouvait rester actif après changement de game, timeout ou
  réponse terminale ;
- `not_reviewable` n'était pas traité comme réponse normale de l'API.

## Correction frontend

Une state machine explicite pilote maintenant l'onglet Review :

- `idle`
- `generating`
- `pending`
- `done`
- `partial`
- `not_reviewable`
- `failed`
- `timeout`

Priorité d'affichage :

1. `not_reviewable`
2. `failed`
3. `timeout`
4. `done`
5. `partial`
6. `pending` / `generating`
7. `idle`

`ReviewPanel` ne reçoit plus `loading` comme source d'affichage du spinner. Le
spinner dépend seulement du statut explicite `pending` ou `generating`.

## Correction backend

Pour une partie trop courte, `POST /games/{game_id}/review/generate` renvoie un
payload `not_reviewable` exploitable directement par le frontend au lieu de
forcer un chemin d'erreur HTTP.

`GET /games/{game_id}/review` continue de faire gagner `not_reviewable` sur une
ancienne review pending si la partie a 10 demi-coups ou moins.

## Timeout stable

`REVIEW_PENDING_TIMEOUT_MS = 60000`.

Le timestamp `reviewPendingStartedAtRef` est stable :

- défini seulement au premier passage en pending ;
- conservé entre les polls ;
- remis à `null` uniquement par reset explicite, retry ou état terminal.

À 60 secondes :

- le polling est arrêté ;
- le statut devient `timeout` ;
- l'UI affiche `L'analyse prend plus de temps que prévu. Réessayez plus tard.`

## Preuve anti-spinner infini

Un spinner infini est impossible parce que :

- `not_reviewable`, `failed`, `timeout`, `done` et `partial` sont terminaux ;
- chaque état terminal appelle `clearReviewPolling()` ;
- `clearReviewPolling()` nettoie l'interval, invalide le run id et remet le
  timestamp pending à `null` ;
- le changement de `game_id`, un nouveau coup, une nouvelle partie et l'unmount
  appellent aussi `clearReviewPolling()` ;
- `ReviewPanel` ne peut pas afficher le spinner depuis `loading=true`.

## Protocole de test manuel

1. Lancer backend et frontend.
2. Créer une partie.
3. Jouer exactement 10 demi-coups.
4. Terminer la partie.
5. Ouvrir l'onglet Review et cliquer `Voir la review`.
6. Vérifier que le message affiché est :
   `Partie trop courte pour générer une review fiable.`
7. Vérifier qu'aucun spinner Review ne reste visible.
8. Sur une partie reviewable avec analyses deep manquantes, vérifier que le
   statut pending finit en `timeout` après 60 secondes maximum.
9. Changer de partie ou démarrer une nouvelle partie pendant un pending et
   vérifier que l'ancien polling ne réapplique aucun état.

## Limite de vérification

Test navigateur réel : à exécuter si un harness browser est disponible. Sinon,
documenter explicitement `Test navigateur réel non exécuté faute de harness browser.`
