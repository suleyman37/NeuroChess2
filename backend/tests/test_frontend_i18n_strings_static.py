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
        self.pv_stepper = read(
            FRONTEND_SRC / "components" / "review" / "ReviewPvStepper.tsx"
        )
        self.move_quality_badge = read(
            FRONTEND_SRC / "components" / "review" / "MoveQualityBadge.tsx"
        )
        self.move_quality_glyphs = read(
            FRONTEND_SRC / "components" / "review" / "moveQualityGlyphs.ts"
        )
        self.board_outcome_overlay = read(
            FRONTEND_SRC / "components" / "review" / "BoardMoveOutcomeOverlay.tsx"
        )
        self.chess_board_panel = read(
            FRONTEND_SRC / "components" / "ChessBoardPanel.tsx"
        )
        self.styles = read(FRONTEND_SRC / "styles.css")
        self.score_details = read(
            FRONTEND_SRC / "components" / "review" / "ReviewScoreDetails.tsx"
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
            "lines:",
            "moveQuality:",
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
            "Qualité du coup joué dans la partie",
            "Position suivante",
            "Terminer la session",
            "Lire la ligne jouée",
            "Lire la ligne solution",
            "Lecture : dans la partie",
            "Lecture : solution",
            "Ligne indisponible pour cette position.",
            "Joueur analysé",
            "Moi",
            "Blancs",
            "Noirs",
            "Les deux",
            "Couleur détectée",
            "Couleur inconnue pour cette partie.",
            "Choisis Blancs, Noirs ou Les deux.",
            "Qualité de ta tentative",
            "Excellent",
            "Jouable",
            "À revoir",
            "Coup illégal",
            "À recalculer",
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
            self.move_quality_badge,
            self.move_quality_glyphs,
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
            "fr.feedback.historicalQualityScope",
            "fr.feedback.historicalPlayedMove",
            "fr.practice.nextPosition",
            "fr.practice.finishSession",
            "fr.practice.acceptedCanContinue",
            "fr.lines.playGameLine",
            "fr.lines.playSolutionLine",
            "fr.lines.playbackGameContext",
            "fr.lines.playbackSolutionContext",
            "fr.lines.stepLabel",
            "fr.review.pov.analyzedPlayer",
            "fr.review.pov.unknownColor",
            "fr.review.pov.detectedColor",
            "fr.review.pov.currentMomentSide",
            "fr.moveQuality.criticalBest.label",
            "fr.moveQuality.good.label",
            "fr.moveQuality.wrong.label",
            "fr.moveQuality.contexts[context]",
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
                        self.pv_stepper,
                        self.score_details,
                        self.move_quality_badge,
                        self.move_quality_glyphs,
                        self.board_outcome_overlay,
                    ]
                ),
            )

    def test_move_quality_glyph_copy_is_catalogued_and_calm(self) -> None:
        self.assertIn("MOVE_QUALITY_GLYPH_REGISTRY", self.move_quality_glyphs)
        self.assertIn("MoveQualityBadge", self.move_quality_badge)
        self.assertIn("getMoveQualityGlyphForAttemptResult", self.move_quality_glyphs)
        self.assertIn("getMoveQualityGlyphForHistoricalCategory", self.move_quality_glyphs)
        for usage in (
            "fr.moveQuality.brilliant.label",
            "fr.moveQuality.criticalBest.label",
            "fr.moveQuality.excellent.label",
            "fr.moveQuality.good.label",
            "fr.moveQuality.playable.label",
            "fr.moveQuality.wrong.label",
            "fr.moveQuality.illegal.label",
            "fr.moveQuality.rebuildNeeded.label",
        ):
            self.assertIn(usage, self.move_quality_glyphs)
        for forbidden in ("génie", "catastrophe", "skull", "pirate", "💀"):
            self.assertNotIn(forbidden, self.catalog + self.move_quality_glyphs)

    def test_board_move_outcome_overlay_reuses_quality_copy_without_assets(self) -> None:
        self.assertIn("BoardMoveOutcomeOverlay", self.board_outcome_overlay)
        self.assertIn("getMoveQualityGlyphDefinition", self.board_outcome_overlay)
        self.assertIn("definition.label", self.board_outcome_overlay)
        self.assertIn("definition.shortDescription", self.board_outcome_overlay)
        self.assertIn("board-move-outcome-live", self.board_outcome_overlay)
        self.assertIn("board-move-outcome-overlay", self.styles)
        self.assertIn("board-move-outcome-glyph", self.styles)
        self.assertIn("pointer-events: none", self.styles)
        self.assertIn("prefers-reduced-motion", self.styles)
        self.assertIn("BoardMoveOutcomeOverlay", self.chess_board_panel)
        for generated_asset in (".svg", ".png", ".webp"):
            self.assertNotIn(generated_asset, self.board_outcome_overlay + self.chess_board_panel)

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
        self.assertIn("fr.feedback.historicalQualityScope", self.lesson_panel)
        self.assertIn("fr.feedback.qualityLabel(qualityLabel)", self.lesson_panel)
        self.assertIn("fr.feedback.successAttemptTitle", self.lesson_panel)
        self.assertIn("fr.feedback.viewWhyItWorks", self.lesson_panel)
        self.assertIn("fr.actions.continue", self.lesson_panel)
        self.assertIn("fr.feedback.currentAttemptWrong", self.lesson_panel)
        self.assertIn("fr.feedback.currentAttemptPlayable", self.lesson_panel)
        self.assertIn("fr.feedback.currentAttemptIllegal", self.lesson_panel)
        self.assertIn("fr.feedback.lineHistoricalContext", self.line_comparison)
        self.assertIn("fr.feedback.historicalPlayedMove", self.line_comparison)
        self.assertIn("review-line-game-quality-badge", self.line_comparison)
        self.assertIn("fr.lines.playGameLine", self.line_comparison)
        self.assertIn("fr.lines.playSolutionLine", self.line_comparison)
        self.assertIn("fr.lines.playbackGameContext", self.pv_stepper)
        self.assertIn("fr.lines.playbackSolutionContext", self.pv_stepper)
        self.assertIn("fr.practice.nextPosition", self.practice_panel)
        self.assertIn("fr.practice.finishSession", self.practice_panel)
        self.assertIn("feedbackCanContinue", self.practice_panel)
        self.assertIn("review-training-next-button", self.practice_panel)
        self.assertIn("review-line-player", self.pv_stepper)

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
