from __future__ import annotations

import os
from pathlib import Path


DEFAULT_ANALYSIS_DEPTH = 12
DEFAULT_MULTIPV = 3


def bundled_stockfish_path() -> Path:
    return Path(__file__).resolve().parents[1] / "stockfish.exe"


def resolve_stockfish_path(
    env: dict[str, str] | None = None,
    bundled_path: str | Path | None = None,
    os_name: str | None = None,
) -> str:
    environment = env if env is not None else os.environ
    configured_path = environment.get("NEUROCHESS_STOCKFISH_PATH")
    if configured_path:
        return configured_path

    bundled_stockfish = (
        Path(bundled_path) if bundled_path is not None else bundled_stockfish_path()
    )
    if bundled_stockfish.exists():
        return str(bundled_stockfish)

    platform_name = os_name if os_name is not None else os.name
    return "stockfish.exe" if platform_name == "nt" else "stockfish"


STOCKFISH_PATH = resolve_stockfish_path()
