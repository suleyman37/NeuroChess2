# V4 Manual Test

## Protocole

1. Lancer le backend.
2. Lancer le frontend.
3. Demarrer une nouvelle partie.
4. Jouer au moins 20 demi-coups.
5. Terminer la partie avec le bouton `Terminer partie`.
6. Attendre les analyses deep si le bouton retourne `pending`.
7. Cliquer `Voir la review`.
8. Verifier les etats:
   - `pending`: message `Analyse approfondie en cours...`;
   - `partial`: note discrete de review partielle;
   - `done`: liste de moments ou message neutre sans moments.
9. Verifier que les moments affichent:
   - numero de ply;
   - coup joue;
   - coup moteur recommande;
   - `cp_loss_label`;
   - evaluation avant -> apres;
   - commentaire factuel.
10. Verifier que l'UI n'affiche pas:
    - ACPL;
    - accuracy;
    - score global;
    - note globale;
    - classification humiliant le coup ou le joueur;
    - diagnostic de style.
11. Verifier que les moments correspondent a des analyses deep `status='done'`.
12. Verifier que l'app reste jouable sur une nouvelle partie.

## Resultats attendus

- Partie en cours: pas de bouton `Voir la review`.
- Partie terminee avec moins de 10 demi-coups: pas de bouton `Voir la review`.
- Partie terminee avec au moins 10 demi-coups: bouton visible.
- Coverage deep suffisant: review `done` ou `partial`.
- Coverage deep insuffisant: review `pending`, sans moments forces.
- Aucun moment majeur: message
  `Aucun moment majeur détecté avec les analyses disponibles.`

## Notes

V4 ne modifie pas Stockfish, la barre d'evaluation, la live analysis, ni la
separation shallow/deep/live/calibration.
