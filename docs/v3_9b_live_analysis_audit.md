# V3.9b Live Analysis Audit

Etat documente avant les modifications fonctionnelles V3.9b.

## 1. Alimentation actuelle de la barre apres POST /moves

- `POST /games/{game_id}/moves` valide et enregistre le coup via `GameRecorder`.
- Le backend calcule ensuite une shallow analysis synchrone avec:
  - `SHALLOW_ANALYSIS_DEPTH = 8`;
  - `SHALLOW_ANALYSIS_MULTIPV = 1`;
  - budget moteur V3.5 `TIME_BUDGET_MS_SHALLOW = 300`.
- Si l'analyse shallow termine, la reponse contient `evaluation_display`.
- Si l'analyse shallow echoue ou si le moteur est indisponible, la partie reste
  jouable et la reponse contient un warning.
- Une deep analysis est seulement programmee en `BackgroundTasks`; la reponse
  HTTP n'attend pas son resultat.

## 2. Emplacement de evaluation_display

- Backend: `backend/neurochess/api/game_routes.py`, dans
  `_try_shallow_engine_evaluation()`.
- Calcul: `make_evaluation_display(eval_cp, mate_in)` dans
  `backend/neurochess/core/evaluation_display.py`.
- API: `GameStateResponse.evaluation_display`.
- Frontend: `frontend/src/App.tsx` lit
  `state.evaluation_display ?? state.evaluation`, puis transmet la valeur a
  `EvaluationBar`.

## 3. Emplacement de evaluation_source

- Backend: `backend/neurochess/api/game_routes.py`, construit pour la shallow
  evaluation.
- API: `GameStateResponse.evaluation_source`.
- Frontend: `frontend/src/App.tsx` stocke `evaluationSource` et le passe a
  `EvaluationBar`.
- L'indicateur V3.9a affiche deja `shallow`, `deep` et `calibration`; V3.9b doit
  ajouter `live`.

## 4. Instanciation Stockfish actuelle

- Shallow/deep: `AnalysisService.run_analysis()` cree une instance
  `StockfishService()` si aucun moteur injectable n'est fourni.
- Calibration: `AnalysisService.evaluate_calibration()` cree aussi une instance
  `StockfishService()`.
- `StockfishService.start()` lance `chess.engine.SimpleEngine.popen_uci(...)`.
- Les instances creees par ces chemins sont fermees apres l'analyse.
- Il n'existe pas encore de service live dedie ni de session live persistante en
  memoire.

## 5. Utilisation python-chess

- Le projet utilise `python-chess` et `chess.engine.SimpleEngine`.
- Les analyses ponctuelles utilisent `engine.analyse(...)`.
- V3.9a a ajoute `StockfishService.evaluate_calibration()` avec
  `chess.engine.Limit(depth=..., time=..., nodes=...)`.
- V3.9b peut ajouter un chemin live base sur `engine.analysis(...)` sans
  reimplementer le protocole UCI.

## 6. Streaming backend actuel

- Aucun endpoint actuel ne streame de reponse.
- FastAPI est deja present; l'ajout le plus simple est `StreamingResponse` avec
  `media_type="text/event-stream"`.
- Aucun WebSocket n'est present.

## 7. Emplacement propre pour LiveAnalysisService

- Nouveau module cible: `backend/neurochess/live_analysis_service.py`.
- Integration API cible: `backend/neurochess/api/game_routes.py`, pour ajouter:
  - `POST /live-analysis/start`;
  - `POST /live-analysis/stop`;
  - `GET /live-analysis/stream?session_id=...`.
- Integration `POST /moves`: apres coup legal et fen backend, stopper les
  anciennes sessions live de la partie puis demarrer une nouvelle session.
- Nettoyage serveur: appeler `stop_all()` dans le lifespan FastAPI.

## 8. Risques identifies

- Update obsolete: une analyse ancienne peut produire des updates apres un
  nouveau coup.
- Concurrence moteur: deux appels simultanes ne doivent pas utiliser la meme
  instance `SimpleEngine` sans protection.
- FEN stale: le frontend peut recevoir une update correspondant a l'ancienne FEN.
- Fuite de process Stockfish: une session live stoppee doit fermer son moteur.
- Erreur moteur: l'analyse live ne doit jamais empecher de jouer.
- Pollution DB: les updates live ne doivent pas etre ecrites dans
  `position_analyses`.
- Frontend: l'EventSource precedente doit etre fermee quand un nouveau
  `live_analysis_session_id` arrive.
