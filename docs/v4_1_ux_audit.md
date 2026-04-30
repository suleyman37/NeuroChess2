# V4.1 UX Audit

Audit realise avant les modifications fonctionnelles V4.1.

## 1. Layout actuel

Le layout principal est dans `frontend/src/App.tsx` et `frontend/src/styles.css`.
La zone `.play-area` est deja une grille avec:

- colonne evaluation;
- colonne echiquier;
- colonne laterale.

La colonne laterale contient actuellement `MoveHistory` et une zone `Debug`.

## 2. Emplacement actuel de la review

La review V4 est affichee avec `ReviewPanel` sous la zone principale, apres
`</section>`. Elle est donc trop basse et se retrouve separee de l'echiquier.

## 3. Donnees de coups disponibles cote frontend

`GameState.moves` expose les champs de `RecordedMove`:

- `id`;
- `game_id`;
- `ply`;
- `fen_before`;
- `uci`;
- `san`;
- `is_player`;
- champs historiques d'evaluation V0/V3;
- `annotations`.

## 4. fen_before / fen_after cote frontend

`fen_before` est disponible dans `RecordedMove`.

`fen_after` n'est pas disponible dans `RecordedMove`. `POST /games/{id}/moves`
retourne `fen_after` seulement pour le dernier coup joue. Pour naviguer dans
l'historique sans reconstruire les FEN dans le frontend, V4.1 a besoin d'un
endpoint de lecture d'historique.

## 5. Review moments et FEN

`GET /games/{game_id}/review` retourne deja, pour chaque moment:

- `fen_before`;
- `fen_after`;
- `played_uci`;
- `played_san`;
- `best_move_uci`;
- `best_move_san`;
- labels d'evaluation.

Le clic review peut donc afficher la position avant le coup du moment.

## 6. Historique complet des coups

Il n'existe pas encore d'endpoint dedie `GET /games/{game_id}/moves`.
`GET /games/{game_id}` retourne un `GameState` et `game`, mais ne fournit pas
`fen_after` pour chaque coup.

Conclusion: l'extension API minimale est justifiee.

## 7. Debug actuel

La zone Debug est dans `App.tsx`, dans la colonne droite, toujours visible. V4.1
doit la deplacer dans un onglet `Infos` visible seulement en dev avec
`import.meta.env.DEV`.

## 8. FEN transmise a react-chessboard

`ChessBoardPanel` recoit `fen` depuis `App.tsx`, puis passe cette valeur a
`Chessboard.position`.

En V4.1, `ChessBoardPanel` doit recevoir `viewedFen`, pas forcement la FEN
reelle live/finale.

## 9. Drag-and-drop en historique/review

`ChessBoardPanel` accepte deja `disabled` et passe `arePiecesDraggable`.
V4.1 peut desactiver le drag-and-drop en utilisant:

- `positionMode !== "LIVE"`;
- ou partie terminee;
- ou busy/non jouable.

## 10. Tests frontend existants

Les tests frontend sont surtout statiques dans
`backend/tests/test_calibration_logic.py`. Ils peuvent etre etendus pour
verifier:

- presence de `positionMode`;
- distinction `fen_after` pour les coups et `fen_before` pour la review;
- roles ARIA des onglets;
- absence de l'onglet Infos en build production via `import.meta.env.DEV`;
- absence de metriques/mots interdits.
