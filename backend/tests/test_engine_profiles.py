from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Any


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.engines.engine_profiles import (
    apply_engine_profile_options,
    engine_profile_for_name,
    review_hash_for_profile,
    review_multipv_for_profile,
    review_threads_for_profile,
)


class FakeOption:
    def __init__(
        self,
        default: Any = None,
        minimum: int | None = None,
        maximum: int | None = None,
    ) -> None:
        self.default = default
        self.min = minimum
        self.max = maximum


class FakeEngine:
    def __init__(self) -> None:
        self.options = {
            "Threads": FakeOption(default=1, minimum=1, maximum=16),
            "Hash": FakeOption(default=16, minimum=1, maximum=4096),
            "UCI_AnalyseMode": FakeOption(default=False),
            "UCI_LimitStrength": FakeOption(default=False),
            "Skill Level": FakeOption(default=20, minimum=0, maximum=20),
            "SyzygyPath": FakeOption(default=""),
        }
        self.configured: dict[str, Any] = {}

    def configure(self, values: dict[str, Any]) -> None:
        self.configured.update(values)


class EngineProfilesTests(unittest.TestCase):
    def test_review_profile_settings_are_explicit(self) -> None:
        self.assertEqual(review_threads_for_profile("standard"), 6)
        self.assertEqual(review_hash_for_profile("standard"), 1024)
        self.assertEqual(review_multipv_for_profile("standard"), 5)
        self.assertEqual(review_threads_for_profile("deep"), 8)
        self.assertEqual(review_hash_for_profile("deep"), 2048)
        self.assertEqual(review_multipv_for_profile("deep"), 5)
        self.assertEqual(review_multipv_for_profile("quick"), 5)

    def test_live_continuous_profile_is_not_time_budgeted(self) -> None:
        profile = engine_profile_for_name("live_continuous")

        self.assertEqual(profile.analysis_profile, "live_continuous")
        self.assertEqual(profile.threads, 4)
        self.assertEqual(profile.hash_mb, 512)
        self.assertEqual(profile.multipv, 1)
        self.assertEqual(profile.limit_mode, "continuous")

    def test_apply_engine_profile_options_reports_real_settings(self) -> None:
        engine = FakeEngine()

        report = apply_engine_profile_options(
            engine,
            "standard",
            requested_multipv=3,
            limit_mode="time",
        )

        self.assertEqual(engine.configured["Threads"], 6)
        self.assertEqual(engine.configured["Hash"], 1024)
        self.assertEqual(engine.configured["UCI_AnalyseMode"], True)
        self.assertEqual(engine.configured["UCI_LimitStrength"], False)
        self.assertEqual(engine.configured["Skill Level"], 20)
        self.assertEqual(report["threads"], 6)
        self.assertEqual(report["hash_mb"], 1024)
        self.assertEqual(report["multipv"], 3)
        self.assertEqual(report["analysis_limit_mode"], "time")
        self.assertEqual(report["uci_analyse_mode"], True)
        self.assertEqual(report["uci_limit_strength"], False)
        self.assertEqual(report["skill_level"], 20)


if __name__ == "__main__":
    unittest.main()
