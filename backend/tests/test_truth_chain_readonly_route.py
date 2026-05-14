from __future__ import annotations

import inspect
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

from backend.app import app  # noqa: E402
from neurochess.api import game_routes  # noqa: E402
from neurochess.api.game_routes import ACTIVE_SESSIONS, get_repository  # noqa: E402
from neurochess.data.database import init_db  # noqa: E402
from neurochess.data.repositories import Repository  # noqa: E402
from neurochess.review_moments_readonly_service import (  # noqa: E402
    ReviewMomentsReadOnlyService,
)
from neurochess.review_service import (  # noqa: E402
    REVIEW_SCHEMA_VERSION,
    SELECTION_ALGORITHM_VERSION,
)


START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


class TruthChainReadOnlyRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-truth-chain-"))
        self.db_path = self.temp_dir / "test.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: self.repository
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        ACTIVE_SESSIONS.clear()
        shutil.rmtree(self.temp_dir)

    def test_route_returns_persisted_review_moments_without_raw_metrics(self) -> None:
        game_id = self._create_finished_game()
        review_id, first_moment_id = self._seed_review_moments(game_id, count=6)
        training_item_id = self._seed_training_item(game_id, first_moment_id)
        self._seed_daily_plan_item(training_item_id)
        before = self._mutation_snapshot()

        response = self.client.get(f"/games/{game_id}/truth-chain/moments")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["game"]["id"], str(game_id))
        self.assertEqual(payload["game"]["white"], "bahij")
        self.assertEqual(payload["game"]["black"], "ClubRival")
        self.assertEqual(payload["game"]["openingName"], "Sicilian Defense: Najdorf")
        self.assertEqual(payload["game"]["eco"], "B90")
        self.assertEqual(payload["game"]["reviewStatus"], "done")
        self.assertEqual(payload["game"]["moveCount"], 6)
        self.assertEqual(len(payload["moments"]), 5)
        self.assertIn("limited to first 5 persisted moments", payload["limitations"])

        first = payload["moments"][0]
        self.assertEqual(first["gameId"], str(game_id))
        self.assertEqual(first["ply"], 1)
        self.assertEqual(first["moveNumber"], 1)
        self.assertEqual(first["san"], "e4")
        self.assertEqual(first["uci"], "e2e4")
        self.assertEqual(first["fenBefore"], START_FEN)
        self.assertTrue(first["fenAfter"])
        self.assertEqual(first["momentKind"], "tactical")
        self.assertEqual(first["visualSeverity"], "critical")
        self.assertTrue(first["reviewAvailable"])
        self.assertTrue(first["exerciseAvailable"])
        self.assertEqual(first["source"], "persisted_review_moment")
        self.assertEqual(payload["readOnlyProof"]["methodsAllowed"], ["GET"])
        self.assertFalse(payload["readOnlyProof"]["writesPerformed"])
        self.assertFalse(payload["readOnlyProof"]["trainingItemsCreated"])
        self.assertFalse(payload["readOnlyProof"]["dailyPlanTouched"])
        self.assertFalse(payload["readOnlyProof"]["dueAtTouched"])
        self.assertFalse(payload["readOnlyProof"]["engineInvoked"])
        self.assertEqual(self._mutation_snapshot(), before)
        self.assertEqual(self._review_moment_count(review_id), 6)
        self._assert_banned_metrics_absent(payload)

    def test_route_returns_empty_without_creating_data(self) -> None:
        game_id = self._create_finished_game()
        before = self._mutation_snapshot()

        first = self.client.get(f"/games/{game_id}/truth-chain/moments")
        second = self.client.get(f"/games/{game_id}/truth-chain/moments")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        payload = second.json()
        self.assertEqual(payload["moments"], [])
        self.assertIn("no persisted review", payload["limitations"])
        self.assertFalse(payload["readOnlyProof"]["writesPerformed"])
        self.assertEqual(self._mutation_snapshot(), before)

    def test_route_returns_empty_when_review_exists_without_moments(self) -> None:
        game_id = self._create_finished_game()
        review_id = self._seed_review_without_moments(game_id)
        training_item_id = self._seed_training_item(game_id, None)
        self._seed_daily_plan_item(training_item_id)
        self._seed_review_practice_attempt(game_id, training_item_id)
        before = self._mutation_snapshot()

        first = self.client.get(f"/games/{game_id}/truth-chain/moments")
        second = self.client.get(f"/games/{game_id}/truth-chain/moments")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        payload = second.json()
        self.assertEqual(payload["moments"], [])
        self.assertTrue(payload["limitations"])
        self.assertIn("no persisted review moments", payload["limitations"])
        self.assertFalse(payload["readOnlyProof"]["writesPerformed"])
        self.assertFalse(payload["readOnlyProof"]["trainingItemsCreated"])
        self.assertFalse(payload["readOnlyProof"]["dailyPlanTouched"])
        self.assertFalse(payload["readOnlyProof"]["dueAtTouched"])
        self.assertEqual(self._review_moment_count(review_id), 0)
        self.assertEqual(self._mutation_snapshot(), before)

    def test_route_returns_404_for_missing_game(self) -> None:
        response = self.client.get("/games/999999/truth-chain/moments")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Game does not exist")

    def test_repeated_calls_do_not_mutate_training_practice_daily_plan_or_due_at(self) -> None:
        game_id = self._create_finished_game()
        _, first_moment_id = self._seed_review_moments(game_id, count=2)
        training_item_id = self._seed_training_item(game_id, first_moment_id)
        self._seed_daily_plan_item(training_item_id)
        self._seed_review_practice_attempt(game_id, training_item_id)
        before = self._mutation_snapshot()

        first = self.client.get(f"/games/{game_id}/truth-chain/moments")
        second = self.client.get(f"/games/{game_id}/truth-chain/moments")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(self._mutation_snapshot(), before)

    def test_static_guard_keeps_readonly_route_and_service_away_from_writes(self) -> None:
        route_source = inspect.getsource(game_routes.get_truth_chain_moments)
        service_source = Path(inspect.getsourcefile(ReviewMomentsReadOnlyService) or "").read_text(
            encoding="utf-8"
        )
        combined = f"{route_source}\n{service_source}".casefold()

        forbidden_fragments = (
            "ensure_training_items_for_game",
            "_ensure_training_items_for_review_payload",
            "create_training_item",
            "create_practice_attempt",
            "insert into",
            "update ",
            "delete from",
            "due_at =",
            "daily_plan",
            "stockfish",
            "analysisservice",
            "reviewservice",
            "recompute_review",
            "generate_review",
            "rebuild_review",
        )
        for fragment in forbidden_fragments:
            self.assertNotIn(fragment, combined)

    def _create_finished_game(self) -> int:
        game_id = self.repository.create_game("classic")
        board = chess.Board(START_FEN)
        for ply, uci in enumerate(("e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4"), start=1):
            move = chess.Move.from_uci(uci)
            fen_before = board.fen()
            san = board.san(move)
            self.repository.add_move(
                game_id,
                ply=ply,
                fen_before=fen_before,
                uci=uci,
                san=san,
                is_player=ply % 2 == 1,
            )
            board.push(move)
        self.repository.finish_game(
            game_id,
            result="0-1",
            pgn='[White "bahij"]\n[Black "ClubRival"]\n[Result "0-1"]\n\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 0-1\n',
        )
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                UPDATE games
                SET white_name = 'bahij',
                    black_name = 'ClubRival',
                    opening_name_pgn = 'Sicilian Defense: Najdorf',
                    eco_code_pgn = 'B90',
                    user_color = 'white'
                WHERE id = ?
                """,
                (game_id,),
            )
            connection.execute(
                """
                INSERT INTO game_opening_classifications (
                    game_id,
                    opening_name,
                    eco_code,
                    matched_plies,
                    classification_status,
                    created_at,
                    updated_at
                )
                VALUES (?, 'Sicilian Defense: Najdorf', 'B90', 6, 'matched', datetime('now'), datetime('now'))
                """,
                (game_id,),
            )
            connection.commit()
        return game_id

    def _seed_review_without_moments(self, game_id: int) -> int:
        with closing(sqlite3.connect(self.db_path)) as connection:
            review_cursor = connection.execute(
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
                (game_id, REVIEW_SCHEMA_VERSION, SELECTION_ALGORITHM_VERSION),
            )
            connection.commit()
            return int(review_cursor.lastrowid)

    def _seed_review_moments(self, game_id: int, *, count: int) -> tuple[int, int]:
        labels = (
            "moment decisif selon analyse approfondie",
            "tres important",
            "important",
            "significatif",
            "leger",
            "micro",
        )
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.row_factory = sqlite3.Row
            review_cursor = connection.execute(
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
                (game_id, REVIEW_SCHEMA_VERSION, SELECTION_ALGORITHM_VERSION),
            )
            review_id = int(review_cursor.lastrowid)
            moves = connection.execute(
                """
                SELECT id, ply, fen_before, uci, san
                FROM moves
                WHERE game_id = ?
                ORDER BY ply, id
                """,
                (game_id,),
            ).fetchall()
            first_moment_id = 0
            for index, move_row in enumerate(moves[:count]):
                board = chess.Board(str(move_row["fen_before"]))
                move = chess.Move.from_uci(str(move_row["uci"]))
                fen_after = board.copy()
                fen_after.push(move)
                side = "white" if board.turn == chess.WHITE else "black"
                cursor = connection.execute(
                    """
                    INSERT INTO review_moments (
                        review_id,
                        game_id,
                        move_id,
                        ply,
                        played_by,
                        side_to_move_before,
                        fen_before,
                        fen_after,
                        played_uci,
                        played_san,
                        best_move_uci,
                        best_move_san,
                        eval_before_cp,
                        eval_after_cp,
                        mate_before,
                        mate_after,
                        cp_loss,
                        cp_loss_label,
                        importance_score,
                        reliability_score,
                        reliability_label,
                        top_moves_json,
                        review_type,
                        created_at
                    )
                    VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'e2e4', 'e4',
                        20, -120, NULL, NULL, ?, ?, ?, 1.0, 'stable',
                        ?, 'player_loss', datetime('now')
                    )
                    """,
                    (
                        review_id,
                        game_id,
                        int(move_row["id"]),
                        int(move_row["ply"]),
                        side,
                        side,
                        str(move_row["fen_before"]),
                        fen_after.fen(),
                        str(move_row["uci"]),
                        str(move_row["san"]),
                        120 - index,
                        labels[index % len(labels)],
                        95.0 - index,
                        json.dumps([{"uci": "e2e4", "rank": 1}]),
                    ),
                )
                if first_moment_id == 0:
                    first_moment_id = int(cursor.lastrowid)
            connection.commit()
        return review_id, first_moment_id

    def _seed_training_item(self, game_id: int, moment_id: int | None) -> int:
        with closing(sqlite3.connect(self.db_path)) as connection:
            cursor = connection.execute(
                """
                INSERT INTO training_items (
                    source_type,
                    source_game_id,
                    source_ply,
                    source_moment_id,
                    fen,
                    side_to_move,
                    best_move,
                    accepted_moves_json,
                    domain,
                    primary_tag,
                    secondary_tags_json,
                    criticality_score,
                    created_at,
                    status
                )
                VALUES (
                    'review_moment', ?, 1, ?, ?, 'white', 'e2e4', '["e2e4"]',
                    'tactics', 'decision', '[]', 88.0, datetime('now'), 'active'
                )
                """,
                (game_id, moment_id, START_FEN),
            )
            connection.commit()
            return int(cursor.lastrowid)

    def _seed_daily_plan_item(self, training_item_id: int) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.execute(
                """
                INSERT INTO daily_plan_items (
                    user_id,
                    plan_date,
                    item_id,
                    order_index,
                    selection_reason,
                    selection_score,
                    source_bucket,
                    created_at
                )
                VALUES ('local', '2026-05-14', ?, 1, 'test', 1.0, 'manual', datetime('now'))
                """,
                (training_item_id,),
            )
            connection.commit()

    def _seed_review_practice_attempt(self, game_id: int, training_item_id: int) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            session_cursor = connection.execute(
                """
                INSERT INTO review_practice_sessions (
                    game_id,
                    review_id,
                    pov,
                    status,
                    item_count,
                    created_at,
                    schema_version
                )
                VALUES (?, NULL, 'white', 'running', 1, datetime('now'), 'test')
                """,
                (game_id,),
            )
            session_id = int(session_cursor.lastrowid)
            connection.execute(
                """
                INSERT INTO review_practice_attempts (
                    session_id,
                    game_id,
                    ply,
                    color,
                    attempted_uci,
                    expected_best_uci,
                    result,
                    attempt_number,
                    evidence_snapshot_json,
                    created_at,
                    item_id,
                    source_context,
                    due_at
                )
                VALUES (?, ?, 1, 'white', 'e2e4', 'e2e4', 'best', 1, '{}', datetime('now'), ?, 'review_practice', '2026-05-15T00:00:00+00:00')
                """,
                (session_id, game_id, f"training_item:{training_item_id}"),
            )
            connection.commit()

    def _mutation_snapshot(self) -> dict[str, Any]:
        with closing(sqlite3.connect(self.db_path)) as connection:
            counts = {
                table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                for table in (
                    "training_items",
                    "review_practice_attempts",
                    "daily_plan_items",
                    "game_reviews",
                    "review_moments",
                )
            }
            due_rows = [
                tuple(row)
                for row in connection.execute(
                    """
                    SELECT id, due_at
                    FROM review_practice_attempts
                    ORDER BY id
                    """
                ).fetchall()
            ]
        return {"counts": counts, "dueRows": due_rows}

    def _review_moment_count(self, review_id: int) -> int:
        with closing(sqlite3.connect(self.db_path)) as connection:
            return int(
                connection.execute(
                    "SELECT COUNT(*) FROM review_moments WHERE review_id = ?",
                    (review_id,),
                ).fetchone()[0]
            )

    def _assert_banned_metrics_absent(self, payload: dict[str, Any]) -> None:
        serialized = json.dumps(payload, sort_keys=True)
        for banned in (
            "raw_wdl",
            "rawWdl",
            "criticality_score",
            "criticalityScore",
            "diagnostic_gap",
            "diagnosticGap",
            "ETV",
            "centipawn",
            "cp_loss",
            "cpLoss",
            "eval_before_cp",
            "eval_after_cp",
            "raw engine",
        ):
            self.assertNotIn(banned, serialized)


if __name__ == "__main__":
    unittest.main()
