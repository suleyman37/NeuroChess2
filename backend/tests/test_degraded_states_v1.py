from __future__ import annotations

import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from neurochess.data.database import init_db
from neurochess.pgn_import_service import PgnImportService


FRONTEND_SRC = PROJECT_ROOT / "frontend" / "src"
DOCS_DIR = PROJECT_ROOT / "docs"

SIMPLE_PGN = """[Event "Degraded State Duplicate"]
[Site "https://lichess.org/degradedstate"]
[Date "2026.05.05"]
[White "UserA"]
[Black "OpponentB"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 *
"""

ILLEGAL_PGN = """[Event "Broken"]
[Site "?"]
[Date "2026.05.05"]
[White "Bad"]
[Black "Parser"]
[Result "*"]

1. e5 *
"""


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class DegradedStatesStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = read(FRONTEND_SRC / "App.tsx")
        self.state_notice = read(FRONTEND_SRC / "components" / "StateNotice.tsx")
        self.degraded_states = read(FRONTEND_SRC / "degradedStates.ts")
        self.i18n = read(FRONTEND_SRC / "i18n" / "fr.ts")
        self.practice_panel = read(
            FRONTEND_SRC / "components" / "review" / "ReviewPracticePanel.tsx"
        )
        self.styles = read(FRONTEND_SRC / "styles.css")

    def test_state_notice_hides_debug_details_by_default(self) -> None:
        for token in (
            "export function StateNotice",
            "data-testid={testId}",
            '<details className="state-notice-details">',
            "<summary>Détails techniques</summary>",
            'role={variant === "danger" ? "alert" : "status"}',
        ):
            self.assertIn(token, self.state_notice)

    def test_import_daily_plan_and_practice_degraded_states_are_wired(self) -> None:
        for token in (
            "buildPgnImportNotice",
            "buildDailyPlanNotice",
            'setPgnImportError("IMPORT_EMPTY_PGN")',
            'testId="degraded-import-notice"',
            'testId="degraded-daily-plan-notice"',
            "IMPORT_DUPLICATE_GAME",
            "DAILY_PLAN_EMPTY",
            "PRACTICE_ATTEMPT_SAVE_FAILED",
            "ANTI_TILT_REPEATED_WRONG",
            'testId="anti-tilt-repeated-wrong-notice"',
            'testId="practice-save-failed-notice"',
            'testId="practice-illegal-move-notice"',
        ):
            self.assertIn(token, "\n".join([self.app, self.degraded_states, self.practice_panel, self.i18n]))

    def test_required_v1_copy_is_present_and_calm(self) -> None:
        combined = "\n".join([self.degraded_states, self.practice_panel, self.i18n])
        for copy in (
            "Colle une partie pour commencer",
            "PGN non reconnu",
            "Un coup n’est pas légal",
            "Partie déjà importée",
            "NeuroChess local ne répond pas",
            "Tentative non enregistrée",
            "Plan en construction",
            "Plan court aujourd’hui",
            "Cette position est difficile. Prends ton temps",
            "Bonne décision de regarder. Cette position reviendra bientôt.",
            "Ces positions reviendront au bon moment.",
        ):
            self.assertIn(copy, combined)
        for blaming_copy in ("tu as échoué", "humiliant", "streak perdu", "encore raté"):
            self.assertNotIn(blaming_copy, combined.lower())
        self.assertNotRegex(combined.lower(), r"\bnul\b")

    def test_state_notice_styles_exist(self) -> None:
        for token in (
            ".state-notice",
            ".state-notice-warning",
            ".state-notice-danger",
            ".state-notice-success",
            ".state-notice-details",
        ):
            self.assertIn(token, self.styles)

    def test_forbidden_v1_labels_are_not_added_to_user_facing_sources(self) -> None:
        combined = "\n".join([self.app, self.state_notice, self.degraded_states, self.practice_panel, self.i18n])
        for forbidden in (
            "NeuroMonitor",
            "Candidate Trainer",
            "Intent Layer",
            "LLM coach",
            "Transfer Gap",
            "ETV",
            "FSRS",
            "Cognitive Map",
        ):
            self.assertNotIn(forbidden, combined)


class DegradedPgnImportServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess-degraded-pgn-"))
        self.db_path = self.temp_dir / "test_neurochess.db"
        init_db(self.db_path)
        self.opening_patch = patch("neurochess.pgn_import_service.OpeningService")
        self.opening_cls = self.opening_patch.start()
        self.opening_cls.return_value.classify_game_opening.return_value = {"status": "ok"}
        self.service = PgnImportService(self.db_path)

    def tearDown(self) -> None:
        self.opening_patch.stop()
        shutil.rmtree(self.temp_dir)

    def test_invalid_pgn_preview_returns_safe_counts_and_errors(self) -> None:
        preview = self.service.preview_import("not a pgn at all")

        self.assertEqual(preview["valid_count"], 0)
        self.assertEqual(preview["invalid_count"], 1)
        self.assertGreaterEqual(len(preview["errors"]), 1)
        self.assertIn("no mainline moves", preview["errors"][0])

    def test_illegal_pgn_preview_returns_illegal_move_error_without_crash(self) -> None:
        preview = self.service.preview_import(ILLEGAL_PGN)

        self.assertEqual(preview["valid_count"], 0)
        self.assertEqual(preview["invalid_count"], 1)
        self.assertGreaterEqual(len(preview["errors"]), 1)
        self.assertIn("illegal san", preview["errors"][0])

    def test_duplicate_import_is_reported_without_new_game(self) -> None:
        first = self.service.import_pgn(SIMPLE_PGN, user_alias="UserA", platform="lichess")
        second = self.service.import_pgn(SIMPLE_PGN, user_alias="UserA", platform="lichess")

        self.assertEqual(first["imported_count"], 1)
        self.assertEqual(second["imported_count"], 0)
        self.assertEqual(second["duplicate_count"], 1)
        self.assertEqual(second["invalid_count"], 0)


class DegradedStatesContractDocTests(unittest.TestCase):
    def test_contract_document_lists_required_state_ids(self) -> None:
        contract_path = DOCS_DIR / "DEGRADED_STATES_CONTRACT.md"
        if not contract_path.exists():
            self.fail("docs/DEGRADED_STATES_CONTRACT.md is required")
        contract = read(contract_path)
        for state_id in (
            "IMPORT_EMPTY_PGN",
            "IMPORT_INVALID_PGN",
            "IMPORT_ILLEGAL_MOVES",
            "ENGINE_STALLED_RESUMABLE",
            "BACKEND_UNAVAILABLE",
            "REVIEW_NO_MOMENTS",
            "PRACTICE_ATTEMPT_SAVE_FAILED",
            "DAILY_PLAN_EMPTY",
            "EXPORT_FAILED",
            "ANTI_TILT_REPEATED_WRONG",
        ):
            self.assertIn(state_id, contract)


if __name__ == "__main__":
    unittest.main()
