# V4.1 Review UX & Game Navigation

## Objectif

V4.1 rend la review V4 consultable comme un outil d'analyse de partie. Elle ne
modifie pas l'algorithme de review, `cp_loss`, `importance_score`, Stockfish,
la live analysis, shallow/deep/calibration ou la formule de barre.

## Layout

Le layout principal est une grille desktop en trois colonnes:

1. barre d'evaluation;
2. echiquier et navigation;
3. panneau droit a onglets.

La review n'est plus affichee en bas de page. Elle vit dans le panneau droit,
onglet `Review`.

## Onglets

Le panneau droit contient:

- `Coups`: historique interactif;
- `Review`: generation et consultation de la review;
- `Infos`: donnees de debug, visible seulement avec `import.meta.env.DEV`.

Les onglets utilisent les roles ARIA minimum:

- `role="tablist"`;
- `role="tab"`;
- `aria-selected`;
- `aria-controls`;
- `role="tabpanel"`;
- `aria-labelledby`.

## Historique backend

V4.1 ajoute `GET /games/{game_id}/moves`.

Cet endpoint retourne:

- `initial_fen`;
- `current_fen`;
- `status`;
- chaque coup avec `fen_before` et `fen_after`.

Le frontend ne reconstruit pas les FEN de l'historique.

## Etats de position

Le frontend utilise:

- `positionMode = "LIVE" | "HISTORICAL" | "REVIEW"`;
- `viewedFen`;
- `displayedPositionPly`;
- `selectedReviewMomentId`;
- `selectedReviewMovePly`.

### LIVE

Affiche la position actuelle si la partie est en cours, ou la position finale si
elle est terminee. Le drag-and-drop n'est autorise qu'en LIVE sur une partie en
cours.

### HISTORICAL

Affiche une position de l'historique. Le clic sur un coup `ply=N` affiche
`fen_after` et place `displayedPositionPly=N`.

### REVIEW

Affiche un moment de review. Le clic sur un moment `ply=N` affiche `fen_before`
et place `displayedPositionPly=N-1`.

C'est le point anti off-by-one principal: le coup N dans la liste montre apres
le coup, tandis que le moment N montre avant le coup.

## Navigation

Sous l'echiquier:

- `<<`: position initiale;
- `<`: ply precedent;
- `>`: ply suivant;
- `>>`: position actuelle/finale;
- bouton `Position actuelle` ou `Position finale` hors LIVE.

Les boutons impossibles sont desactives. Les raccourcis clavier suivants sont
actifs seulement si aucun champ de saisie n'a le focus:

- ArrowLeft;
- ArrowRight;
- Home;
- End.

## Review

Les cartes de review affichent:

- numero de moment;
- `Coup {ply}`;
- badge `cp_loss_label`;
- coup joue vers coup moteur;
- evaluation avant -> apres;
- commentaire court et factuel;
- bouton `Voir sur l'echiquier`.

L'UI n'affiche pas `cp_loss` brut, ACPL, accuracy, score global, ou
classification du type blunder/mistake/inaccuracy.

## Coherence evaluation / position affichee

V4.1.1 a verrouille la relation entre l'echiquier et la barre d'evaluation.
V5.2 precise la regle produit definitive: la barre juge toujours `boardFen`,
c'est-a-dire la FEN reellement affichee a l'ecran.

En `LIVE`, l'echiquier affiche la position reelle courante ou finale et la
barre affiche l'evaluation normale associee a cette position.

En `HISTORICAL`, l'echiquier affiche une position passee. La barre demarre une
analyse live de cette FEN affichee, avec une analyse deep existante comme valeur
initiale si elle est deja disponible.

En `REVIEW`, l'echiquier affiche `fen_before` du moment selectionne. La barre
demarre une analyse live de cette FEN. Elle peut afficher d'abord
`eval_before_cp` / `mate_before` du moment quand ces donnees sont disponibles.
Elle n'utilise jamais `eval_after_cp` pour evaluer la position avant le coup.

Le fallback neutre ne signifie pas `0.00`: il signifie qu'aucune evaluation
fiable n'est encore disponible pour la position affichee.

## Surlignage

En mode REVIEW:

- les cases du coup moteur sont surlignees en vert doux;
- les cases du coup joue sont surlignees en orange doux.

Si le surlignage n'est pas disponible, un texte sous l'echiquier rappelle le
coup joue et le coup moteur.

## Robustesse reseau

Si `GET /games/{game_id}/moves` echoue:

- l'onglet Coups affiche un message local et un bouton `Reessayer`;
- les boutons de navigation sont desactives;
- l'app ne crashe pas;
- la review peut rester consultable si son endpoint fonctionne.

## Limites V4.1

- Pas de refonte mobile complete.
- Pas de frise `input range` en V4.1; possible TODO V4.2.
- Pas de nouvelle logique moteur.
- Pas de nouvelle logique pedagogique.
- Pas de modification de l'algorithme de selection des moments.
