from __future__ import annotations

import os
import shutil
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

import chess
from fastapi.testclient import TestClient


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import app
from neurochess.api.game_routes import ACTIVE_SESSIONS, get_repository
from neurochess.data.database import get_connection, init_db
from neurochess.data.repositories import Repository
from neurochess.engines.fake_engine import FakeStockfishService
from neurochess.pgn_import_service import IMPORT_SCHEMA_VERSION, PgnImportService, parse_pgn_games


FIXTURE = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "pgn"
    / "real_lichess_sindarov_from_position.pgn"
)
SPECIAL_INITIAL_FEN = "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


class SindarovRealPgnTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-sindarov-"))
        self.db_path = self.temp_dir / "test.db"
        init_db(self.db_path)
        self.pgn_text = FIXTURE.read_text(encoding="utf-8")
        self.service = PgnImportService(self.db_path)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir)

    def test_real_sindarov_file_imports_opens_and_starts_review_job(self) -> None:
        parsed, errors = parse_pgn_games(self.pgn_text)
        self.assertEqual(errors, [])
        self.assertEqual(len(parsed), 14)

        imported = self.service.import_pgn(
            self.pgn_text,
            user_alias="SindarovGM",
            platform="unknown",
        )
        self.assertEqual(imported["imported_count"], 14)
        self.assertEqual(imported["repaired_count"], 0)
        first_game_id = imported["imported_game_ids"][0]

        repository = Repository(self.db_path)
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: repository
        self._enable_fast_fake_engine()
        client = TestClient(app)
        try:
            history = client.get("/games/history?scope=all&limit=100")
            state = client.get(f"/games/{first_game_id}")
            moves = client.get(f"/games/{first_game_id}/moves")
            diagnostics = client.get(f"/games/{first_game_id}/diagnostics")
            review_job = client.post(
                f"/games/{first_game_id}/review/jobs",
                json={"profile": "standard", "force_reanalysis": True},
            )
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()
            self._restore_engine_env()

        history_payload = history.json()
        expected_fens_by_source_id = {
            game.source_game_id: game.initial_fen for game in parsed
        }
        sindarov_cards = [
            item
            for item in history_payload
            if item["source_game_id"] in expected_fens_by_source_id
        ]
        self.assertEqual(len(sindarov_cards), 14)
        for card in sindarov_cards:
            self.assertEqual(card["source_platform"], "lichess")
            self.assertEqual(card["variant"], "From Position")
            self.assertEqual(
                card["initial_fen"],
                expected_fens_by_source_id[card["source_game_id"]],
            )
            self.assertNotEqual(card["initial_fen"], chess.STARTING_FEN)
            self.assertTrue(card["is_special_position"])
            self.assertEqual(card["import_status"], "ok")

        first_card = next(item for item in history_payload if item["game_id"] == first_game_id)
        self.assertEqual(history.status_code, 200)
        self.assertEqual(first_card["source_platform"], "lichess")
        self.assertEqual(first_card["variant"], "From Position")
        self.assertEqual(first_card["initial_fen"], SPECIAL_INITIAL_FEN)
        self.assertTrue(first_card["is_special_position"])
        self.assertEqual(first_card["import_status"], "ok")

        self.assertEqual(state.status_code, 200)
        self.assertEqual(state.json()["moves"][0]["fen_before"], SPECIAL_INITIAL_FEN)

        self.assertEqual(moves.status_code, 200)
        self.assertEqual(moves.json()["initial_fen"], SPECIAL_INITIAL_FEN)
        self.assertEqual(moves.json()["moves"][0]["fen_before"], SPECIAL_INITIAL_FEN)
        self._assert_replay_payload_is_legal(moves.json())

        self.assertEqual(diagnostics.status_code, 200)
        self.assertTrue(diagnostics.json()["can_open"])
        self.assertTrue(diagnostics.json()["can_analyze"])
        self.assertTrue(diagnostics.json()["replay_from_initial_fen_ok"])

        self.assertIn(review_job.status_code, {200, 202})
        self.assertNotEqual(review_job.json()["status"], "failed")
        with closing(get_connection(self.db_path)) as connection:
            initial_analysis = connection.execute(
                """
                SELECT id
                FROM position_analyses
                WHERE fen = ?
                  AND analysis_kind = 'deep'
                  AND schema_version = 'engine_analysis_v2'
                LIMIT 1
                """,
                (SPECIAL_INITIAL_FEN,),
            ).fetchone()
        self.assertIsNotNone(initial_analysis)

    def test_reimport_repairs_legacy_sindarov_row_without_duplicate(self) -> None:
        imported = self.service.import_pgn(
            self.pgn_text,
            user_alias="SindarovGM",
            platform="unknown",
        )
        game_id = imported["imported_game_ids"][0]
        with closing(get_connection(self.db_path)) as connection:
            connection.execute(
                """
                UPDATE games
                SET initial_fen = ?,
                    variant = NULL,
                    import_schema_version = NULL,
                    import_status = 'ok'
                WHERE id = ?
                """,
                (chess.STARTING_FEN, game_id),
            )
            connection.execute(
                """
                UPDATE moves
                SET fen_before = ?
                WHERE game_id = ?
                  AND ply = 1
                """,
                (chess.STARTING_FEN, game_id),
            )
            connection.commit()

        repaired = self.service.import_pgn(
            self.pgn_text,
            user_alias="SindarovGM",
            platform="unknown",
        )

        self.assertEqual(repaired["imported_count"], 0)
        self.assertGreaterEqual(repaired["repaired_count"], 1)
        self.assertIn(game_id, repaired["repaired_game_ids"])
        with closing(get_connection(self.db_path)) as connection:
            game_count = connection.execute("SELECT COUNT(*) FROM games").fetchone()[0]
            game = connection.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
            first_move = connection.execute(
                "SELECT * FROM moves WHERE game_id = ? ORDER BY ply LIMIT 1",
                (game_id,),
            ).fetchone()
        self.assertEqual(game_count, 14)
        self.assertEqual(game["initial_fen"], SPECIAL_INITIAL_FEN)
        self.assertEqual(game["variant"], "From Position")
        self.assertEqual(game["import_schema_version"], IMPORT_SCHEMA_VERSION)
        self.assertEqual(first_move["fen_before"], SPECIAL_INITIAL_FEN)

    def test_game_diagnostics_exposes_sindarov_openability(self) -> None:
        imported = self.service.import_pgn(
            self.pgn_text,
            user_alias="SindarovGM",
            platform="unknown",
        )
        game_id = imported["imported_game_ids"][0]

        diagnostics = self.service.game_diagnostics(game_id)

        self.assertEqual(diagnostics["local_game_id"], game_id)
        self.assertEqual(diagnostics["external_source"], "lichess")
        self.assertEqual(diagnostics["variant"], "From Position")
        self.assertEqual(diagnostics["initial_fen"], SPECIAL_INITIAL_FEN)
        self.assertFalse(diagnostics["is_initial_fen_standard"])
        self.assertTrue(diagnostics["can_open"])
        self.assertTrue(diagnostics["can_analyze"])
        self.assertTrue(diagnostics["replay_from_initial_fen_ok"])

    def _assert_replay_payload_is_legal(self, payload: dict[str, object]) -> None:
        board = chess.Board(str(payload["initial_fen"]))
        self.assertNotEqual(board.fen(), chess.STARTING_FEN)
        for move_payload in payload["moves"]:  # type: ignore[index]
            self.assertEqual(board.fen(), move_payload["fen_before"])
            move = chess.Move.from_uci(move_payload["played_uci"])
            self.assertIn(move, board.legal_moves)
            board.push(move)

    def _enable_fast_fake_engine(self) -> None:
        self._previous_env = {
            "NEUROCHESS_ENGINE_MODE": os.environ.get("NEUROCHESS_ENGINE_MODE"),
            "FAKE_ENGINE_DELAY_MS": os.environ.get("FAKE_ENGINE_DELAY_MS"),
            "FAKE_ENGINE_HARD_TIMEOUT_MS": os.environ.get("FAKE_ENGINE_HARD_TIMEOUT_MS"),
        }
        os.environ["NEUROCHESS_ENGINE_MODE"] = "fake"
        os.environ["FAKE_ENGINE_DELAY_MS"] = "1"
        os.environ["FAKE_ENGINE_HARD_TIMEOUT_MS"] = "1000"
        FakeStockfishService.reset_state()

    def _restore_engine_env(self) -> None:
        previous_env = getattr(self, "_previous_env", {})
        for key, value in previous_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        FakeStockfishService.reset_state()


if __name__ == "__main__":
    unittest.main()
