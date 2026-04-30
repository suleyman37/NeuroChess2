from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

import chess


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.core.game_recorder import GameRecorder, GameRecorderError
from neurochess.core.game_session import GameSession, GameSessionError
from neurochess.data.database import init_db
from neurochess.data.repositories import Repository


class FailingAddMoveRepository:
    def __init__(self, repository: Repository) -> None:
        self.repository = repository

    def create_game(
        self,
        mode: str,
        opponent_type: str | None = None,
        opponent_level: int | None = None,
    ) -> int:
        return self.repository.create_game(mode, opponent_type, opponent_level)

    def finish_game(
        self,
        game_id: int,
        result: str | None = None,
        pgn: str | None = None,
    ) -> None:
        self.repository.finish_game(game_id, result, pgn)

    def add_move(self, *args, **kwargs) -> int:
        raise RuntimeError("simulated database failure")

    def get_game(self, game_id: int):
        return self.repository.get_game(game_id)

    def get_moves_for_game(self, game_id: int):
        return self.repository.get_moves_for_game(game_id)


class GameRecorderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-v2-test-"))
        self.db_path = self.temp_dir / "test_neurochess.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)
        self.recorder = GameRecorder(self.repository)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir)

    def test_game_session_initial_position(self) -> None:
        session = GameSession()

        chess.Board(session.current_fen())
        self.assertIn("e2e4", session.legal_moves_uci())

    def test_preview_does_not_modify_board(self) -> None:
        session = GameSession()
        before = session.current_fen()

        session.preview_uci("e2e4")

        self.assertEqual(session.current_fen(), before)

    def test_preview_game_over_uses_temp_board(self) -> None:
        session = GameSession()
        session.push_uci("f2f3")
        session.push_uci("e7e5")
        session.push_uci("g2g4")
        before = session.current_fen()

        preview = session.preview_uci("d8h4")

        self.assertTrue(preview["is_game_over"])
        self.assertEqual(preview["result"], "0-1")
        self.assertEqual(session.current_fen(), before)
        self.assertFalse(session.is_game_over())

    def test_push_uci_e2e4(self) -> None:
        session = GameSession()

        move_data = session.push_uci("e2e4")

        self.assertEqual(move_data["ply"], 1)
        self.assertEqual(move_data["san"], "e4")
        self.assertEqual(move_data["uci"], "e2e4")
        self.assertNotEqual(move_data["fen_before"], move_data["fen_after"])
        self.assertEqual(move_data["turn_after"], "black")

    def test_illegal_move_raises(self) -> None:
        session = GameSession()

        with self.assertRaises(GameSessionError):
            session.push_uci("e2e5")

    def test_malformed_uci_raises(self) -> None:
        session = GameSession()

        with self.assertRaises(GameSessionError):
            session.push_uci("bad")

    def test_start_game_creates_game(self) -> None:
        game_id = self.recorder.start_game("classic")

        self.assertIsInstance(game_id, int)
        self.assertIsNotNone(self.repository.get_game(game_id))

    def test_play_move_records_immediately(self) -> None:
        game_id = self.recorder.start_game("classic")
        session = GameSession()

        self.recorder.play_move(game_id, session, "e2e4", is_player=True)
        moves = self.repository.get_moves_for_game(game_id)

        self.assertEqual(len(moves), 1)
        self.assertEqual(moves[0].uci, "e2e4")
        self.assertNotEqual(session.current_fen(), moves[0].fen_before)

    def test_play_move_db_failure_does_not_advance_session(self) -> None:
        game_id = self.recorder.start_game("classic")
        session = GameSession()
        before = session.current_fen()
        failing_recorder = GameRecorder(FailingAddMoveRepository(self.repository))

        with self.assertRaises(GameRecorderError):
            failing_recorder.play_move(game_id, session, "e2e4", is_player=True)

        self.assertEqual(session.current_fen(), before)
        self.assertEqual(self.repository.get_moves_for_game(game_id), [])

    def test_play_four_half_moves_order(self) -> None:
        game_id = self.recorder.start_game("classic")
        session = GameSession()

        for uci, is_player in (
            ("e2e4", True),
            ("e7e5", False),
            ("g1f3", True),
            ("b8c6", False),
        ):
            self.recorder.play_move(game_id, session, uci, is_player=is_player)

        moves = self.repository.get_moves_for_game(game_id)

        self.assertEqual(len(moves), 4)
        self.assertEqual([move.ply for move in moves], [1, 2, 3, 4])
        self.assertEqual([move.san for move in moves], ["e4", "e5", "Nf3", "Nc6"])

    def test_load_session_reconstructs_position(self) -> None:
        game_id = self.recorder.start_game("classic")
        session = GameSession()

        for uci in ("e2e4", "e7e5", "g1f3", "b8c6"):
            self.recorder.play_move(game_id, session, uci, is_player=True)

        loaded_session = self.recorder.load_session(game_id)

        self.assertEqual(loaded_session.current_fen(), session.current_fen())

    def test_finish_unfinished_game(self) -> None:
        game_id = self.recorder.start_game("classic")
        session = GameSession()
        self.recorder.play_move(game_id, session, "e2e4", is_player=True)

        self.recorder.finish_game(game_id, session, result="*")
        game = self.repository.get_game(game_id)

        self.assertIsNotNone(game)
        self.assertTrue(game.completed)
        self.assertEqual(game.result, "*")
        self.assertTrue(game.pgn)

    def test_fools_mate_detection(self) -> None:
        game_id = self.recorder.start_game("classic")
        session = GameSession()

        for uci, is_player in (
            ("f2f3", True),
            ("e7e5", False),
            ("g2g4", True),
            ("d8h4", False),
        ):
            self.recorder.play_move(game_id, session, uci, is_player=is_player)

        self.assertTrue(session.is_game_over())
        self.assertEqual(session.result(), "0-1")

        self.recorder.finish_game(game_id, session)
        game = self.repository.get_game(game_id)

        self.assertIsNotNone(game)
        self.assertEqual(game.result, "0-1")

    def test_pgn_uses_python_chess_from_board(self) -> None:
        session = GameSession()
        session.push_uci("e2e4")
        session.push_uci("e7e5")
        session.push_uci("g1f3")

        pgn = session.pgn()

        self.assertIn("NeuroChess 2 Game", pgn)
        self.assertIn("1. e4 e5 2. Nf3", pgn)

    def test_get_game_with_moves_json_serializable(self) -> None:
        game_id = self.recorder.start_game("classic")
        session = GameSession()
        self.recorder.play_move(game_id, session, "e2e4", is_player=True)
        self.recorder.play_move(game_id, session, "e7e5", is_player=False)

        payload = self.recorder.get_game_with_moves(game_id)

        json.dumps(payload)
        self.assertEqual(payload["game"]["id"], game_id)
        self.assertEqual(len(payload["moves"]), 2)

    def test_no_engine_dependency(self) -> None:
        project_root = Path(__file__).resolve().parents[2]
        game_session_source = (
            project_root / "backend" / "neurochess" / "core" / "game_session.py"
        ).read_text(encoding="utf-8")
        game_recorder_source = (
            project_root / "backend" / "neurochess" / "core" / "game_recorder.py"
        ).read_text(encoding="utf-8")
        combined_source = game_session_source + game_recorder_source

        self.assertNotIn("StockfishService", combined_source)
        self.assertNotIn("EngineManager", combined_source)
        self.assertNotIn("chess.engine", combined_source)


if __name__ == "__main__":
    unittest.main()
