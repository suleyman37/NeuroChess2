from __future__ import annotations

import sqlite3
import threading
import time
import random
from contextlib import closing
from pathlib import Path
from typing import Callable, TypeVar

from neurochess.data.migrations import apply_migrations


DEFAULT_DB_PATH = Path("neurochess.db")
SQLITE_BUSY_TIMEOUT_MS = 30_000
SQLITE_LOCK_RETRY_DELAYS_SECONDS = (
    0.1,
    0.2,
    0.4,
    0.8,
    1.2,
    2.0,
    3.0,
    4.0,
    5.0,
    6.0,
)
SQLITE_LOCK_RETRY_JITTER_SECONDS = 0.05
SQLITE_WRITE_LOCK = threading.RLock()

T = TypeVar("T")


def get_connection(db_path: str | Path | None = None) -> sqlite3.Connection:
    """Open a SQLite connection with project defaults enabled."""
    path = Path(db_path) if db_path is not None else DEFAULT_DB_PATH

    if str(path) != ":memory:":
        path.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(path, timeout=SQLITE_BUSY_TIMEOUT_MS / 1000)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute(f"PRAGMA busy_timeout = {SQLITE_BUSY_TIMEOUT_MS}")
    if str(path) != ":memory:":
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute("PRAGMA synchronous = NORMAL")
    return connection


def init_db(db_path: str | Path | None = None) -> None:
    """Create or update the database schema."""
    with closing(get_connection(db_path)) as connection:
        apply_migrations(connection)


def is_sqlite_locked_error(exc: BaseException) -> bool:
    if not isinstance(exc, sqlite3.OperationalError):
        return False
    message = str(exc).lower()
    return "database is locked" in message or "database is busy" in message


def execute_with_retry(
    operation: Callable[[], T],
    delays: tuple[float, ...] = SQLITE_LOCK_RETRY_DELAYS_SECONDS,
) -> T:
    """Retry a short SQLite operation when the local DB is temporarily locked."""
    with SQLITE_WRITE_LOCK:
        for attempt, delay in enumerate((*delays, 0.0)):
            try:
                return operation()
            except sqlite3.OperationalError as exc:
                if not is_sqlite_locked_error(exc) or attempt >= len(delays):
                    raise
                jitter = random.uniform(
                    0.0,
                    min(SQLITE_LOCK_RETRY_JITTER_SECONDS, max(delay * 0.25, 0.0)),
                )
                time.sleep(delay + jitter)
        return operation()


def execute_sqlite_write_with_retry(
    operation: Callable[[], T],
    delays: tuple[float, ...] = SQLITE_LOCK_RETRY_DELAYS_SECONDS,
) -> T:
    """Serialize and retry a critical SQLite write section."""
    return execute_with_retry(operation, delays=delays)
