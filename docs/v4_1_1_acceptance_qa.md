# V4.1.1 Acceptance QA

## Verdict

PASS avec reserve manuelle: les tests automatises backend passent et le build
frontend production passe. Le test manuel navigateur reste a faire dans une
session applicative lancee.

## Audit d'etat

### Etats frontend

- `currentFen` represente la position reelle courante/finale renvoyee par le
  backend.
- `viewedFen` represente la position effectivement affichee par
  `react-chessboard`.
- `displayedPositionPly` represente la position affichee: `0` pour la position
  initiale, `N` apres le coup `ply=N`.
- `positionMode` vaut `LIVE`, `HISTORICAL` ou `REVIEW`.

### FEN envoyee a l'echiquier

- `LIVE`: `viewedFen` est recalee sur `currentFen`; l'echiquier affiche la
  position reelle.
- `HISTORICAL`: l'echiquier affiche `fen_after` du coup clique ou de la
  navigation.
- `REVIEW`: l'echiquier affiche `fen_before` du moment de review.

`ChessBoardPanel` recoit `fen={viewedFen ?? currentFen}`. Le backend reste la
source de verite des FEN via l'etat de partie et `GET /games/{game_id}/moves`.

### Barre d'evaluation

Risque identifie: avant V4.1.1, la barre recevait directement
`evaluation/evaluationSource` meme quand `viewedFen !== currentFen`, ce qui
pouvait faire croire que l'evaluation live de la position courante concernait
une position historique ou une position de review.

Correction V4.1.1:

- `LIVE`: la barre affiche l'evaluation normale courante/live.
- `HISTORICAL`: la barre affiche un etat neutre/dimmed, libelle
  `position historique`; aucune evaluation live/current n'est presentee.
- `REVIEW`: Option B retenue. La barre affiche un etat neutre/dimmed,
  libelle `evaluation non affichee`; les cartes de review conservent
  `eval_before_label -> eval_after_label`.

Option B est retenue car le payload frontend `ReviewMoment` n'expose pas
`eval_before_cp`. V4.1.1 ne modifie pas l'API review et ne duplique pas une
logique de calcul supplementaire.

### Clic sur un coup

Un clic sur un coup `ply=N` dans l'onglet Coups:

- affiche `fen_after`;
- positionne `displayedPositionPly=N`;
- passe en `HISTORICAL`, sauf si `N` est le dernier ply courant/final.

### Clic sur un moment review

Un clic sur un moment `ply=N`:

- affiche `fen_before`;
- positionne `displayedPositionPly=N-1`;
- passe en `REVIEW`;
- selectionne le moment pour le surlignage et la navigation de moments.

### Navigation

- `<<`: affiche `initial_fen`, `displayedPositionPly=0`.
- `<`: affiche la position apres le ply precedent.
- `>`: affiche la position apres le ply suivant.
- `>>`: affiche `current_fen`, repasse en `LIVE`.
- `Position actuelle/finale`: repasse en `LIVE`, efface la selection review.

### Drag-and-drop

Le drag-and-drop est autorise seulement si:

- `positionMode === "LIVE"`;
- une partie existe;
- la partie n'est pas terminee;
- l'UI n'est pas occupee.

`ChessBoardPanel` retourne `false` si `disabled` ou absence de FEN.

### Review indisponible

Si `/review` echoue alors que l'utilisateur consulte une position de review,
l'UI revient a `LIVE` et affiche `Review temporairement indisponible.`. Aucun
appel moteur direct n'est lance depuis le frontend.

### Infos dev-only

L'onglet `Infos` reste conditionne par `import.meta.env.DEV`. Il n'est pas
rendu en build production.

### Accessibilite

Les onglets gardent les roles ARIA minimum:

- `role="tablist"`;
- `role="tab"`;
- `aria-selected`;
- `aria-controls`;
- `role="tabpanel"`;
- `aria-labelledby`.

L'echiquier garde un `aria-label` dynamique selon `positionMode`.

## Corrections appliquees

- Derivation explicite de l'etat visible de la barre via
  `evaluationBarStateForPositionMode`.
- Ajout d'un placeholder UI pour les etats neutres/dimmed.
- Neutralisation de la barre hors `LIVE`.
- Retour a `LIVE` si la review devient indisponible pendant une consultation de
  moment.
- Tests statiques renforces pour l'anti-confusion `currentFen/viewedFen`.

## Tests executes

- `C:\Users\grezo\AppData\Local\Python\bin\python.exe -m unittest discover backend/tests`
  - Resultat: 186 tests OK.
- `cd frontend && npm run build`
  - Resultat: OK (`tsc && vite build`).

## Test manuel navigateur

Non execute dans cette passe. Protocole recommande:

1. Lancer backend et frontend.
2. Creer une partie.
3. Jouer au moins 10 demi-coups.
4. Cliquer sur un coup ancien dans Coups.
5. Verifier que l'echiquier affiche la position apres ce coup.
6. Verifier que la barre n'affiche pas l'evaluation live de la position
   courante.
7. Cliquer sur un moment review.
8. Verifier que l'echiquier affiche la position avant le coup du moment.
9. Verifier que la barre est neutre/dimmed en REVIEW.
10. Essayer de jouer en REVIEW: le coup doit etre empeche.
11. Cliquer Position finale/actuelle.
12. Verifier le retour a `LIVE` et a la barre courante.
13. Verifier l'absence d'ACPL, accuracy, score global, blunder/mistake/
    inaccuracy.

## Limites restantes

- La barre REVIEW utilise l'Option B neutre. Elle n'affiche pas
  `eval_before_cp`, car ce champ n'est pas expose au frontend en V4.1.1.
- Le test navigateur reste manuel.
- Aucun changement n'a ete fait a l'algorithme review, Stockfish, live
  analysis, shallow/deep/calibration, `cp_loss` ou `importance_score`.
