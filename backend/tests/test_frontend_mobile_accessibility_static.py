from __future__ import annotations

import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SRC = PROJECT_ROOT / "frontend" / "src"
SCRIPTS_DIR = PROJECT_ROOT / "scripts"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


class FrontendMobileAccessibilityStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = read(FRONTEND_SRC / "App.tsx")
        self.i18n = read(FRONTEND_SRC / "i18n" / "fr.ts")
        self.styles = read(FRONTEND_SRC / "styles.css")
        self.board = read(FRONTEND_SRC / "components" / "ChessBoardPanel.tsx")
        self.helper = read(SCRIPTS_DIR / "browser_test_helpers.mjs")
        self.mobile_smoke = read(SCRIPTS_DIR / "browser_mobile_responsive_smoke.mjs")
        self.keyboard_smoke = read(SCRIPTS_DIR / "browser_keyboard_accessibility_smoke.mjs")

    def test_mobile_responsive_css_contract_exists(self) -> None:
        for token in (
            "P1 mobile/a11y V1",
            "@media (max-width: 720px)",
            "grid-template-columns: repeat(3, minmax(0, 1fr))",
            "grid-template-columns: minmax(0, 1fr) !important",
            ".pgn-history-table",
            ".review-practice-summary-grid",
            "overflow-x: hidden",
            "min-height: 44px",
        ):
            self.assertIn(token, self.styles)

    def test_focus_reduced_motion_and_board_accessibility_exist(self) -> None:
        for token in (
            "prefers-reduced-motion",
            "button:focus-visible",
            ".board-panel:focus-visible",
            "a:focus-visible",
            "textarea:focus-visible",
        ):
            self.assertIn(token, self.styles)

        for token in (
            "aria-label={ariaLabel}",
            "aria-disabled={disabled}",
            "tabIndex={fen && !disabled ? 0 : -1}",
            "const horizontalMargin = window.innerWidth < 640 ? 32 : 120;",
            "Math.max(260, window.innerWidth - horizontalMargin)",
            "new ResizeObserver(updateBoardWidth)",
            "onSquareClick={handleSquareClick}",
        ):
            self.assertIn(token, self.board)

    def test_browser_helpers_support_mobile_and_keyboard_smokes(self) -> None:
        for token in (
            "async setViewport",
            "Emulation.setDeviceMetricsOverride",
            "Emulation.setTouchEmulationEnabled",
            "async assertNoHorizontalOverflow",
            "async pressKey",
            "async activeElementSnapshot",
        ):
            self.assertIn(token, self.helper)

    def test_mobile_and_keyboard_smoke_scripts_cover_required_flows(self) -> None:
        for token in (
            "browser_mobile_responsive_smoke_latest.json",
            "width: 390",
            "height: 844",
            "mobile_review_board_fits",
            "mobile_review_exploration_tap",
            "mobile_review_practice_attempt_saved",
            "mobile_daily_plan_attempt_saved",
            "mobile_profile_privacy_visible",
            "assertNoHorizontalOverflow",
            "assertMainNavExactly3",
            "assertTrainingExactly3",
        ):
            self.assertIn(token, self.mobile_smoke)

        for token in (
            "browser_keyboard_accessibility_smoke_latest.json",
            "focusByTabUntil",
            "keyboard_nav_today_focusable",
            "keyboard_nav_games_focusable",
            "keyboard_importer_focusable",
            "keyboard_pgn_textarea_focusable",
            "keyboard_practice_board_focusable",
            "keyboard_practice_hint_focusable",
            "keyboard_practice_reveal_focusable",
            "keyboard_practice_skip_focusable",
            "keyboard_reduced_motion_css_present",
        ):
            self.assertIn(token, self.keyboard_smoke)

    def test_plan2_navigation_and_training_contract_unchanged(self) -> None:
        for token in (
            'data-testid="main-nav"',
            'data-testid="nav-today"',
            'data-testid="nav-games"',
            'data-testid="nav-training"',
            "Aujourd'hui",
            "Mes parties",
            "Entra",
            'data-testid="profile-settings-button"',
            'data-testid="training-daily-plan-card"',
            'data-testid="training-failed-card"',
            'data-testid="training-due-card"',
        ):
            self.assertIn(token, self.app + self.i18n)
        self.assertNotIn('id="tab-review"', self.app)

    def test_no_forbidden_v1_labels_in_mobile_accessibility_sources(self) -> None:
        combined = "\n".join([
            self.app,
            self.i18n,
            self.styles,
            self.board,
            self.mobile_smoke,
            self.keyboard_smoke,
        ])
        for forbidden in (
            "NeuroMonitor",
            "Candidate Trainer",
            "Intent Layer",
            "LLM coach",
            "Transfer Gap",
            "ETV",
            "FSRS",
            "Cognitive Map",
            "SkillTrace score",
        ):
            self.assertNotIn(forbidden, combined)


if __name__ == "__main__":
    unittest.main()
