# V5.1.9 - Review UX Polish

## Objectif

Ameliorer la lisibilite de l'onglet Review sans changer le moteur, les seuils, `cp_loss`, `importance_score`, l'opening book, l'opening classification ou l'algorithme de selection des moments.

## Source de verite de la barre Review

En mode Review, la barre d'evaluation ne depend pas du moteur live.

La barre lit les valeurs stables deja presentes sur chaque `ReviewMoment` :
- `eval_before_cp` / `mate_before`
- `eval_after_cp` / `mate_after`
- `eval_depth_before` / `eval_depth_after`
- `eval_source_kind`

Ces valeurs sont converties avec le helper frontend existant `makeEvaluationDisplayFromEngineScore`, donc la Review reutilise la meme logique de barre que le reste de l'application.

Si `eval_source_kind` vaut `review_stabilized_deep`, la source affiche `review stable`. Sinon, la source est marquee `review_saved`.

## Animation de barre

Quand l'utilisateur clique sur `Voir sur l'echiquier`, l'UI place d'abord la Review en phase `before`, puis passe en phase `after`.

La barre anime alors la transition entre :
1. l'evaluation avant le coup critique ;
2. l'evaluation apres le coup critique.

La transition CSS dure environ 560 ms avec easing `ease-out`.

## Delta joueur

Chaque moment affiche un delta compact calcule du point de vue du joueur qui vient de jouer :
- delta negatif : perte, affichee en rouge ;
- delta positif : gain, affiche en vert ;
- delta neutre : badge gris.

Le calcul utilise les pourcentages derives de la barre :
- Blanc : `white_percent`
- Noir : `black_percent`

## Replay sur l'echiquier

Le bouton `Voir sur l'echiquier` declenche une sequence simple :
1. afficher `fen_before` ;
2. attendre un court delai ;
3. afficher `fen_after` ;
4. laisser `react-chessboard` animer le deplacement de piece.

La duree d'animation de l'echiquier est reglee a 380 ms en mode Review. Les highlights Review existants sont conserves.

## Fallbacks

Si les donnees stables du moment sont disponibles, aucun message lie au moteur live ne doit apparaitre.

Si les donnees d'evaluation du moment manquent, l'UI affiche :

`Evaluation non disponible pour ce moment.`

Le reste de la Review reste utilisable.

## Tests

Validation automatique :
- `backend.tests.test_calibration_logic` verifie le contrat statique V5.1.9 ;
- `tsc --noEmit` verifie les types frontend ;
- `vite build` verifie la build frontend.

Validation manuelle recommandee :
1. ouvrir une partie avec Review et moments disponibles ;
2. cliquer sur `Voir sur l'echiquier` ;
3. verifier que l'echiquier affiche le coup avant puis apres avec animation ;
4. verifier que la barre anime la transition avant/apres ;
5. verifier que le delta rouge/vert est visible ;
6. verifier qu'aucun message `moteur indisponible` n'apparait quand les evaluations du moment existent.

## Limites

L'animation de piece repose sur l'animation native de `react-chessboard` lors d'un changement de position programme. Si la bibliotheque ne peut pas animer un cas particulier, le fallback reste un affichage statique correct de `fen_after`.
