# Testing Commands

- Backend full unit suite from repo root: `.venv\Scripts\python.exe -m unittest discover backend/tests`.
- Targeted backend examples: `.venv\Scripts\python.exe -m unittest backend.tests.test_review_metrics`, `.venv\Scripts\python.exe -m unittest backend.tests.test_review_practice_sessions`, `.venv\Scripts\python.exe -m unittest backend.tests.test_game_api`.
- Review regression smoke: `.venv\Scripts\python.exe scripts\review_regression_smoke.py`.
- PGN smoke if needed: `.venv\Scripts\python.exe scripts\pgn_import_smoke.py`.
- Frontend build from `frontend/`: `cmd /c npm.cmd run build` or `npm run build` if shell policy permits.
- Dev backend: `.venv\Scripts\python.exe -m uvicorn backend.app:app --reload` from repo root.
- Dev frontend: `cmd /c npm.cmd run dev` from `frontend/`.
- Use Playwright MCP only for UI/browser-visible changes. Stop if base tests fail without a clear relation to the mission.