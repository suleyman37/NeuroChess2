from __future__ import annotations

import sqlite3
from collections.abc import Callable


MigrationBody = tuple[str, ...] | Callable[[sqlite3.Connection], None]


def _table_columns(connection: sqlite3.Connection, table_name: str) -> set[str]:
    return {
        row["name"] if isinstance(row, sqlite3.Row) else row[1]
        for row in connection.execute(f"PRAGMA table_info({table_name})")
    }


def _add_column_if_missing(
    connection: sqlite3.Connection,
    table_name: str,
    column_name: str,
    definition: str,
) -> None:
    if column_name not in _table_columns(connection, table_name):
        connection.execute(
            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"
        )


def _apply_v3_5_durable_analysis_pipeline(connection: sqlite3.Connection) -> None:
    _add_column_if_missing(
        connection,
        "moves",
        "annotations",
        "TEXT NOT NULL DEFAULT '{}'",
    )

    before_count = connection.execute(
        "SELECT COUNT(*) FROM position_analyses"
    ).fetchone()[0]

    connection.execute("DROP INDEX IF EXISTS idx_position_analyses_fen")
    connection.execute("DROP INDEX IF EXISTS idx_position_analyses_unique_v3_5")
    connection.execute("ALTER TABLE position_analyses RENAME TO position_analyses_old")
    _create_v3_5_position_analyses(connection)
    _copy_position_analyses_rows(connection)
    after_count = connection.execute(
        "SELECT COUNT(*) FROM position_analyses"
    ).fetchone()[0]

    if after_count != before_count:
        raise RuntimeError(
            "position_analyses migration row count mismatch: "
            f"before={before_count}, after={after_count}"
        )

    connection.execute("DROP TABLE position_analyses_old")


