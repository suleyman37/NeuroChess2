# V5.2.3 - Audit Review Critical Moment

## Objectif

Auditer la selection actuelle des moments Review avant d'ajouter un modele de
criticite.

## Selection actuelle

- La Review construit les coups candidats depuis les coups de la partie.
- Pour chaque coup, elle lit l'analyse deep de `fen_before` et de `fen_after`.
- Si une analyse deep manque, la review peut rester `pending` ou devenir
  `partial` selon la couverture.
- Les analyses shallow/live ne sont pas utilisees pour selectionner les moments.
- Le seuil principal est une perte de Win% du joueur qui vient de jouer :
  `MIN_SIGNIFICANT_WIN_LOSS = 10.0`.
- Les changements de mate sont toujours significatifs.

## Importance avant V5.2.3

Avant V5.2.3, `importance_score` utilisait surtout :

```text
mover_win_loss * reliability_score * context_weight
```

En pratique, `context_weight` vaut `1.0` quand aucun contexte fiable n'est
disponible. Deux coups avec la meme perte immediate etaient donc presque
equivalents.

## Tri

- Les candidats etaient tries par `importance_score` decroissant.
- Les 5 meilleurs maximum etaient gardes.
- Les moments gardes etaient ensuite reordonnes par `ply` croissant pour
  l'affichage.

## Max 5 non force

La Review ne force pas 5 moments :

- 0 candidat => `done`, `moments=[]`,
  `empty_reason="no_significant_moments"`.
- 1 a 5 candidats => seulement les candidats reels sont affiches.
- plus de 5 candidats => max 5 sont gardes.

## Limites constatees

- Une perte `50 -> 30` et une perte `30 -> 10` etaient trop proches si la perte
  immediate etait identique.
- Le modele ne favorisait pas assez les transitions de zone, par exemple
  `balanced -> worse`.
- Il ne distinguait pas explicitement :
  - tournant de partie ;
  - avantage laisse filer ;
  - aggravation ;
  - moment decisif.
- Plusieurs moments proches dans le meme effondrement pouvaient rester
  competitifs si leurs pertes brutes etaient fortes.

## Conclusion

La Review doit selectionner des moments vitaux, pas simplement les plus grosses
pertes brutes. V5.2.3 ajoute donc une criticite fondee sur la perte immediate,
l'etat initial, la transition de zone, la persistance et la nouveaute du moment.
