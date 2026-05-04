from __future__ import annotations

import shutil
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
import json
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.data.database import get_connection, init_db
import neurochess.data.database as database_module
from neurochess.data.repositories import Repository


START_FEN = "rn1qkbnr/pppbpppp/8/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq - 2 3"
SAMPLE_UCI_MOVES = [
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


class DatabaseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-test-"))
        self.db_path = self.temp_dir / "test_neurochess.db"
        init_db(self.db_path)
        self.repository = Repository(self.db_path)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir)

    def test_database_file_is_created(self) -> None:
        self.assertTrue(self.db_path.exists())

    def test_required_tables_exist(self) -> None:
        expected_tables = {
            "schema_migrations",
            "games",
            "moves",
            "position_analyses",
            "game_reviews",
            "review_moments",
            "opening_lines",
            "opening_line_nodes",
            "game_opening_classifications",
            "user_aliases",
            "review_jobs",
            "review_practice_sessions",
            "review_practice_attempts",
        }

        with closing(sqlite3.connect(self.db_path)) as connection:
            rows = connection.execute(
                """
                SELECT name
                FROM sqlite_master
                WHERE type = 'table'
                """
            ).fetchall()

        self.assertTrue(expected_tables.issubset({row[0] for row in rows}))

    def test_v5_3_d2_practice_session_items_schema_exists(self) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            columns = {
                row[1]
                for row in connection.execute(
                    "PRAGMA table_info(review_practice_sessions)"
                )
            }

        self.assertIn("scope", columns)
        self.assertIn("items_json", columns)

    def test_v5_5_learning_loop_practice_event_schema_exists(self) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            attempt_columns = {
                row[1]
                for row in connection.execute(
                    "PRAGMA table_info(review_practice_attempts)"
                )
            }
            attempt_indexes = {
                row[1]
                for row in connection.execute(
                    "PRAGMA index_list(review_practice_attempts)"
                )
            }

        for column in (
            "item_id",
            "time_spent_ms",
            "hint_used",
            "reveal_used",
            "source_context",
            "due_at",
        ):
            self.assertIn(column, attempt_columns)
        self.assertIn("idx_review_practice_attempts_game_due", attempt_indexes)

    def test_init_db_is_idempotent(self) -> None:
        init_db(self.db_path)
        init_db(self.db_path)

        with closing(sqlite3.connect(self.db_path)) as connection:
            migration_count = connection.execute(
                "SELECT COUNT(*) FROM schema_migrations"
            ).fetchone()[0]

        self.assertEqual(migration_count, 19)

    def test_v5_2_2_history_category_schema_exists(self) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            game_columns = {
                row[1]
                for row in connection.execute("PRAGMA table_info(games)")
            }
            game_indexes = {
                row[1]
                for row in connection.execute("PRAGMA index_list(games)")
            }

        self.assertIn("game_category", game_columns)
        self.assertIn("opponent_type", game_columns)
        self.assertIn("idx_games_game_category", game_indexes)

    def test_v5_3_a4d_review_job_hardening_schema_exists(self) -> None:
        with closing(get_connection(self.db_path)) as connection:
            job_columns = {
                row[1]
                for row in connection.execute("PRAGMA table_info(review_jobs)")
            }
            job_sql = connection.execute(
                """
                SELECT sql
                FROM sqlite_master
                WHERE type = 'table'
                  AND name = 'review_jobs'
                """
            ).fetchone()[0]
            busy_timeout = connection.execute("PRAGMA busy_timeout").fetchone()[0]

        self.assertIn("failed_reason", job_columns)
        self.assertIn("last_error", job_columns)
        self.assertIn("retryable", job_columns)
        self.assertIn("heartbeat_at", job_columns)
        self.assertIn("last_progress_at", job_columns)
        self.assertIn("current_phase", job_columns)
        self.assertIn("current_position_started_at", job_columns)
        self.assertIn("finalizing", job_sql)
        self.assertIn("stalled", job_sql)
        self.assertEqual(busy_timeout, 30000)

    def test_v5_2_pgn_r2_import_schema_version_exists(self) -> None:
        with closing(get_connection(self.db_path)) as connection:
            game_columns = {
                row[1]
                for row in connection.execute("PRAGMA table_info(games)")
            }
            game_indexes = {
                row[1]
                for row in connection.execute("PRAGMA index_list(games)")
            }

        self.assertIn("import_schema_version", game_columns)
        self.assertIn("idx_games_import_schema_version", game_indexes)

    def test_sqlite_retry_uses_backoff_jitter(self) -> None:
        attempts = {"count": 0}
        sleeps: list[float] = []
        original_sleep = database_module.time.sleep
        original_random = database_module.random.uniform

        def flaky_operation() -> str:
            attempts["count"] += 1
            if attempts["count"] == 1:
                raise sqlite3.OperationalError("database is locked")
            return "ok"

        try:
            database_module.time.sleep = lambda value: sleeps.append(value)  # type: ignore[assignment]
            database_module.random.uniform = lambda _minimum, maximum: maximum  # type: ignore[assignment]

            result = database_module.execute_with_retry(
                flaky_operation,
                delays=(0.1,),
            )
        finally:
            database_module.time.sleep = original_sleep  # type: ignore[assignment]
            database_module.random.uniform = original_random  # type: ignore[assignment]

        self.assertEqual(result, "ok")
        self.assertEqual(attempts["count"], 2)
        self.assertEqual(len(sleeps), 1)
        self.assertGreater(sleeps[0], 0.1)

    def test_v5_opening_schema_exists(self) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            opening_columns = {
                row[1]: {
                    "type": row[2],
                    "notnull": row[3],
                    "default": row[4],
                }
                for row in connection.execute("PRAGMA table_info(opening_lines)")
            }
            node_columns = {
                row[1]: {
                    "type": row[2],
                    "notnull": row[3],
                    "default": row[4],
                }
                for row in connection.execute("PRAGMA table_info(opening_line_nodes)")
            }
            classification_columns = {
                row[1]: {
                    "type": row[2],
                    "notnull": row[3],
                    "default": row[4],
                }
                for row in connection.execute(
                    "PRAGMA table_info(game_opening_classifications)"
                )
            }
            opening_indexes = {
                row[1]
                for row in connection.execute("PRAGMA index_list(opening_lines)")
            }
            node_indexes = {
                row[1]
                for row in connection.execute("PRAGMA index_list(opening_line_nodes)")
            }

        for column in (
            "eco_code",
            "name",
            "variation",
            "color",
            "parent_line_id",
            "target_depth_plies",
            "pgn_canonical",
            "source",
        ):
            self.assertIn(column, opening_columns)
        self.assertEqual(opening_columns["source"]["default"], "'internal_seed'")
        self.assertIn("idx_opening_lines_eco_code", opening_indexes)
        self.assertIn("idx_opening_lines_name", opening_indexes)

        for column in (
            "line_id",
            "ply",
            "fen",
            "fen_key",
            "expected_move_uci",
            "expected_move_san",
            "alternatives_json",
        ):
            self.assertIn(column, node_columns)
        self.assertEqual(node_columns["alternatives_json"]["default"], "'[]'")
        self.assertIn("idx_opening_line_nodes_fen_key", node_indexes)
        self.assertIn("idx_opening_line_nodes_line_id_ply", node_indexes)

        for column in (
            "game_id",
            "line_id",
            "opening_name",
            "eco_code",
            "matched_plies",
            "last_book_ply",
            "out_of_book_ply",
            "out_of_book_color",
            "out_of_book_fen",
            "confidence",
            "classification_status",
        ):
            self.assertIn(column, classification_columns)

    def test_v4_review_schema_exists(self) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            review_columns = {
                row[1]: {
                    "type": row[2],
                    "notnull": row[3],
                    "default": row[4],
                }
                for row in connection.execute("PRAGMA table_info(game_reviews)")
            }
            moment_columns = {
                row[1]: {
                    "type": row[2],
                    "notnull": row[3],
                    "default": row[4],
                }
                for row in connection.execute("PRAGMA table_info(review_moments)")
            }
            review_indexes = connection.execute(
                "PRAGMA index_list(game_reviews)"
            ).fetchall()

        self.assertIn("status", review_columns)
        self.assertIn("review_schema_version", review_columns)
        self.assertIn("selection_algorithm_version", review_columns)
        self.assertIn("warnings_json", review_columns)
        self.assertIn("score_json", review_columns)
        self.assertEqual(
            review_columns["review_schema_version"]["default"],
            "'post_game_review_v1'",
        )
        self.assertEqual(
            review_columns["selection_algorithm_version"]["default"],
            "'moment_selection_v1'",
        )
        self.assertEqual(review_columns["warnings_json"]["default"], "'[]'")
        self.assertTrue(any(row[2] == 1 for row in review_indexes))

        for column in (
            "review_id",
            "game_id",
            "ply",
            "played_by",
            "side_to_move_before",
            "fen_before",
            "fen_after",
            "played_uci",
            "cp_loss",
            "cp_loss_label",
            "importance_score",
            "reliability_score",
            "reliability_label",
            "top_moves_json",
            "review_type",
        ):
            self.assertIn(column, moment_columns)

    def test_v3_5_schema_has_no_duplicate_columns_and_unique_index(self) -> None:
        with closing(sqlite3.connect(self.db_path)) as connection:
            move_columns = [
                row[1] for row in connection.execute("PRAGMA table_info(moves)")
            ]
            analysis_columns = {
                row[1]: {
                    "type": row[2],
                    "notnull": row[3],
                    "default": row[4],
                }
                for row in connection.execute("PRAGMA table_info(position_analyses)")
            }
            indexes = connection.execute(
                "PRAGMA index_list(position_analyses)"
            ).fetchall()

            unique_index = next(
                row for row in indexes if row[1] == "idx_position_analyses_unique_v3_5"
            )
            unique_index_columns = [
                row[2]
                for row in connection.execute(
                    "PRAGMA index_info(idx_position_analyses_unique_v3_5)"
                )
            ]

        self.assertEqual(len(move_columns), len(set(move_columns)))
        self.assertEqual(len(analysis_columns), len(set(analysis_columns)))
        self.assertIn("annotations", move_columns)
        self.assertEqual(unique_index[2], 1)
        self.assertEqual(
            unique_index_columns,
            [
                "fen",
                "engine",
                "engine_version",
                "depth",
                "multipv",
                "analysis_kind",
                "schema_version",
            ],
        )

        for column in unique_index_columns:
            self.assertEqual(analysis_columns[column]["notnull"], 1)

        self.assertEqual(analysis_columns["engine"]["default"], "'stockfish'")
        self.assertEqual(analysis_columns["engine_version"]["default"], "'unknown'")
        self.assertEqual(analysis_columns["depth"]["default"], "12")
        self.assertEqual(analysis_columns["multipv"]["default"], "3")
        self.assertEqual(analysis_columns["analysis_kind"]["default"], "'deep'")
        self.assertEqual(
            analysis_columns["schema_version"]["default"],
            "'engine_analysis_v2'",
        )

    def test_legacy_position_analyses_rebuild_preserves_rows(self) -> None:
        legacy_db_path = self.temp_dir / "legacy_neurochess.db"
        self._create_legacy_v0_database(legacy_db_path)

        with closing(sqlite3.connect(legacy_db_path)) as connection:
            before_count = connection.execute(
                "SELECT COUNT(*) FROM position_analyses"
            ).fetchone()[0]

        init_db(legacy_db_path)

        with closing(sqlite3.connect(legacy_db_path)) as connection:
            after_count = connection.execute(
                "SELECT COUNT(*) FROM position_analyses"
            ).fetchone()[0]
            rows = connection.execute(
                """
                SELECT id, analysis_json, engine, depth, schema_version, engine_version
                FROM position_analyses
                ORDER BY id
                """
            ).fetchall()

        self.assertEqual(before_count, 2)
        self.assertEqual(after_count, before_count)
        self.assertEqual(rows[0][0], 1)
        self.assertEqual(json.loads(rows[0][1])["best_move"], "e2e4")
        self.assertEqual(rows[0][2], "stockfish-placeholder")
        self.assertEqual(rows[0][3], 12)
        self.assertEqual(rows[0][4], "v0")
        self.assertEqual(rows[0][5], "unknown")
        self.assertEqual(rows[1][5], "unknown-legacy-2")

    def test_game_and_moves_flow(self) -> None:
        game_id = self.repository.create_game(
            mode="training",
            opponent_type="human",
            opponent_level=None,
        )

        game = self.repository.get_game(game_id)
        self.assertIsNotNone(game)
        self.assertEqual(game.mode, "training")
        self.assertFalse(game.completed)

        for ply, uci in enumerate(SAMPLE_UCI_MOVES, start=1):
            move_id = self.repository.add_move(
                game_id=game_id,
                ply=ply,
                fen_before=START_FEN,
                uci=uci,
                san=f"Move {ply}",
                is_player=ply % 2 == 1,
                time_spent=1.5 + ply,
            )
            self.assertIsInstance(move_id, int)

        moves = self.repository.get_moves_for_game(game_id)
        self.assertEqual(len(moves), 10)
        self.assertEqual([move.ply for move in moves], list(range(1, 11)))

        games = self.repository.list_games()
        self.assertEqual([listed_game.id for listed_game in games], [game_id])

        self.repository.finish_game(
            game_id,
            result="1-0",
            pgn='[Result "1-0"]',
        )

        finished_game = self.repository.get_game(game_id)
        self.assertIsNotNone(finished_game)
        self.assertTrue(finished_game.completed)
        self.assertEqual(finished_game.result, "1-0")
        self.assertEqual(finished_game.pgn, '[Result "1-0"]')
        self.assertIsNotNone(finished_game.completed_at)

    def test_position_analysis_round_trip(self) -> None:
        analysis_id = self.repository.save_position_analysis(
            fen=START_FEN,
            analysis_json={
                "best_move": "e2e4",
                "score_cp": 34,
                "principal_variation": ["e2e4", "e7e5"],
            },
            engine="stockfish-placeholder",
            depth=12,
        )

        self.assertIsInstance(analysis_id, int)

        analysis = self.repository.get_position_analysis_by_fen(START_FEN)
        self.assertIsNotNone(analysis)
        self.assertEqual(analysis.fen, START_FEN)
        self.assertEqual(analysis.analysis_json["best_move"], "e2e4")
        self.assertEqual(analysis.engine, "stockfish-placeholder")
        self.assertEqual(analysis.depth, 12)
        self.assertEqual(analysis.schema_version, "v0")

    def _create_legacy_v0_database(self, db_path: Path) -> None:
        with closing(sqlite3.connect(db_path)) as connection:
            connection.executescript(
                """
                CREATE TABLE schema_migrations (
                    id TEXT PRIMARY KEY,
                    applied_at TEXT NOT NULL
                );
                INSERT INTO schema_migrations (id, applied_at)
                VALUES ('0001_v0_schema', datetime('now'));

                CREATE TABLE games (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    completed_at TEXT NULL,
                    mode TEXT NOT NULL,
                    opponent_type TEXT NULL,
                    opponent_level INTEGER NULL,
                    result TEXT NULL,
                    pgn TEXT NULL,
                    completed INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE moves (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id INTEGER NOT NULL,
                    ply INTEGER NOT NULL,
                    fen_before TEXT NOT NULL,
                    uci TEXT NOT NULL,
                    san TEXT NOT NULL,
                    is_player INTEGER NOT NULL,
                    time_spent REAL NULL,
                    eval_before_cp INTEGER NULL,
                    eval_after_cp INTEGER NULL,
                    best_move_uci TEXT NULL,
                    cp_loss INTEGER NULL,
                    classification TEXT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(game_id) REFERENCES games(id)
                );

                CREATE TABLE position_analyses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fen TEXT NOT NULL,
                    analysis_json TEXT NOT NULL,
                    engine TEXT NULL,
                    depth INTEGER NULL,
                    schema_version TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX idx_moves_game_id ON moves(game_id);
                CREATE INDEX idx_moves_game_id_ply ON moves(game_id, ply);
                CREATE INDEX idx_position_analyses_fen ON position_analyses(fen);
                """
            )
            for row_id in (1, 2):
                connection.execute(
                    """
                    INSERT INTO position_analyses (
                        id,
                        fen,
                        analysis_json,
                        engine,
                        depth,
                        schema_version,
                        created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                    """,
                    (
                        row_id,
                        START_FEN,
                        json.dumps({"best_move": "e2e4", "legacy_id": row_id}),
                        "stockfish-placeholder",
                        12,
                        "v0",
                    ),
                )
            connection.commit()


if __name__ == "__main__":
    unittest.main()
