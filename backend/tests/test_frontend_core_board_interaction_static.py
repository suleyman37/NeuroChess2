from __future__ import annotations

import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SRC = PROJECT_ROOT / "frontend" / "src"
REVIEW_DIR = FRONTEND_SRC / "components" / "review"
SCRIPTS_DIR = PROJECT_ROOT / "scripts"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


class FrontendCoreBoardInteractionStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = read(FRONTEND_SRC / "App.tsx")
        self.i18n = read(FRONTEND_SRC / "i18n" / "fr.ts")
        self.board = read(FRONTEND_SRC / "components" / "ChessBoardPanel.tsx")
        self.practice = read(REVIEW_DIR / "ReviewPracticePanel.tsx")
        self.summary = read(REVIEW_DIR / "ReviewCockpitSummary.tsx")
        self.panel = read(REVIEW_DIR / "ReviewPanel.tsx")

    def test_board_supports_click_click_drag_and_stable_test_selectors(self) -> None:
        for token in (
            "onPieceDrop={handlePieceDrop}",
            "onSquareClick={handleSquareClick}",
            "boardOrientation={orientation}",
            "data-board-orientation={orientation}",
            "data-board-fen={fen ?? \"\"}",
            "data-testid={testId}",
            "buildClickSquareStyles",
            "submitMove(selectedSquare, square",
        ):
            self.assertIn(token, self.board)

        for token in (
            'testId={boardTestId}',
            '? "practice-board"',
            '? "review-board"',
            ': "game-board"',
            "boardOrientation",
        ):
            self.assertIn(token, self.app)

    def test_practice_has_real_attempt_path_not_only_reveal_path(self) -> None:
        self.assertIn("async function handlePracticeAttempt", self.app)
        self.assertIn("await handlePracticeAttempt(uci)", self.app)
        self.assertIn("recordReviewPracticeAttempt", self.app)
        self.assertIn("summary.attempt_feedback", self.app)
        self.assertIn('data-testid="practice-panel"', self.practice)
        self.assertIn('data-testid="practice-feedback"', self.practice)
        self.assertIn('data-testid="practice-reveal-button"', self.practice)
        self.assertIn('data-testid="practice-next-button"', self.practice)
        self.assertNotIn("function evaluateTryMoveAttempt", self.app)

    def test_review_local_exploration_mode_is_present_and_not_practice(self) -> None:
        for token in (
            "ReviewExplorationState",
            "startReviewExploration",
            "handleReviewExplorationMove",
            "undoReviewExplorationMove",
            "resetReviewExploration",
            'data-testid="review-exploration-start"',
            'data-testid="review-exploration-panel"',
            'data-testid="review-exploration-feedback"',
            'data-testid="review-exploration-undo"',
            'data-testid="review-exploration-reset"',
            'data-testid="review-exploration-exit"',
            "!reviewExplorationActive",
            "reviewExplorationActive ? [] : reviewBoardArrows",
        ):
            self.assertIn(token, self.app)
        for token in (
            "Exploration locale",
            "Rien n'est enregistré comme",
        ):
            self.assertIn(token, self.i18n)

        exploration_block_start = self.app.index("function handleReviewExplorationMove")
        exploration_block_end = self.app.index("async function handleMove")
        exploration_block = self.app[exploration_block_start:exploration_block_end]
        self.assertIn("new Chess(state.currentFen)", exploration_block)
        self.assertIn("board.move", exploration_block)
        self.assertNotIn("recordReviewPracticeAttempt", exploration_block)
        self.assertNotIn("due_at", exploration_block)

    def test_review_and_training_selectors_keep_plan2_contract(self) -> None:
        for token in (
            'data-testid="app-root"',
            'data-testid="main-nav"',
            'data-testid="nav-today"',
            'data-testid="nav-games"',
            'data-testid="nav-training"',
            'data-testid="profile-settings-button"',
            'data-testid="training-daily-plan-card"',
            'data-testid="training-failed-card"',
            'data-testid="training-due-card"',
            'data-testid="review-summary"',
            'data-testid="review-moment-card"',
            'data-testid="review-practice-button"',
        ):
            self.assertIn(token, self.app + self.summary + self.practice)

        for label in ("Aujourd'hui", "Mes parties", "Entra"):
            self.assertIn(label, self.app + self.i18n)
        self.assertNotIn('id="tab-review"', self.app)
        self.assertNotIn("Profil / ParamÃ¨tres</button>\n          </nav>", self.app)

    def test_stalled_analysis_retry_copy_is_not_duplicated(self) -> None:
        self.assertIn("REVIEW_RETRY_COPY", self.panel)
        self.assertIn("!reviewJob.error_message?.includes(REVIEW_RETRY_COPY)", self.panel)
        self.assertEqual((self.panel + self.i18n).count("Vous pouvez reprendre l'analyse."), 1)

    def test_no_forbidden_v1_or_raw_debug_labels_in_main_sources(self) -> None:
        combined = "\n".join([self.app, self.board, self.practice, self.summary, self.panel, self.i18n])
        for forbidden_label in (
            "Candidate Trainer",
            "Intent Layer",
            "Transfer Gap",
            "LLM coach",
            "NeuroMonitor",
            "brain",
            "cortex",
            "atlas",
            "SkillTrace score",
            "ETV",
            "FSRS",
            "posterior Beta",
            "Stockfish WDL",
            "Evidence JSON",
        ):
            self.assertNotIn(forbidden_label, combined)
        self.assertNotIn("criticality_score</", combined)
        self.assertNotIn("diagnostic_gap</", combined)

    def test_browser_smoke_scripts_exist_for_real_board_interaction(self) -> None:
        helper = read(SCRIPTS_DIR / "browser_test_helpers.mjs")
        core_smoke = read(SCRIPTS_DIR / "browser_core_board_interaction_smoke.mjs")
        stall_smoke = read(SCRIPTS_DIR / "browser_analysis_stall_recovery_smoke.mjs")
        exploration_smoke = read(SCRIPTS_DIR / "browser_review_exploration_real_smoke.mjs")
        no_infinite_smoke = read(SCRIPTS_DIR / "browser_real_analysis_no_infinite_loop_smoke.mjs")

        for token in (
            "tryMoveByClickClick",
            "tryMoveByDragDrop",
            "getSquareCenter",
            "assertAttemptSaved",
        ):
            self.assertIn(token, helper + core_smoke)

        for token in (
            "correct_attempt_saved",
            "wrong_attempt_saved",
            "illegal_attempt_saved",
            "daily_plan_board_attempt_saved",
        ):
            self.assertIn(token, core_smoke)

        self.assertIn("FAKE_ENGINE_TIMEOUT_ON_INDEX", stall_smoke)
        self.assertIn("Vous pouvez reprendre l'analyse.", stall_smoke)
        self.assertIn("review-exploration-start", exploration_smoke)
        self.assertIn("attempts_after_exploration", exploration_smoke)
        self.assertIn("browser_real_analysis_no_infinite_loop", no_infinite_smoke)
        self.assertIn("hard_deadline_ms", no_infinite_smoke)


if __name__ == "__main__":
    unittest.main()