def _create_v3_5_position_analyses(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE position_analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fen TEXT NOT NULL,
            analysis_json TEXT NOT NULL DEFAULT '{}',
            engine TEXT NOT NULL DEFAULT 'stockfish',
            depth INTEGER NOT NULL DEFAULT 12,
            schema_version TEXT NOT NULL DEFAULT 'engine_analysis_v2',
            created_at TEXT NOT NULL,
            engine_version TEXT NOT NULL DEFAULT 'unknown',
            multipv INTEGER NOT NULL DEFAULT 3,
            analysis_time_ms INTEGER NULL,
            reliability_score REAL NULL,
            reliability_label TEXT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK(status IN ('pending', 'running', 'done', 'failed')),
            error_message TEXT NULL,
            completed_at TIMESTAMP NULL,
            analysis_kind TEXT NOT NULL DEFAULT 'deep'
                CHECK(analysis_kind IN ('shallow', 'deep'))
        )
        """
    )
    connection.execute(
        "CREATE INDEX idx_position_analyses_fen ON position_analyses(fen)"
    )
    connection.execute(
        """
        CREATE UNIQUE INDEX idx_position_analyses_unique_v3_5
        ON position_analyses(
            fen,
            engine,
            engine_version,
            depth,
            multipv,
            analysis_kind,
            schema_version
        )
        """
    )


def _copy_position_analyses_rows(connection: sqlite3.Connection) -> None:
    rows = connection.execute(
        """
        SELECT
            id,
            fen,
            analysis_json,
            engine,
            depth,
            schema_version,
            created_at
        FROM position_analyses_old
        ORDER BY id
        """
    ).fetchall()

    seen_keys: set[tuple[str, str, str, int, int, str, str]] = set()

    for row in rows:
        row_id = int(row["id"])
        fen = row["fen"]
        engine = row["engine"] or "stockfish"
        depth = int(row["depth"] if row["depth"] is not None else 12)
        schema_version = row["schema_version"] or "engine_analysis_v2"
        engine_version = "unknown"
        multipv = 3
        analysis_kind = "deep"

        unique_key = (
            fen,
            engine,
            engine_version,
            depth,
            multipv,
            analysis_kind,
            schema_version,
        )
        if unique_key in seen_keys:
            engine_version = f"unknown-legacy-{row_id}"
            unique_key = (
                fen,
                engine,
                engine_version,
                depth,
                multipv,
                analysis_kind,
                schema_version,
            )
        seen_keys.add(unique_key)

        connection.execute(
            """
            INSERT INTO position_analyses (
                id,
                fen,
                analysis_json,
                engine,
                depth,
                schema_version,
                created_at,
                engine_version,
                multipv,
                status,
                analysis_kind
            )
            VALUES (?, ?, COALESCE(?, '{}'), ?, ?, ?, ?, ?, ?, 'done', ?)
            """,
            (
                row_id,
                fen,
                row["analysis_json"],
                engine,
                depth,
                schema_version,
                row["created_at"],
                engine_version,
                multipv,
                analysis_kind,
            ),
        )


V4_POST_GAME_REVIEW_MIGRATION: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS game_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        status TEXT NOT NULL
            CHECK(status IN ('pending', 'done', 'partial', 'failed')),
        review_schema_version TEXT NOT NULL DEFAULT 'post_game_review_v1',
        selection_algorithm_version TEXT NOT NULL DEFAULT 'moment_selection_v1',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        warnings_json TEXT NOT NULL DEFAULT '[]',
        UNIQUE(game_id, review_schema_version, selection_algorithm_version),
        FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS review_moments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id INTEGER NOT NULL,
        game_id INTEGER NOT NULL,
        move_id INTEGER NULL,
        ply INTEGER NOT NULL,
        played_by TEXT NOT NULL CHECK(played_by IN ('white', 'black')),
        side_to_move_before TEXT NOT NULL CHECK(side_to_move_before IN ('white', 'black')),
        fen_before TEXT NOT NULL,
        fen_after TEXT NOT NULL,
        played_uci TEXT NOT NULL,
        played_san TEXT NULL,
        best_move_uci TEXT NULL,
        best_move_san TEXT NULL,
        eval_before_cp INTEGER NULL,
        eval_after_cp INTEGER NULL,
        mate_before INTEGER NULL,
        mate_after INTEGER NULL,
        cp_loss INTEGER NOT NULL,
        cp_loss_label TEXT NOT NULL,
        importance_score REAL NOT NULL,
        reliability_score REAL NOT NULL,
        reliability_label TEXT NOT NULL,
        top_moves_json TEXT NOT NULL DEFAULT '[]',
        review_type TEXT NOT NULL CHECK(review_type = 'player_loss'),
        created_at TEXT NOT NULL,
        FOREIGN KEY(review_id) REFERENCES game_reviews(id) ON DELETE CASCADE,
        FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY(move_id) REFERENCES moves(id) ON DELETE SET NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_game_reviews_game_id ON game_reviews(game_id)",
    "CREATE INDEX IF NOT EXISTS idx_review_moments_review_id ON review_moments(review_id)",
    "CREATE INDEX IF NOT EXISTS idx_review_moments_game_id_ply ON review_moments(game_id, ply)",
)


V5_OPENING_DETECTION_MIGRATION: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS opening_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eco_code TEXT NULL,
        name TEXT NOT NULL,
        variation TEXT NULL,
        color TEXT NULL CHECK(color IN ('white', 'black', 'both') OR color IS NULL),
        parent_line_id INTEGER NULL,
        target_depth_plies INTEGER NOT NULL,
        pgn_canonical TEXT NULL,
        source TEXT NOT NULL DEFAULT 'internal_seed',
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        UNIQUE(name, variation),
        FOREIGN KEY(parent_line_id) REFERENCES opening_lines(id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS opening_line_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        line_id INTEGER NOT NULL,
        ply INTEGER NOT NULL,
        fen TEXT NOT NULL,
        fen_key TEXT NOT NULL,
        expected_move_uci TEXT NULL,
        expected_move_san TEXT NULL,
        alternatives_json TEXT NOT NULL DEFAULT '[]',
        note TEXT NULL,
        created_at TIMESTAMP,
        UNIQUE(line_id, ply, fen_key),
        FOREIGN KEY(line_id) REFERENCES opening_lines(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS game_opening_classifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        line_id INTEGER NULL,
        opening_name TEXT NULL,
        eco_code TEXT NULL,
        matched_plies INTEGER NOT NULL DEFAULT 0,
        last_book_ply INTEGER NULL,
        out_of_book_ply INTEGER NULL,
        out_of_book_color TEXT NULL CHECK(out_of_book_color IN ('white', 'black') OR out_of_book_color IS NULL),
        out_of_book_fen TEXT NULL,
        confidence TEXT NOT NULL DEFAULT 'unknown',
        classification_status TEXT NOT NULL DEFAULT 'unknown'
            CHECK(classification_status IN ('matched', 'partial', 'unknown', 'failed')),
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        UNIQUE(game_id),
        FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY(line_id) REFERENCES opening_lines(id) ON DELETE SET NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_opening_lines_eco_code ON opening_lines(eco_code)",
    "CREATE INDEX IF NOT EXISTS idx_opening_lines_name ON opening_lines(name)",
    "CREATE INDEX IF NOT EXISTS idx_opening_line_nodes_fen_key ON opening_line_nodes(fen_key)",
    "CREATE INDEX IF NOT EXISTS idx_opening_line_nodes_line_id ON opening_line_nodes(line_id)",
    "CREATE INDEX IF NOT EXISTS idx_opening_line_nodes_line_id_ply ON opening_line_nodes(line_id, ply)",
    "CREATE INDEX IF NOT EXISTS idx_game_opening_classifications_game_id ON game_opening_classifications(game_id)",
)


def _apply_v5_2_pgn_import(connection: sqlite3.Connection) -> None:
    game_columns = {
        "source": "TEXT NOT NULL DEFAULT 'local'",
        "source_platform": "TEXT NULL",
        "source_url": "TEXT NULL",
        "source_game_id": "TEXT NULL",
        "imported_at": "TEXT NULL",
        "moves_uci_hash": "TEXT NULL",
        "white_name": "TEXT NULL",
        "black_name": "TEXT NULL",
        "white_elo": "INTEGER NULL",
        "black_elo": "INTEGER NULL",
        "time_control": "TEXT NULL",
        "date_played": "TEXT NULL",
        "eco_code_pgn": "TEXT NULL",
        "opening_name_pgn": "TEXT NULL",
        "termination": "TEXT NULL",
        "user_color": (
            "TEXT NULL CHECK(user_color IN ('white','black') OR user_color IS NULL)"
        ),
        "opponent_name": "TEXT NULL",
        "result_from_user_pov": (
            "TEXT NULL CHECK(result_from_user_pov IN "
            "('win','loss','draw','unknown') OR result_from_user_pov IS NULL)"
        ),
    }
    for column_name, definition in game_columns.items():
        _add_column_if_missing(connection, "games", column_name, definition)

    move_columns = {
        "time_spent_ms": "INTEGER NULL",
        "white_clock_ms": "INTEGER NULL",
        "black_clock_ms": "INTEGER NULL",
        "clock_source": "TEXT NULL",
    }
    for column_name, definition in move_columns.items():
        _add_column_if_missing(connection, "moves", column_name, definition)

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS user_aliases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            username_normalized TEXT NOT NULL,
            platform TEXT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(username_normalized, platform)
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_games_source_url ON games(source_url)"
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_games_moves_uci_hash ON games(moves_uci_hash)"
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_games_date_played ON games(date_played)"
    )


def _apply_v5_2_2_game_history_categories(connection: sqlite3.Connection) -> None:
    _add_column_if_missing(connection, "games", "game_category", "TEXT NULL")
    _add_column_if_missing(connection, "games", "opponent_type", "TEXT NULL")

    connection.execute(
        """
        UPDATE games
        SET game_category =
            CASE
                WHEN source = 'pgn_import' AND user_color IS NOT NULL
                    THEN 'imported_user'
                WHEN source = 'pgn_import'
                    THEN 'imported_observed'
                WHEN opponent_type IN ('engine', 'bot')
                    THEN 'local_ai'
                WHEN source IS NULL OR source = 'local'
                    THEN 'local_manual'
                ELSE 'unknown'
            END
        WHERE game_category IS NULL
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_games_game_category ON games(game_category)"
    )


