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
    get_repository,
    get_review_service,
)
from neurochess.data.database import init_db  # noqa: E402
from neurochess.data.repositories import Repository  # noqa: E402
from neurochess.review_practice_service import (  # noqa: E402
    ReviewPracticeService,
    ReviewPracticeServiceError,
)
from neurochess.review_service import (  # noqa: E402
    REVIEW_SCHEMA_VERSION,
    SELECTION_ALGORITHM_VERSION,
)


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
AFTER_E4_E5_FEN = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"
FEN_BXF7 = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4"


class StaticReviewService:
    def __init__(self, review: dict[str, Any]) -> None:
        self.review = review
        self.calls = 0

    def get_review(self, game_id: int, profile: str = "standard") -> dict[str, Any]:
        _ = profile
        self.calls += 1
        payload = dict(self.review)
        payload["game_id"] = game_id
        return payload


def practice_review(game_id: int, user_color: str | None = "white") -> dict[str, Any]:
    annotations = [
        {
            "ply": 1,
            "move_number": 1,
            "color": "white",
            "side": "white",
            "san": "e4",
            "uci": "e2e4",
            "fen_before": START_FEN,
            "fen_after": AFTER_E4_FEN,
            "primary_category": "critical",
            "category_label": "Critique",
            "tags": ["missed_opportunity"],
            "tag_labels": ["Opportunite manquee"],
            "win_loss": 25.0,
            "move_accuracy": 30.0,
            "best_move_uci": "e2e4",
            "best_move_san": "e4",
            "try_move_supported": True,
            "acceptable_moves": [
                {
                    "uci": "e2e4",
                    "san": "e4",
                    "quality": "best",
                    "delta_from_best_win_percent": 0.0,
                }
            ],
            "pedagogical_explanation": {
                "error_type": "tactical",
                "main_message": "Tu as probablement rate une ressource tactique.",
                "why_best_move_good": "Le meilleur coup force la position.",
            },
            "pv_line": [
                {"ply_offset": 1, "uci": "e2e4", "san": "e4", "fen_after": AFTER_E4_FEN}
            ],
            "pv_line_available": True,
            "coach_priority_rank": 1,
        },
        {
            "ply": 2,
            "move_number": 1,
            "color": "black",
            "side": "black",
            "san": "e5",
            "uci": "e7e5",
            "fen_before": AFTER_E4_FEN,
            "fen_after": AFTER_E4_E5_FEN,
            "primary_category": "inexact",
            "category_label": "Imprecis",
            "tags": ["cluster"],
            "win_loss": 9.0,
            "move_accuracy": 58.0,
            "best_move_uci": "e7e5",
            "best_move_san": "e5",
            "try_move_supported": True,
            "acceptable_moves": [
                {
                    "uci": "e7e5",
                    "san": "e5",
                    "quality": "best",
                    "delta_from_best_win_percent": 0.0,
                }
            ],
            "pedagogical_explanation": {"error_type": "cluster"},
            "pv_line": [],
            "pv_line_available": False,
            "coach_priority_rank": 2,
        },
    ]
    return {
        "game_id": game_id,
        "status": "done",
        "user_color": user_color,
        "coverage": 1.0,
        "move_annotations": annotations,
        "review_sections": {
            "to_review": annotations,
            "strong_moves": [],
            "missed_opportunities": [annotations[0]],
            "all": annotations,
        },
    }


def practice_review_bxf7_legacy(game_id: int) -> dict[str, Any]:
    annotation = {
        "ply": 7,
        "move_number": 4,
        "color": "white",
        "side": "white",
        "san": "Bc4",
        "uci": "f1c4",
        "fen_before": FEN_BXF7,
        "fen_after": FEN_BXF7,
        "primary_category": "critical",
        "category_label": "Critique",
        "tags": ["missed_opportunity"],
        "tag_labels": ["Opportunite manquee"],
        "win_loss": 31.0,
        "move_accuracy": 34.0,
        "best_move_uci": "Bxf7+",
        "best_move_san": "Bxf7+",
        "try_move_supported": True,
        "acceptable_moves": [],
        "accepted_moves_json": None,
        "pedagogical_explanation": {
            "error_type": "tactical",
            "why_best_move_good": "Le coup force le roi adverse.",
        },
        "pv_line": [],
        "pv_line_available": False,
        "coach_priority_rank": 1,
    }
    return {
        "game_id": game_id,
        "status": "done",
        "user_color": "white",
        "coverage": 1.0,
        "move_annotations": [annotation],
        "review_sections": {
            "to_review": [annotation],
            "strong_moves": [],
            "missed_opportunities": [annotation],
            "all": [annotation],
        },
    }


class ReviewPracticeSessionsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-practice-"))
        self.db_path = self.temp_dir / "test.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)
        self.game_id = self.repository.create_game("classic")
        self.repository.finish_game(self.game_id, result="*", pgn="[Result \"*\"]")
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                INSERT INTO game_reviews (
                    game_id,
                    status,
                    review_schema_version,
                    selection_algorithm_version,
                    created_at,
                    updated_at,
                    warnings_json
                )
                VALUES (?, 'done', ?, ?, datetime('now'), datetime('now'), '[]')
                """,
                (self.game_id, REVIEW_SCHEMA_VERSION, SELECTION_ALGORITHM_VERSION),
            )
            connection.commit()

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        ACTIVE_SESSIONS.clear()
        shutil.rmtree(self.temp_dir)

    def test_create_attempts_and_complete_session(self) -> None:
        service = ReviewPracticeService(
            self.db_path,
            review_service=StaticReviewService(practice_review(self.game_id)),  # type: ignore[arg-type]
        )

        session = service.create_session(self.game_id, pov="both", max_items=5)
        self.assertEqual(session["status"], "running")
        self.assertEqual(len(session["items"]), 2)

        best_summary = service.record_attempt(
            int(session["session_id"]),
            ply=1,
            attempted_uci="e2e4",
            result="wrong",
        )
        wrong_summary = service.record_attempt(
            int(session["session_id"]),
            ply=1,
            attempted_uci="d2d4",
            result="best",
        )
        revealed_summary = service.record_attempt(
            int(session["session_id"]),
            ply=2,
            attempted_uci=None,
            result="revealed",
        )
        skipped_summary = service.record_attempt(
            int(session["session_id"]),
            ply=2,
            attempted_uci=None,
            result="skipped",
        )
        completed = service.complete_session(int(session["session_id"]))

        self.assertEqual(best_summary["correct_count"], 1)
        self.assertEqual(best_summary["attempt_feedback"]["result"], "best")
        self.assertEqual(best_summary["attempt_feedback"]["attempted_san"], "e4")
        self.assertEqual(wrong_summary["needs_rebuild_count"], 1)
        self.assertEqual(wrong_summary["attempt_feedback"]["result"], "needs_rebuild")
        self.assertEqual(revealed_summary["revealed_count"], 1)
        self.assertEqual(revealed_summary["attempt_feedback"]["result"], "revealed")
        self.assertEqual(skipped_summary["wrong_count"], 0)
        self.assertEqual(skipped_summary["needs_rebuild_count"], 1)
        self.assertEqual(skipped_summary["skipped_count"], 1)
        self.assertEqual(skipped_summary["attempt_feedback"]["result"], "skipped")
        self.assertEqual(completed["status"], "completed")
        self.assertEqual(completed["attempt_count"], 4)
        with closing(sqlite3.connect(self.db_path)) as connection:
            attempts = connection.execute(
                "SELECT COUNT(*) FROM review_practice_attempts"
            ).fetchone()[0]
            snapshot = json.loads(
                connection.execute(
                    """
                    SELECT evidence_snapshot_json
                    FROM review_practice_attempts
                    ORDER BY id
                    LIMIT 1
                    """
                ).fetchone()[0]
            )
        self.assertEqual(attempts, 4)
        self.assertEqual(snapshot["best_move_uci"], "e2e4")

    def test_exact_best_move_san_legacy_review_is_success(self) -> None:
        service = ReviewPracticeService(
            self.db_path,
            review_service=StaticReviewService(practice_review_bxf7_legacy(self.game_id)),  # type: ignore[arg-type]
        )

        session = service.create_session(self.game_id, pov="both", max_items=5)
        summary = service.record_attempt(
            int(session["session_id"]),
            ply=7,
            attempted_uci="c4f7",
            result="wrong",
            source_context="review_practice",
        )

        self.assertEqual(summary["attempt_feedback"]["result"], "best")
        self.assertEqual(summary["attempt_feedback"]["attempted_san"], "Bxf7+")
        self.assertEqual(summary["attempt_feedback"]["best_move_uci"], "c4f7")
        self.assertFalse(summary["attempt_feedback"]["show_best_move"])
        self.assertIsNotNone(summary["latest_attempt"]["due_at"])
        with closing(sqlite3.connect(self.db_path)) as connection:
            row = connection.execute(
                """
                SELECT result, attempted_uci, expected_best_uci, due_at,
                       evidence_snapshot_json
                FROM review_practice_attempts
                ORDER BY id DESC
                LIMIT 1
                """
            ).fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], "best")
        self.assertEqual(row[1], "c4f7")
        self.assertEqual(row[2], "c4f7")
        self.assertIsNotNone(row[3])
        evidence = json.loads(row[4])
        self.assertEqual(
            evidence["attempt_classification"]["reason_code"],
            "exact_best_move",
        )

    def test_original_game_move_is_not_reused_as_user_attempt(self) -> None:
        review = practice_review(self.game_id)
        annotation = review["move_annotations"][0]
        annotation["san"] = "d4"
        annotation["uci"] = "d2d4"
        annotation["best_move_uci"] = "e2e4"
        annotation["best_move_san"] = "e4"
        annotation["acceptable_moves"] = []
        service = ReviewPracticeService(
            self.db_path,
            review_service=StaticReviewService(review),  # type: ignore[arg-type]
        )

        session = service.create_session(self.game_id, pov="both", max_items=5)
        summary = service.record_attempt(
            int(session["session_id"]),
            ply=1,
            attempted_uci="e2e4",
            result="wrong",
        )

        self.assertEqual(summary["attempt_feedback"]["result"], "best")
        self.assertEqual(summary["attempt_feedback"]["attempted_uci"], "e2e4")
        self.assertEqual(summary["attempt_feedback"]["attempted_san"], "e4")
        with closing(sqlite3.connect(self.db_path)) as connection:
            row = connection.execute(
                """
                SELECT result, attempted_uci, evidence_snapshot_json
                FROM review_practice_attempts
                ORDER BY id DESC
                LIMIT 1
                """
            ).fetchone()
        self.assertEqual(row[0], "best")
        self.assertEqual(row[1], "e2e4")
        evidence = json.loads(row[2])
        self.assertEqual(evidence["uci"], "d2d4")
        self.assertEqual(
            evidence["attempt_classification"]["user_move_uci"],
            "e2e4",
        )

    def test_unparseable_legacy_best_move_requires_rebuild_not_wrong(self) -> None:
        review = practice_review(self.game_id)
        annotation = review["move_annotations"][0]
        annotation["best_move_uci"] = "not-a-legal-move"
        annotation["best_move_san"] = None
        annotation["acceptable_moves"] = []
        service = ReviewPracticeService(
            self.db_path,
            review_service=StaticReviewService(review),  # type: ignore[arg-type]
        )

        session = service.create_session(self.game_id, pov="both", max_items=5)
        with self.assertRaises(ReviewPracticeServiceError) as context:
            service.record_attempt(
                int(session["session_id"]),
                ply=1,
                attempted_uci="e2e4",
            )

        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(
            context.exception.payload["error_code"],
            "REVIEW_LEGACY_REBUILD_REQUIRED",
        )
        self.assertEqual(
            context.exception.payload["feedback"]["reason_code"],
            "best_move_missing_or_unparseable",
        )
        with closing(sqlite3.connect(self.db_path)) as connection:
            attempts = connection.execute(
                "SELECT COUNT(*) FROM review_practice_attempts"
            ).fetchone()[0]
        self.assertEqual(attempts, 0)

    def test_api_endpoints_create_attempt_and_complete(self) -> None:
        static_review_service = StaticReviewService(practice_review(self.game_id))
        app.dependency_overrides[get_repository] = lambda: self.repository
        app.dependency_overrides[get_review_service] = lambda: static_review_service
        client = TestClient(app)

        session_response = client.post(
            f"/games/{self.game_id}/review/practice/sessions",
            json={"pov": "white", "scope": "top_priority", "max_items": 5},
        )
        self.assertEqual(session_response.status_code, 200)
        session_payload = session_response.json()
        self.assertEqual(session_payload["item_count"], 1)

        attempt_response = client.post(
            f"/review/practice/sessions/{session_payload['session_id']}/attempts",
            json={"ply": 1, "attempted_uci": "e2e4", "result": "wrong"},
        )
        self.assertEqual(attempt_response.status_code, 200)
        self.assertEqual(attempt_response.json()["correct_count"], 1)
        self.assertEqual(attempt_response.json()["attempt_feedback"]["result"], "best")
        self.assertEqual(attempt_response.json()["attempt_feedback"]["attempted_san"], "e4")

        complete_response = client.post(
            f"/review/practice/sessions/{session_payload['session_id']}/complete"
        )
        self.assertEqual(complete_response.status_code, 200)
        self.assertEqual(complete_response.json()["status"], "completed")

    def test_api_try_move_evaluation_has_no_practice_side_effect(self) -> None:
        client = TestClient(app)

        response = client.post(
            "/review/try-move/evaluate",
            json={
                "fen_before": FEN_BXF7,
                "move_played": "Bxf7+",
                "best_move_san": "Bxf7+",
                "source_context": "review_try_move",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["result"], "best")
        self.assertFalse(payload["show_best_move"])
        self.assertEqual(payload["evidence"]["user_move_uci"], "c4f7")
        self.assertEqual(payload["evidence"]["best_move_uci"], "c4f7")
        with closing(sqlite3.connect(self.db_path)) as connection:
            attempts = connection.execute(
                "SELECT COUNT(*) FROM review_practice_attempts"
            ).fetchone()[0]
            jobs = connection.execute("SELECT COUNT(*) FROM review_jobs").fetchone()[0]
        self.assertEqual(attempts, 0)
        self.assertEqual(jobs, 0)

    def test_api_history_detail_abandon_and_retry_failed(self) -> None:
        static_review_service = StaticReviewService(practice_review(self.game_id))
        app.dependency_overrides[get_repository] = lambda: self.repository
        app.dependency_overrides[get_review_service] = lambda: static_review_service
        client = TestClient(app)

        session_response = client.post(
            f"/games/{self.game_id}/review/practice/sessions",
            json={"pov": "both", "scope": "top_priority", "max_items": 5},
        )
        self.assertEqual(session_response.status_code, 200)
        session_payload = session_response.json()
        session_id = session_payload["session_id"]

        client.post(
            f"/review/practice/sessions/{session_id}/attempts",
            json={"ply": 1, "attempted_uci": "e2e5", "result": "illegal"},
        )

        list_response = client.get(
            f"/games/{self.game_id}/review/practice/sessions"
        )
        detail_response = client.get(f"/review/practice/sessions/{session_id}")
        retry_response = client.post(
            f"/review/practice/sessions/{session_id}/retry-failed"
        )
        abandon_response = client.post(
            f"/review/practice/sessions/{session_id}/abandon"
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()["sessions"]), 1)
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json()["summary"]["illegal_count"], 1)
        self.assertEqual(retry_response.status_code, 200)
        self.assertEqual([item["ply"] for item in retry_response.json()["items"]], [1])
        self.assertEqual(abandon_response.status_code, 200)
        self.assertEqual(abandon_response.json()["status"], "abandoned")


if __name__ == "__main__":
    unittest.main()
