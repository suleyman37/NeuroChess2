# NeuroChess Domain Invariants

- Backend is authoritative. Frontend may preview, display, or orchestrate UX, but final chess rules, grading, review scoring, and training decisions belong backend-side.
- Do not put metric formulas or final grading logic in `frontend/src/App.tsx`.
- Chess state semantics: legal moves/FEN/SAN/PGN are grounded in backend `python-chess` paths; frontend `chess.js` is not final authority.
- `eval_cp` and `mate_in` are always POV White. Side-to-move POV belongs in separate fields such as `eval_pov_side_to_move_cp`.
- Deep stabilized review snapshots are durable source for Review. Do not mix live/shallow analysis into review scoring or final review conclusions.
- Beginner/user flows must not show raw formulas, evidence JSON, debug panels, raw criticality, engine settings, or formula versions.
- Research/future metrics are not product truth. If data is insufficient, show qualitative or 'profile in construction' style states.