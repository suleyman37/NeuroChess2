---
name: neurochess-replay-debug
description: Debug NeuroChess PGN, FEN, replay, Review, Practice, move legality, SAN/UCI, or analysis-position bugs. Use when a bug involves imported games, game reconstruction, board state, review moments, try-move, practice attempts, or engine snapshot alignment.
---

# NeuroChess Replay Debug

## When To Use

- A bug involves PGN import, FEN mismatch, SAN/UCI, move legality, replay,
  Review board position, Practice item position, or try-move grading.
- A Review or Practice flow points at the wrong position or move.
- Engine analysis appears attached to the wrong FEN or source kind.

## When Not To Use

- Pure UI styling bugs.
- New metric/action/feature work.
- Formula calibration or score redesign.

## Required Docs And Files

- `docs/data_model.md`
- `docs/PROJECT_STATE.md`
- `docs/FORMULAS_AND_METRICS.md` only to avoid formula drift.
- `backend/neurochess/core/game_session.py`
- `backend/neurochess/core/game_recorder.py`
- `backend/neurochess/pgn_import_service.py` when PGN/import is involved.
- `backend/neurochess/review_service.py` when Review replay is involved.
- `backend/neurochess/review_practice_service.py` and
  `backend/neurochess/metrics/try_move.py` when Practice is involved.

## Mandatory Steps

1. Reproduce before fixing.
2. Create a minimal red test or smoke reproduction.
3. Identify the first incorrect FEN, SAN, UCI, ply, or analysis key.
4. Trace source of truth from game import/session/recorder to Review/Practice.
5. Use Serena symbol/reference tools before multi-file edits.
6. Do not change formulas during replay/debug work.
7. Add PGN/FEN edge cases when relevant, including From Position and headers.
8. Apply the smallest fix that restores source-of-truth alignment.
9. Keep backend authoritative for final legality/grading.
10. Report root cause, failing path, fix, tests, and remaining risk.

## Validation

- Red test fails before fix and passes after fix.
- FEN before/after, SAN, UCI, ply, and game initial FEN are coherent.
- Review uses durable deep/stabilized snapshots, not live/shallow.
- Practice attempts evaluate from the intended `fen_before`.
- No formula constants or score semantics changed.

## Stop Conditions

- The bug cannot be reproduced.
- Fix requires changing metric formulas.
- Source of truth is ambiguous between frontend and backend.
- Existing dirty files make safe minimal patch impossible without human input.

