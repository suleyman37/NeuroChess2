from __future__ import annotations

import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SRC = PROJECT_ROOT / "frontend" / "src"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


class FrontendLearningLoopStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = read(FRONTEND_SRC / "App.tsx")
        self.client = read(FRONTEND_SRC / "api" / "client.ts")

    def test_learning_loop_uses_practice_events_without_extra_training_mode(self) -> None:
        for token in (
            "reviewPracticeLearningSummary",
            "learningDueCount",
            "learningScheduledCount",
            "dailyPlan",
            "startDailyPlanPractice",
            "createOrRefreshDailyPlan",
            "startDueReviewPractice",
            "handleTrainingRevisionsAction",
            "Progression cette semaine",
            "Compteurs issus des tentatives Practice réelles.",
            "Les positions travaillées reviendront au bon moment.",
        ):
            self.assertIn(token, self.app)

        for token in (
            "timeSpentMs",
            "hintUsed",
            "revealUsed",
            "sourceContext",
            "ReviewPracticeLearningSummary",
            "DailyPlanResponse",
            "getDailyPlanToday",
            "createDailyPlan",
            "startDailyPlanPracticeSession",
            "startDueReviewPracticeSession",
        ):
            self.assertIn(token, self.client + self.app)

        training_entries = ("Plan du jour", "Mes positions ratées", "Révisions")
        for entry in training_entries:
            self.assertIn(entry, self.app)

        for forbidden_label in (
            "Candidate Trainer",
            "Intent Layer",
            "Transfer Gap",
            "LLM coach",
            "NeuroMonitor",
            "brain",
            "cortex",
            "atlas",
            "SkillTrace",
            "FSRS",
            "ETV",
        ):
            self.assertNotIn(forbidden_label, self.app)


if __name__ == "__main__":
    unittest.main()
