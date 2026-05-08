# Architecture Map

- Frontend: React/Vite/TypeScript in `frontend/`; `frontend/src/App.tsx` orchestrates most UI state; `frontend/src/api/client.ts` owns API calls; review/practice components live under `frontend/src/components/review/`.
- Backend: FastAPI entrypoint `backend/app.py`; routes/schemas in `backend/neurochess/api/`.
- Persistence: SQLite in `backend/neurochess/data/`; migrations in `migrations.py`; durable analysis data in `position_analyses.analysis_json`.
- Chess rules: backend `core/game_session.py` and `core/game_recorder.py` are authoritative for legal moves/FEN/SAN/persistence; frontend chess logic is UX preview only.
- Engine: Stockfish config/profiles/services in `backend/neurochess/engines/`; durable analysis in `analysis_service.py`; live analysis in `live_analysis_service.py`.
- Review: `review_service.py` builds post-game review, scores, moments, annotations; `review_job_service.py` owns async review job lifecycle.
- Metrics: pure/review formulas in `backend/neurochess/metrics/`; docs canon in `docs/METRIC_REGISTRY.md` and `docs/FORMULAS_AND_METRICS.md`.
- Practice/training current state: `review_practice_service.py` manages review practice sessions and attempts. Future Learning Engine is blueprint only.
- Governance docs: `PROJECT_STATE`, `AI_COLLABORATION_PROTOCOL`, `METRIC_REGISTRY`, `ACTION_REGISTRY`, `FORMULAS_AND_METRICS`, `data_model`, `LEARNING_ENGINE_BLUEPRINT`, `SCREEN_CONTRACTS` are the first source for scope decisions.