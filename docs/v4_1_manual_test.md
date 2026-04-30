# V4.1 Manual Test

## Protocole

1. Lancer le backend.
2. Lancer le frontend.
3. Demarrer une nouvelle partie.
4. Jouer au moins 10 demi-coups.
5. Terminer la partie.
6. Cliquer `Voir la review`.
7. Verifier que la review apparait dans l'onglet `Review`, pas sous
   l'echiquier.
8. Cliquer plusieurs coups dans l'onglet `Coups`.
9. Verifier que le clic sur le coup `ply=N` affiche la position apres le coup.
10. Utiliser `<<`, `<`, `>`, `>>`.
11. Verifier que `<<` affiche la position initiale et `>>` la position finale.
12. Cliquer `Voir sur l'echiquier` sur un moment de review.
13. Verifier que l'echiquier affiche la position avant le coup du moment.
14. Verifier le badge `Moment a revoir`.
15. Utiliser `Moment precedent` et `Moment suivant`.
16. Revenir a `Position finale`.
17. Verifier que le drag-and-drop est desactive en HISTORICAL et REVIEW.
18. Verifier que le drag-and-drop reste actif en LIVE si la partie est en cours.
19. En build production, verifier que l'onglet `Infos` n'est pas visible.
20. En dev, verifier que l'onglet `Infos` contient Game ID, FEN affichee, FEN
    actuelle, mode et ply affiche.
21. Verifier que les boutons gardent un focus visible au clavier.
22. Verifier que ArrowLeft, ArrowRight, Home et End naviguent uniquement quand
    aucun champ de saisie n'a le focus.
23. Simuler une erreur `GET /games/{game_id}/moves` si possible et verifier que
    l'onglet Coups affiche `Impossible de charger l'historique.` avec
    `Reessayer`, sans crash.

## Points a verifier

- Aucun ACPL visible.
- Aucune accuracy visible.
- Aucun score global visible.
- Aucun mot blunder/mistake/inaccuracy visible.
- Les badges restent sobres.
- Le panneau droit reste utilisable avec moments vides, pending, partial et
  done.

## Resultat attendu

V4.1 doit permettre de lire une partie, feuilleter ses positions et consulter
les moments de review sans confondre:

- position reelle de la partie;
- position historique apres un coup;
- position avant un moment de review.