def _apply_v5_3a4_review_analysis_profiles(connection: sqlite3.Connection) -> None:
    analysis_columns = {
        "analysis_profile": "TEXT NULL",
        "requested_time_ms": "INTEGER NULL",
        "requested_depth": "INTEGER NULL",
        "requested_multipv": "INTEGER NULL",
        "analysis_limit_mode": "TEXT NULL",
        "settings_json": "TEXT NULL",
    }
    for column_name, definition in analysis_columns.items():
        _add_column_if_missing(
            connection,
            "position_analyses",
            column_name,
            definition,
        )

    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_position_analyses_profile
        ON position_analyses(fen, analysis_profile, status)
        """
    )


def _apply_v5_3a4c_review_jobs(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS review_jobs (
            job_id TEXT PRIMARY KEY,
            game_id INTEGER NOT NULL,
            profile TEXT NOT NULL,
            status TEXT NOT NULL
                CHECK(status IN ('queued', 'running', 'finalizing', 'completed', 'failed', 'cancelled', 'incomplete')),
            force_reanalysis INTEGER NOT NULL DEFAULT 0,
            required_position_count INTEGER NOT NULL DEFAULT 0,
            completed_position_count INTEGER NOT NULL DEFAULT 0,
            failed_position_count INTEGER NOT NULL DEFAULT 0,
            current_fen_index INTEGER NOT NULL DEFAULT 0,
            total_budget_seconds INTEGER NOT NULL DEFAULT 0,
            per_position_time_ms INTEGER NOT NULL DEFAULT 0,
            elapsed_seconds INTEGER NOT NULL DEFAULT 0,
            estimated_remaining_seconds INTEGER NOT NULL DEFAULT 0,
            can_cancel INTEGER NOT NULL DEFAULT 0,
            cancellation_requested INTEGER NOT NULL DEFAULT 0,
            error_message TEXT NULL,
            created_at TEXT NOT NULL,
            started_at TEXT NULL,
            updated_at TEXT NOT NULL,
            completed_at TEXT NULL,
            settings_json TEXT NOT NULL DEFAULT '{}',
            FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
        )
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_review_jobs_game_status
        ON review_jobs(game_id, status, created_at)
        """
    )


