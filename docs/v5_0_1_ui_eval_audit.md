# V5.0.1 UI + Evaluation Context Audit

## Ouverture V5

V5 expose deja la classification via le backend:

- `POST /openings/import-seed`;
- `POST /games/{game_id}/opening/classify`;
- `GET /games/{game_id}/opening`.

Avant V5.0.1, le frontend ne consommait pas `GET /games/{game_id}/opening`.
L'ouverture detectee etait donc stockable et consultable via API, mais invisible
dans l'interface.

Emplacement retenu pour V5.0.1: une ligne discrete au-dessus du panneau droit,
sans creer d'onglet Ouvertures.

## EvaluationBar actuelle

Avant V5.0.1, `EvaluationBar` recevait un etat derive par
`evaluationBarStateForPositionMode`:

- `LIVE`: evaluation live/current normale;
- `HISTORICAL`: barre neutre `position historique`;
- `REVIEW`: barre neutre `evaluation non affichee`.

Cette logique venait de V4.1.1 et evitait d'afficher l'evaluation live sur une
position passee. Elle etait correcte comme garde-fou, mais elle ne satisfait
plus l'intention V5.0.1: la barre doit evaluer la position affichee.

## Endpoint d'analyse disponible

`GET /analyses/by-fen?fen=...&kind=deep` existe deja:

- `200`: analyse done;
- `202`: pending/running;
- `404`: absente;
- `409`: failed.

Il peut etre utilise en lecture seule pour une position historique. V5.0.1 ne
doit pas declencher de nouvelle analyse moteur depuis la navigation.

## Review moments

Avant V5.0.1, `GET /games/{game_id}/review` exposait:

- `eval_before_label`;
- `eval_after_label`;
- `mate_before`;
- `mate_after`;
- `fen_before`;
- `fen_after`.

Les colonnes DB `eval_before_cp` et `eval_after_cp` existent deja dans
`review_moments`, mais n'etaient pas exposees dans le payload frontend.

Correction V5.0.1 prevue: exposer `eval_before_cp` et `eval_after_cp` en lecture
seule, sans modifier la DB ni l'algorithme review.

## Regle V5.0.1

La barre juge la position affichee:

- `LIVE`: `currentFen`, source live/shallow/deep existante;
- `HISTORICAL`: `viewedFen`, source deep existante si disponible;
- `REVIEW`: `fen_before` du moment, via `eval_before_cp/mate_before`;
- fallback: barre neutre `analyse indisponible`, jamais `0.00`.

## Risques restants

- Les analyses historiques deep peuvent etre absentes; dans ce cas, le fallback
  neutre est volontaire.
- Les clics rapides dans l'historique peuvent provoquer plusieurs requetes; un
  cache frontend par FEN limite les refetchs.
- L'ouverture n'est pas classifiee automatiquement pour eviter une logique
  cachee. L'utilisateur peut lancer la classification par bouton discret.
