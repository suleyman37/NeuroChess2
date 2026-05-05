from __future__ import annotations

import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
REVIEW_DIR = PROJECT_ROOT / "frontend" / "src" / "components" / "review"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


class FrontendLessonFlowStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self.lesson = read(REVIEW_DIR / "ReviewLessonPanel.tsx")
        self.labels = read(REVIEW_DIR / "reviewLabels.ts")
        self.summary = read(REVIEW_DIR / "ReviewCockpitSummary.tsx")
        self.practice = read(REVIEW_DIR / "ReviewPracticePanel.tsx")
        self.laboratory = read(REVIEW_DIR / "ReviewLaboratoryPanel.tsx")
        self.panel = read(REVIEW_DIR / "ReviewPanel.tsx")
        self.focus_tabs = read(REVIEW_DIR / "ReviewFocusTabs.tsx")
        self.view_model = read(REVIEW_DIR / "reviewViewModel.ts")
        self.types = read(REVIEW_DIR / "reviewTypes.ts")
        self.step_status = read(REVIEW_DIR / "ReviewStepStatus.tsx")
        self.app = read(PROJECT_ROOT / "frontend" / "src" / "App.tsx")
        self.i18n = read(PROJECT_ROOT / "frontend" / "src" / "i18n" / "fr.ts")

    def section(self, name: str) -> str:
        start = self.lesson.index(f'data-public-lesson-step="{name}"')
        if name == "challenge":
            end = self.lesson.index('data-public-lesson-step="correction"')
        elif name == "correction":
            end = self.lesson.index('data-public-lesson-step="training"')
        else:
            end = self.lesson.index("\n    </section>", start)
        return self.lesson[start:end]

    def test_review_tabs_are_four_guided_contract_tabs(self) -> None:
        for usage in (
            "fr.review.focusSummary",
            "fr.review.focusLearn",
            "fr.review.focusPractice",
            "fr.review.focusExplorer",
        ):
            self.assertIn(usage, self.labels)
        for label in ("Résumé", "Apprendre", "S'entraîner", "Explorer"):
            self.assertIn(label, self.i18n + self.summary + self.laboratory)
        self.assertNotIn('label: "Laboratoire"', self.labels)
        self.assertIn('aria-label="Explorer Review"', self.laboratory)
        self.assertIn("<strong>Explorer la partie en profondeur</strong>", self.laboratory)
        self.assertIn("Détails techniques", self.laboratory)

    def test_review_tabs_load_from_capabilities_with_local_fallback(self) -> None:
        self.assertIn('import { getCapabilities, type CapabilityTab } from "../../api/client"', self.focus_tabs)
        self.assertIn("normalizeCapabilityReviewTabs(capabilities.review?.tabs)", self.focus_tabs)
        self.assertIn('explorer: "lab"', self.focus_tabs)
        self.assertIn("REVIEW_FOCUS_TABS", self.focus_tabs)
        self.assertIn("catch(() => REVIEW_FOCUS_TABS)", self.focus_tabs)
        self.assertIn("REQUIRED_REVIEW_FOCUS_KEYS", self.focus_tabs)
        self.assertNotIn("getCapabilities", self.app)
        self.assertNotIn("capabilities.review", self.app)

    def test_visible_lesson_flow_is_three_public_steps(self) -> None:
        self.assertIn('export type ReviewPublicLessonStep = "challenge" | "correction" | "training"', self.types)
        self.assertIn("REVIEW_PUBLIC_LESSON_STEPS", self.labels)
        for label in ("Défi", "Correction", "Entraînement"):
            self.assertIn(label, self.labels + self.lesson)
        self.assertIn("review-public-stepper", self.lesson)
        self.assertNotIn("REVIEW_LESSON_STEPS.map", self.lesson)
        self.assertNotIn("review-lesson-stepper", self.lesson)

    def test_internal_six_steps_are_grouped_not_exposed_as_navigation(self) -> None:
        for step in ('"observe"', '"try"', '"played"', '"solution"', '"compare"', '"takeaway"'):
            self.assertIn(step, self.types + self.labels + self.view_model)
        self.assertIn("getPublicLessonStep", self.view_model)
        self.assertIn('lessonStep === "takeaway"', self.view_model)
        self.assertIn('return "training"', self.view_model)
        self.assertIn('lessonStep === "played"', self.view_model)
        self.assertIn('lessonStep === "solution"', self.view_model)
        self.assertIn('lessonStep === "compare"', self.view_model)
        self.assertIn('return "correction"', self.view_model)

    def test_challenge_step_does_not_reveal_solution_or_line(self) -> None:
        challenge = self.section("challenge")
        self.assertIn("Trouve le meilleur coup.", challenge + self.i18n)
        self.assertIn("Essayer", challenge)
        self.assertIn("Indice", challenge + self.i18n)
        self.assertIn("Voir la correction", challenge + self.i18n)
        self.assertNotIn("solutionMove", challenge)
        self.assertNotIn("best_move_san", challenge)
        self.assertNotIn("ReviewLineComparison", challenge)
        self.assertNotIn("Voir la ligne", challenge)

    def test_correction_reveals_solution_after_explicit_action(self) -> None:
        correction = self.section("correction")
        self.assertIn("handleShowCorrection", self.lesson)
        self.assertIn('onShowAnnotation(lessonAnnotation, index, "best")', self.lesson)
        self.assertIn('publicStep === "correction" && canShowSolutionData', self.lesson)
        self.assertIn("const correctionMain", self.lesson)
        self.assertIn("Voici ce que ton coup a permis.", self.lesson + self.i18n)
        self.assertIn("Le meilleur coup était", correction + self.i18n)
        self.assertIn("solutionMove", correction)
        self.assertIn("ReviewLineComparison", correction)
        self.assertIn('<details className="review-line-comparison-disclosure">', correction)
        self.assertNotIn('<details className="review-line-comparison-disclosure" open', correction)

    def test_practice_feedback_best_or_accepted_cannot_force_problem_copy(self) -> None:
        self.assertIn("evaluateReviewTryMoveAttempt", self.app)
        self.assertIn("attemptState?.feedback?.show_best_move", self.view_model)
        self.assertNotIn("Boolean(attemptMatches && attemptState?.feedback) ||", self.view_model)
        self.assertIn("const feedbackWantsCorrection", self.practice)
        self.assertIn("state.feedback?.show_best_move", self.practice)
        self.assertNotIn("state.feedback ||", self.practice)
        self.assertIn("const tryMoveAccepted", self.lesson)
        self.assertIn('tryFeedbackResult === "best"', self.lesson)
        self.assertIn('tryFeedbackResult === "very_good"', self.lesson)
        self.assertIn('tryFeedbackResult === "acceptable"', self.lesson)
        self.assertIn("correctionPlayedLabel", self.lesson)
        self.assertIn("Bonne id", self.lesson + self.i18n)
        self.assertIn("{!tryMoveAccepted && !tryMoveNeedsRebuild && (", self.lesson)
        self.assertIn("Review ", self.lesson + self.i18n)
        self.assertIn(" reconstruire", self.lesson + self.i18n)

    def test_training_step_has_takeaway_and_training_action(self) -> None:
        training = self.section("training")
        self.assertIn("Transforme ce moment en entraînement.", training)
        self.assertIn("À retenir", training)
        self.assertIn("Prochaine action", training)
        self.assertIn("S'entraîner", training)
        self.assertIn("Moment suivant", training)
        self.assertIn("Retour au résumé", training)

    def test_one_primary_action_is_selected_per_public_state(self) -> None:
        self.assertIn("const challengePrimaryAction", self.lesson)
        self.assertIn("const correctionPrimaryAction", self.lesson)
        self.assertIn("const trainingPrimaryAction", self.lesson)
        self.assertIn('challengePrimaryAction === "try" ? "primary"', self.lesson)
        self.assertIn('correctionPrimaryAction === "continue" ? "primary"', self.lesson)
        self.assertNotIn('correctionPrimaryAction === "line" ? "primary"', self.lesson)
        self.assertIn('trainingPrimaryAction === "practice" ? "primary"', self.lesson)
        self.assertIn('trainingPrimaryAction === "next" ? "primary"', self.lesson)

    def test_summary_hides_audit_details_and_practice_is_state_driven(self) -> None:
        self.assertIn("NeuroScore", self.summary)
        self.assertIn("Score coach", self.summary + self.view_model)
        self.assertIn("Précision de référence", self.summary + self.view_model)
        self.assertIn("coachNeuroScoreForReview", self.view_model)
        self.assertIn("referencePrecisionForReview", self.view_model)
        self.assertIn("user_headline_neurochess_score", self.view_model)
        self.assertIn("user_public_neuro_score", self.view_model)
        self.assertIn("S'entraîner sur cette Review", self.summary)
        self.assertIn("Moments clés", self.summary)
        self.assertIn("Explorer les détails", self.summary)
        self.assertIn("review-summary-simple", self.summary)
        self.assertIn("review-key-moment-list", self.summary)
        self.assertIn("review-training-card", self.summary)
        self.assertNotIn("scoreAuditDetailsForPov", self.summary)
        self.assertNotIn("Écart diagnostique", self.summary)
        self.assertNotIn("Détails techniques / audit", self.summary)
        self.assertNotIn("criticality_score", self.summary)
        self.assertNotIn("diagnostic_gap", self.summary)
        self.assertNotIn("neuro_score_diag", self.summary)
        self.assertIn("Commencer l'entraînement", self.practice + self.i18n)
        self.assertIn("Session recommandée", self.practice + self.i18n)
        self.assertIn("Plan en construction", self.practice + self.i18n)
        self.assertIn("Explorer les moments", self.practice + self.i18n)
        self.assertIn("Voir la correction", self.practice + self.i18n)
        self.assertNotIn("Voir solution", self.practice)
        self.assertIn("Revoir les positions ratées", self.practice)
        self.assertIn("Faire une nouvelle session", self.practice)
        self.assertNotIn("disabled={!canShowPv", self.practice)
        self.assertNotIn("board-neuro3d-monitor", self.app)
        self.assertNotIn("boardNeuroBrainData", self.app)

    def test_score_mock_contract_is_visible_in_sources(self) -> None:
        raw_start = self.view_model.index("function rawCoachNeuroScoreForReview")
        coach_start = self.view_model.index("export function coachNeuroScoreForReview")
        reference_start = self.view_model.index("export function referencePrecisionForReview")
        raw_block = self.view_model[raw_start:coach_start]
        coach_block = self.view_model[coach_start:reference_start]
        self.assertLess(raw_block.index("review.user_coach_neuro_score"), raw_block.index("review.user_public_neuro_score") if "review.user_public_neuro_score" in raw_block else len(raw_block))
        self.assertIn("review.user_headline_neurochess_score", raw_block)
        self.assertIn("review.user_public_neuro_score", self.view_model[reference_start:])
        self.assertIn("rawCoachNeuroScoreForReview", coach_block)
        self.assertIn("referencePrecisionForReview", coach_block)
        self.assertIn("rawCoachNeuroScoreForReview(review, povContext) ?? referencePrecisionForReview(review, povContext)", coach_block)
        self.assertIn("coachScoreLabelForPov", self.view_model)
        self.assertIn("referencePrecisionLabelForPov", self.view_model)
        self.assertIn("NeuroScore ${formatHeadlineScore(coachScore)} / 100", self.summary)
        self.assertIn("referencePrecisionLabel", self.summary)
        self.assertNotIn("NeuroScore ${formatHeadlineScore(publicScore)} / 100", self.summary)
        self.assertNotIn("active={selectedMovePly === selectedCoachAnnotation?.ply}\n            active=", self.panel)

    def test_review_practice_grading_is_backend_authoritative(self) -> None:
        self.assertIn("recordReviewPracticeAttempt", self.app)
        self.assertIn("summary.attempt_feedback", self.app)
        self.assertNotIn("function evaluateTryMoveAttempt", self.app)
        self.assertNotIn("result: evaluation.result", self.app)
        for local_result in (
            'result: "best"',
            'result: "very_good"',
            'result: "acceptable"',
            'result: "wrong"',
            'result: "illegal"',
        ):
            self.assertNotIn(local_result, self.app)

    def test_reveal_gate_still_resets_and_hides_before_correction(self) -> None:
        self.assertIn('setSolutionRevealForAnnotation(annotation, "hidden")', self.app)
        self.assertIn('setSolutionRevealForAnnotation(annotation, "hint_shown")', self.app)
        self.assertIn('setSolutionRevealForAnnotation(annotation, "solution_revealed")', self.app)
        self.assertIn('setSolutionRevealForAnnotation(annotation, "attempted")', self.app)
        self.assertIn('revealMode === "hint_shown"', self.view_model)
        self.assertIn('revealMode === "solution_revealed"', self.view_model)
        self.assertIn('revealMode === "pv_line"', self.view_model)
        self.assertIn('publicStep === "correction"', self.view_model)

    def test_under_board_status_is_compact(self) -> None:
        self.assertIn("Position critique - trouve le meilleur coup.", self.step_status)
        self.assertIn("Résumé Review", self.step_status)
        self.assertIn("NeuroScore, priorités et plan sont dans le panneau coach.", self.step_status)
        self.assertIn("Ton coup et la correction sont affichés.", self.step_status)
        self.assertIn("À retenir : cherche les coups forcing.", self.step_status)
        self.assertIn("review-step-status-actions", self.step_status)
        self.assertNotIn("ReviewLineComparison", self.step_status)
        self.assertNotIn("CoachExplanationBlock", self.step_status)
        self.assertNotIn("Rejouer étape", self.step_status)

    def test_explorer_contains_folded_complexity_and_detail_panel(self) -> None:
        explorer = read(REVIEW_DIR / "ReviewExplorerPanel.tsx")
        self.assertIn("Explorer la partie en profondeur", self.laboratory)
        self.assertIn('<details className="review-lab-section" open>', self.laboratory)
        self.assertIn("<summary>Ouverture détaillée</summary>", self.laboratory)
        self.assertIn("<summary>Options d'analyse</summary>", self.laboratory)
        self.assertIn("<summary>Détails techniques</summary>", self.laboratory)
        self.assertIn("<summary>Preuves PV</summary>", self.laboratory)
        self.assertIn("ReviewExplorerDetail", explorer)
        self.assertIn("Voir la leçon", explorer)
        self.assertIn("Rejouer la ligne", explorer)

    def test_sources_have_no_visible_mojibake(self) -> None:
        combined = "\n".join(
            [self.lesson, self.labels, self.view_model, self.types, self.step_status]
        )
        for marker in ("Ã", "Â", "â", "�", "prÃ", "?coul?", "z?ro"):
            self.assertNotIn(marker, combined)


if __name__ == "__main__":
    unittest.main()
