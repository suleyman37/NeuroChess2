from __future__ import annotations

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

from backend.app import app  # noqa: E402
from neurochess.api.game_routes import (  # noqa: E402
    ACTIVE_SESSIONS,
    get_analysis_service,
    get_repository,
)
from neurochess.data.database import init_db  # noqa: E402
from neurochess.data.repositories import Repository  # noqa: E402


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


class ExplorerFakeAnalysisService:
    def __init__(
        self,
        db_path: Path,
        *,
        after_eval_cp: int | None = 20,
        fail_after: bool = False,
    ) -> None:
        self.db_path = db_path
        self.after_eval_cp = after_eval_cp
        self.fail_after = fail_after
        self.calls: list[dict[str, Any]] = []
        self.rows: dict[int, dict[str, Any]] = {}

    def get_or_create_analysis(self, **kwargs: Any) -> dict[str, Any]:
        analysis_id = len(self.rows) + 1
        self.rows[analysis_id] = dict(kwargs)
        self.calls.append({"method": "get_or_create_analysis", **kwargs})
        return {"id": analysis_id, "status": "pending"}

    def run_analysis(self, analysis_id: int) -> dict[str, Any]:
        row = self.rows[analysis_id]
        fen = str(row["fen"])
        board = chess.Board(fen)
        if fen != START_FEN and self.fail_after:
            return {"id": analysis_id, "status": "failed", "analysis_json": {}}
        if board.turn == chess.WHITE and fen == START_FEN:
            top_moves = [
                {"rank": 1, "uci": "e2e4", "eval_cp": 100, "mate_in": None, "pv": ["e2e4"]},
                {"rank": 2, "uci": "d2d4", "eval_cp": 90, "mate_in": None, "pv": ["d2d4"]},
                {"rank": 3, "uci": "c2c4", "eval_cp": 20, "mate_in": None, "pv": ["c2c4"]},
                {"rank": 4, "uci": "b1c3", "eval_cp": -20, "mate_in": None, "pv": ["b1c3"]},
            ]
        else:
            legal_move = next(iter(board.legal_moves), None)
            top_moves = [
                {
                    "rank": 1,
                    "uci": legal_move.uci() if legal_move else None,
                    "eval_cp": self.after_eval_cp,
                    "mate_in": None,
                    "pv": [legal_move.uci()] if legal_move else [],
                }
            ]
        return {
            "id": analysis_id,
            "status": "done",
            "analysis_json": {
                "eval_cp": top_moves[0]["eval_cp"] if top_moves else None,
                "mate_in": None,
                "top_moves": top_moves,
            },
        }


class ReviewExplorerStableMoveFeedbackTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-explorer-feedback-"))
        self.db_path = self.temp_dir / "test.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)
        self.analysis_service = ExplorerFakeAnalysisService(self.db_path)
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: self.repository
        app.dependency_overrides[get_analysis_service] = lambda: self.analysis_service
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        ACTIVE_SESSIONS.clear()
        shutil.rmtree(self.temp_dir)

    def test_explorer_evaluate_playable_move_without_practice_side_effects(self) -> None:
        response = self.client.post(
            "/api/review/explorer/evaluate-move",
            json={"fen_before": START_FEN, "move_uci": "c2c4"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["legal"])
        self.assertEqual(payload["result"], "playable")
        self.assertEqual(payload["label"], "Jouable")
        self.assertTrue(payload["no_side_effects"])
        self.assertEqual(payload["source_context"] if "source_context" in payload else "review_explorer", "review_explorer")
        self.assertEqual(self._count("review_practice_attempts"), 0)
        self.assertEqual(self._count("training_items"), 0)
        self.assertEqual(self._count("daily_plan_items"), 0)

    def test_explorer_evaluate_out_of_list_wrong_uses_stable_result(self) -> None:
        self.analysis_service.after_eval_cp = -80

        response = self.client.post(
            "/api/review/explorer/evaluate-move",
            json={"fen_before": START_FEN, "move_uci": "a2a3"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["legal"])
        self.assertEqual(payload["result"], "wrong")
        self.assertEqual(payload["stable_evaluation_status"], "stable_resulting_position")
        self.assertEqual(self._count("review_practice_attempts"), 0)

    def test_explorer_stable_unavailable_returns_rebuild_not_wrong(self) -> None:
        self.analysis_service.fail_after = True

        response = self.client.post(
            "/api/review/explorer/evaluate-move",
            json={"fen_before": START_FEN, "move_uci": "a2a3"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["legal"])
        self.assertEqual(payload["result"], "needs_rebuild")
        self.assertNotEqual(payload["result"], "wrong")
        self.assertEqual(payload["stable_evaluation_status"], "stable_evaluation_unavailable")
        self.assertEqual(self._count("review_practice_attempts"), 0)

    def test_explorer_illegal_move_returns_illegal_without_engine(self) -> None:
        response = self.client.post(
            "/api/review/explorer/evaluate-move",
            json={"fen_before": START_FEN, "move_uci": "e2e5"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload["legal"])
        self.assertEqual(payload["result"], "illegal")
        self.assertEqual(payload["stable_evaluation_status"], "illegal")
        self.assertEqual(self.analysis_service.calls, [])

    def test_frontend_explorer_feedback_copy_and_safe_endpoint_are_wired(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(encoding="utf-8")
        client_source = (PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts").read_text(encoding="utf-8")
        fr_source = (PROJECT_ROOT / "frontend" / "src" / "i18n" / "fr.ts").read_text(encoding="utf-8")

        for token in (
            "Analyser ce coup",
            "Analyser la branche",
            "Évaluation du coup…",
            "Exploration locale",
            "non enregistré comme exercice",
            "Tourner l'échiquier",
        ):
            self.assertIn(token, fr_source)
        self.assertIn("evaluateReviewExplorerMove", app_source)
        self.assertIn("/api/review/explorer/evaluate-move", client_source)
        self.assertIn("review-explorer-analyze-move", app_source)
        self.assertIn("review-exploration-flip-board", app_source)
        self.assertNotIn("recordReviewPracticeAttempt(", app_source.split("analyzeLatestReviewExplorationMove", 1)[1].split("async function handleMove", 1)[0])

    def _count(self, table: str) -> int:
        with closing(sqlite3.connect(self.db_path)) as connection:
            return int(connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])


if __name__ == "__main__":
    unittest.main()
