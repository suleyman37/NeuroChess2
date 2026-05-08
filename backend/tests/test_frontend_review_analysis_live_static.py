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
        self.i18n = read(FRONTEND_SRC / "i18n" / "fr.ts")
        self.review_panel = read(
            FRONTEND_SRC / "components" / "review" / "ReviewPanel.tsx"
        )
        self.helper = read(SCRIPTS_DIR / "browser_test_helpers.mjs")
        self.no_timer_smoke = read(
            SCRIPTS_DIR
            / "browser_review_analysis_from_ui_no_infinite_timer_smoke.mjs"
        )
        self.standard_last_ply_smoke = read(
            SCRIPTS_DIR / "browser_standard_analysis_last_ply_no_hang_smoke.mjs"
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
            self.assertIn(token, self.app + self.i18n)

        self.assertIn("review-progress", self.review_panel)
        self.assertIn("review-status", self.review_panel)
        self.assertIn("review-resume", self.review_panel)
        self.assertEqual((self.review_panel + self.i18n).count("Vous pouvez reprendre l'analyse."), 1)

    def test_review_job_timer_uses_stable_job_timestamp_not_progress_only(self) -> None:
        for token in (
            "reviewJobElapsedSeconds",
            "stableStartedAt",
            "job.started_at ?? job.created_at",
            "Date.now() - parsedStartedAt",
            "Temps écoulé : {elapsedSeconds}s",
        ):
            self.assertIn(token, self.review_panel)

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
            self.assertIn(token, self.app + self.i18n)

        self.assertNotIn('liveSuspendedForReview = activeTab === "review"', self.app)

    def test_live_analysis_is_hidden_in_active_practice(self) -> None:
        for token in (
            "const liveSuspendedForPractice = reviewPracticeState?.active === true",
            "fr.liveAnalysis.pausedDuringPractice",
            "fr.liveAnalysis.hiddenDuringPractice",
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
            "browser_standard_analysis_last_ply_no_hang",
            "P0_STANDARD_ANALYSIS_LAST_PLY_HANG_ROOT_CAUSE_FIX_V1",
            "standard_job_poll_trace.jsonl",
            "deep_job_poll_trace.jsonl",
            "NEUROCHESS_ENGINE_MODE: \"\"",
            "standard_backend_elapsed_monotonic",
            "standard_ui_timer_monotonic",
            "02_standard_analysis_mid_progress",
            "03_standard_analysis_last_move_or_finalizing",
            "07_deep_analysis_completed",
        ):
            self.assertIn(token, self.standard_last_ply_smoke)

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
        combined = "\n".join([self.app, self.review_panel, self.i18n])
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
