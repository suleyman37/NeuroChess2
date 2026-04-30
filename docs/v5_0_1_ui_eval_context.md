# V5.0.1 Opening UI + Evaluation Context

## Objectif

V5.0.1 rend visible la classification d'ouverture V5 et change la regle de la
barre d'evaluation: elle juge toujours la position affichee a l'ecran.

Note V5.2: cette regle est maintenant implementee par une session live
universelle liee a `boardFen`. Les sections ci-dessous decrivent la base
V5.0.1; V5.2 etend cette logique en analysant aussi les positions
historiques/review en live.

## Affichage ouverture

L'ouverture est affichee dans une ligne discrete au-dessus du layout principal,
sans creer d'onglet Ouvertures.

La ligne affiche:

- nom d'ouverture si une classification existe;
- ECO si disponible;
- dernier ply de livre;
- sortie de livre et couleur si disponibles.

Si aucune classification n'existe:

- l'UI affiche `Ouverture : non classifiée`;
- un bouton discret `Classifier l'ouverture` appelle
  `POST /games/{game_id}/opening/classify`.

Depuis V5.1, si le book n'a pas encore ete importe, le clic sur
`Classifier l'ouverture` peut preparer le book local offline puis classifier la
partie. Le message bloquant `Book d'ouvertures non importe` n'est plus l'etat UI
attendu.

## Barre contextuelle

La barre d'evaluation correspond a la FEN actuellement affichee.

### LIVE

- FEN affichee: `currentFen`.
- Source: evaluation live/current existante.
- La live analysis continue de fonctionner comme avant.

### HISTORICAL

- FEN affichee: `viewedFen`.
- Depuis V5.2, source prioritaire: session live-analysis de `viewedFen`.
- Une analyse deep existante peut servir de valeur initiale.
- Si aucune update live ni valeur initiale n'est disponible, la barre affiche
  `analyse en cours` ou `analyse indisponible`.
- La barre ne reprend jamais l'evaluation live/current si `viewedFen` differe
  de `currentFen`.

### REVIEW

- FEN affichee: `fen_before` du moment.
- Depuis V5.2, source prioritaire: session live-analysis de `fen_before`.
- `eval_before_cp` et `mate_before` exposes par `GET /games/{game_id}/review`
  peuvent servir de valeur initiale.
- La barre n'utilise jamais `eval_after_cp` pour la position REVIEW.
- Sinon, fallback `analyse en cours` ou `analyse indisponible`.

## Fallback

Une evaluation absente ne doit jamais etre presentee comme une egalite.

Le fallback neutre affiche:

- barre 50/50 dimmed;
- label `analyse indisponible`;
- source contextuelle `hist.` ou `review`.

Il n'affiche pas `0.00`.

## Helper frontend

`makeEvaluationDisplayFromEngineScore(eval_cp, mate_in)` applique la convention
V3.6:

- `eval_cp` est POV Blancs;
- mate blanc: 100/0, label `M{N}`;
- mate noir: 0/100, label `-M{N}`;
- non-mate: formule Lichess.

Le helper retourne `null` si aucune evaluation n'est disponible.

## Limites restantes

- V5.2 declenche une analyse live de la FEN affichee, avec debounce et guards
  anti-updates obsoletes.
- Le cache frontend deep reste simple et indexe par FEN complete.
- Aucune UI de revision d'ouverture n'est ajoutee.
- Aucun SRS, score de maitrise, recommandation, profil ou V6.
