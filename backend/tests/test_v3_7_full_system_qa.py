from __future__ import annotations

import json
import shutil
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from typing import Any

import chess
from fastapi.testclient import TestClient


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import app
from neurochess.analysis_service import AnalysisService
from neurochess.api.game_routes import (
    ACTIVE_SESSIONS,
    get_analysis_service,
    get_repository,
)
from neurochess.core.game_recorder import GameRecorder
from neurochess.core.game_session import GameSession, GameSessionError
from neurochess.data.database import get_connection, init_db
from neurochess.data.repositories import Repository


TEN_LEGAL_MOVES = [
    "g1f3",
    "d7d5",
    "d2d4",
    "g8f6",
    "c2c4",
    "e7e6",
    "b1c3",
    "f8e7",
    "c1g5",
    "e8g8",
]
INVALID_C_FEN = "7r/8/4k1Rp/8/2c2P2/4B3/PPP3PP/2K2BNR b - - 1 18"


class V37FakeEngine:
    def __init__(self, eval_cp: int = 300) -> None:
        self.eval_cp = eval_cp

    def analyze_fen(
        self,
        fen: str,
        depth: int,
        multipv: int,
        time_budget_ms: int | None = None,
    ) -> dict[str, Any]:
        _ = time_budget_ms
        board = chess.Board(fen)
        legal_moves = list(board.legal_moves)[: max(1, multipv)]
        top_moves = [
            {
                "rank": rank,
                "uci": move.uci(),
                "eval_cp": self.eval_cp - ((rank - 1) * 20),
                "eval_pov_side_to_move_cp": -999,
                "mate_in": None,
                "pv": [move.uci()],
            }
            for rank, move in enumerate(legal_moves, start=1)
        ]

        return {
            "fen": fen,
            "engine": "stockfish",
            "engine_version": "V37FakeEngine",
            "depth": depth,
            "multipv": multipv,
            "eval_cp": self.eval_cp,
            "mate_in": None,
            "top_moves": top_moves,
        }


class V37UnavailableEngine:
    def analyze_fen(
        self,
        fen: str,
        depth: int,
        multipv: int,
        time_budget_ms: int | None = None,
    ) -> dict[str, Any]:
        _ = fen, depth, multipv, time_budget_ms
        raise RuntimeError("stockfish missing")


class V37FakeAnalysisService(AnalysisService):
    def __init__(self, db_path: Path, log_path: Path) -> None:
        super().__init__(db_path, log_path=log_path)
        self.process_calls = 0

    def run_analysis(
        self,
        analysis_id: int,
        engine: Any | None = None,
    ) -> dict[str, Any] | None:
        return super().run_analysis(analysis_id, engine=engine or V37FakeEngine())

    def process_pending_analyses(
        self,
        limit: int = 10,
        engine: Any | None = None,
    ) -> list[dict[str, Any]]:
        _ = limit, engine
        self.process_calls += 1
        return []

    def complete_pending(self) -> list[dict[str, Any]]:
        return super().process_pending_analyses(limit=50, engine=V37FakeEngine())


class V37UnavailableAnalysisService(V37FakeAnalysisService):
    def run_analysis(
        self,
        analysis_id: int,
        engine: Any | None = None,
    ) -> dict[str, Any] | None:
        return AnalysisService.run_analysis(
            self,
            analysis_id,
            engine=engine or V37UnavailableEngine(),
        )


