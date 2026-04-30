# V4 Post-game Review Minimal

## Objectif

V4 ajoute une review post-game minimale: une partie terminee peut produire une
liste de moments a revoir, basee uniquement sur les analyses Stockfish deep
existantes.

La review reste factuelle. Elle ne produit pas de diagnostic psychologique, pas
de note globale, pas d'accuracy visible et pas d'ACPL visible.

## Pourquoi deep uniquement

Les moments V4 sont construits seulement si les deux positions d'un coup ont
une analyse:

- `analysis_kind = 'deep'`;
- `status = 'done'`;
- `schema_version = 'engine_analysis_v2'`.

Shallow est reserve a l'UX immediate. Live est progressif et non canonique.
Calibration est un outil de debug. Aucun de ces modes ne sert a generer une
review V4.

## Conventions d'evaluation

`eval_cp` reste toujours du point de vue des Blancs:

- positif: avantage Blancs;
- negatif: avantage Noirs.

Pour un coup blanc:

```text
cp_loss = max(0, eval_before_cp - eval_after_cp)
```

Pour un coup noir:

```text
cp_loss = max(0, eval_after_cp - eval_before_cp)
```

Le `cp_loss` brut est stocke en DB/API pour debug, mais l'UI V4 affiche le
label qualitatif `cp_loss_label`.

## Gestion mate

Avant calcul interne, un mate est converti en proxy:

- `mate_in = +N` -> `10000 - N`;
- `mate_in = -N` -> `-10000 + N`;
- `mate_in = null` -> `eval_cp`.

Ce proxy n'est jamais affiche dans l'UI.

## Labels

Grille V4:

- `50 <= cp_loss < 100`: `écart notable`;
- `100 <= cp_loss < 200`: `écart important`;
- `200 <= cp_loss < 500`: `écart majeur`;
- `500 <= cp_loss < 1000`: `écart très important`;
- `cp_loss >= 1000` ou evenement de mate significatif:
  `moment décisif selon l’analyse approfondie`.

## importance_score

Formule:

```text
importance_score = min(cp_loss, 1000) * reliability_score * 1.0
```

`move_context_weight` vaut toujours `1.0` en V4.

Si les deux reliability scores existent, V4 prend le minimum. Si un seul existe,
il est utilise. Si aucun n'existe, V4 utilise `0.5` et ajoute un warning a la
review.

## Selection

1. Construire les coups reviewables.
2. Garder les moments avec `cp_loss >= 50` ou evenement de mate significatif.
3. Calculer `importance_score`.
4. Trier par importance decroissante.
5. Garder au maximum 5 moments.
6. Retourner les moments par ordre chronologique.

V4 ne force jamais 5 moments. Une review terminee avec `moments=[]` est valide.

## top_moves_json

`top_moves_json` vient toujours de `analysis_json.top_moves` de `fen_before`.

Regles:

- maximum 3 entrees;
- PV limitee a 5 coups UCI;
- pas de SAN dans la PV;
- `top1` n'est pas une source canonique.

Le meilleur coup recommande est donc le meilleur coup disponible avant le coup
joue, jamais celui de `fen_after`.

## Idempotence

`POST /games/{game_id}/review/generate` est idempotent pour:

- `review_schema_version = post_game_review_v1`;
- `selection_algorithm_version = moment_selection_v1`.

Si une review courante `done` ou `partial` existe, elle est retournee sans
recalcul. Pour forcer une generation future, il faudra changer
`selection_algorithm_version`.

## Coverage deep

`coverage = reviewable_moves / candidate_moves`.

- `coverage >= 0.95`: status `done`;
- `0.70 <= coverage < 0.95`: status `partial` avec warning;
- `coverage < 0.70`: status `pending`, aucune generation de moments.

V4 tente de creer les analyses deep manquantes quand le coverage est trop bas,
mais n'utilise jamais shallow/live/calibration pour combler.

## Statuts

`game_reviews.status`:

- `pending`;
- `done`;
- `partial`;
- `failed`.

`GET /games/{game_id}/review` ne regenere jamais automatiquement.

## Texte utilisateur

Le texte est deterministe et factuel:

- `Le moteur préférait {best_move}, qui conservait une meilleure évaluation.`
- `Après ce coup, l’évaluation baisse pour le camp qui vient de jouer.`

V4 n'emploie pas les labels de type classification moteur ou jugement joueur.

## Limites connues V4

- Pas de phase de jeu.
- Pas de temps passe sur le coup.
- Pas de complexite positionnelle.
- `importance_score` est un proxy simple.
- Pas de diagnostic cognitif.
- Pas de LLM.
- Pas de classification good/mistake/blunder/inaccuracy.
- Pas d'ouverture, profil ou recommandation.
- `review_type` vaut toujours `player_loss`.
- Pas d'agregation cross-games.
- Chaque review est isolee a sa partie.
