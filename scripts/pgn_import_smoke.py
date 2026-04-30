from __future__ import annotations

import shutil
import sys
import tempfile
from contextlib import closing
from pathlib import Path

import chess


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from neurochess.core.game_recorder import GameRecorder
from neurochess.data.database import get_connection, init_db
from neurochess.data.repositories import Repository
from neurochess.opening_service import OpeningService
from neurochess.pgn_import_service import PgnImportService
from neurochess.review_service import ReviewService


FIXTURE_DIR = PROJECT_ROOT / "backend" / "tests" / "fixtures"
SPECIAL_INITIAL_FEN = "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
CHESSCOM_CURRENT_POSITION = "8/8/8/8/8/1kb5/p7/1K6 w - - 0 75"


class DemandOnlyAnalysisService:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    def get_or_create_analysis(
        self,
        fen: str,
        depth: int = 12,
        multipv: int = 3,
        kind: str = "deep",
        analysis_profile: str | None = None,
        requested_time_ms: int | None = None,
        requested_depth: int | None = None,
        requested_multipv: int | None = None,
        analysis_limit_mode: str | None = None,
        settings_json: dict[str, object] | None = None,
    ) -> dict[str, object]:
        _ = requested_depth, settings_json
        with closing(get_connection(self.db_path)) as connection:
            connection.execute(
                """
                INSERT OR IGNORE INTO position_analyses (
                    fen,
                    analysis_json,
                    engine,
                    engine_version,
                    depth,
                    multipv,
                    analysis_kind,
                    schema_version,
                    analysis_profile,
                    requested_time_ms,
                    requested_multipv,
                    analysis_limit_mode,
                    status,
                    created_at
                )
                VALUES (?, '{}', 'stockfish', 'unknown', ?, ?, ?, 'engine_analysis_v2',
                        ?, ?, ?, ?, 'pending', datetime('now'))
                """,
                (
                    fen,
                    depth,
                    multipv,
                    kind,
                    analysis_profile,
                    requested_time_ms,
                    requested_multipv if requested_multipv is not None else multipv,
                    analysis_limit_mode,
                ),
            )
            row = connection.execute(
                """
                SELECT *
                FROM position_analyses
                WHERE fen = ?
                  AND analysis_kind = ?
                  AND schema_version = 'engine_analysis_v2'
                ORDER BY id DESC
                LIMIT 1
                """,
                (fen, kind),
            ).fetchone()
            connection.commit()
        return dict(row)


def main() -> int:
    temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-pgn-smoke-"))
    try:
        db_path = temp_dir / "smoke.db"
        init_db(db_path)
        service = PgnImportService(db_path)

        chesscom = service.import_pgn(
            (FIXTURE_DIR / "fixture_chesscom_live.pgn").read_text(encoding="utf-8"),
            user_alias="UserA",
            platform="unknown",
        )
        from_position = service.import_pgn(
            (FIXTURE_DIR / "fixture_lichess_from_position.pgn").read_text(
                encoding="utf-8"
            ),
            user_alias="SindarovGM",
            platform="unknown",
        )

        chesscom_id = chesscom["imported_game_ids"][0]
        from_position_id = from_position["imported_game_ids"][0]

        with closing(get_connection(db_path)) as connection:
            chesscom_row = connection.execute(
                "SELECT * FROM games WHERE id = ?",
                (chesscom_id,),
            ).fetchone()
            from_position_row = connection.execute(
                "SELECT * FROM games WHERE id = ?",
                (from_position_id,),
            ).fetchone()

        assert chesscom_row["source_platform"] == "chesscom"
        assert chesscom_row["source_game_id"] == "167654817356"
        assert chesscom_row["initial_fen"] == chess.STARTING_FEN
        assert chesscom_row["current_position_fen"] == CHESSCOM_CURRENT_POSITION
        assert from_position_row["source_platform"] == "lichess"
        assert from_position_row["initial_fen"] == SPECIAL_INITIAL_FEN

        recorder = GameRecorder(Repository(db_path))
        assert recorder.load_session(chesscom_id).current_fen() != CHESSCOM_CURRENT_POSITION
        assert recorder.load_session(from_position_id).current_fen() != chess.STARTING_FEN

        classification = OpeningService(db_path).classify_game_opening(from_position_id)
        assert classification["classification_status"] == "not_applicable_from_position"

        review = ReviewService(
            db_path,
            analysis_service=DemandOnlyAnalysisService(db_path),
        ).generate_review(from_position_id, profile="standard")
        assert review["status"] == "pending"
        assert review["scheduled_deep_count"] > 0

        print("PGN import smoke PASS")
        return 0
    finally:
        shutil.rmtree(temp_dir)


if __name__ == "__main__":
    raise SystemExit(main())
