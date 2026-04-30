# V3.9e Manual Test

Objectif: verifier que les warnings d'analyse indisponible ne restent pas
affiches quand une evaluation valide, notamment live, est deja visible.

## Protocole

1. Lancer le backend FastAPI.
2. Lancer le frontend.
3. Demarrer une nouvelle partie.
4. Jouer `d2d4`.
5. Verifier que la barre affiche une evaluation live quand une update SSE est
   recue.
6. Verifier qu'aucun warning jaune
   `Moteur d'analyse indisponible. Verifie le chemin Stockfish ou NEUROCHESS_STOCKFISH_PATH.`
   ne reste affiche si la live analysis fonctionne.
7. Jouer plusieurs coups rapidement.
8. Verifier que les warnings obsoletes ne reapparaissent pas apres changement
   de position.
9. Verifier que la source affichee correspond a la position courante.
10. Casser volontairement le chemin Stockfish ou lancer sans moteur disponible,
    puis verifier que la partie reste jouable et qu'un warning clair apparait
    seulement lorsqu'aucune evaluation valide n'est disponible.

## Resultat attendu

- Evaluation live visible: aucun warning global `engine_unavailable`.
- Shallow valide: aucun warning global `engine_unavailable`.
- Deep/calibration valide si affichee: aucun warning global
  `engine_unavailable`.
- `analysis_stopped`: pas de warning moteur indisponible.
- Erreur SSE apres au moins une update valide: derniere evaluation conservee,
  pas de gros warning jaune.
- Erreur SSE avant toute evaluation valide: warning live autorise.

## Notes

Ce protocole ne modifie pas Stockfish, les profondeurs, la formule
d'evaluation, la DB, ni la separation shallow/deep/live/calibration.