class V37FullSystemQaTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-v37-test-"))
        self.db_path = self.temp_dir / "test_neurochess.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)
        self.analysis_service = V37FakeAnalysisService(
            self.db_path,
            self.temp_dir / "analysis.log",
        )
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: self.repository
        app.dependency_overrides[get_analysis_service] = lambda: self.analysis_service
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        ACTIVE_SESSIONS.clear()
        shutil.rmtree(self.temp_dir)

    def test_backend_e2e_10_moves_fen_evaluation_and_deep_analysis(self) -> None:
        game_id = self._create_game()
        fen_after_each_move: list[str] = []

        for uci in TEN_LEGAL_MOVES:
            response = self.client.post(
                f"/games/{game_id}/moves",
                json={"uci": uci, "is_player": True},
            )
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            fen_after_each_move.append(payload["fen"])
            self.assertEqual(payload["move"]["fen_after"], payload["fen"])
            self.assertNotIn("c", payload["fen"].split(" ", 1)[0])
            chess.Board(payload["fen"])
            self.assertEqual(payload["evaluation"], payload["evaluation_display"])
            self.assertIsNotNone(payload["evaluation_display"])
            self.assertAlmostEqual(
                payload["evaluation_display"]["white_percent"],
                75.1,
                places=1,
            )

        self.assertEqual(len(self.repository.get_moves_for_game(game_id)), 10)
        self.assertEqual(len(fen_after_each_move), 10)
        self.assertEqual(self.analysis_service.process_calls, 10)

        self.analysis_service.complete_pending()
        analyses_response = self.client.get(f"/games/{game_id}/analyses")
        self.assertEqual(analyses_response.status_code, 200)
        analyses = analyses_response.json()["analyses"]
        self.assertEqual(len(analyses), 10)
        self.assertTrue(all(item["analysis_kind"] == "deep" for item in analyses))
        self.assertTrue(all(item["status"] == "done" for item in analyses))
        self.assertTrue(
            all(item["analysis_json"].get("top_moves") for item in analyses)
        )

    def test_illegal_move_keeps_database_unchanged(self) -> None:
        game_id = self._create_game()

        response = self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e5", "is_player": True},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.repository.get_moves_for_game(game_id), [])

    def test_invalid_c_fen_is_rejected_and_not_stored(self) -> None:
        with self.assertRaises(ValueError):
            chess.Board(INVALID_C_FEN)

        response = self.client.get(
            "/analyses/by-fen",
            params={"fen": INVALID_C_FEN, "kind": "deep"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "invalid_fen")
        self.assertEqual(self._analysis_count(), 0)

    def test_engine_unavailable_is_playable_and_distinct_from_invalid_fen(self) -> None:
        unavailable_service = V37UnavailableAnalysisService(
            self.db_path,
            self.temp_dir / "unavailable-analysis.log",
        )
        app.dependency_overrides[get_analysis_service] = lambda: unavailable_service
        game_id = self._create_game()

        response = self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["move"]["uci"], "e2e4")
        self.assertIsNone(payload["evaluation_display"])
        self.assertIsNone(payload["evaluation"])
        self.assertIn("analysis_engine_unavailable", payload["warnings"])
        self.assertNotIn("invalid_fen", payload["warnings"])
        self.assertEqual(len(self.repository.get_moves_for_game(game_id)), 1)

    def test_game_session_rejects_french_piece_letter_in_fen(self) -> None:
        with self.assertRaises(GameSessionError):
            GameSession(INVALID_C_FEN)

    def test_pgn_move_list_capture_check_castle_and_promotion_are_stable(self) -> None:
        game_id = self.repository.create_game("classic")
        recorder = GameRecorder(self.repository)
        session = GameSession()

        for uci in ("e2e4", "d7d5", "e4d5"):
            recorder.play_move(game_id, session, uci, is_player=True)

        capture_moves = self.repository.get_moves_for_game(game_id)
        self.assertEqual(capture_moves[-1].san, "exd5")
        chess.Board(session.current_fen())

        castle_session = GameSession()
        for uci in ("e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "e1g1"):
            castle_session.push_uci(uci)
        self.assertIn("O-O", castle_session.pgn())

        mate_session = GameSession()
        for uci in ("f2f3", "e7e5", "g2g4", "d8h4"):
            last = mate_session.push_uci(uci)
        self.assertTrue(last["is_game_over"])
        self.assertEqual(last["result"], "0-1")

        promotion_session = GameSession("8/P7/8/8/8/8/8/4k2K w - - 0 1")
        promotion = promotion_session.push_uci("a7a8q")
        self.assertEqual(promotion["uci"], "a7a8q")
        chess.Board(promotion["fen_after"])

    def test_database_v3_5_health_checks(self) -> None:
        with closing(get_connection(self.db_path)) as connection:
            migrations = [
                row["id"]
                for row in connection.execute(
                    "SELECT id FROM schema_migrations ORDER BY id"
                )
            ]
            move_columns = [
                row["name"] for row in connection.execute("PRAGMA table_info(moves)")
            ]
            analysis_columns = [
                row["name"]
                for row in connection.execute("PRAGMA table_info(position_analyses)")
            ]
            busy_timeout = connection.execute("PRAGMA busy_timeout").fetchone()[0]
            unique_index_count = connection.execute(
                """
                SELECT COUNT(*)
                FROM sqlite_master
                WHERE type = 'index'
                  AND name = 'idx_position_analyses_unique_v3_5'
                """
            ).fetchone()[0]

        self.assertEqual(
            migrations,
            [
                "0001_v0_schema",
                "0002_v3_5_durable_analysis_pipeline",
                "0003_v4_post_game_review",
                "0004_v5_opening_detection",
                "0005_v5_2_pgn_import",
                "0006_v5_2_2_game_history_categories",
                "0007_v5_3a4_review_analysis_profiles",
                "0008_v5_3a4c_review_jobs",
                "0009_v5_3a4d_review_job_hardening",
                "0010_v5_3a4e_review_job_finalizing",
                "0011_v5_3a4f_review_job_watchdog",
                "0012_v5_2_pgn_r1_import_hardening",
                "0013_v5_2_pgn_r2_sindarov_legacy_repair",
                "0014_v5_3_a5_1_r1_review_score_cache",
                "0015_v5_3_d1_review_practice_sessions",
                "0016_v5_3_d1_r1_review_practice_skip_count",
                "0017_v5_3_d2_review_practice_session_items",
            ],
        )
        self.assertIn("annotations", move_columns)
        self.assertIn("analysis_kind", analysis_columns)
        self.assertIn("analysis_profile", analysis_columns)
        self.assertIn("requested_time_ms", analysis_columns)
        self.assertIn("analysis_limit_mode", analysis_columns)
        self.assertIn("engine_version", analysis_columns)
        self.assertNotIn("engine_name", analysis_columns)
        self.assertNotIn("analysis_depth", analysis_columns)
        self.assertEqual(unique_index_count, 1)
        self.assertEqual(busy_timeout, 30000)

    def test_analysis_json_validity_by_status(self) -> None:
        pending = self.analysis_service.get_or_create_analysis(
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            kind="deep",
        )
        done = self.analysis_service.run_analysis(pending["id"])
        self.assertIsNotNone(done)

        shallow = self.analysis_service.get_or_create_analysis(
            "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
            depth=8,
            multipv=1,
            kind="shallow",
        )
        self.assertEqual(shallow["analysis_json"], {})

        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                "SELECT status, analysis_json FROM position_analyses"
            ).fetchall()

        for row in rows:
            parsed = json.loads(row["analysis_json"])
            self.assertIsInstance(parsed, dict)
            if row["status"] == "done":
                self.assertIn("top_moves", parsed)

    def test_frontend_contract_is_staticly_aligned(self) -> None:
        client_source = (PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts").read_text(
            encoding="utf-8"
        )
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        evaluation_bar_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "EvaluationBar.tsx"
        ).read_text(encoding="utf-8")

        self.assertIn("evaluation_display: Evaluation | null", client_source)
        self.assertIn("evaluation_source: EvaluationSource | null", client_source)
        self.assertIn("state.evaluation_display ?? state.evaluation", app_source)
        self.assertIn("Moteur d'analyse indisponible", app_source)
        self.assertIn("Analyse indisponible", evaluation_bar_source)
        self.assertIn('kind === "shallow"', evaluation_bar_source)
        self.assertIn("analyse rapide", evaluation_bar_source)
        self.assertNotIn("eval_pov_side_to_move_cp", evaluation_bar_source)

    def _create_game(self) -> int:
        response = self.client.post("/games", json={"mode": "classic"})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsNone(payload["result"])
        chess.Board(payload["fen"])
        return int(payload["game_id"])

    def _analysis_count(self) -> int:
        with closing(sqlite3.connect(self.db_path)) as connection:
            return int(
                connection.execute(
                    "SELECT COUNT(*) FROM position_analyses"
                ).fetchone()[0]
            )


if __name__ == "__main__":
    unittest.main()