def _apply_v5_3a4d_review_job_hardening(connection: sqlite3.Connection) -> None:
    _add_column_if_missing(connection, "review_jobs", "failed_reason", "TEXT NULL")
    _add_column_if_missing(connection, "review_jobs", "last_error", "TEXT NULL")
    _add_column_if_missing(
        connection,
        "review_jobs",
        "retryable",
        "INTEGER NOT NULL DEFAULT 0",
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_review_jobs_game_profile_status
        ON review_jobs(game_id, profile, status, created_at)
        """
    )


def _apply_v5_3a4e_review_job_finalizing(connection: sqlite3.Connection) -> None:
    row = connection.execute(
        """
        SELECT sql
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'review_jobs'
        """
    ).fetchone()
    table_sql = str(row[0] if row else "")
    if "finalizing" in table_sql:
        return

    connection.execute("DROP INDEX IF EXISTS idx_review_jobs_game_status")
    connection.execute("DROP INDEX IF EXISTS idx_review_jobs_game_profile_status")
    connection.execute("ALTER TABLE review_jobs RENAME TO review_jobs_v5_3a4e_old")
    connection.execute(
        """
        CREATE TABLE review_jobs (
            job_id TEXT PRIMARY KEY,
            game_id INTEGER NOT NULL,
            profile TEXT NOT NULL,
            status TEXT NOT NULL
                CHECK(status IN ('queued', 'running', 'finalizing', 'completed', 'failed', 'cancelled', 'incomplete')),
            force_reanalysis INTEGER NOT NULL DEFAULT 0,
            required_position_count INTEGER NOT NULL DEFAULT 0,
            completed_position_count INTEGER NOT NULL DEFAULT 0,
            failed_position_count INTEGER NOT NULL DEFAULT 0,
            current_fen_index INTEGER NOT NULL DEFAULT 0,
            total_budget_seconds INTEGER NOT NULL DEFAULT 0,
            per_position_time_ms INTEGER NOT NULL DEFAULT 0,
            elapsed_seconds INTEGER NOT NULL DEFAULT 0,
            estimated_remaining_seconds INTEGER NOT NULL DEFAULT 0,
            can_cancel INTEGER NOT NULL DEFAULT 1,
            cancellation_requested INTEGER NOT NULL DEFAULT 0,
            error_message TEXT NULL,
            failed_reason TEXT NULL,
            last_error TEXT NULL,
            retryable INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            started_at TEXT NULL,
            completed_at TEXT NULL,
            updated_at TEXT NOT NULL,
            settings_json TEXT NOT NULL DEFAULT '{}'
        )
        """
    )
    connection.execute(
        """
        INSERT INTO review_jobs (
            job_id,
            game_id,
            profile,
            status,
            force_reanalysis,
            required_position_count,
            completed_position_count,
            failed_position_count,
            current_fen_index,
            total_budget_seconds,
            per_position_time_ms,
            elapsed_seconds,
            estimated_remaining_seconds,
            can_cancel,
            cancellation_requested,
            error_message,
            failed_reason,
            last_error,
            retryable,
            created_at,
            started_at,
            completed_at,
            updated_at,
            settings_json
        )
        SELECT
            job_id,
            game_id,
            profile,
            status,
            force_reanalysis,
            required_position_count,
            completed_position_count,
            failed_position_count,
            current_fen_index,
            total_budget_seconds,
            per_position_time_ms,
            elapsed_seconds,
            estimated_remaining_seconds,
            can_cancel,
            cancellation_requested,
            error_message,
            failed_reason,
            last_error,
            retryable,
            created_at,
            started_at,
            completed_at,
            updated_at,
            settings_json
        FROM review_jobs_v5_3a4e_old
        """
    )
    connection.execute("DROP TABLE review_jobs_v5_3a4e_old")
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_review_jobs_game_status
        ON review_jobs(game_id, status, created_at)
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_review_jobs_game_profile_status
        ON review_jobs(game_id, profile, status, created_at)
        """
    )


