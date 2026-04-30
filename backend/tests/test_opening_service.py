from __future__ import annotations

import json
import shutil
import sqlite3
import sys
import tempfile
import time
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
from neurochess.api.game_routes import (
    ACTIVE_SESSIONS,
    get_analysis_service,
    get_live_analysis_service,
    get_opening_service,
    get_repository,
)
from neurochess.data.database import init_db
from neurochess.data.repositories import Repository
from neurochess.opening_service import (
    OpeningService,
    OpeningServiceError,
    normalize_fen_for_opening,
)
from neurochess.opening_book_preparer import (
    OPENINGS_BOOK_SCHEMA_VERSION,
    prepare_lichess_openings,
)
from backend.tests.test_game_api import ApiFakeAnalysisService, ApiFakeLiveAnalysisService


class OpeningServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-v5-openings-"))
        self.db_path = self.temp_dir / "test_neurochess.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)
        self.service = OpeningService(self.db_path)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir)

    def test_normalize_fen_for_opening_ignores_halfmove_and_fullmove(self) -> None:
        first = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
        second = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 7 42"

        self.assertEqual(
            normalize_fen_for_opening(first),
            normalize_fen_for_opening(second),
        )

    def test_import_opening_seed_is_idempotent_and_creates_nodes(self) -> None:
        first = self.service.import_opening_seed()
        second = self.service.import_opening_seed()

        self.assertEqual(first["status"], "ok")
        self.assertGreaterEqual(first["created"], 20)
        self.assertEqual(first["updated"], 0)
        self.assertEqual(first["unchanged"], 0)
        self.assertEqual(first["kept_orphan"], 0)
        self.assertGreater(first["nodes_created"], first["created"])
        self.assertEqual(second["created"], 0)
        self.assertEqual(second["updated"], 0)
        self.assertEqual(second["unchanged"], first["created"])

        with closing(sqlite3.connect(self.db_path)) as connection:
            line_count = connection.execute(
                "SELECT COUNT(*) FROM opening_lines"
            ).fetchone()[0]
            node_count = connection.execute(
                "SELECT COUNT(*) FROM opening_line_nodes"
            ).fetchone()[0]
            sample = connection.execute(
                """
                SELECT fen, fen_key
                FROM opening_line_nodes
                ORDER BY id
                LIMIT 1
                """
            ).fetchone()

        self.assertEqual(line_count, first["created"])
        self.assertGreater(node_count, line_count)
        self.assertIsInstance(sample[0], str)
        self.assertIsInstance(sample[1], str)
        self.assertLess(len(sample[1].split()), len(sample[0].split()))

    def test_import_update_preserves_line_id_and_rebuilds_only_nodes(self) -> None:
        seed_path = self._write_seed(
            [
                self._line(
                    name="Test Line",
                    variation=None,
                    moves=["e2e4", "e7e5"],
                )
            ]
        )
        service = OpeningService(self.db_path, seed_path=seed_path)
        service.import_opening_seed()
        line_id_before = self._line_id("Test Line", None)
        node_count_before = self._node_count(line_id_before)

        seed_path = self._write_seed(
            [
                self._line(
                    name="Test Line",
                    variation=None,
                    moves=["e2e4", "e7e5", "g1f3"],
                )
            ]
        )
        service = OpeningService(self.db_path, seed_path=seed_path)
        result = service.import_opening_seed()
        line_id_after = self._line_id("Test Line", None)

        self.assertEqual(line_id_after, line_id_before)
        self.assertEqual(result["created"], 0)
        self.assertEqual(result["updated"], 1)
        self.assertEqual(result["nodes_deleted"], node_count_before)
        self.assertEqual(self._node_count(line_id_after), 4)

    def test_invalid_seed_fails_without_corrupting_existing_book(self) -> None:
        service = OpeningService(
            self.db_path,
            seed_path=self._write_seed([self._line("Safe Line", None, ["e2e4"])]),
        )
        service.import_opening_seed()
        before = self._book_counts()

        invalid_seed = self._write_seed(
            [self._line("Broken Line", None, ["e2e4", "e2e5"])]
        )
        with self.assertRaises(OpeningServiceError) as context:
            OpeningService(self.db_path, seed_path=invalid_seed).import_opening_seed()

        self.assertIn("invalid UCI move", str(context.exception))
        self.assertEqual(self._book_counts(), before)

    def test_parent_line_name_is_resolved_and_color_does_not_drive_classification(self) -> None:
        seed_path = self._write_seed(
            [
                self._line("Parent Test", None, ["e2e4"], color="white"),
                self._line(
                    "Child Test",
                    "Line",
                    ["e2e4", "e7e5"],
                    color="black",
                    parent="Parent Test",
                ),
            ]
        )
        service = OpeningService(self.db_path, seed_path=seed_path)
        service.import_opening_seed()

        parent_id = self._line_id("Parent Test", None)
        child_id = self._line_id("Child Test", "Line")
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.row_factory = sqlite3.Row
            child = connection.execute(
                "SELECT parent_line_id, color FROM opening_lines WHERE id = ?",
                (child_id,),
            ).fetchone()

        game_id = self._create_game(["e2e4", "e7e5"])
        payload = service.classify_game_opening(game_id)

        self.assertEqual(child["parent_line_id"], parent_id)
        self.assertEqual(child["color"], "black")
        self.assertEqual(payload["line_id"], child_id)
        self.assertEqual(payload["opening_name"], "Child Test")

    def test_classifies_mainstream_openings_and_unknown(self) -> None:
        self.service.import_opening_seed()

        italian = self.service.classify_game_opening(
            self._create_game(["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"])
        )
        ruy = self.service.classify_game_opening(
            self._create_game(["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"])
        )
        sicilian = self.service.classify_game_opening(
            self._create_game(["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4"])
        )
        unknown = self.service.classify_game_opening(
            self._create_game(["h2h4", "h7h5"])
        )

        self.assertEqual(italian["opening_name"], "Italian Game")
        self.assertEqual(italian["classification_status"], "matched")
        self.assertEqual(ruy["opening_name"], "Ruy Lopez")
        self.assertEqual(sicilian["opening_name"], "Sicilian Defense")
        self.assertEqual(sicilian["matched_plies"], 7)
        self.assertEqual(unknown["classification_status"], "unknown")
        self.assertEqual(unknown["confidence"], "unknown")
        self.assertIsNone(unknown["opening_name"])

    def test_tie_break_prefers_target_depth_closest_to_observed_match(self) -> None:
        seed_path = self._write_seed(
            [
                self._line(
                    "Long Test",
                    None,
                    ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "c2c3", "g8f6"],
                ),
                self._line(
                    "Short Test",
                    None,
                    ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5"],
                ),
            ]
        )
        service = OpeningService(self.db_path, seed_path=seed_path)
        service.import_opening_seed()

        game_id = self._create_game(
            ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "h2h3"]
        )
        payload = service.classify_game_opening(game_id)

        self.assertEqual(payload["opening_name"], "Short Test")
        self.assertEqual(payload["matched_plies"], 6)
        self.assertEqual(payload["out_of_book_ply"], 7)
        self.assertEqual(payload["out_of_book_color"], "white")

    def test_shared_start_fen_does_not_confuse_sequential_matching(self) -> None:
        seed_path = self._write_seed(
            [
                self._line("E4 Test", None, ["e2e4", "e7e5"]),
                self._line("D4 Test", None, ["d2d4", "d7d5"]),
            ]
        )
        service = OpeningService(self.db_path, seed_path=seed_path)
        service.import_opening_seed()

        payload = service.classify_game_opening(
            self._create_game(["d2d4", "d7d5"])
        )

        self.assertEqual(payload["opening_name"], "D4 Test")
        self.assertEqual(payload["matched_plies"], 2)

    def test_out_of_book_fields_and_confidence_thresholds(self) -> None:
        self.service.import_opening_seed()
        game_id = self._create_game(
            ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "a7a6"]
        )
        context = self.repository.get_moves_for_game(game_id)[-1]

        payload = self.service.classify_game_opening(game_id)
        low = self.service.classify_game_opening(
            self._create_game(["e2e4", "c7c5"])
        )
        high_service = OpeningService(
            self.db_path,
            seed_path=self._write_seed(
                [
                    self._line(
                        "High Confidence Test",
                        None,
                        ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "c2c3", "g8f6"],
                    )
                ]
            ),
        )
        high_service.import_opening_seed()
        high = high_service.classify_game_opening(
            self._create_game(
                ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "c2c3", "g8f6"]
            )
        )

        self.assertEqual(payload["matched_plies"], 5)
        self.assertEqual(payload["last_book_ply"], 5)
        self.assertEqual(payload["out_of_book_ply"], 6)
        self.assertEqual(payload["out_of_book_color"], "black")
        self.assertEqual(payload["out_of_book_fen"], context.fen_before)
        self.assertEqual(payload["confidence"], "medium")
        self.assertEqual(low["confidence"], "low")
        self.assertEqual(low["classification_status"], "partial")
        self.assertEqual(high["confidence"], "high")

    def test_classification_upsert_does_not_duplicate(self) -> None:
        self.service.import_opening_seed()
        game_id = self._create_game(["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"])

        first = self.service.classify_game_opening(game_id)
        second = self.service.classify_game_opening(game_id)

        with closing(sqlite3.connect(self.db_path)) as connection:
            count = connection.execute(
                "SELECT COUNT(*) FROM game_opening_classifications WHERE game_id = ?",
                (game_id,),
            ).fetchone()[0]

        self.assertEqual(first, second)
        self.assertEqual(count, 1)

    def test_opening_service_does_not_import_engine_or_review_layers(self) -> None:
        source = (BACKEND_ROOT / "neurochess" / "opening_service.py").read_text(
            encoding="utf-8"
        )
        preparer_source = (BACKEND_ROOT / "neurochess" / "opening_book_preparer.py").read_text(
            encoding="utf-8"
        )

        forbidden = (
            "StockfishService",
            "AnalysisService",
            "ReviewService",
            "live_analysis",
            "position_analyses",
            "requests",
            "urllib",
            "httpx",
        )
        for token in forbidden:
            self.assertNotIn(token, source)
            self.assertNotIn(token, preparer_source)

    def test_prepare_lichess_openings_generates_book_from_local_tsv(self) -> None:
        source_dir = self._write_lichess_source(
            [
                ("C50", "Italian Game", "1. e4 e5 2. Nf3 Nc6 3. Bc4"),
                ("C60", "Ruy Lopez", "1. e4 e5 2. Nf3 Nc6 3. Bb5"),
                ("A00", "Duplicate Test", "1. a3"),
                ("A00", "Duplicate Test", "1. h3"),
                ("A00", "Broken Test", "1. e5"),
            ]
        )
        output_path = self.temp_dir / "openings_book.json"

        result = prepare_lichess_openings(source_dir, output_path)
        payload = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["files_read"], 5)
        self.assertEqual(result["lines_read"], 5)
        self.assertEqual(result["lines_written"], 4)
        self.assertEqual(result["skipped_invalid"], 1)
        self.assertEqual(result["duplicate_lines"], 1)
        self.assertEqual(payload["schema_version"], OPENINGS_BOOK_SCHEMA_VERSION)
        self.assertEqual(payload["source_license"], "CC0 1.0 Universal")

        duplicate_variations = [
            line["variation"]
            for line in payload["lines"]
            if line["name"] == "Duplicate Test"
        ]
        self.assertEqual(len(set(duplicate_variations)), 2)
        for line in payload["lines"]:
            self.assertEqual(line["target_depth_plies"], len(line["moves_uci"]))
            board = chess.Board()
            for uci in line["moves_uci"]:
                move = chess.Move.from_uci(uci)
                self.assertIn(move, board.legal_moves)
                board.push(move)

    def test_generated_opening_book_is_larger_than_seed(self) -> None:
        book_path = BACKEND_ROOT / "neurochess" / "data" / "openings_book.json"
        seed_path = BACKEND_ROOT / "neurochess" / "data" / "openings_seed.json"

        book = json.loads(book_path.read_text(encoding="utf-8"))
        seed = json.loads(seed_path.read_text(encoding="utf-8"))

        self.assertEqual(book["schema_version"], OPENINGS_BOOK_SCHEMA_VERSION)
        self.assertEqual(book["source"], "lichess-org/chess-openings")
        self.assertGreater(len(book["lines"]), len(seed["lines"]))
        for line in book["lines"][:50]:
            self.assertEqual(line["target_depth_plies"], len(line["moves_uci"]))

    def test_import_opening_book_is_idempotent_and_preserves_line_id_on_update(self) -> None:
        book_path = self._write_book(
            [
                self._book_line("Italian Game", "Main Line", ["e2e4", "e7e5", "g1f3"]),
                self._book_line("London System", None, ["d2d4", "d7d5", "g1f3", "g8f6", "c1f4"]),
            ]
        )
        service = OpeningService(self.db_path, book_path=book_path)

        first = service.import_opening_book()
        second = service.import_opening_book()
        line_id_before = self._line_id("Italian Game", "Main Line")
        node_count_before = self._node_count(line_id_before)

        self.assertEqual(first["source"], "lichess-org/chess-openings")
        self.assertEqual(first["created"], 2)
        self.assertEqual(second["created"], 0)
        self.assertEqual(second["unchanged"], 2)

        self._write_book(
            [
                self._book_line(
                    "Italian Game",
                    "Main Line",
                    ["e2e4", "e7e5", "g1f3", "b8c6"],
                ),
                self._book_line("London System", None, ["d2d4", "d7d5", "g1f3", "g8f6", "c1f4"]),
            ],
            path=book_path,
        )
        updated = service.import_opening_book()
        line_id_after = self._line_id("Italian Game", "Main Line")

        self.assertEqual(line_id_after, line_id_before)
        self.assertEqual(updated["updated"], 1)
        self.assertEqual(updated["nodes_deleted"], node_count_before)
        self.assertEqual(self._node_count(line_id_after), 5)

    def test_classify_auto_imports_book_when_opening_lines_empty(self) -> None:
        book_path = self._write_book(
            [
                self._book_line(
                    "Italian Game",
                    "Main Line",
                    ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"],
                    eco="C50",
                ),
                self._book_line(
                    "Ruy Lopez",
                    "Main Line",
                    ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"],
                    eco="C60",
                ),
                self._book_line(
                    "Sicilian Defense",
                    "Open Sicilian",
                    ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4"],
                    eco="B50",
                ),
                self._book_line(
                    "London System",
                    None,
                    ["d2d4", "d7d5", "g1f3", "g8f6", "c1f4"],
                    eco="D02",
                ),
            ]
        )
        service = OpeningService(
            self.db_path,
            book_path=book_path,
            lichess_source_dir=self.temp_dir / "missing-source",
        )

        italian = service.classify_game_opening(
            self._create_game(["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"])
        )
        london = service.classify_game_opening(
            self._create_game(["d2d4", "d7d5", "g1f3", "g8f6", "c1f4"])
        )
        unknown = service.classify_game_opening(self._create_game(["h2h4", "h7h5"]))

        self.assertEqual(italian["opening_name"], "Italian Game")
        self.assertEqual(london["opening_name"], "London System")
        self.assertEqual(unknown["classification_status"], "unknown")

    def test_api_import_classify_and_get_opening(self) -> None:
        analysis_service = ApiFakeAnalysisService(
            self.db_path,
            self.temp_dir / "analysis.log",
        )
        live_service = ApiFakeLiveAnalysisService()
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: self.repository
        app.dependency_overrides[get_analysis_service] = lambda: analysis_service
        app.dependency_overrides[get_live_analysis_service] = lambda: live_service
        app.dependency_overrides[get_opening_service] = (
            lambda: OpeningService(self.db_path)
        )
        client = TestClient(app)
        try:
            import_response = client.post("/openings/import-seed")
            self.assertEqual(import_response.status_code, 200)
            self.assertEqual(import_response.json()["status"], "ok")

            game_id = self._create_game(["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"])
            process_calls_before = analysis_service.process_calls

            classify_response = client.post(f"/games/{game_id}/opening/classify")
            self.assertEqual(classify_response.status_code, 200)
            classify_payload = classify_response.json()
            self.assertEqual(classify_payload["opening_name"], "Italian Game")

            get_response = client.get(f"/games/{game_id}/opening")
            self.assertEqual(get_response.status_code, 200)
            self.assertEqual(get_response.json(), classify_payload)
            self.assertEqual(analysis_service.process_calls, process_calls_before)
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()

    def test_api_import_book_endpoint(self) -> None:
        book_path = self._write_book(
            [self._book_line("Italian Game", "Main Line", ["e2e4", "e7e5", "g1f3"])]
        )
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: self.repository
        app.dependency_overrides[get_opening_service] = (
            lambda: OpeningService(self.db_path, book_path=book_path)
        )
        client = TestClient(app)
        try:
            response = client.post("/openings/import-book")
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["status"], "ok")
            self.assertEqual(payload["source"], "lichess-org/chess-openings")
            self.assertEqual(payload["created"], 1)
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()

    def test_v5_1_1_full_book_acceptance_and_performance(self) -> None:
        result = self.service.import_opening_book()
        second = self.service.import_opening_book()

        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["created"], 3690)
        self.assertEqual(result["skipped_invalid"], 0)
        self.assertEqual(second["created"], 0)
        self.assertEqual(second["unchanged"], 3690)

        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.row_factory = sqlite3.Row
            line_count = int(
                connection.execute("SELECT COUNT(*) FROM opening_lines").fetchone()[0]
            )
            node_count = int(
                connection.execute("SELECT COUNT(*) FROM opening_line_nodes").fetchone()[0]
            )
            columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(opening_lines)").fetchall()
            }
            disambiguated = connection.execute(
                """
                SELECT name, variation
                FROM opening_lines
                WHERE variation LIKE '%(line %'
                ORDER BY name, variation
                LIMIT 1
                """
            ).fetchone()

        self.assertEqual(line_count, 3690)
        self.assertEqual(node_count, 39220)
        self.assertNotIn("epd", columns)
        self.assertIsNotNone(disambiguated)
        self.assertIn("(line ", disambiguated["variation"])

        cases = (
            ("Italian Game", ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"], "Italian Game"),
            ("Ruy Lopez", ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"], "Ruy Lopez"),
            (
                "Sicilian Defense",
                ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4"],
                "Sicilian Defense",
            ),
            ("French Defense", ["e2e4", "e7e6", "d2d4", "d7d5"], "French Defense"),
            ("Caro-Kann", ["e2e4", "c7c6", "d2d4", "d7d5"], "Caro-Kann Defense"),
            ("Queen's Gambit", ["d2d4", "d7d5", "c2c4"], "Queen's Gambit"),
            ("London System", ["d2d4", "d7d5", "g1f3", "g8f6", "c1f4"], "Queen's Pawn Game"),
            ("English Opening", ["c2c4"], "English Opening"),
            ("Réti Opening", ["g1f3", "d7d5", "c2c4"], "Réti Opening"),
            ("Unknown empty game", [], None),
        )
        elapsed_ms: list[float] = []
        payloads: dict[str, dict[str, Any]] = {}
        for label, moves, expected_name in cases:
            game_id = self._create_game(moves)
            started = time.perf_counter()
            payload = self.service.classify_game_opening(game_id)
            elapsed_ms.append((time.perf_counter() - started) * 1000)
            payloads[label] = payload
            if expected_name is None:
                self.assertEqual(payload["classification_status"], "unknown")
                self.assertIsNone(payload["opening_name"])
            else:
                self.assertEqual(payload["opening_name"], expected_name)
                self.assertIn(payload["classification_status"], {"matched", "partial"})

        average_ms = sum(elapsed_ms) / len(elapsed_ms)
        max_ms = max(elapsed_ms)
        self.assertLess(average_ms, 300.0)
        self.assertLess(max_ms, 1000.0)
        self.assertEqual(payloads["Italian Game"]["eco_code"], "C50")
        self.assertEqual(payloads["Ruy Lopez"]["eco_code"], "C60")
        self.assertEqual(payloads["Sicilian Defense"]["opening_name"], "Sicilian Defense")

    def _create_game(self, moves_uci: list[str]) -> int:
        game_id = self.repository.create_game("classic")
        board = chess.Board()
        for ply, uci in enumerate(moves_uci, start=1):
            move = chess.Move.from_uci(uci)
            self.assertIn(move, board.legal_moves)
            fen_before = board.fen()
            san = board.san(move)
            self.repository.add_move(
                game_id=game_id,
                ply=ply,
                fen_before=fen_before,
                uci=uci,
                san=san,
                is_player=True,
            )
            board.push(move)
        return game_id

    def _write_seed(self, lines: list[dict[str, Any]]) -> Path:
        seed_path = self.temp_dir / "openings_seed_test.json"
        seed_path.write_text(
            json.dumps(
                {
                    "schema_version": "openings_seed_v1",
                    "lines": lines,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return seed_path

    def _write_lichess_source(self, rows: list[tuple[str, str, str]]) -> Path:
        source_dir = self.temp_dir / "lichess_chess_openings"
        source_dir.mkdir()
        (source_dir / "README.md").write_text("CC0 Public Domain Dedication", encoding="utf-8")
        (source_dir / "COPYING.txt").write_text("CC0 1.0 Universal", encoding="utf-8")
        for file_name in ("a.tsv", "b.tsv", "c.tsv", "d.tsv", "e.tsv"):
            file_rows = rows if file_name == "a.tsv" else []
            text = "eco\tname\tpgn\n" + "".join(
                f"{eco}\t{name}\t{pgn}\n" for eco, name, pgn in file_rows
            )
            (source_dir / file_name).write_text(text, encoding="utf-8")
        return source_dir

    def _write_book(
        self,
        lines: list[dict[str, Any]],
        *,
        path: Path | None = None,
    ) -> Path:
        book_path = path or self.temp_dir / "openings_book_test.json"
        book_path.write_text(
            json.dumps(
                {
                    "schema_version": "openings_book_v1",
                    "source": "lichess-org/chess-openings",
                    "source_license": "CC0 1.0 Universal",
                    "generated_at": "2026-04-26T00:00:00+00:00",
                    "lines": lines,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        return book_path

    def _book_line(
        self,
        name: str,
        variation: str | None,
        moves: list[str],
        *,
        eco: str | None = None,
    ) -> dict[str, Any]:
        board = chess.Board()
        for uci in moves:
            board.push(chess.Move.from_uci(uci))
        return {
            "eco_code": eco,
            "name": name,
            "variation": variation,
            "color": "both",
            "moves_uci": moves,
            "target_depth_plies": len(moves),
            "epd": board.epd(),
            "source": "lichess_chess_openings",
        }

    def _line(
        self,
        name: str,
        variation: str | None,
        moves: list[str],
        *,
        color: str | None = "both",
        parent: str | None = None,
    ) -> dict[str, Any]:
        return {
            "eco_code": None,
            "name": name,
            "variation": variation,
            "color": color,
            "moves_uci": moves,
            "target_depth_plies": len(moves),
            "parent_line_name": parent,
            "note": None,
        }

    def _line_id(self, name: str, variation: str | None) -> int:
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.row_factory = sqlite3.Row
            row = connection.execute(
                """
                SELECT id
                FROM opening_lines
                WHERE name = ?
                  AND (
                    (variation IS NULL AND ? IS NULL)
                    OR variation = ?
                  )
                """,
                (name, variation, variation),
            ).fetchone()
        self.assertIsNotNone(row)
        return int(row["id"])

    def _node_count(self, line_id: int) -> int:
        with closing(sqlite3.connect(self.db_path)) as connection:
            return int(
                connection.execute(
                    "SELECT COUNT(*) FROM opening_line_nodes WHERE line_id = ?",
                    (line_id,),
                ).fetchone()[0]
            )

    def _book_counts(self) -> tuple[int, int]:
        with closing(sqlite3.connect(self.db_path)) as connection:
            lines = connection.execute(
                "SELECT COUNT(*) FROM opening_lines"
            ).fetchone()[0]
            nodes = connection.execute(
                "SELECT COUNT(*) FROM opening_line_nodes"
            ).fetchone()[0]
        return int(lines), int(nodes)


if __name__ == "__main__":
    unittest.main()
