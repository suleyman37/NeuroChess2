# NeuroChess 2

NeuroChess 2 is being rebuilt as a future cognitive chess coach: reliable data, reliable analysis, reliable diagnosis, then prescribed training.

V0 created the backend structure and SQLite data layer. V1 adds a minimal Stockfish engine layer. V1.1 adds a pure mathematical evaluation display model for future eval bars. V1.2 adds pure reliability and rating math helpers. V2 adds game session and recording logic. V3 adds a local FastAPI backend and minimal React UI. V3.5 adds the durable analysis pipeline with versioned `engine_analysis_v2` JSON, separated shallow/deep analyses, idempotent persistence, recovery, and JSONL analysis logs. V3.6 stabilizes the white/black evaluation bar. V3.7 performs full system QA and stabilization around FEN validity, engine availability, frontend/backend sync, and evaluation display. V3.8 hardens Stockfish path resolution and canonical engine version storage. V4 adds a minimal deep-only post-game review, V4.1 makes that review navigable, and V4.1.1 locks evaluation/position context consistency. V5 adds a local opening detection foundation with an internal seed book and sequential FEN-key matching. V5.1 imports the local `lichess-org/chess-openings` dataset as an offline opening book. There is still no LLM, no Tension Lab, no Opening Mastery, no SRS, no recommendations, and no player profile.

## Structure

- `backend/app.py`: initializes the local database.
- `backend/neurochess/data/`: SQLite connection, migrations, models, and repositories.
- `backend/neurochess/engines/`: minimal Stockfish engine integration.
- `backend/neurochess/core/`: pure core helpers, including evaluation display math.
- `backend/neurochess/api/`: local FastAPI routes and schemas.
- `backend/neurochess/opening_service.py`: V5/V5.1 opening book import and game classification.
- `backend/tools/prepare_lichess_openings.py`: offline conversion from the local Lichess openings TSV files to `openings_book.json`.
- `backend/tests/`: unit tests for the database, engine layer, and core helpers.
- `frontend/`: minimal Vite React interface for local playtesting.

## Install Dependencies

```bash
pip install -r requirements.txt
```

V1 uses `python-chess` to communicate with Stockfish through UCI.

## Stockfish

NeuroChess resolves Stockfish in this order:

1. `NEUROCHESS_STOCKFISH_PATH`, if defined.
2. The bundled executable at `backend/neurochess/stockfish.exe`, if present.
3. `stockfish.exe` on Windows.
4. `stockfish` on other platforms.

You can also point NeuroChess 2 to a specific executable:

```bash
set NEUROCHESS_STOCKFISH_PATH=C:\path\to\stockfish.exe
```

On PowerShell for the current session:

```powershell
$env:NEUROCHESS_STOCKFISH_PATH = "C:\path\to\stockfish.exe"
```

If Stockfish is not available, the engine tests are skipped instead of failed.

The Windows launcher `Lancer NeuroChess 2.bat` sets
`NEUROCHESS_STOCKFISH_PATH` to the bundled executable when
`backend\neurochess\stockfish.exe` exists.

## Run Tests

From the project root:

```bash
python -m unittest discover backend/tests
python -m unittest backend/tests/test_engine_config.py
python -m unittest backend/tests/test_database.py
python -m unittest backend/tests/test_stockfish_service.py
python -m unittest backend/tests/test_evaluation_display.py
python -m unittest backend/tests/test_analysis_reliability.py
python -m unittest backend/tests/test_rating_math.py
python -m unittest backend/tests/test_game_recorder.py
python -m unittest backend/tests/test_game_api.py
```

## Initialize The Local Database

From the project root:

```bash
python backend/app.py
```

This creates or updates `neurochess.db` in the current directory.

## Technical Notes

- SQLite uses the Python standard library `sqlite3`.
- Migrations are recorded in `schema_migrations` and can be rerun safely.
- Durable Stockfish analysis results use canonical `engine_analysis_v2` JSON in `position_analyses.analysis_json`.
- `top_moves`, PV, `eval_cp`, `mate_in`, and side-to-move evaluation live in `analysis_json`; they are not separate SQL columns.
- `eval_cp` and `mate_in` are always from White's point of view. Positive `eval_cp` means an advantage for White; negative means an advantage for Black. Positive `mate_in` means White mates; negative means White is getting mated.
- Engine centipawn evaluations include side-to-move POV inside each top move as `eval_pov_side_to_move_cp`, but the evaluation bar never uses that field.
- V3.6 evaluation display uses the Lichess Win% logistic curve as a non-linear visual transform from White-POV centipawns into a white/black bar percentage:

```text
white_percent = 100 / (1 + exp(-0.00368208 * eval_cp))
black_percent = 100 - white_percent
```

This percentage is only a visual representation of engine evaluation, not a win probability and not a canonical rating/review signal.
- V3.8 stores the real engine version returned by Stockfish, such as `Stockfish 18`, in canonical `analysis_json.engine_version`. If the pending row was created with `engine_version='unknown'`, the SQL column is updated to the real version when possible without violating the unique analysis index.
- V5 opening detection uses `opening_lines`, `opening_line_nodes`, and `game_opening_classifications`. Matching uses normalized opening FEN keys that ignore halfmove and fullmove counters. It is sequential only and does not handle complex transpositions.
- V5.1 can generate `backend/neurochess/data/openings_book.json` from the local `backend/neurochess/data/sources/lichess_chess_openings` folder with `python -m backend.tools.prepare_lichess_openings`, then import it with `POST /openings/import-book`. This is fully offline and does not call Lichess at runtime.

## Reliability Philosophy

NeuroChess should prefer honest estimates over false precision. A displayed Elo or NeuroChess Rating without uncertainty is misleading: future player ratings must include an uncertainty range, and future AI levels should be calibrated target levels rather than exact guarantees.

Stockfish evaluations depend on analysis settings such as depth, time, MultiPV, position type, material, and forced mates. The evaluation bar is a non-linear visualization of advantage, not a win probability.

## V2 Game Recording

`GameSession` manages chess state in memory with `python-chess`: legal moves, SAN/UCI data, FEN before and after moves, game-over detection, results, and PGN generation.

`GameRecorder` connects a `GameSession` to the SQLite repository layer. Every played move is persisted immediately before the in-memory board advances, so the database remains the source of reliable game history.

V2 does not include engine analysis, UI, LLM features, benchmarks, or takebacks. A recorded move is definitive in this version.

## V3 Local Playtest App

V3 adds a local FastAPI API and a minimal React + TypeScript frontend. `GameSession` remains responsible for chess state, while `GameRecorder` persists every move through the SQLite repository layer. The UI always treats the backend FEN as the source of truth.

Install frontend dependencies:

```bash
cd frontend
npm install
```

Run the backend from the project root:

```bash
uvicorn backend.app:app --reload
```

Run the frontend:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

Known V3 limits:

- no AI opponent yet;
- pawn promotion is automatic to queen;
- no review mode yet;
- active sessions are stored in backend memory and rebuilt from DB after restart;
- no move-history navigation yet;
- Stockfish analysis is intentionally light to preserve UI responsiveness;
- if Stockfish is unavailable, moves still work and evaluation is omitted.
