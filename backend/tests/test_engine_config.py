from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.engines.engine_config import (
    bundled_stockfish_path,
    resolve_stockfish_path,
)
from neurochess.engines.fake_engine import FakeStockfishService


class EngineConfigTests(unittest.TestCase):
    def test_env_stockfish_path_has_priority(self) -> None:
        configured_path = r"C:\custom\stockfish.exe"
        with tempfile.TemporaryDirectory() as temp_dir:
            bundled_path = Path(temp_dir) / "stockfish.exe"
            bundled_path.write_text("", encoding="utf-8")

            resolved = resolve_stockfish_path(
                env={"NEUROCHESS_STOCKFISH_PATH": configured_path},
                bundled_path=bundled_path,
                os_name="nt",
            )

        self.assertEqual(resolved, configured_path)

    def test_bundled_stockfish_is_used_when_env_is_absent(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            bundled_path = Path(temp_dir) / "stockfish.exe"
            bundled_path.write_text("", encoding="utf-8")

            resolved = resolve_stockfish_path(
                env={},
                bundled_path=bundled_path,
                os_name="nt",
            )

        self.assertEqual(resolved, str(bundled_path))

    def test_windows_fallback_is_used_when_no_env_or_bundled_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            missing_bundled = Path(temp_dir) / "stockfish.exe"

            resolved = resolve_stockfish_path(
                env={},
                bundled_path=missing_bundled,
                os_name="nt",
            )

        self.assertEqual(resolved, "stockfish.exe")

    def test_non_windows_fallback_is_used_when_no_env_or_bundled_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            missing_bundled = Path(temp_dir) / "stockfish.exe"

            resolved = resolve_stockfish_path(
                env={},
                bundled_path=missing_bundled,
                os_name="posix",
            )

        self.assertEqual(resolved, "stockfish")

    def test_project_bundled_path_points_to_neurochess_stockfish(self) -> None:
        expected = BACKEND_ROOT / "neurochess" / "stockfish.exe"

        self.assertEqual(bundled_stockfish_path(), expected)

    def test_fake_engine_timeout_hook_is_test_only_and_retryable(self) -> None:
        FakeStockfishService.reset_state()
        with patch.dict("os.environ", {"FAKE_ENGINE_TIMEOUT_ON_INDEX": "1"}):
            engine = FakeStockfishService()
            with self.assertRaisesRegex(RuntimeError, "engine_hard_timeout"):
                engine.analyze_fen(
                    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                    depth=18,
                    multipv=3,
                    analysis_profile="standard",
                )

        engine = FakeStockfishService()
        result = engine.analyze_fen(
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            depth=18,
            multipv=3,
            analysis_profile="standard",
        )
        self.assertEqual(result["engine_version"], "FakeFish deterministic v5.3.A4g")


if __name__ == "__main__":
    unittest.main()