def _apply_v5_3a4f_review_job_watchdog(connection: sqlite3.Connection) -> None:
    row = connection.execute(
        """
        SELECT sql
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'review_jobs'
        """
    ).fetchone()
    table_sql = str(row[0] if row else "")

    columns = {
        column["name"]
        for column in connection.execute("PRAGMA table_info(review_jobs)").fetchall()
    }
    if "stalled" not in table_sql:
        connection.execute("DROP INDEX IF EXISTS idx_review_jobs_game_status")
        connection.execute("DROP INDEX IF EXISTS idx_review_jobs_game_profile_status")
        connection.execute("ALTER TABLE review_jobs RENAME TO review_jobs_v5_3a4f_old")
        connection.execute(
            """
            CREATE TABLE review_jobs (
                job_id TEXT PRIMARY KEY,
                game_id INTEGER NOT NULL,
                profile TEXT NOT NULL,
                status TEXT NOT NULL
                    CHECK(status IN ('queued', 'running', 'finalizing', 'completed', 'failed', 'cancelled', 'incomplete', 'stalled')),
                force_reanalysis INTEGER NOT NULL DEFAULT 0,
                required_position_count INTEGER NOT NULL DEFAULT 0,
                completed_position_count INTEGER NOT NULL DEFAULT 0,
                failed_position_count INTEGER NOT NULL DEFAULT 0,
                current_fen_index INTEGER NOT NULL DEFAULT 0,
                total_budget_seconds INTEGER NOT NULL DEFAULT 0,
                per_position_time_ms INTEGER NOT NULL DEFAULT 0,
                elapsed_seconds INTEGER NOT NULL DEFAULT 0,
                estimated_remaining_seconds INTEGER NOT NULL DEFAULT 0,
                can_cancel INTEGER NOT NULL DEFAULT 1,
                cancellation_requested INTEGER NOT NULL DEFAULT 0,
                error_message TEXT NULL,
                failed_reason TEXT NULL,
                last_error TEXT NULL,
                retryable INTEGER NOT NULL DEFAULT 0,
                heartbeat_at TEXT NULL,
                last_progress_at TEXT NULL,
                current_fen_key TEXT NULL,
                current_phase TEXT NULL,
                stalled_reason TEXT NULL,
                current_position_started_at TEXT NULL,
                attempts_for_current_position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                started_at TEXT NULL,
                completed_at TEXT NULL,
                updated_at TEXT NOT NULL,
                settings_json TEXT NOT NULL DEFAULT '{}'
            )
            """
        )
        connection.execute(
            """
            INSERT INTO review_jobs (
                job_id,
                game_id,
                profile,
                status,
                force_reanalysis,
                required_position_count,
                completed_position_count,
                failed_position_count,
                current_fen_index,
                total_budget_seconds,
                per_position_time_ms,
                elapsed_seconds,
                estimated_remaining_seconds,
                can_cancel,
                cancellation_requested,
                error_message,
                failed_reason,
                last_error,
                retryable,
                created_at,
                started_at,
                completed_at,
                updated_at,
                settings_json
            )
            SELECT
                job_id,
                game_id,
                profile,
                status,
                force_reanalysis,
                required_position_count,
                completed_position_count,
                failed_position_count,
                current_fen_index,
                total_budget_seconds,
                per_position_time_ms,
                elapsed_seconds,
                estimated_remaining_seconds,
                can_cancel,
                cancellation_requested,
                error_message,
                failed_reason,
                last_error,
                retryable,
                created_at,
                started_at,
                completed_at,
                updated_at,
                settings_json
            FROM review_jobs_v5_3a4f_old
            """
        )
        connection.execute("DROP TABLE review_jobs_v5_3a4f_old")
    else:
        _add_column_if_missing(connection, "review_jobs", "heartbeat_at", "TEXT NULL")
        _add_column_if_missing(connection, "review_jobs", "last_progress_at", "TEXT NULL")
        _add_column_if_missing(connection, "review_jobs", "current_fen_key", "TEXT NULL")
        _add_column_if_missing(connection, "review_jobs", "current_phase", "TEXT NULL")
        _add_column_if_missing(connection, "review_jobs", "stalled_reason", "TEXT NULL")
        _add_column_if_missing(
            connection,
            "review_jobs",
            "current_position_started_at",
            "TEXT NULL",
        )
        _add_column_if_missing(
            connection,
            "review_jobs",
            "attempts_for_current_position",
            "INTEGER NOT NULL DEFAULT 0",
        )

    if "heartbeat_at" not in columns:
        connection.execute(
            """
            UPDATE review_jobs
            SET heartbeat_at = COALESCE(heartbeat_at, updated_at),
                last_progress_at = COALESCE(last_progress_at, updated_at),
                current_phase = COALESCE(current_phase, status)
            """
        )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_review_jobs_game_status
        ON review_jobs(game_id, status, created_at)
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_review_jobs_game_profile_status
        ON review_jobs(game_id, profile, status, created_at)
        """
    )


def _apply_v5_2_pgn_r1_import_hardening(connection: sqlite3.Connection) -> None:
    game_columns = {
        "initial_fen": (
            "TEXT NULL DEFAULT "
            "'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'"
        ),
        "current_position_fen": "TEXT NULL",
        "variant": "TEXT NULL",
        "import_status": "TEXT NOT NULL DEFAULT 'ok'",
        "import_warnings_json": "TEXT NOT NULL DEFAULT '[]'",
        "import_error": "TEXT NULL",
    }
    for column_name, definition in game_columns.items():
        _add_column_if_missing(connection, "games", column_name, definition)

    connection.execute(
        """
        UPDATE games
        SET initial_fen = COALESCE(
                initial_fen,
                'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
            ),
            variant = COALESCE(variant, 'Standard'),
            import_status = COALESCE(import_status, 'ok'),
            import_warnings_json = COALESCE(import_warnings_json, '[]')
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_games_source_platform_game_id
        ON games(source_platform, source_game_id)
        """
    )

    row = connection.execute(
        """
        SELECT sql
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'game_opening_classifications'
        """
    ).fetchone()
    table_sql = str(row[0] if row else "")
    if "not_applicable_from_position" in table_sql:
        return

    connection.execute("DROP INDEX IF EXISTS idx_game_opening_classifications_game_id")
    connection.execute(
        "ALTER TABLE game_opening_classifications RENAME TO game_opening_classifications_v5_2_pgn_r1_old"
    )
    connection.execute(
        """
        CREATE TABLE game_opening_classifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL,
            line_id INTEGER NULL,
            opening_name TEXT NULL,
            eco_code TEXT NULL,
            matched_plies INTEGER NOT NULL DEFAULT 0,
            last_book_ply INTEGER NULL,
            out_of_book_ply INTEGER NULL,
            out_of_book_color TEXT NULL CHECK(out_of_book_color IN ('white', 'black') OR out_of_book_color IS NULL),
            out_of_book_fen TEXT NULL,
            confidence TEXT NOT NULL DEFAULT 'unknown',
            classification_status TEXT NOT NULL DEFAULT 'unknown'
                CHECK(classification_status IN ('matched', 'partial', 'unknown', 'failed', 'not_applicable_from_position')),
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            UNIQUE(game_id),
            FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY(line_id) REFERENCES opening_lines(id) ON DELETE SET NULL
        )
        """
    )
    connection.execute(
        """
        INSERT INTO game_opening_classifications (
            id,
            game_id,
            line_id,
            opening_name,
            eco_code,
            matched_plies,
            last_book_ply,
            out_of_book_ply,
            out_of_book_color,
            out_of_book_fen,
            confidence,
            classification_status,
            created_at,
            updated_at
        )
        SELECT
            id,
            game_id,
            line_id,
            opening_name,
            eco_code,
            matched_plies,
            last_book_ply,
            out_of_book_ply,
            out_of_book_color,
            out_of_book_fen,
            confidence,
            classification_status,
            created_at,
            updated_at
        FROM game_opening_classifications_v5_2_pgn_r1_old
        """
    )
    connection.execute("DROP TABLE game_opening_classifications_v5_2_pgn_r1_old")
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_game_opening_classifications_game_id
        ON game_opening_classifications(game_id)
        """
    )


