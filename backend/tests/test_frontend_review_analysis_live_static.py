from __future__ import annotations

import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SRC = PROJECT_ROOT / "frontend" / "src"
SCRIPTS_DIR = PROJECT_ROOT / "scripts"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


class FrontendReviewAnalysisLiveStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = read(FRONTEND_SRC / "App.tsx")
        self.review_panel = read(
            FRONTEND_SRC / "components" / "review" / "ReviewPanel.tsx"
        )
        self.helper = read(SCRIPTS_DIR / "browser_test_helpers.mjs")
        self.no_timer_smoke = read(
            SCRIPTS_DIR
            / "browser_review_analysis_from_ui_no_infinite_timer_smoke.mjs"
        )
        self.live_default_smoke = read(
            SCRIPTS_DIR / "browser_live_analysis_default_smoke.mjs"
        )
        self.live_pause_smoke = read(
            SCRIPTS_DIR / "browser_live_analysis_pauses_during_review_smoke.mjs"
        )
        self.no_spoiler_smoke = read(
            SCRIPTS_DIR / "browser_practice_no_live_spoiler_smoke.mjs"
        )

    def test_review_job_polling_has_frontend_watchdog_and_recovery_copy(self) -> None:
        for token in (
            "REVIEW_JOB_NO_PROGRESS_WATCHDOG_MS",
            "reviewJobLastProgressAtRef",
            "reviewJobProgressSignature",
            "reviewJobFrontendWatchdogMs",
            "makeFrontendStalledReviewJob",
            "makeFrontendIncompleteReviewJob",
            "review_job_frontend_watchdog",
            "frontend_no_progress_watchdog",
            "completed_without_review",
            "completed_review_fetch_failed",
            "Review incomplète. L'analyse est terminée",
            "Analyse interrompue temporairement. Tu peux reprendre l'analyse.",
            "setReviewError(reviewJobUserMessage(stalledJob))",
        ):
            self.assertIn(token, self.app)

        self.assertIn("review-progress", self.review_panel)
        self.assertIn("review-status", self.review_panel)
        self.assertIn("review-resume", self.review_panel)
        self.assertEqual(self.review_panel.count("Vous pouvez reprendre l'analyse."), 1)

    def test_live_analysis_is_enabled_for_review_but_paused_for_review_jobs(self) -> None:
        for token in (
            "const liveSuspendedForReview = reviewJobRunning",
            "Analyse live en pause pendant la Review",
            "startLiveAnalysis",
            "liveAnalysisTargetFen",
            "latest_payload",
            "boardEvaluationContext",
            "evaluationBarStateForBoardFen",
            'mode === "HISTORICAL"',
        ):
            self.assertIn(token, self.app)

        self.assertNotIn('liveSuspendedForReview = activeTab === "review"', self.app)

    def test_live_analysis_is_hidden_in_active_practice(self) -> None:
        for token in (
            "const liveSuspendedForPractice = reviewPracticeState?.active === true",
            "Analyse live en pause pendant l'exercice",
            "analyse live masquee pendant l'exercice",
            ': "Mode entrainement"',
        ):
            self.assertIn(token, self.app)

    def test_browser_smoke_scripts_cover_no_timer_live_pause_and_no_spoiler(self) -> None:
        for token in (
            "pollReviewJobToTerminal",
            "prepareReviewFixture",
            "openReviewFromPersistedState",
            "seedEligibleReviewMoment",
        ):
            self.assertIn(token, self.helper)

        for token in (
            "browser_review_analysis_from_ui_no_infinite_timer_smoke_latest.json",
            "HARD_DEADLINE_MS",
            "review_analysis_started_from_ui",
            "analysis_hard_deadline_no_infinite_timer",
            "terminal Review UI without active spinner",
            "activeSpinnerText",
            "statuses_seen",
            "progress_seen",
        ):
            self.assertIn(token, self.no_timer_smoke)

        for token in (
            "browser_live_analysis_default_smoke_latest.json",
            "live_analysis_visible_on_review_board",
            "review-exploration-start",
            "live_analysis_updates_after_review_exploration_move",
        ):
            self.assertIn(token, self.live_default_smoke)

        for token in (
            "browser_live_analysis_pauses_during_review_smoke_latest.json",
            "live_analysis_paused_during_review_job",
            "Analyse live en pause pendant la Review",
            "review_job_terminal_or_recoverable",
        ):
            self.assertIn(token, self.live_pause_smoke)

        for token in (
            "browser_practice_no_live_spoiler_smoke_latest.json",
            "practice_no_live_spoiler_before_attempt",
            "practice_attempt_saved_after_hidden_live",
            "review-practice-button",
        ):
            self.assertIn(token, self.no_spoiler_smoke)

    def test_no_forbidden_v1_labels_or_raw_engine_debug_in_live_ui_sources(self) -> None:
        combined = "\n".join([self.app, self.review_panel])
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
            "posterior Beta",
            "Stockfish WDL",
            "Evidence JSON",
        ):
            self.assertNotIn(forbidden, combined)
        self.assertNotIn("criticality_score</", combined)
        self.assertNotIn("diagnostic_gap</", combined)


if __name__ == "__main__":
    unittest.main()
