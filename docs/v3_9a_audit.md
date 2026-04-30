# V3.9a Audit

Etat documente avant les modifications fonctionnelles V3.9a.

## 1. Instanciation Stockfish

- `StockfishService` est instancie dans `AnalysisService.run_analysis()` quand aucun moteur injectable n'est fourni.
- Chaque appel `run_analysis()` sans moteur injecte cree une nouvelle instance `StockfishService()`.
- `StockfishService.start()` ouvre `chess.engine.SimpleEngine.popen_uci(...)`.
- `AnalysisService.run_analysis()` ferme l'instance creee localement en `finally` via `engine_instance.close()`.
- Si un moteur est injecte dans les tests, il n'est pas ferme par `AnalysisService`.
- Il n'y a pas de pool moteur, pas de worker persistant, pas de moteur live separe.

## 2. Parametres reellement utilises

### Shallow

- Declenchement: `POST /games/{game_id}/moves`.
- Profondeur: `SHALLOW_ANALYSIS_DEPTH = 8`.
- MultiPV: `SHALLOW_ANALYSIS_MULTIPV = 1`.
- Budget temps: `TIME_BUDGET_MS_SHALLOW = 300`.
- Type persiste: `analysis_kind='shallow'`.
- `engine_version` initiale de ligne: `unknown`, sauf si fournie explicitement.

### Deep

- Declenchement: `POST /games/{game_id}/moves`, programme via `BackgroundTasks`.
- Profondeur: `DEEP_ANALYSIS_DEPTH = 12`.
- MultiPV: `DEEP_ANALYSIS_MULTIPV = 3`.
- Budget temps: `TIME_BUDGET_MS_DEEP = 5000`.
- Type persiste: `analysis_kind='deep'`.
- `engine_version` initiale de ligne: `unknown`, puis V3.8 met a jour la version pour les nouvelles analyses terminees quand Stockfish la retourne.

### StockfishService

- `StockfishService.analyze_fen()` appelle `engine.analyse(board, chess.engine.Limit(depth=depth, time=time_budget_ms / 1000.0), multipv=requested_multipv)`.
- `requested_multipv = max(1, multipv)`.
- `engine_version` vient de `engine.id["name"]`, sinon `unknown`.

## 3. Alimentation frontend de la barre

- Le backend renvoie `evaluation_display` et garde `evaluation` comme alias compatible.
- `frontend/src/App.tsx` lit `state.evaluation_display ?? state.evaluation`.
- Le frontend ne lit pas directement `eval_cp`.
- Le frontend ne lit pas `eval_pov_side_to_move_cp`.
- `frontend/src/components/EvaluationBar.tsx` consomme uniquement `white_percent`, `black_percent` et `label`.
- Avant V3.9a, il n'existe pas d'`evaluation_source`; l'UI ne peut donc pas indiquer si la valeur vient d'une shallow ou d'une deep.
- Dans le flux actuel, la barre live vient de la shallow evaluation de `POST /moves`; il n'y a pas de bascule frontend explicite vers deep.

## 4. Conversion mate_in

- `make_evaluation_display()` court-circuite deja les mates:
  - `mate_in > 0` donne `white_percent = 100.0`;
  - `mate_in < 0` donne `white_percent = 0.0`.
- `black_percent` est derive par `100.0 - white_percent`.
- `mate_in` n'est pas passe dans la sigmoide Lichess.
- Les labels sont `M{n}` et `-M{n}`.

## 5. Verification analysis_json sur 10 lignes recentes done

DB auditee: `neurochess.db`.

Resultat des 10 dernieres lignes `status='done'`:

| id | top_moves existe | type | longueur | top_moves[0].rank | top1 existe | engine_version JSON |
| --- | --- | --- | ---: | ---: | --- | --- |
| 236 | oui | list | 3 | 1 | non | unknown |
| 235 | oui | list | 1 | 1 | non | unknown |
| 234 | oui | list | 1 | 1 | non | unknown |
| 233 | oui | list | 1 | 1 | non | unknown |
| 232 | oui | list | 3 | 1 | non | unknown |
| 231 | oui | list | 1 | 1 | non | unknown |
| 230 | oui | list | 3 | 1 | non | unknown |
| 229 | oui | list | 1 | 1 | non | unknown |
| 228 | oui | list | 3 | 1 | non | unknown |
| 227 | oui | list | 1 | 1 | non | unknown |

Observations:

- `analysis_json.top_moves` existe et reste une liste.
- `top_moves[0].rank` existe et vaut `1`.
- Aucun champ `top1` n'est present dans les payloads canoniques verifies.
- Le code backend utilise `top_moves[0]` pour le meilleur coup.
- Le seul champ `top1` trouve dans le code applicatif est `top1_uci` dans le log JSONL d'analyse; il s'agit d'un alias debug derive, pas de la source canonique.
- Les anciennes lignes locales peuvent conserver `engine_version='unknown'` dans `analysis_json`; V3.8 corrige les nouvelles analyses, mais ne migre pas les anciennes lignes.

## 6. Options moteur exposees par python-chess

Environnement audite:

- `engine.id`: `{"name": "Stockfish 18", "author": "the Stockfish developers (see AUTHORS file)"}`
- `Threads`: expose, type `spin`, default `1`, min `1`, max `1024`.
- `Hash`: expose, type `spin`, default `16`, min `1`, max `33554432`.
- `MultiPV`: expose, type `spin`, default `1`, min `1`, max `256`.
- `UCI_NNUE`: non expose.
- `EvalFile`: expose, type `string`, default `nn-c288c895ea92.nnue`.
- `EvalFileSmall`: expose, type `string`, default `nn-37f18f62d772.nnue`.

Conclusion:

- Les informations UCI doivent etre rapportees comme `engine_options_reported`.
- `UCI_NNUE` ne doit pas etre force si l'option n'est pas exposee.
- `EvalFile` et `EvalFileSmall` peuvent etre lus si exposes.