def _apply_v5_2_pgn_r2_sindarov_legacy_repair(connection: sqlite3.Connection) -> None:
    _add_column_if_missing(
        connection,
        "games",
        "import_schema_version",
        "TEXT NULL",
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_games_import_schema_version
        ON games(import_schema_version)
        """
    )


def _apply_v5_3_a5_1_r1_review_score_cache(connection: sqlite3.Connection) -> None:
    _add_column_if_missing(
        connection,
        "game_reviews",
        "score_json",
        "TEXT NULL",
    )


def _apply_v5_3_d1_review_practice_sessions(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS review_practice_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL,
            review_id INTEGER NULL,
            pov TEXT NOT NULL,
            status TEXT NOT NULL
                CHECK(status IN ('running', 'completed', 'abandoned')),
            item_count INTEGER NOT NULL DEFAULT 0,
            correct_count INTEGER NOT NULL DEFAULT 0,
            partial_count INTEGER NOT NULL DEFAULT 0,
            wrong_count INTEGER NOT NULL DEFAULT 0,
            revealed_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            completed_at TEXT NULL,
            schema_version TEXT NOT NULL,
            FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY(review_id) REFERENCES game_reviews(id) ON DELETE SET NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS review_practice_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            game_id INTEGER NOT NULL,
            ply INTEGER NOT NULL,
            color TEXT NOT NULL,
            attempted_uci TEXT NULL,
            attempted_san TEXT NULL,
            expected_best_uci TEXT NULL,
            result TEXT NOT NULL
                CHECK(result IN (
                    'best',
                    'very_good',
                    'acceptable',
                    'wrong',
                    'illegal',
                    'skipped',
                    'revealed'
                )),
            attempt_number INTEGER NOT NULL,
            evidence_snapshot_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES review_practice_sessions(id)
                ON DELETE CASCADE,
            FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
        )
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_review_practice_sessions_game
        ON review_practice_sessions(game_id, created_at)
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_review_practice_attempts_session
        ON review_practice_attempts(session_id, ply, attempt_number)
        """
    )


