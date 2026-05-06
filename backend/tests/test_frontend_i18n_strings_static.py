from __future__ import annotations

import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SRC = PROJECT_ROOT / "frontend" / "src"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


class FrontendI18nStringsStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self.catalog = read(FRONTEND_SRC / "i18n" / "fr.ts")
        self.index = read(FRONTEND_SRC / "i18n" / "index.ts")
        self.app = read(FRONTEND_SRC / "App.tsx")
        self.degraded_states = read(FRONTEND_SRC / "degradedStates.ts")
        self.review_state = read(FRONTEND_SRC / "reviewState.ts")
        self.review_panel = read(
            FRONTEND_SRC / "components" / "review" / "ReviewPanel.tsx"
        )
        self.review_labels = read(
            FRONTEND_SRC / "components" / "review" / "reviewLabels.ts"
        )
        self.lesson_panel = read(
            FRONTEND_SRC / "components" / "review" / "ReviewLessonPanel.tsx"
        )
        self.line_comparison = read(
            FRONTEND_SRC / "components" / "review" / "ReviewLineComparison.tsx"
        )
        self.practice_panel = read(
            FRONTEND_SRC / "components" / "review" / "ReviewPracticePanel.tsx"
        )

    def test_french_catalog_exports_critical_v1_sections(self) -> None:
        self.assertIn("export const fr = {", self.catalog)
        self.assertIn('export { fr } from "./fr";', self.index)
        for section in (
            "nav:",
            "actions:",
            "analysis:",
            "review:",
            "liveAnalysis:",
            "degradedStates:",
            "import:",
            "training:",
            "profilePrivacy:",
            "confirmation:",
            "feedback:",
        ):
            self.assertIn(section, self.catalog)

    def test_critical_v1_strings_are_in_catalog(self) -> None:
        for token in (
            "Aujourd'hui",
            "Mes parties",
            "Entraînement",
            "Profil / Paramètres",
            "Bien joué. Tu as trouvé l’idée critique",
            "Bonne idée. Ce coup répond au problème principal",
            "Pas encore. Le coup clé était",
            "Pas encore. Ce coup ne répond pas à l'idée clé de la position.",
            "Ce coup n’est pas légal dans cette position.",
            "Ton coup",
            "Problème",
            "Meilleure idée",
            "Tentative réussie",
            "Voir pourquoi ça marche",
            "Dans la partie, cette idée avait été manquée.",
            "Gain récupéré",
            "Impact :",
            "Qualité :",
            "Coup joué dans la partie",
            "Analyse interrompue temporairement",
            "Review incomplète",
            "S'entraîner",
            "Analyse live en pause pendant la Review",
            "analyse live indisponible",
            "NeuroChess local ne répond pas",
            "Plan en construction",
            "PGN non reconnu",
            "Exporter mes données",
            "Supprimer mes données",
            "SUPPRIMER",
        ):
            self.assertIn(token, self.catalog)

    def test_critical_components_use_catalog(self) -> None:
        for source in (
            self.app,
            self.degraded_states,
            self.review_state,
            self.review_panel,
            self.review_labels,
            self.lesson_panel,
            self.practice_panel,
        ):
            self.assertIn("fr.", source)
        for usage in (
            "fr.nav.today",
            "fr.nav.games",
            "fr.nav.training",
            "fr.profilePrivacy.exportData",
            "fr.confirmation.deleteKeyword",
            "fr.analysis.interruptedWithResume",
            "fr.liveAnalysis.pausedDuringReview",
            "fr.review.focusPractice",
            "fr.import.invalidTitle",
            "fr.degradedStates.practiceSaveFailed",
            "fr.feedback.problem",
            "fr.feedback.bestIdea",
            "fr.actions.showCorrection",
            "fr.actions.continue",
            "fr.feedback.successAttemptTitle",
            "fr.feedback.viewWhyItWorks",
            "fr.feedback.recoveredGain",
            "fr.feedback.currentAttemptWrong",
            "fr.feedback.currentAttemptPlayable",
            "fr.feedback.currentAttemptIllegal",
            "fr.feedback.lineHistoricalContext",
            "fr.feedback.historicalPlayedMove",
        ):
            self.assertIn(
                usage,
                "\n".join(
                    [
                        self.app,
                        self.degraded_states,
                        self.review_state,
                        self.review_panel,
                        self.review_labels,
                        self.lesson_panel,
                        self.line_comparison,
                        self.practice_panel,
                    ]
                ),
            )

    def test_practice_feedback_contradiction_guards_remain(self) -> None:
        self.assertIn("const feedbackWantsCorrection", self.practice_panel)
        self.assertIn("state.feedback?.show_best_move", self.practice_panel)
        self.assertNotIn("state.feedback ||", self.practice_panel)
        self.assertIn("buildReviewCorrectionFeedbackView", self.lesson_panel)
        self.assertIn("correctionMoveAccepted", self.lesson_panel)
        self.assertIn("{correctionFeedback.showMissedBest && (", self.lesson_panel)
        self.assertIn("fr.feedback.bestMoveSuccess(displayedPlayedMove)", self.lesson_panel)
        self.assertIn("correctionFeedback.categoryIsNegative", self.lesson_panel)
        self.assertIn("fr.feedback.historicalIdeaMissed", self.lesson_panel)
        self.assertIn("fr.feedback.recoveredGain", self.lesson_panel)
        self.assertIn("fr.feedback.historicalImpact(impactLabel)", self.lesson_panel)
        self.assertIn("fr.feedback.qualityLabel(qualityLabel)", self.lesson_panel)
        self.assertIn("fr.feedback.successAttemptTitle", self.lesson_panel)
        self.assertIn("fr.feedback.viewWhyItWorks", self.lesson_panel)
        self.assertIn("fr.actions.continue", self.lesson_panel)
        self.assertIn("fr.feedback.currentAttemptWrong", self.lesson_panel)
        self.assertIn("fr.feedback.currentAttemptPlayable", self.lesson_panel)
        self.assertIn("fr.feedback.currentAttemptIllegal", self.lesson_panel)
        self.assertIn("fr.feedback.lineHistoricalContext", self.line_comparison)
        self.assertIn("fr.feedback.historicalPlayedMove", self.line_comparison)

    def test_main_nav_and_training_catalog_contract(self) -> None:
        for usage in ("fr.nav.today", "fr.nav.games", "fr.nav.training"):
            self.assertIn(usage, self.app)
        for usage in (
            "fr.training.dailyPlan",
            "fr.training.failedPositions",
            "fr.training.revisions",
        ):
            self.assertIn(usage, self.app)
        for usage in (
            "fr.review.focusSummary",
            "fr.review.focusLearn",
            "fr.review.focusPractice",
            "fr.review.focusExplorer",
        ):
            self.assertIn(usage, self.review_labels)
        self.assertNotIn('id="tab-review"', self.app)

    def test_forbidden_v1_and_raw_metric_labels_are_not_introduced(self) -> None:
        combined = "\n".join(
            [
                self.catalog,
                self.app,
                self.degraded_states,
                self.review_panel,
                self.review_labels,
                self.lesson_panel,
                self.practice_panel,
            ]
        )
        for forbidden in (
            "Candidate Trainer",
            "LLM coach",
            "Intent Layer",
            "Transfer Gap",
            "NeuroMonitor",
            "Cognitive Map",
            "Evidence JSON",
            "raw Stockfish WDL",
        ):
            self.assertNotIn(forbidden, combined)


if __name__ == "__main__":
    unittest.main()
