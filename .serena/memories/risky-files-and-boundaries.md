# Risky Files And Boundaries

- Do not modify application code during setup/governance-only missions.
- High-risk hotspots: `frontend/src/App.tsx`, `backend/neurochess/review_service.py`, `backend/neurochess/review_job_service.py`, `backend/neurochess/review_practice_service.py`, `backend/neurochess/analysis_service.py`, `backend/neurochess/data/migrations.py`, `backend/neurochess/engines/stockfish_service.py`, metrics modules.
- Frontend must stay dumb: no final grading, review scoring, training decisions, raw formulas, or backend-authoritative chess rules in frontend code.
- Do not mix live/shallow analysis with review deep/stabilized snapshots.
- Do not alter migrations, formula versions, action/metric registries, or screen contracts incidentally.
- Do not expose secrets, tokens, cookies, `.env`, or private auth material in prompts, logs, memories, docs, or tests.
- Avoid big-bang refactors. For multi-file changes, use Serena references/symbol mapping first and keep diffs small.