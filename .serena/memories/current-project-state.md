# Current Project State

- NeuroChess2 is a local cognitive chess coach: reliable game data, Stockfish analysis, post-game review, and prescribed practice.
- Current docs describe V5.x Review/PGN/metrics/UI work; V6 and full Learning Engine are not started.
- Implemented: SQLite migrations, local game session/recording, Stockfish shallow/deep analysis, review jobs, review scoring, PGN import/history, opening classification, review practice sessions.
- Not implemented now: real Maia/human-like adapter, LLM coach, Memory Loop, full Learning Engine, Transfer Gap, BKT/IRT/FSRS, candidate move logging, calibrated user progression model.
- Product-visible Review contract as of V5.4: visible coach NeuroScore is `coach_neuro_score_v1`, reference precision is shown separately, diagnostic gap/raw formulas are audit/technical only.
- Before any new coding mission, read `docs/PROJECT_STATE.md` and check for `unknown / to verify` status or required browser validation.