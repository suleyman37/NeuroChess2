from __future__ import annotations

import hashlib
import shutil
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

import chess
from fastapi.testclient import TestClient


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import app
from neurochess.api.game_routes import ACTIVE_SESSIONS, get_analysis_service, get_repository
from neurochess.data.database import get_connection, init_db
from neurochess.data.repositories import Repository
from neurochess.opening_service import OpeningService
from neurochess.pgn_import_service import (
    PgnImportService,
    parse_pgn_games,
    time_control_category,
)


FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
LICHESS_FROM_POSITION_PGN = (FIXTURES_DIR / "fixture_lichess_from_position.pgn").read_text(
    encoding="utf-8",
)
CHESSCOM_LIVE_PGN = (FIXTURES_DIR / "fixture_chesscom_live.pgn").read_text(
    encoding="utf-8",
)
SPECIAL_INITIAL_FEN = "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
CHESSCOM_CURRENT_POSITION = "8/8/8/8/8/1kb5/p7/1K6 w - - 0 75"

SINGLE_PGN = """[Event "Live Chess"]
[Site "https://www.chess.com/game/live/123"]
[Date "2024.01.02"]
[White "UserA"]
[Black "OpponentB"]
[Result "1-0"]
[WhiteElo "1500"]
[BlackElo "1450"]
[TimeControl "600+0"]
[ECO "C60"]
[Opening "Ruy Lopez"]
[Termination "UserA won by resignation"]

1. e4 {[%clk 0:10:00]} e5 {[%clk 0:10:00]} 2. Nf3 Nc6 3. Bb5 a6 1-0
"""

SECOND_PGN = """[Event "Rated Blitz game"]
[Site "https://lichess.org/abcdef"]
[Date "2024.01.03"]
[White "Other"]
[Black "UserA"]
[Result "0-1"]
[WhiteElo "1600"]
[BlackElo "1550"]
[TimeControl "300+3"]
[ECO "B00"]
[Opening "King's Pawn Game"]

1. e4 e6 2. d4 d5 3. Nc3 Nf6 0-1
"""

OBSERVED_PGN = SECOND_PGN.replace("https://lichess.org/abcdef", "https://lichess.org/observed").replace(
    '[Black "UserA"]',
    '[Black "ViewerB"]',
)

INVALID_PGN = """[Event "Broken"]
[Site "?"]
[Date "2024.01.04"]
[White "Bad"]
[Black "Parser"]
[Result "*"]

1. e5 *
"""

VARIATION_PGN = """[Event "Variation"]
[Site "https://lichess.org/variation"]
[Date "2024.01.05"]
[White "UserA"]
[Black "OpponentC"]
[Result "*"]

1. e4 (1. d4 d5) e5 2. Nf3 *
"""

REVIEWABLE_PGN = """[Event "Reviewable Import"]
[Site "https://lichess.org/reviewable"]
[Date "2024.01.06"]
[White "UserA"]
[Black "OpponentD"]
[Result "*"]
[ECO "C60"]
[Opening "Ruy Lopez"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 *
"""


class PgnImportServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-v52-pgn-"))
        self.db_path = self.temp_dir / "test_neurochess.db"
        init_db(self.db_path)
        self.opening_patch = patch("neurochess.pgn_import_service.OpeningService")
        self.opening_cls = self.opening_patch.start()
        self.opening_cls.return_value.classify_game_opening.return_value = {"status": "ok"}
        self.service = PgnImportService(self.db_path)

    def tearDown(self) -> None:
        self.opening_patch.stop()
        shutil.rmtree(self.temp_dir)

    def test_migration_adds_import_columns_and_user_aliases(self) -> None:
        with closing(get_connection(self.db_path)) as connection:
            game_columns = {row[1] for row in connection.execute("PRAGMA table_info(games)")}
            move_columns = {row[1] for row in connection.execute("PRAGMA table_info(moves)")}
            aliases = connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_aliases'"
            ).fetchone()

        for column in (
            "source",
            "source_platform",
            "source_url",
            "moves_uci_hash",
            "white_name",
            "black_name",
            "white_elo",
            "black_elo",
            "time_control",
            "user_color",
            "result_from_user_pov",
            "game_category",
            "initial_fen",
            "current_position_fen",
            "variant",
            "import_status",
            "import_warnings_json",
            "import_error",
            "import_schema_version",
        ):
            self.assertIn(column, game_columns)
        for column in ("time_spent_ms", "white_clock_ms", "black_clock_ms", "clock_source"):
            self.assertIn(column, move_columns)
        self.assertIsNotNone(aliases)

    def test_preview_pgn_single_game(self) -> None:
        preview = self.service.preview_import(SINGLE_PGN)

        self.assertEqual(preview["game_count"], 1)
        self.assertEqual(preview["valid_count"], 1)
        self.assertEqual(preview["invalid_count"], 0)
        self.assertEqual(preview["duplicate_count"], 0)
        self.assertEqual(preview["detected_players"], ["OpponentB", "UserA"])
        self.assertTrue(preview["needs_user_alias"])
        self.assertEqual(preview["sample_games"][0]["white"], "UserA")
        self.assertEqual(preview["sample_games"][0]["eco"], "C60")

    def test_preview_pgn_multi_game(self) -> None:
        preview = self.service.preview_import(SINGLE_PGN + "\n\n" + SECOND_PGN)

        self.assertEqual(preview["game_count"], 2)
        self.assertEqual(preview["valid_count"], 2)
        self.assertEqual(preview["invalid_count"], 0)
        self.assertEqual(len(preview["sample_games"]), 2)

    def test_parse_chesscom_current_position_is_metadata_not_initial_fen(self) -> None:
        parsed, errors = parse_pgn_games(CHESSCOM_LIVE_PGN)

        self.assertEqual(errors, [])
        self.assertEqual(len(parsed), 1)
        game = parsed[0]
        self.assertEqual(game.source_platform, "chesscom")
        self.assertEqual(game.source_game_id, "167654817356")
        self.assertEqual(
            game.source_url,
            "https://www.chess.com/analysis/game/live/167654817356/analysis",
        )
        self.assertEqual(game.initial_fen, chess.STARTING_FEN)
        self.assertEqual(game.current_position_fen, CHESSCOM_CURRENT_POSITION)
        self.assertEqual(game.moves[0].fen_before, chess.STARTING_FEN)

    def test_parse_lichess_from_position_uses_setup_fen(self) -> None:
        parsed, errors = parse_pgn_games(LICHESS_FROM_POSITION_PGN)

        self.assertEqual(errors, [])
        self.assertEqual(len(parsed), 2)
        self.assertTrue(all(game.source_platform == "lichess" for game in parsed))
        self.assertEqual(parsed[0].source_game_id, "frompos01")
        self.assertEqual(parsed[0].variant, "From Position")
        self.assertEqual(parsed[0].initial_fen, SPECIAL_INITIAL_FEN)
        self.assertEqual(parsed[0].moves[0].fen_before, SPECIAL_INITIAL_FEN)

    def test_import_pgn_single_game_creates_game_moves_and_no_analysis(self) -> None:
        result = self.service.import_pgn(
            SINGLE_PGN,
            user_alias="UserA",
            platform="chesscom",
        )

        self.assertEqual(result["imported_count"], 1)
        self.assertEqual(result["duplicate_count"], 0)
        self.assertEqual(result["classified_count"], 1)
        self.opening_cls.return_value.classify_game_opening.assert_called_once()

        game_id = result["imported_game_ids"][0]
        with closing(get_connection(self.db_path)) as connection:
            game = connection.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
            moves = connection.execute(
                "SELECT * FROM moves WHERE game_id = ? ORDER BY ply",
                (game_id,),
            ).fetchall()
            analysis_count = connection.execute(
                "SELECT COUNT(*) FROM position_analyses"
            ).fetchone()[0]

        self.assertEqual(game["source"], "pgn_import")
        self.assertEqual(game["source_platform"], "chesscom")
        self.assertEqual(game["source_url"], "https://www.chess.com/game/live/123")
        self.assertEqual(game["white_name"], "UserA")
        self.assertEqual(game["black_name"], "OpponentB")
        self.assertEqual(game["white_elo"], 1500)
        self.assertEqual(game["black_elo"], 1450)
        self.assertEqual(game["time_control"], "600+0")
        self.assertEqual(game["user_color"], "white")
        self.assertEqual(game["opponent_name"], "OpponentB")
        self.assertEqual(game["result_from_user_pov"], "win")
        self.assertEqual(game["game_category"], "imported_user")
        self.assertEqual([move["uci"] for move in moves], ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"])
        self.assertEqual(moves[0]["white_clock_ms"], 600000)
        self.assertEqual(moves[1]["black_clock_ms"], 600000)
        self.assertEqual(analysis_count, 0)

    def test_import_chesscom_link_extracts_external_id_and_keeps_standard_start(self) -> None:
        result = self.service.import_pgn(
            CHESSCOM_LIVE_PGN,
            user_alias="UserA",
            platform="unknown",
        )
        game_id = result["imported_game_ids"][0]

        with closing(get_connection(self.db_path)) as connection:
            game = connection.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
            moves = connection.execute(
                "SELECT * FROM moves WHERE game_id = ? ORDER BY ply",
                (game_id,),
            ).fetchall()

        self.assertEqual(game["source_platform"], "chesscom")
        self.assertEqual(game["source_game_id"], "167654817356")
        self.assertEqual(
            game["source_url"],
            "https://www.chess.com/analysis/game/live/167654817356/analysis",
        )
        self.assertEqual(game["initial_fen"], chess.STARTING_FEN)
        self.assertEqual(game["current_position_fen"], CHESSCOM_CURRENT_POSITION)
        self.assertEqual(game["variant"], "Standard")
        self.assertEqual(game["import_status"], "ok")
        self.assertEqual(moves[0]["fen_before"], chess.STARTING_FEN)

    def test_import_lichess_from_position_opening_is_not_applicable(self) -> None:
        result = self.service.import_pgn(
            LICHESS_FROM_POSITION_PGN,
            user_alias="SindarovGM",
            platform="unknown",
        )
        game_id = result["imported_game_ids"][0]

        with closing(get_connection(self.db_path)) as connection:
            game = connection.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
            moves = connection.execute(
                "SELECT * FROM moves WHERE game_id = ? ORDER BY ply",
                (game_id,),
            ).fetchall()

        self.assertEqual(game["source_platform"], "lichess")
        self.assertEqual(game["source_game_id"], "frompos01")
        self.assertEqual(game["initial_fen"], SPECIAL_INITIAL_FEN)
        self.assertEqual(game["variant"], "From Position")
        self.assertEqual(moves[0]["fen_before"], SPECIAL_INITIAL_FEN)

        classification = OpeningService(self.db_path).classify_game_opening(game_id)
        self.assertEqual(
            classification["classification_status"],
            "not_applicable_from_position",
        )

        history_item = {
            item["game_id"]: item
            for item in self.service.history(scope="all")
        }[game_id]
        self.assertTrue(history_item["is_special_position"])
        self.assertEqual(history_item["initial_fen"], SPECIAL_INITIAL_FEN)
        self.assertEqual(history_item["classification_status"], "not_applicable_from_position")
        self.assertTrue(history_item["is_reviewable"])

    def test_import_pgn_multi_game(self) -> None:
        result = self.service.import_pgn(
            SINGLE_PGN + "\n\n" + SECOND_PGN,
            user_alias="UserA",
            platform="lichess",
        )

        self.assertEqual(result["imported_count"], 2)
        self.assertEqual(result["duplicate_count"], 0)
        self.assertEqual(len(result["imported_game_ids"]), 2)

    def test_moves_have_valid_fen_before_and_after(self) -> None:
        game_id = self.service.import_pgn(SINGLE_PGN)["imported_game_ids"][0]
        with closing(get_connection(self.db_path)) as connection:
            rows = connection.execute(
                "SELECT fen_before, uci FROM moves WHERE game_id = ? ORDER BY ply",
                (game_id,),
            ).fetchall()

        board = chess.Board(rows[0]["fen_before"])
        for row in rows:
            self.assertEqual(board.fen(), row["fen_before"])
            move = chess.Move.from_uci(row["uci"])
            self.assertIn(move, board.legal_moves)
            board.push(move)

    def test_moves_uci_hash_is_stable(self) -> None:
        parsed, errors = parse_pgn_games(SINGLE_PGN)
        self.assertEqual(errors, [])
        expected = hashlib.sha256(
            "e2e4 e7e5 g1f3 b8c6 f1b5 a7a6".encode("utf-8")
        ).hexdigest()

        self.assertEqual(parsed[0].moves_uci_hash, expected)

    def test_duplicate_import_is_ignored(self) -> None:
        first = self.service.import_pgn(SINGLE_PGN)
        second = self.service.import_pgn(SINGLE_PGN)

        self.assertEqual(first["imported_count"], 1)
        self.assertEqual(second["imported_count"], 0)
        self.assertEqual(second["duplicate_count"], 1)

    def test_reimport_chesscom_link_uses_external_id_for_idempotency(self) -> None:
        first = self.service.import_pgn(CHESSCOM_LIVE_PGN, platform="unknown")
        second = self.service.import_pgn(CHESSCOM_LIVE_PGN, platform="unknown")

        self.assertEqual(first["imported_count"], 1)
        self.assertEqual(second["imported_count"], 0)
        self.assertEqual(second["duplicate_count"], 1)

    def test_source_url_duplicate_is_ignored(self) -> None:
        altered_same_url = SINGLE_PGN.replace("3. Bb5 a6", "3. Bc4 Bc5")

        self.assertEqual(self.service.import_pgn(SINGLE_PGN)["imported_count"], 1)
        duplicate = self.service.import_pgn(altered_same_url)

        self.assertEqual(duplicate["imported_count"], 0)
        self.assertEqual(duplicate["duplicate_count"], 1)

    def test_user_alias_white_and_black_result_from_user_pov(self) -> None:
        white = self.service.import_pgn(SINGLE_PGN, user_alias="usera")
        black = self.service.import_pgn(SECOND_PGN, user_alias="USERA")

        with closing(get_connection(self.db_path)) as connection:
            white_game = connection.execute(
                "SELECT user_color, result_from_user_pov FROM games WHERE id = ?",
                (white["imported_game_ids"][0],),
            ).fetchone()
            black_game = connection.execute(
                "SELECT user_color, result_from_user_pov FROM games WHERE id = ?",
                (black["imported_game_ids"][0],),
            ).fetchone()

        self.assertEqual(tuple(white_game), ("white", "win"))
        self.assertEqual(tuple(black_game), ("black", "win"))

    def test_invalid_pgn_is_skipped_without_breaking_batch(self) -> None:
        result = self.service.import_pgn(INVALID_PGN + "\n\n" + SINGLE_PGN)

        self.assertEqual(result["imported_count"], 1)
        self.assertEqual(result["invalid_count"], 1)

    def test_unsupported_variant_does_not_create_analyzable_card(self) -> None:
        unsupported = """[Event "Unsupported"]
[Site "https://example.test/unsupported"]
[White "Bug"]
[Black "Safe"]
[Result "*"]
[Variant "Atomic"]

1. e4 *
"""
        result = self.service.import_pgn(unsupported)

        self.assertEqual(result["imported_count"], 0)
        self.assertEqual(result["invalid_count"], 1)
        self.assertEqual(self.service.history(scope="all"), [])

    def test_comments_and_variations_import_mainline_only(self) -> None:
        result = self.service.import_pgn(VARIATION_PGN)
        game_id = result["imported_game_ids"][0]

        with closing(get_connection(self.db_path)) as connection:
            moves = [
                row[0]
                for row in connection.execute(
                    "SELECT uci FROM moves WHERE game_id = ? ORDER BY ply",
                    (game_id,),
                ).fetchall()
            ]

        self.assertEqual(moves, ["e2e4", "e7e5", "g1f3"])
        self.assertNotIn("d2d4", moves)

    def test_history_returns_imported_games(self) -> None:
        result = self.service.import_pgn(SINGLE_PGN, user_alias="UserA")

        history = self.service.history()

        self.assertEqual(history[0]["game_id"], result["imported_game_ids"][0])
        self.assertEqual(history[0]["date_played"], "2024.01.02")
        self.assertEqual(history[0]["white_name"], "UserA")
        self.assertEqual(history[0]["result_from_user_pov"], "win")
        self.assertEqual(history[0]["game_category"], "imported_user")
        self.assertEqual(history[0]["display_title"], "UserA vs OpponentB")
        self.assertEqual(history[0]["time_control_category"], "rapid")
        self.assertFalse(history[0]["is_reviewable"])
        self.assertIn("opening_name", history[0])

    def test_history_scopes_classify_mine_imported_local_observed_and_all(self) -> None:
        imported_user = self.service.import_pgn(
            SINGLE_PGN,
            user_alias="UserA",
            platform="chesscom",
        )["imported_game_ids"][0]
        imported_observed = self.service.import_pgn(
            OBSERVED_PGN,
            user_alias=None,
            platform="lichess",
        )["imported_game_ids"][0]
        local_game = self._create_finished_local_game(move_count=11)

        mine_ids = {item["game_id"] for item in self.service.history(scope="mine")}
        imported_ids = {item["game_id"] for item in self.service.history(scope="imported")}
        local_ids = {item["game_id"] for item in self.service.history(scope="local")}
        observed_ids = {item["game_id"] for item in self.service.history(scope="observed")}
        all_ids = {item["game_id"] for item in self.service.history(scope="all")}

        self.assertIn(imported_user, mine_ids)
        self.assertIn(local_game, mine_ids)
        self.assertNotIn(imported_observed, mine_ids)
        self.assertEqual(imported_ids, {imported_user, imported_observed})
        self.assertEqual(local_ids, {local_game})
        self.assertEqual(observed_ids, {imported_observed})
        self.assertTrue({imported_user, imported_observed, local_game}.issubset(all_ids))

    def test_history_display_labels_avoid_question_mark_rows(self) -> None:
        imported = self.service.import_pgn(
            SINGLE_PGN,
            user_alias="UserA",
            platform="chesscom",
        )["imported_game_ids"][0]
        observed = self.service.import_pgn(
            OBSERVED_PGN,
            user_alias=None,
            platform="lichess",
        )["imported_game_ids"][0]
        local = self._create_finished_local_game(move_count=11)

        items = {
            item["game_id"]: item
            for item in self.service.history(scope="all")
        }

        self.assertEqual(items[imported]["display_title"], "UserA vs OpponentB")
        self.assertIn("Chess.com", items[imported]["display_subtitle"])
        self.assertEqual(items[observed]["display_title"], "Other vs ViewerB")
        self.assertIn("Lichess", items[observed]["display_subtitle"])
        self.assertEqual(items[local]["display_title"], "Partie locale")
        for item in items.values():
            self.assertNotIn("? - ?", item["display_title"])
            self.assertNotIn("? - ?", item["display_subtitle"])

    def test_history_time_control_category_helper(self) -> None:
        self.assertEqual(time_control_category("60+0"), "bullet")
        self.assertEqual(time_control_category("180+0"), "blitz")
        self.assertEqual(time_control_category("300+0"), "blitz")
        self.assertEqual(time_control_category("600"), "rapid")
        self.assertEqual(time_control_category("600+0"), "rapid")
        self.assertEqual(time_control_category("900+10"), "rapid")
        self.assertEqual(time_control_category("1800+0"), "classical")
        self.assertEqual(time_control_category(None), "unknown")

    def test_history_metadata_quality_and_review_status_are_exposed(self) -> None:
        unknown_game = self._create_unknown_history_game()
        review_game = self.service.import_pgn(
            REVIEWABLE_PGN,
            user_alias="UserA",
            platform="lichess",
        )["imported_game_ids"][0]
        with closing(get_connection(self.db_path)) as connection:
            connection.execute(
                """
                INSERT INTO game_reviews (
                    game_id,
                    status,
                    review_schema_version,
                    selection_algorithm_version,
                    created_at,
                    updated_at
                )
                VALUES (?, 'done', 'post_game_review_v1', 'moment_selection_winloss_v2',
                        datetime('now'), datetime('now'))
                """,
                (review_game,),
            )
            connection.commit()

        items = {item["game_id"]: item for item in self.service.history(scope="all")}

        self.assertEqual(items[unknown_game]["metadata_quality"], "poor")
        self.assertEqual(items[unknown_game]["display_title"], "Position locale non identifiée")
        self.assertEqual(items[review_game]["review_status"], "done")
        self.assertEqual(
            items[review_game]["review_summary_status"],
            "no_significant_moments",
        )
        self.assertTrue(items[review_game]["is_reviewable"])

    def test_history_source_platforms_and_alias_categories_are_exposed(self) -> None:
        chesscom = self.service.import_pgn(
            SINGLE_PGN,
            user_alias="UserA",
            platform="chesscom",
        )["imported_game_ids"][0]
        lichess_observed = self.service.import_pgn(
            OBSERVED_PGN,
            user_alias=None,
            platform="lichess",
        )["imported_game_ids"][0]

        items = {item["game_id"]: item for item in self.service.history(scope="all")}

        self.assertEqual(items[chesscom]["source_platform"], "chesscom")
        self.assertEqual(items[chesscom]["game_category"], "imported_user")
        self.assertEqual(items[lichess_observed]["source_platform"], "lichess")
        self.assertEqual(items[lichess_observed]["game_category"], "imported_observed")

    def _create_finished_local_game(self, move_count: int) -> int:
        repository = Repository(self.db_path)
        game_id = repository.create_game(
            mode="classic",
            opponent_type="human",
            opponent_level=None,
        )
        for ply in range(1, move_count + 1):
            repository.add_move(
                game_id=game_id,
                ply=ply,
                fen_before=chess.STARTING_FEN,
                uci="e2e4",
                san=f"Move {ply}",
                is_player=True,
            )
        repository.finish_game(game_id, result="*", pgn='[Result "*"]')
        return game_id

    def _create_unknown_history_game(self) -> int:
        with closing(get_connection(self.db_path)) as connection:
            cursor = connection.execute(
                """
                INSERT INTO games (
                    created_at,
                    completed_at,
                    mode,
                    completed,
                    game_category
                )
                VALUES (datetime('now'), datetime('now'), 'sandbox', 1, 'unknown')
                """
            )
            connection.commit()
            return int(cursor.lastrowid)

    def test_api_preview_import_and_history(self) -> None:
        repository = Repository(self.db_path)
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: repository
        client = TestClient(app)
        try:
            preview = client.post(
                "/games/import-pgn/preview",
                json={"pgn_text": SINGLE_PGN},
            )
            imported = client.post(
                "/games/import-pgn",
                json={
                    "pgn_text": SINGLE_PGN,
                    "user_alias": "UserA",
                    "platform": "chesscom",
                },
            )
            history = client.get("/games/history")
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()

        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.json()["valid_count"], 1)
        self.assertEqual(imported.status_code, 200)
        self.assertEqual(imported.json()["imported_count"], 1)
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()[0]["white_name"], "UserA")
        self.assertEqual(history.json()[0]["display_title"], "UserA vs OpponentB")
        self.assertIn("review_summary_status", history.json()[0])

    def test_imported_game_history_opens_moves_and_review_on_demand(self) -> None:
        imported = self.service.import_pgn(
            REVIEWABLE_PGN,
            user_alias="UserA",
            platform="lichess",
        )
        game_id = imported["imported_game_ids"][0]

        with closing(get_connection(self.db_path)) as connection:
            analysis_count_after_import = connection.execute(
                "SELECT COUNT(*) FROM position_analyses"
            ).fetchone()[0]
        self.assertEqual(analysis_count_after_import, 0)

        repository = Repository(self.db_path)
        analysis_service = DemandOnlyAnalysisService(self.db_path)
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: repository
        app.dependency_overrides[get_analysis_service] = lambda: analysis_service
        client = TestClient(app)
        try:
            history = client.get("/games/history")
            state = client.get(f"/games/{game_id}")
            moves = client.get(f"/games/{game_id}/moves")
            review = client.post(f"/games/{game_id}/review/generate")
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()

        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()[0]["game_id"], game_id)
        self.assertEqual(state.status_code, 200)
        self.assertEqual(state.json()["game"]["id"], game_id)
        self.assertEqual(state.json()["game"]["completed"], 1)
        self.assertEqual(len(state.json()["moves"]), 11)
        self.assertEqual(moves.status_code, 200)
        self.assertEqual(moves.json()["initial_fen"], chess.STARTING_FEN)
        self.assertEqual(len(moves.json()["moves"]), 11)
        self.assertIn("fen_after", moves.json()["moves"][0])
        self.assertEqual(review.status_code, 202)
        self.assertEqual(review.json()["status"], "pending")
        self.assertTrue(review.json()["review_work_active"])
        self.assertGreater(review.json()["scheduled_deep_count"], 0)
        self.assertEqual(analysis_service.process_limits, [review.json()["total_required_deep_count"]])

        with closing(get_connection(self.db_path)) as connection:
            required_deep_count = connection.execute(
                """
                SELECT COUNT(*)
                FROM position_analyses
                WHERE analysis_kind = 'deep'
                  AND schema_version = 'engine_analysis_v2'
                """
            ).fetchone()[0]
        self.assertEqual(required_deep_count, review.json()["total_required_deep_count"])

    def test_from_position_history_opens_with_special_initial_fen_and_can_start_review(self) -> None:
        imported = self.service.import_pgn(
            LICHESS_FROM_POSITION_PGN,
            user_alias="SindarovGM",
            platform="unknown",
        )
        game_id = imported["imported_game_ids"][0]

        repository = Repository(self.db_path)
        analysis_service = DemandOnlyAnalysisService(self.db_path)
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: repository
        app.dependency_overrides[get_analysis_service] = lambda: analysis_service
        client = TestClient(app)
        try:
            state = client.get(f"/games/{game_id}")
            moves = client.get(f"/games/{game_id}/moves")
            review = client.post(f"/games/{game_id}/review/generate")
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()

        self.assertEqual(state.status_code, 200)
        self.assertEqual(state.json()["moves"][0]["fen_before"], SPECIAL_INITIAL_FEN)
        self.assertEqual(moves.status_code, 200)
        self.assertEqual(moves.json()["initial_fen"], SPECIAL_INITIAL_FEN)
        self.assertEqual(moves.json()["moves"][0]["fen_before"], SPECIAL_INITIAL_FEN)
        self.assertEqual(review.status_code, 202)
        self.assertEqual(review.json()["status"], "pending")
        self.assertGreater(review.json()["scheduled_deep_count"], 0)
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

    def test_chesscom_history_opens_from_standard_initial_fen_not_current_position(self) -> None:
        imported = self.service.import_pgn(
            CHESSCOM_LIVE_PGN,
            user_alias="UserA",
            platform="unknown",
        )
        game_id = imported["imported_game_ids"][0]

        repository = Repository(self.db_path)
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: repository
        client = TestClient(app)
        try:
            state = client.get(f"/games/{game_id}")
            moves = client.get(f"/games/{game_id}/moves")
            history = client.get("/games/history")
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()

        self.assertEqual(state.status_code, 200)
        self.assertEqual(state.json()["moves"][0]["fen_before"], chess.STARTING_FEN)
        self.assertEqual(moves.status_code, 200)
        self.assertEqual(moves.json()["initial_fen"], chess.STARTING_FEN)
        self.assertEqual(moves.json()["initial_fen"], state.json()["moves"][0]["fen_before"])
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()[0]["game_id"], game_id)
        self.assertEqual(history.json()[0]["source_platform"], "chesscom")
        self.assertEqual(history.json()[0]["source_game_id"], "167654817356")
        self.assertEqual(history.json()[0]["current_position_fen"], CHESSCOM_CURRENT_POSITION)

    def test_api_accepts_multipart_pgn_file_without_stockfish_analysis(self) -> None:
        repository = Repository(self.db_path)
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: repository
        client = TestClient(app)
        try:
            preview = client.post(
                "/games/import-pgn/preview",
                files={
                    "file": (
                        "sample.pgn",
                        SINGLE_PGN.encode("utf-8"),
                        "application/x-chess-pgn",
                    )
                },
            )
            imported = client.post(
                "/games/import-pgn",
                data={"user_alias": "UserA", "platform": "chesscom"},
                files={
                    "file": (
                        "sample.pgn",
                        SINGLE_PGN.encode("utf-8"),
                        "application/x-chess-pgn",
                    )
                },
            )
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()

        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.json()["valid_count"], 1)
        self.assertEqual(imported.status_code, 200)
        self.assertEqual(imported.json()["imported_count"], 1)
        with closing(get_connection(self.db_path)) as connection:
            analysis_count = connection.execute(
                "SELECT COUNT(*) FROM position_analyses"
            ).fetchone()[0]
        self.assertEqual(analysis_count, 0)


class DemandOnlyAnalysisService:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.process_limits: list[int] = []

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

    def process_pending_analyses(self, limit: int = 10) -> list[dict[str, object]]:
        self.process_limits.append(limit)
        return []


if __name__ == "__main__":
    unittest.main()