def _apply_v5_3_d1_r1_review_practice_skip_count(connection: sqlite3.Connection) -> None:
    _add_column_if_missing(
        connection,
        "review_practice_sessions",
        "skipped_count",
        "INTEGER NOT NULL DEFAULT 0",
    )


def _apply_v5_3_d2_review_practice_session_items(connection: sqlite3.Connection) -> None:
    _add_column_if_missing(
        connection,
        "review_practice_sessions",
        "scope",
        "TEXT NOT NULL DEFAULT 'top_priority'",
    )
    _add_column_if_missing(
        connection,
        "review_practice_sessions",
        "items_json",
        "TEXT NULL",
    )


def _apply_v5_5_learning_loop_practice_event_fields(connection: sqlite3.Connection) -> None:
    _add_column_if_missing(
        connection,
        "review_practice_attempts",
        "item_id",
        "TEXT NULL",
    )
    _add_column_if_missing(
        connection,
        "review_practice_attempts",
        "time_spent_ms",
        "INTEGER NULL",
    )
    _add_column_if_missing(
        connection,
        "review_practice_attempts",
        "hint_used",
        "INTEGER NOT NULL DEFAULT 0",
    )
    _add_column_if_missing(
        connection,
        "review_practice_attempts",
        "reveal_used",
        "INTEGER NOT NULL DEFAULT 0",
    )
    _add_column_if_missing(
        connection,
        "review_practice_attempts",
        "source_context",
        "TEXT NOT NULL DEFAULT 'review_practice'",
    )
    _add_column_if_missing(
        connection,
        "review_practice_attempts",
        "due_at",
        "TEXT NULL",
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_review_practice_attempts_game_due
        ON review_practice_attempts(game_id, due_at)
        """
    )


def _apply_v5_6_training_items_daily_plan(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS training_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_type TEXT NOT NULL,
            source_game_id INTEGER NOT NULL,
            source_ply INTEGER NOT NULL,
            source_moment_id INTEGER NULL,
            fen TEXT NOT NULL,
            side_to_move TEXT NOT NULL,
            best_move TEXT NOT NULL,
            accepted_moves_json TEXT NOT NULL DEFAULT '[]',
            domain TEXT NOT NULL DEFAULT 'unknown',
            primary_tag TEXT NOT NULL DEFAULT 'unknown',
            secondary_tags_json TEXT NOT NULL DEFAULT '[]',
            difficulty_proxy REAL NULL,
            criticality_score REAL NOT NULL DEFAULT 0.0,
            explanation_short TEXT NULL,
            takeaway TEXT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            FOREIGN KEY(source_game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY(source_moment_id) REFERENCES review_moments(id) ON DELETE SET NULL
        )
        """
    )
    connection.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_training_items_source_game_ply
        ON training_items(source_game_id, source_ply)
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_training_items_status_created
        ON training_items(status, created_at)
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_training_items_game
        ON training_items(source_game_id, source_ply)
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_plan_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL DEFAULT 'local',
            plan_date TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            order_index INTEGER NOT NULL,
            selection_reason TEXT NOT NULL,
            selection_score REAL NOT NULL DEFAULT 0.0,
            source_bucket TEXT NOT NULL
                CHECK(source_bucket IN (
                    'due',
                    'failed_recent',
                    'recent_critical',
                    'diversity_fill',
                    'manual'
                )),
            created_at TEXT NOT NULL,
            FOREIGN KEY(item_id) REFERENCES training_items(id) ON DELETE CASCADE
        )
        """
    )
    connection.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_plan_items_user_date_item
        ON daily_plan_items(user_id, plan_date, item_id)
        """
    )
    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_daily_plan_items_user_date_order
        ON daily_plan_items(user_id, plan_date, order_index)
        """
    )


MIGRATIONS: tuple[tuple[str, MigrationBody], ...] = (
    (
        "0001_v0_schema",
        (
            """
            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                completed_at TEXT NULL,
                mode TEXT NOT NULL,
                opponent_type TEXT NULL,
                opponent_level INTEGER NULL,
                result TEXT NULL,
                pgn TEXT NULL,
                completed INTEGER NOT NULL DEFAULT 0
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS moves (
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
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS position_analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fen TEXT NOT NULL,
                analysis_json TEXT NOT NULL,
                engine TEXT NULL,
                depth INTEGER NULL,
                schema_version TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_moves_game_id ON moves(game_id)",
            "CREATE INDEX IF NOT EXISTS idx_moves_game_id_ply ON moves(game_id, ply)",
            "CREATE INDEX IF NOT EXISTS idx_position_analyses_fen ON position_analyses(fen)",
        ),
    ),
    (
        "0002_v3_5_durable_analysis_pipeline",
        _apply_v3_5_durable_analysis_pipeline,
    ),
    (
        "0003_v4_post_game_review",
        V4_POST_GAME_REVIEW_MIGRATION,
    ),
    (
        "0004_v5_opening_detection",
        V5_OPENING_DETECTION_MIGRATION,
    ),
    (
        "0005_v5_2_pgn_import",
        _apply_v5_2_pgn_import,
    ),
    (
        "0006_v5_2_2_game_history_categories",
        _apply_v5_2_2_game_history_categories,
    ),
    (
        "0007_v5_3a4_review_analysis_profiles",
        _apply_v5_3a4_review_analysis_profiles,
    ),
    (
        "0008_v5_3a4c_review_jobs",
        _apply_v5_3a4c_review_jobs,
    ),
    (
        "0009_v5_3a4d_review_job_hardening",
        _apply_v5_3a4d_review_job_hardening,
    ),
    (
        "0010_v5_3a4e_review_job_finalizing",
        _apply_v5_3a4e_review_job_finalizing,
    ),
    (
        "0011_v5_3a4f_review_job_watchdog",
        _apply_v5_3a4f_review_job_watchdog,
    ),
    (
        "0012_v5_2_pgn_r1_import_hardening",
        _apply_v5_2_pgn_r1_import_hardening,
    ),
    (
        "0013_v5_2_pgn_r2_sindarov_legacy_repair",
        _apply_v5_2_pgn_r2_sindarov_legacy_repair,
    ),
    (
        "0014_v5_3_a5_1_r1_review_score_cache",
        _apply_v5_3_a5_1_r1_review_score_cache,
    ),
    (
        "0015_v5_3_d1_review_practice_sessions",
        _apply_v5_3_d1_review_practice_sessions,
    ),
    (
        "0016_v5_3_d1_r1_review_practice_skip_count",
        _apply_v5_3_d1_r1_review_practice_skip_count,
    ),
    (
        "0017_v5_3_d2_review_practice_session_items",
        _apply_v5_3_d2_review_practice_session_items,
    ),
    (
        "0018_v5_5_learning_loop_practice_event_fields",
        _apply_v5_5_learning_loop_practice_event_fields,
    ),
    (
        "0019_v5_6_training_items_daily_plan",
        _apply_v5_6_training_items_daily_plan,
    ),
)


def ensure_schema_migrations(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        )
        """
    )


def apply_migrations(connection: sqlite3.Connection) -> None:
    """Apply pending idempotent migrations without deleting existing data."""
    ensure_schema_migrations(connection)
    connection.commit()
    applied = {
        row["id"]
        for row in connection.execute("SELECT id FROM schema_migrations").fetchall()
    }

    for migration_id, migration_body in MIGRATIONS:
        if migration_id in applied:
            continue

        try:
            connection.execute("BEGIN")

            if callable(migration_body):
                migration_body(connection)
            else:
                for statement in migration_body:
                    connection.execute(statement)

            connection.execute(
                """
                INSERT INTO schema_migrations (id, applied_at)
                VALUES (?, datetime('now'))
                """,
                (migration_id,),
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise

    connection.commit()
