# V3.9c Manual Test

## Objectif

Verifier que l'UI ne peut plus afficher simultanement une evaluation live valide
et le warning jaune `analyse live indisponible`.

## Protocole

1. Lancer l'application.
2. Creer une nouvelle partie.
3. Jouer la sequence:
   - `d2d4`
   - `g7g6`
   - `e2e4`
   - `f8g7`
   - `b1c3`
   - `g8f6`
   - `e4e5`
4. Verifier la FEN:

```text
rnbqk2r/ppppppbp/5np1/4P3/3P4/2N5/PPP2PPP/R1BQKBNR b KQkq - 0 4
```

5. Verifier que l'evaluation est autour de `+1.5`.
6. Verifier que la barre affiche une source `live` si une update live a ete
   recue.
7. Verifier qu'aucun warning `analyse live indisponible` n'est affiche si le
   live fonctionne.
8. Jouer un nouveau coup et verifier que l'ancienne session n'alimente plus la
   barre.
9. Simuler ou provoquer une indisponibilite live:
   - la partie doit rester jouable;
   - l'evaluation shallow doit rester affichee si disponible;
   - le warning live ne doit apparaitre que si aucune update live valide n'a ete
     recue pour la session courante.

## Resultat attendu

- `+1.51 live` et `analyse live indisponible` ne doivent jamais etre visibles
  en meme temps.
- `analysis_stopped` ne doit pas produire un warning.
- Une erreur reseau apres au moins une update live valide ne doit pas rallumer
  le gros warning jaune.
