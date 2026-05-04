from __future__ import annotations

import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SRC = PROJECT_ROOT / "frontend" / "src"
DOCS_DIR = PROJECT_ROOT / "docs"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


class FrontendAppShellStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = read(FRONTEND_SRC / "App.tsx")
        self.styles = read(FRONTEND_SRC / "styles.css")
        self.action_registry = read(DOCS_DIR / "ACTION_REGISTRY.md")
        self.screen_contracts = read(DOCS_DIR / "SCREEN_CONTRACTS.md")

    def test_v5_5_app_shell_plan2_contract_is_statically_present(self) -> None:
        self.assertIn('type AppShellPage = "today" | "games" | "training"', self.app)
        self.assertIn('useState<AppShellPage>("today")', self.app)
        self.assertIn('className="app-shell-nav"', self.app)

        for label in ("Aujourd'hui", "Mes parties", "Entraînement"):
            self.assertIn(label, self.app)

        for page in (
            'activeShellPage === "today"',
            'activeShellPage === "games"',
            'activeShellPage === "training"',
        ):
            self.assertIn(page, self.app)

        for today_token in (
            "Ta Review est prête",
            "Reprendre ton entraînement",
            "Analyse en cours",
            "Construisons ton profil",
            "Plan du jour",
            "Dernière Review",
            "Progression cette semaine",
            "À revoir",
            "profil en construction",
        ):
            self.assertIn(today_token, self.app)

        for training_token in ("Plan du jour", "Mes positions ratées", "Révisions"):
            self.assertIn(training_token, self.app)

        for training_v1_token in (
            "trainingPrimaryLabel",
            "handleTrainingFailedPositionsAction",
            "failedPositionsActionLabel",
            "canOpenFailedPositions",
            "sans mode supplémentaire",
            "Profil en construction",
            "Réviser",
        ):
            self.assertIn(training_v1_token, self.app)

        self.assertIn(".plan2-secondary-action", self.styles)
        self.assertIn(".training-card-cta", self.styles)

        for forbidden_label in (
            "Candidate Trainer",
            "Intent Layer",
            "Transfer Gap",
            "LLM coach",
            "NeuroMonitor",
            "brain",
            "cortex",
            "atlas",
        ):
            self.assertNotIn(forbidden_label, self.app)

        self.assertIn("review-context-header", self.app)
        self.assertIn("Review contextuelle", self.app)
        self.assertIn("Retour aux parties", self.app)
        self.assertIn('openReviewContext("today")', self.app)
        self.assertIn('openReviewContext("training")', self.app)
        self.assertIn('openGamesPanel("import")', self.app)
        self.assertIn('openGamesPanel("history")', self.app)
        self.assertIn('setReviewFocusKey("practice")', self.app)
        self.assertNotIn('id="tab-review"', self.app)

        self.assertIn(".app-shell-nav", self.styles)
        self.assertIn(".plan2-page", self.styles)
        self.assertIn(".review-context-header", self.styles)
        self.assertIn("nav.open_today", self.action_registry)
        self.assertIn("nav.open_review_contextual", self.action_registry)
        self.assertIn("today.follow_recommendation", self.action_registry)
        self.assertIn("training.start_daily_plan", self.action_registry)
        self.assertIn("training.review_failed_positions", self.action_registry)
        self.assertNotIn(
            "| nav.open_review | Review | global | main navigation |",
            self.action_registry,
        )
        self.assertIn("| app.today |", self.screen_contracts)
        self.assertIn("V5.5 Plan2 App Shell Application", self.screen_contracts)


if __name__ == "__main__":
    unittest.main()
