# V5.1.4c Review Spinner 3s Timeout

## Pourquoi limiter le spinner visible

Les corrections V5.1.4 et V5.1.4b empêchent les états `not_reviewable`
incorrects et nettoient le polling, mais le navigateur peut encore donner une
impression de blocage si l'API ou l'analyse profonde reste en `pending`.

Décision produit V5.1.4c : l'interface Review ne doit jamais afficher
`Analyse approfondie en cours...` plus de 3 secondes. Le spinner est donc un
état d'attente court, pas une promesse que l'analyse backend va terminer dans
ce délai.

## Différence backend / UI

`REVIEW_VISIBLE_SPINNER_TIMEOUT_MS = 3000` contrôle uniquement le temps
d'affichage du spinner visible.

Cette constante ne remplace pas :

- le timeout moteur ;
- le timeout d'analyse deep ;
- le timeout backend ;
- le timeout global de pending.

Le backend peut continuer à préparer ou compléter les analyses profondes. Le
frontend, lui, arrête simplement de montrer une attente visuelle bloquante.

## État `pending_background`

Un état Review explicite `pending_background` a été ajouté.

Sens :

- l'analyse n'est pas prête ;
- le spinner n'est plus affiché ;
- le polling frontend est arrêté pour V5.1.4c ;
- l'utilisateur peut relancer une vérification avec `Vérifier à nouveau`.

Le message affiché est :

`L'analyse approfondie continue en arrière-plan. Vérifiez à nouveau dans quelques instants.`

## Bouton Vérifier à nouveau

`pending_background` affiche un bouton `Vérifier à nouveau`.

Le bouton utilise la logique existante de retry Review : il repasse par
`handleReview()`, qui vérifie d'abord les parties trop courtes puis relance la
demande Review normale si la partie est reviewable.

## Priorité d'affichage

La priorité Review devient :

1. `not_reviewable`
2. `failed`
3. `timeout`
4. `done`
5. `partial`
6. `pending_background`
7. `pending` / `generating`
8. `idle`

`not_reviewable` continue de gagner contre `pending`, `generating`,
`pending_background` et les anciens états locaux.

## Protocole de test manuel

1. Lancer backend et frontend.
2. Créer une partie trop courte de 10 demi-coups ou moins.
3. Terminer la partie.
4. Cliquer `Voir la review`.
5. Vérifier que le message `Partie trop courte pour générer une review fiable.`
   apparaît immédiatement, sans spinner.
6. Créer ou utiliser une partie reviewable dont la review n'est pas prête.
7. Cliquer `Voir la review`.
8. Vérifier que `Analyse approfondie en cours...` disparaît après 3 secondes
   maximum.
9. Vérifier que le message d'arrière-plan apparaît :
   `L'analyse approfondie continue en arrière-plan. Vérifiez à nouveau dans quelques instants.`
10. Vérifier que le bouton `Vérifier à nouveau` est visible.
11. Vérifier dans l'onglet Network que le polling Review ne continue pas en
    boucle après le passage en `pending_background`.
12. Cliquer `Vérifier à nouveau` plus tard et vérifier que la review s'affiche si elle
    est devenue `done` ou `partial`.

## Limite de validation

La validation automatisée couvre le contrat statique, les tests backend et le
build frontend. Le chronométrage réel des 3 secondes doit être confirmé en
navigateur avec le protocole ci-dessus.
