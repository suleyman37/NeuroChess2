from __future__ import annotations

import shutil
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
import json
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
    get_live_analysis_service,
    get_repository,
)
from neurochess.data.database import init_db
from neurochess.data.repositories import Repository


class ApiFakeEngine:
    def analyze_fen(
        self,
        fen: str,
        depth: int,
        multipv: int,
        time_budget_ms: int | None = None,
    ) -> dict[str, Any]:
        _ = time_budget_ms
        return {
            "fen": fen,
            "engine": "stockfish",
            "engine_version": "FakeFish API",
            "depth": depth,
            "multipv": multipv,
            "eval_cp": 300,
            "mate_in": None,
            "top_moves": [
                {
                    "rank": 1,
                    "uci": "e7e5",
                    "eval_cp": 300,
                    "eval_pov_side_to_move_cp": -300,
                    "mate_in": None,
                    "pv": ["e7e5"],
                }
            ],
        }


class ApiTimeoutEngine:
    def analyze_fen(
        self,
        fen: str,
        depth: int,
        multipv: int,
        time_budget_ms: int | None = None,
    ) -> dict[str, Any]:
        _ = fen, depth, multipv, time_budget_ms
        raise TimeoutError("deterministic timeout")


class ApiFakeAnalysisService(AnalysisService):
    def __init__(self, db_path: Path, log_path: Path) -> None:
        super().__init__(db_path, log_path=log_path)
        self.process_calls = 0

    def run_analysis(
        self,
        analysis_id: int,
        engine: Any | None = None,
    ) -> dict[str, Any] | None:
        return super().run_analysis(analysis_id, engine=engine or ApiFakeEngine())

    def process_pending_analyses(
        self,
        limit: int = 10,
        engine: Any | None = None,
    ) -> list[dict[str, Any]]:
        _ = limit, engine
        self.process_calls += 1
        return []

    def complete_pending(self) -> list[dict[str, Any]]:
        return super().process_pending_analyses(limit=10, engine=ApiFakeEngine())

    def fail_analysis(self, analysis_id: int) -> dict[str, Any] | None:
        return super().run_analysis(analysis_id, engine=ApiTimeoutEngine())


class ApiFakeLiveAnalysisService:
    def __init__(self) -> None:
        self.started: list[dict[str, Any]] = []
        self.stopped_games: list[int] = []
        self.stopped_sessions: list[str] = []

    def start_session(
        self,
        fen: str,
        game_id: int | None = None,
        ply: int | None = None,
        context: str | None = None,
        review_moment_id: str | None = None,
    ) -> str:
        session_id = f"fake-live-{len(self.started) + 1}"
        self.started.append(
            {
                "session_id": session_id,
                "fen": fen,
                "game_id": game_id,
                "ply": ply,
                "context": context,
                "review_moment_id": review_moment_id,
            }
        )
        return session_id

    def stop_sessions_for_game(self, game_id: int) -> None:
        self.stopped_games.append(game_id)

    def stop_session(self, session_id: str) -> dict[str, Any]:
        self.stopped_sessions.append(session_id)
        return {"session_id": session_id, "status": "stopped"}

    def wait_for_latest(
        self,
        session_id: str,
        timeout_seconds: float = 0.35,
    ) -> dict[str, Any] | None:
        session = next(
            (
                item
                for item in self.started
                if item["session_id"] == session_id
            ),
            None,
        )
        if session is None:
            return None
        return {
            "type": "analysis_update",
            "session_id": session_id,
            "fen": session["fen"],
            "context": session["context"] or "live",
            "analysis_kind": "live",
            "evaluation_display": {
                "white_percent": 53.9,
                "black_percent": 46.1,
                "label": "+0.42",
                "is_mate": False,
            },
            "evaluation_source": {
                "kind": "live",
                "analysis_profile": "live_continuous",
            },
        }

    def stream_session(self, session_id: str) -> list[str]:
        _ = session_id
        return []


class ApiFailingLiveAnalysisService(ApiFakeLiveAnalysisService):
    def start_session(
        self,
        fen: str,
        game_id: int | None = None,
        ply: int | None = None,
        context: str | None = None,
        review_moment_id: str | None = None,
    ) -> str:
        _ = fen, game_id, ply, context, review_moment_id
        raise RuntimeError("deterministic live start failure")


class GameApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-api-test-"))
        self.db_path = self.temp_dir / "test_neurochess.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)
        self.analysis_service = ApiFakeAnalysisService(
            self.db_path,
            self.temp_dir / "analysis.log",
        )
        self.live_analysis_service = ApiFakeLiveAnalysisService()
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: self.repository
        app.dependency_overrides[get_analysis_service] = lambda: self.analysis_service
        app.dependency_overrides[get_live_analysis_service] = (
            lambda: self.live_analysis_service
        )
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        ACTIVE_SESSIONS.clear()
        shutil.rmtree(self.temp_dir)

    def test_health_returns_ok(self) -> None:
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_post_games_creates_game(self) -> None:
        response = self.client.post("/games", json={"mode": "classic"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsInstance(payload["game_id"], int)
        self.assertIn("e2e4", payload["legal_moves"])
        self.assertEqual(payload["moves"], [])

    def test_post_move_e2e4_works(self) -> None:
        game_id = self._create_game()

        response = self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True, "time_spent": None},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["move"]["uci"], "e2e4")
        self.assertEqual(payload["move"]["san"], "e4")
        self.assertEqual(payload["moves"][0]["uci"], "e2e4")
        self.assertEqual(payload["move"]["fen_after"], payload["fen"])
        chess.Board(payload["fen"])

    def test_post_move_returns_evaluation_display_and_compat_alias(self) -> None:
        game_id = self._create_game()

        response = self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["evaluation"], payload["evaluation_display"])
        self.assertAlmostEqual(
            payload["evaluation_display"]["white_percent"],
            75.1,
            places=1,
        )
        self.assertEqual(payload["evaluation_display"]["label"], "+3.00")
        self.assertFalse(payload["evaluation_display"]["is_mate"])
        self.assertEqual(payload["evaluation_source"]["kind"], "shallow")
        self.assertEqual(payload["evaluation_source"]["depth"], 8)
        self.assertIsNone(payload["evaluation_source"]["nodes"])
        self.assertEqual(
            payload["evaluation_source"]["engine_version"],
            "FakeFish API",
        )
        self.assertEqual(payload["live_analysis_session_id"], "fake-live-1")
        self.assertEqual(payload["fen_after"], payload["fen"])

    def test_fen_changes_after_e2e4(self) -> None:
        start_payload = self.client.post("/games", json={"mode": "classic"}).json()
        start_fen = start_payload["fen"]
        game_id = start_payload["game_id"]

        move_payload = self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        ).json()

        self.assertNotEqual(move_payload["fen"], start_fen)

    def test_get_game_returns_game_and_moves(self) -> None:
        game_id = self._create_game()
        self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        )

        response = self.client.get(f"/games/{game_id}")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["game"]["id"], game_id)
        self.assertEqual(len(payload["moves"]), 1)

    def test_illegal_move_returns_400(self) -> None:
        game_id = self._create_game()

        response = self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e5", "is_player": True},
        )

        self.assertEqual(response.status_code, 400)

    def test_finish_game_marks_completed(self) -> None:
        game_id = self._create_game()
        self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        )

        response = self.client.post(f"/games/{game_id}/finish", json={"result": "*"})

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["game"]["completed"])
        self.assertEqual(payload["game"]["result"], "*")

    def test_get_games_lists_created_game(self) -> None:
        game_id = self._create_game()

        response = self.client.get("/games")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(any(game["id"] == game_id for game in payload))

    def test_move_works_when_stockfish_is_unavailable(self) -> None:
        game_id = self._create_game()

        response = self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(
            payload["evaluation"] is not None
            or "engine_unavailable" in payload["warnings"]
        )

    def test_get_analysis_by_fen_returns_202_for_pending(self) -> None:
        analysis = self.analysis_service.get_or_create_analysis(
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            kind="deep",
        )

        response = self.client.get(
            "/analyses/by-fen",
            params={"fen": analysis["fen"], "kind": "deep"},
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "pending")

    def test_get_analysis_by_fen_returns_done_payload(self) -> None:
        analysis = self.analysis_service.get_or_create_analysis(
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            kind="deep",
        )
        self.analysis_service.run_analysis(analysis["id"])

        response = self.client.get(
            "/analyses/by-fen",
            params={"fen": analysis["fen"], "kind": "deep"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "done")
        self.assertIn("top_moves", payload["analysis_json"])

    def test_get_analysis_by_fen_returns_409_for_failed(self) -> None:
        analysis = self.analysis_service.get_or_create_analysis(
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            kind="deep",
        )
        self.analysis_service.fail_analysis(analysis["id"])

        response = self.client.get(
            "/analyses/by-fen",
            params={"fen": analysis["fen"], "kind": "deep"},
        )

        self.assertEqual(response.status_code, 409)
        payload = response.json()
        self.assertEqual(payload["status"], "failed")
        self.assertEqual(payload["error_message"], "time_budget_exceeded")

    def test_get_analysis_by_fen_returns_404_when_absent(self) -> None:
        response = self.client.get(
            "/analyses/by-fen",
            params={"fen": "4k3/8/8/8/8/8/8/4K3 w - - 0 1", "kind": "deep"},
        )

        self.assertEqual(response.status_code, 404)

    def test_get_analysis_by_fen_rejects_invalid_fen_distinctly(self) -> None:
        response = self.client.get(
            "/analyses/by-fen",
            params={
                "fen": "7r/8/4k1Rp/8/2c2P2/4B3/PPP3PP/2K2BNR b - - 1 18",
                "kind": "deep",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "invalid_fen")

    def test_live_analysis_start_and_stop_endpoints(self) -> None:
        start_response = self.client.post(
            "/live-analysis/start",
            json={
                "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                "game_id": 4,
                "ply": 2,
                "context": "historical",
            },
        )

        self.assertEqual(start_response.status_code, 200)
        start_payload = start_response.json()
        self.assertEqual(start_payload["session_id"], "fake-live-1")
        self.assertEqual(start_payload["status"], "started")
        self.assertEqual(start_payload["context"], "historical")
        self.assertEqual(start_payload["fen"], "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
        self.assertEqual(start_payload["latest_payload"]["analysis_kind"], "live")
        self.assertEqual(
            start_payload["latest_payload"]["evaluation_source"]["kind"],
            "live",
        )

        stop_response = self.client.post(
            "/live-analysis/stop",
            json={"session_id": start_payload["session_id"]},
        )

        self.assertEqual(stop_response.status_code, 200)
        self.assertEqual(stop_response.json()["status"], "stopped")

    def test_live_analysis_start_does_not_create_review_or_training_rows(self) -> None:
        game_id = self._create_game()

        response = self.client.post(
            "/live-analysis/start",
            json={
                "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                "game_id": game_id,
                "ply": 0,
                "context": "review",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "started")
        self.assertEqual(payload["context"], "review")
        self.assertEqual(payload["session_id"], "fake-live-1")
        self.assertEqual(payload["latest_payload"]["analysis_kind"], "live")
        self.assertEqual(self.live_analysis_service.started[0]["context"], "review")
        with closing(sqlite3.connect(self.db_path)) as connection:
            counts = {
                table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                for table in (
                    "review_jobs",
                    "game_reviews",
                    "review_moments",
                    "training_items",
                    "review_practice_attempts",
                )
            }

        self.assertEqual(counts["review_jobs"], 0)
        self.assertEqual(counts["game_reviews"], 0)
        self.assertEqual(counts["review_moments"], 0)
        self.assertEqual(counts["training_items"], 0)
        self.assertEqual(counts["review_practice_attempts"], 0)

    def test_post_move_does_not_depend_on_deep_result(self) -> None:
        game_id = self._create_game()

        response = self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsNotNone(payload["evaluation"])
        self.assertEqual(payload["evaluation_source"]["kind"], "shallow")
        self.assertIsNotNone(payload["live_analysis_session_id"])
        self.assertNotIn("analysis", payload)
        self.assertNotIn("deep_analysis", payload)
        self.assertEqual(self.analysis_service.process_calls, 1)

        deep_row = self._analysis_row(kind="deep")
        self.assertIsNotNone(deep_row)
        self.assertEqual(deep_row["status"], "pending")

        self.analysis_service.complete_pending()
        completed_deep_row = self._analysis_row(kind="deep")
        self.assertIsNotNone(completed_deep_row)
        self.assertEqual(completed_deep_row["status"], "done")
        self.assertIn("top_moves", completed_deep_row["analysis_json"])

    def test_get_game_moves_returns_empty_history_without_engine_work(self) -> None:
        game_id = self._create_game()
        process_calls_before = self.analysis_service.process_calls

        response = self.client.get(f"/games/{game_id}/moves")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["game_id"], game_id)
        self.assertEqual(payload["initial_fen"], chess.STARTING_FEN)
        self.assertEqual(payload["current_fen"], chess.STARTING_FEN)
        self.assertEqual(payload["status"], "in_progress")
        self.assertEqual(payload["moves"], [])
        self.assertEqual(self.analysis_service.process_calls, process_calls_before)

    def test_get_game_moves_returns_ordered_fen_history_and_current_fen(self) -> None:
        game_id = self._create_game()
        self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        )
        self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e7e5", "is_player": True},
        )
        process_calls_before = self.analysis_service.process_calls

        response = self.client.get(f"/games/{game_id}/moves")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "in_progress")
        self.assertEqual([move["ply"] for move in payload["moves"]], [1, 2])
        first = payload["moves"][0]
        second = payload["moves"][1]
        self.assertEqual(first["side_to_move_before"], "white")
        self.assertEqual(first["played_uci"], "e2e4")
        self.assertEqual(first["played_san"], "e4")
        self.assertEqual(first["fen_before"], chess.STARTING_FEN)
        self.assertEqual(first["fen_after"], second["fen_before"])
        self.assertEqual(second["side_to_move_before"], "black")
        self.assertEqual(second["played_uci"], "e7e5")
        self.assertEqual(payload["current_fen"], second["fen_after"])
        self.assertEqual(self.analysis_service.process_calls, process_calls_before)

    def test_get_game_moves_current_fen_stays_final_after_manual_finish(self) -> None:
        game_id = self._create_game()
        self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        )
        finished = self.client.post(f"/games/{game_id}/finish").json()
        final_fen = finished["fen"]

        response = self.client.get(f"/games/{game_id}/moves")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "manually_terminated")
        self.assertEqual(payload["current_fen"], final_fen)

    def test_post_move_starts_live_analysis_without_waiting_for_updates(self) -> None:
        game_id = self._create_game()

        response = self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["live_analysis_session_id"], "fake-live-1")
        self.assertEqual(len(self.live_analysis_service.started), 1)
        self.assertEqual(self.live_analysis_service.started[0]["game_id"], game_id)
        self.assertEqual(self.live_analysis_service.started[0]["fen"], payload["fen"])
        self.assertNotIn("live_analysis_update", payload)

    def test_post_move_still_works_when_live_analysis_start_fails(self) -> None:
        failing_live_service = ApiFailingLiveAnalysisService()
        app.dependency_overrides[get_live_analysis_service] = (
            lambda: failing_live_service
        )
        game_id = self._create_game()

        response = self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsNone(payload["live_analysis_session_id"])
        self.assertIn("live_analysis_unavailable", payload["warnings"])

    def test_new_move_stops_previous_live_sessions_for_game(self) -> None:
        game_id = self._create_game()

        first = self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        ).json()
        second = self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e7e5", "is_player": True},
        ).json()

        self.assertEqual(first["live_analysis_session_id"], "fake-live-1")
        self.assertEqual(second["live_analysis_session_id"], "fake-live-2")
        self.assertEqual(self.live_analysis_service.stopped_games, [game_id, game_id])

    def test_live_updates_are_not_written_as_position_analyses(self) -> None:
        game_id = self._create_game()
        self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        )

        with closing(sqlite3.connect(self.db_path)) as connection:
            live_rows = connection.execute(
                """
                SELECT COUNT(*)
                FROM position_analyses
                WHERE analysis_kind = 'live'
                """
            ).fetchone()[0]

        self.assertEqual(live_rows, 0)

    def test_get_game_analyses_lists_deep_positions_only(self) -> None:
        game_id = self._create_game()
        self.client.post(
            f"/games/{game_id}/moves",
            json={"uci": "e2e4", "is_player": True},
        )
        self.analysis_service.complete_pending()

        response = self.client.get(f"/games/{game_id}/analyses")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["game_id"], game_id)
        self.assertEqual(len(payload["analyses"]), 1)
        self.assertEqual(payload["analyses"][0]["analysis_kind"], "deep")
        self.assertEqual(payload["analyses"][0]["status"], "done")

    def _create_game(self) -> int:
        response = self.client.post("/games", json={"mode": "classic"})
        self.assertEqual(response.status_code, 200)
        return int(response.json()["game_id"])

    def _analysis_row(self, kind: str) -> dict[str, Any] | None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.row_factory = sqlite3.Row
            row = connection.execute(
                """
                SELECT *
                FROM position_analyses
                WHERE analysis_kind = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (kind,),
            ).fetchone()

        if row is None:
            return None

        return {
            "id": row["id"],
            "status": row["status"],
            "analysis_json": (
                {} if not row["analysis_json"] else json.loads(row["analysis_json"])
            ),
        }


if __name__ == "__main__":
    unittest.main()
