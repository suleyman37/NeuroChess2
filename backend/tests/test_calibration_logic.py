from __future__ import annotations

import shutil
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from typing import Any

import chess


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def read_review_panel_source() -> str:
    review_dir = PROJECT_ROOT / "frontend" / "src" / "components" / "review"
    ordered_files = [
        PROJECT_ROOT / "frontend" / "src" / "components" / "ReviewPanel.tsx",
        review_dir / "ReviewPanel.tsx",
        review_dir / "ReviewFocusTabs.tsx",
        review_dir / "ReviewCockpitSummary.tsx",
        review_dir / "ReviewLaboratoryPanel.tsx",
        review_dir / "ReviewLessonPanel.tsx",
        review_dir / "ReviewLineComparison.tsx",
        review_dir / "ReviewOpeningPanel.tsx",
        review_dir / "ReviewPracticePanel.tsx",
        review_dir / "ReviewPvStepper.tsx",
        review_dir / "ReviewPracticeHistory.tsx",
        review_dir / "ReviewExplorerPanel.tsx",
        review_dir / "ReviewScoreDetails.tsx",
        review_dir / "ReviewTechnicalDetails.tsx",
        review_dir / "ReviewStepStatus.tsx",
        review_dir / "reviewViewModel.ts",
        review_dir / "reviewLabels.ts",
        review_dir / "reviewUtils.ts",
        review_dir / "reviewTypes.ts",
    ]
    return "\n".join(path.read_text(encoding="utf-8") for path in ordered_files)

from neurochess.analysis_service import AnalysisService
from neurochess.core.evaluation_display import make_evaluation_display
from neurochess.data.database import init_db


class CalibrationFakeEngine:
    def __init__(self, eval_cp: int, uci: str, mate_in: int | None = None) -> None:
        self.eval_cp = eval_cp
        self.uci = uci
        self.mate_in = mate_in

    def analyze_fen(
        self,
        fen: str,
        depth: int,
        multipv: int,
        time_budget_ms: int | None = None,
    ) -> dict[str, Any]:
        _ = time_budget_ms
        return {
            "fen": fen,
            "engine": "stockfish",
            "engine_version": "CalibrationFake 1",
            "depth": depth,
            "multipv": multipv,
            "eval_cp": self.eval_cp,
            "mate_in": self.mate_in,
            "top_moves": [
                {
                    "rank": 1,
                    "uci": self.uci,
                    "eval_cp": self.eval_cp,
                    "eval_pov_side_to_move_cp": 9999,
                    "mate_in": self.mate_in,
                    "pv": [self.uci],
                }
            ],
        }


class CalibrationLogicTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-v39a-test-"))
        self.db_path = self.temp_dir / "test_neurochess.db"
        init_db(self.db_path)
        self.service = AnalysisService(
            db_path=self.db_path,
            log_path=self.temp_dir / "analysis.log",
        )

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir)

    def test_mate_display_is_exact_and_not_sigmoid(self) -> None:
        white_mate = make_evaluation_display(eval_cp=-10_000, mate_in=2)
        black_mate = make_evaluation_display(eval_cp=10_000, mate_in=-3)

        self.assertEqual(white_mate.label, "M2")
        self.assertEqual(white_mate.white_percent, 100.0)
        self.assertEqual(white_mate.black_percent, 0.0)
        self.assertTrue(white_mate.is_mate)
        self.assertEqual(black_mate.label, "-M3")
        self.assertEqual(black_mate.white_percent, 0.0)
        self.assertEqual(black_mate.black_percent, 100.0)
        self.assertTrue(black_mate.is_mate)

    def test_eval_bar_uses_white_pov_independent_of_side_to_move(self) -> None:
        white_advantage_black_to_move_display = make_evaluation_display(
            eval_cp=300,
            mate_in=None,
        )
        black_advantage_white_to_move_display = make_evaluation_display(
            eval_cp=-300,
            mate_in=None,
        )

        self.assertGreater(white_advantage_black_to_move_display.white_percent, 50.0)
        self.assertLess(black_advantage_white_to_move_display.white_percent, 50.0)

    def test_side_to_move_pov_is_deterministic_for_ten_positions(self) -> None:
        for index, fen in enumerate(self._ten_controlled_fens()):
            board = chess.Board(fen)
            uci = next(iter(board.legal_moves)).uci()
            eval_cp = 100 + index
            analysis = self._run_fake(
                fen,
                CalibrationFakeEngine(eval_cp=eval_cp, uci=uci),
            )

            top_move = analysis["analysis_json"]["top_moves"][0]
            expected = eval_cp if board.turn == chess.WHITE else -eval_cp
            self.assertEqual(top_move["eval_cp"], eval_cp)
            self.assertEqual(top_move["eval_pov_side_to_move_cp"], expected)

    def test_done_analysis_top_moves_schema_is_canonical(self) -> None:
        fen = chess.STARTING_FEN
        analysis = self._run_fake(
            fen,
            CalibrationFakeEngine(eval_cp=42, uci="e2e4"),
        )
        payload = analysis["analysis_json"]
        top_moves = payload["top_moves"]

        self.assertIsInstance(top_moves, list)
        self.assertGreater(len(top_moves), 0)
        self.assertEqual(top_moves[0]["rank"], 1)
        for top_move in top_moves:
            for key in (
                "uci",
                "eval_cp",
                "eval_pov_side_to_move_cp",
                "mate_in",
                "pv",
            ):
                self.assertIn(key, top_move)

    def test_no_canonical_top1_usage_in_app_source(self) -> None:
        offenders: list[str] = []
        for root in (
            PROJECT_ROOT / "backend" / "neurochess",
            PROJECT_ROOT / "frontend" / "src",
        ):
            for path in root.rglob("*"):
                if path.suffix not in {".py", ".ts", ".tsx"}:
                    continue
                for line_number, line in enumerate(
                    path.read_text(encoding="utf-8").splitlines(),
                    start=1,
                ):
                    if "top1" in line and "top1_uci" not in line:
                        offenders.append(f"{path}:{line_number}:{line.strip()}")

        self.assertEqual(offenders, [])

    def test_frontend_accepts_evaluation_source_and_shallow_indicator(self) -> None:
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        evaluation_bar_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "EvaluationBar.tsx"
        ).read_text(encoding="utf-8")

        self.assertIn("evaluation_source: EvaluationSource | null", client_source)
        self.assertIn("const nextEvaluationSource = state.evaluation_source ?? null", app_source)
        self.assertIn("setEvaluationSource(nextEvaluationSource)", app_source)
        self.assertIn('kind === "shallow"', evaluation_bar_source)
        self.assertIn('return "≈"', evaluation_bar_source)
        self.assertNotIn("eval_pov_side_to_move_cp", evaluation_bar_source)

    def test_review_panel_has_no_visible_mojibake(self) -> None:
        review_panel_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "review" / "ReviewPanel.tsx"
        ).read_text(encoding="utf-8")
        cockpit_source = (
            PROJECT_ROOT
            / "frontend"
            / "src"
            / "components"
            / "review"
            / "ReviewCockpitSummary.tsx"
        ).read_text(encoding="utf-8")
        landing_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "LandingPage.tsx"
        ).read_text(encoding="utf-8")
        logo_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "NeuroChessLogo.tsx"
        ).read_text(encoding="utf-8")

        for marker in ("Ã", "Â", "â", "�", "prÃ", "?coul?", "z?ro"):
            self.assertNotIn(marker, review_panel_source)
            self.assertNotIn(marker, cockpit_source)
            self.assertNotIn(marker, landing_source)
            self.assertNotIn(marker, logo_source)

    def test_frontend_review_sections_contract_is_staticly_present(self) -> None:
        review_panel_source = read_review_panel_source()
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")

        self.assertIn("export type ReviewMoveAnnotation", client_source)
        self.assertIn("export type ReviewSections", client_source)
        self.assertIn("move_annotations?: ReviewMoveAnnotation[]", client_source)
        self.assertIn("review_sections?: ReviewSections", client_source)
        self.assertIn("headline_neurochess_score?: number | null", client_source)
        self.assertIn("public_neuro_score?: number | null", client_source)
        self.assertIn("public_score_formula_version?: string | null", client_source)
        self.assertIn("coach_neuro_score?: number | null", client_source)
        self.assertIn("coach_score_formula_version?: string | null", client_source)
        self.assertIn("qualitative_game_label?: string | null", client_source)
        self.assertIn("review_summary_sentence?: string | null", client_source)
        self.assertIn("pedagogical_explanation?: PedagogicalExplanation | null", client_source)
        self.assertIn("try_move_supported?: boolean", client_source)
        self.assertIn("acceptable_moves?: ReviewAcceptableMove[]", client_source)
        self.assertIn("pv_line?: ReviewPvLineMove[]", client_source)
        self.assertIn("export type PvContrastEvidence", client_source)
        self.assertIn("pv_contrast_evidence?: PvContrastEvidence | null", client_source)
        self.assertIn("pv_contrast_evidence_version?: string | null", client_source)
        self.assertIn("export type ContrastCoachExplanation", client_source)
        self.assertIn(
            "contrast_coach_explanation?: ContrastCoachExplanation | null",
            client_source,
        )
        self.assertIn("ReviewLineComparison", review_panel_source)
        self.assertIn("ReviewPvContrastTechnicalDetails", review_panel_source)
        self.assertIn("Détails techniques PV", review_panel_source)
        self.assertIn("Preuves PV", review_panel_source)
        self.assertIn("main_difference_type", review_panel_source)
        self.assertIn("missing_data", review_panel_source)
        self.assertIn("Comparaison des lignes", review_panel_source)
        self.assertIn("Après ton coup", review_panel_source)
        self.assertIn("Avec la solution", review_panel_source)
        self.assertIn("Réponse adverse", review_panel_source)
        self.assertIn("Idée principale", review_panel_source)
        self.assertIn("Différence principale", review_panel_source)
        self.assertIn("Ligne du coup joué", review_panel_source)
        self.assertIn("Ligne de la solution", review_panel_source)
        self.assertIn("ReviewPracticeContrastFeedback", review_panel_source)
        self.assertIn("ReviewCoachMomentCard", review_panel_source)
        self.assertIn("ReviewMomentNavigator", review_panel_source)
        self.assertIn("À revoir", review_panel_source)
        self.assertIn("Coups forts", review_panel_source)
        self.assertIn("Opportunités", review_panel_source)
        self.assertIn("Tous", review_panel_source)
        self.assertIn("Score de précision", review_panel_source)
        self.assertIn("Comparaison", review_panel_source)
        self.assertIn("Options d'analyse", review_panel_source)
        self.assertIn("Impact", review_panel_source)
        self.assertIn("Qualité", review_panel_source)
        self.assertIn("Voici ce que ton coup a permis.", review_panel_source)
        self.assertIn("Le meilleur coup était", review_panel_source)
        self.assertIn("Problème", review_panel_source)
        self.assertIn("lessonStep", review_panel_source)
        self.assertIn("À retenir", review_panel_source)
        self.assertIn("Continuer", review_panel_source)
        self.assertIn("Réessayer", review_panel_source)
        self.assertIn("Voir la ligne", review_panel_source)
        self.assertNotIn("Perte Win%", review_panel_source)
        self.assertNotIn("Accuracy :", review_panel_source)
        self.assertIn("onShowAnnotation", review_panel_source)
        self.assertIn("onGuidedReplayAnnotation", review_panel_source)
        self.assertIn("handleShowReviewAnnotation", app_source)
        self.assertIn("handleGuidedReplayAnnotation", app_source)
        self.assertIn("handleTryMoveAnnotation", app_source)
        self.assertNotIn("evaluateTryMoveAttempt", app_source)
        self.assertNotIn("result: evaluation.result", app_source)
        self.assertIn("handleShowPvLineAnnotation", app_source)
        self.assertIn("guidedReplayPhase", app_source)
        self.assertIn("REPLAY_INITIAL_PAUSE_MS = 1200", app_source)
        self.assertIn('setPositionMode("REVIEW")', app_source)
        self.assertNotIn("startLiveAnalysis", review_panel_source)
        self.assertNotIn("est le coup joué dans la partie", app_source)

    def test_v5_4_front_ref1_review_split_contract_is_staticly_present(self) -> None:
        review_dir = PROJECT_ROOT / "frontend" / "src" / "components" / "review"
        wrapper_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "ReviewPanel.tsx"
        ).read_text(encoding="utf-8")
        review_panel_source = read_review_panel_source()
        view_model_source = (review_dir / "reviewViewModel.ts").read_text(
            encoding="utf-8"
        )
        labels_source = (review_dir / "reviewLabels.ts").read_text(encoding="utf-8")

        self.assertIn('from "./review/ReviewPanel"', wrapper_source)
        self.assertTrue(review_dir.exists())
        for filename in (
            "ReviewCockpitSummary.tsx",
            "ReviewLaboratoryPanel.tsx",
            "ReviewLessonPanel.tsx",
            "ReviewOpeningPanel.tsx",
            "ReviewPracticePanel.tsx",
            "ReviewExplorerPanel.tsx",
            "ReviewTechnicalDetails.tsx",
            "ReviewLineComparison.tsx",
            "ReviewPvStepper.tsx",
            "ReviewPracticeHistory.tsx",
            "ReviewStepStatus.tsx",
            "reviewViewModel.ts",
            "reviewLabels.ts",
            "reviewTypes.ts",
            "reviewUtils.ts",
        ):
            self.assertTrue((review_dir / filename).exists(), filename)

        for helper in (
            "buildReviewScoreViewModel",
            "buildPovOptions",
            "filterSectionsByPov",
            "buildPriorityMoments",
            "buildCockpitIndicators",
            "buildThreeTakeaways",
            "buildLessonStepState",
            "buildLineComparisonView",
            "buildPracticeSummaryView",
            "buildOpeningRealityView",
        ):
            self.assertIn(helper, view_model_source + labels_source)

        for label in (
            "REVIEW_SECTION_TABS",
            "REVIEW_FOCUS_TABS",
            "REVIEW_LESSON_STEPS",
            "REVIEW_PUBLIC_LESSON_STEPS",
            "MAIN_DIFFERENCE_TYPE_LABELS",
            "PRACTICE_FALLBACK_MESSAGES",
            "OPENING_FALLBACK_MESSAGES",
        ):
            self.assertIn(label, labels_source)

        self.assertIn("const canShowSolutionData", review_panel_source)
        self.assertIn('revealMode === "solution_revealed"', review_panel_source)
        self.assertIn("Preuves PV", review_panel_source)
        self.assertNotIn("Meilleur choix", review_panel_source)
        for marker in ("Ã", "Â", "â", "�", "prÃ", "?coul?", "z?ro"):
            self.assertNotIn(marker, review_panel_source)

    def test_frontend_review_pov_contract_is_staticly_present(self) -> None:
        review_panel_source = read_review_panel_source()
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")

        self.assertIn('export type ReviewPov = "user" | "white" | "black" | "both"', review_panel_source)
        self.assertIn('user_color?: "white" | "black" | string | null', client_source)
        self.assertIn("ReviewPovSelector", review_panel_source)
        self.assertIn("Joueur analysé", review_panel_source)
        self.assertIn("Changer", review_panel_source)
        self.assertIn('{ value: "user", label: "Moi" }', review_panel_source)
        self.assertIn('selectedPov === "user" && !userColor ? "white"', review_panel_source)
        self.assertIn("filteredReviewSections", review_panel_source)
        self.assertIn("filterAnnotationsByColor", review_panel_source)
        self.assertIn("Aucun coup dans cette section pour ce joueur.", review_panel_source)
        self.assertIn("Impact", review_panel_source)
        self.assertIn("À toi de jouer pour les", review_panel_source)
        self.assertIn('"Coup joué"', review_panel_source)
        self.assertIn("selectedReviewPov", app_source)
        self.assertIn("REVIEW_POV_STORAGE_KEY_PREFIX", app_source)
        self.assertIn("readReviewPovPreference", app_source)
        self.assertIn("writeReviewPovPreference", app_source)
        self.assertIn('clearReviewOverlays("review_pov_changed")', app_source)
        self.assertIn("isUserReviewPov", app_source)
        self.assertIn("Impact pour les", app_source)

    def test_frontend_review_practice_contract_is_staticly_present(self) -> None:
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        review_panel_source = read_review_panel_source()

        self.assertIn("export type ReviewPracticeItem", client_source)
        self.assertIn("skipped_count: number", client_source)
        self.assertIn("startReviewPracticeSession", client_source)
        self.assertIn("getReviewPracticeSessions", client_source)
        self.assertIn("getReviewPracticeSession", client_source)
        self.assertIn("recordReviewPracticeAttempt", client_source)
        self.assertIn("abandonReviewPracticeSession", client_source)
        self.assertIn("retryFailedReviewPracticeSession", client_source)
        self.assertIn("completeReviewPracticeSession", client_source)
        self.assertIn("reviewPracticeState", app_source)
        self.assertIn("reviewPracticeHistory", app_source)
        self.assertIn("sessions.length === 0 && !isLoading && !error", review_panel_source)
        self.assertIn("itemState:", app_source)
        self.assertIn("handleStartReviewPractice", app_source)
        self.assertIn("retryFailedPracticeSession", app_source)
        self.assertIn("resumePracticeSession", app_source)
        self.assertIn("handlePracticeAttempt", app_source)
        self.assertIn("practiceMoveActive", app_source)
        self.assertIn('positionMode === "REVIEW"', app_source)
        self.assertIn("clearReviewOverlays", app_source)
        self.assertIn("makeReviewOverlayPositionKey", app_source)
        self.assertIn("reviewOverlayPositionKey", app_source)
        self.assertIn("REPLAY_PV_LINE_PAUSE_MS = 1200", app_source)
        self.assertIn("showManualPvLineStep", app_source)
        self.assertIn("toggleManualPvLineAutoplay", app_source)
        self.assertIn("ReviewPracticeSessionPanel", review_panel_source)
        self.assertIn("ReviewPracticePvStepper", review_panel_source)
        self.assertIn("S'entraîner sur cette Review", review_panel_source)
        self.assertIn("Indice", review_panel_source)
        self.assertIn("Voir la correction", review_panel_source)
        self.assertIn("Coup suivant →", review_panel_source)
        self.assertIn("Coup précédent", review_panel_source)
        self.assertIn("Rejouer depuis le début", review_panel_source)
        self.assertIn("Position suivante", review_panel_source)
        self.assertIn("Résumé de session", review_panel_source)
        self.assertIn("Dernières sessions d'entraînement", review_panel_source)
        self.assertIn("Revoir les positions ratées", review_panel_source)
        self.assertIn("Tout refaire", review_panel_source)
        self.assertIn("Positions passées", review_panel_source)
        self.assertNotIn("startLiveAnalysis", review_panel_source)

    def test_frontend_review_solution_reveal_gate_is_staticly_present(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        review_panel_source = read_review_panel_source()
        normalized_app = app_source.replace("\r\n", "\n")
        normalized_panel = review_panel_source.replace("\r\n", "\n")

        self.assertIn("export type ReviewSolutionRevealMode", review_panel_source)
        for mode in (
            '"hidden"',
            '"hint_shown"',
            '"attempted"',
            '"played_move_shown"',
            '"solution_revealed"',
            '"pv_line"',
        ):
            self.assertIn(mode, review_panel_source)

        self.assertIn("ReviewSolutionRevealViewState", review_panel_source)
        self.assertIn("solutionRevealState: ReviewSolutionRevealViewState | null", review_panel_source)
        self.assertIn("onSolutionHintAnnotation", review_panel_source)
        self.assertIn("onSolutionReset", review_panel_source)
        self.assertIn('onSolutionReset("review_section_changed")', normalized_panel)
        self.assertIn('onSolutionReset("review_moment_changed")', normalized_panel)
        self.assertIn("export type ReviewPublicLessonStep", review_panel_source)
        self.assertIn("getPublicLessonStep", review_panel_source)
        self.assertIn("REVIEW_PUBLIC_LESSON_STEPS", review_panel_source)
        for public_step in ('"challenge"', '"correction"', '"training"'):
            self.assertIn(public_step, review_panel_source)
        self.assertIn("const canShowSolutionData", review_panel_source)
        self.assertIn("const hasPlayedMoveOnly =", normalized_panel)
        self.assertIn('revealMode === "played_move_shown"', normalized_panel)
        self.assertIn("const hintVisible =", normalized_panel)
        self.assertIn('revealMode === "hint_shown"', normalized_panel)
        self.assertIn("const hasContrastCoach = Boolean", normalized_panel)
        self.assertIn("hiddenCoachObjective", review_panel_source)
        self.assertIn("practiceHintForAnnotation", review_panel_source)
        self.assertIn("const moveTitle", review_panel_source)
        self.assertIn("au trait", review_panel_source)
        self.assertIn("Voir la correction", review_panel_source)
        self.assertIn("Le meilleur coup était", review_panel_source)
        self.assertIn('data-public-lesson-step="challenge"', normalized_panel)
        self.assertIn('data-public-lesson-step="correction"', normalized_panel)
        self.assertIn('data-public-lesson-step="training"', normalized_panel)
        self.assertIn("ReviewLineComparison", review_panel_source)
        self.assertIn("Comparaison des lignes", review_panel_source)
        self.assertIn("Après ton coup", review_panel_source)
        self.assertIn("Avec la solution", review_panel_source)
        self.assertIn("Détails techniques PV", review_panel_source)
        self.assertIn("Preuves PV", review_panel_source)
        self.assertNotIn('className="review-best-line"', normalized_panel)
        self.assertNotIn("Meilleur choix", review_panel_source)

        coach_card_start = normalized_panel.index("function ReviewCoachMomentCard")
        comparison_start = normalized_panel.index("function ReviewLineComparison")
        coach_card_body = normalized_panel[coach_card_start:comparison_start]
        self.assertNotIn("ReviewPvContrastTechnicalDetails", coach_card_body)
        self.assertNotIn("Détails techniques PV", coach_card_body)
        self.assertNotIn("best_branch", coach_card_body)
        self.assertNotIn("main_difference_type", coach_card_body)

        comparison_index = normalized_panel.index("<ReviewLineComparison")
        comparison_guard_index = normalized_panel.rfind(
            "canShowLineComparison",
            0,
            comparison_index,
        )
        self.assertNotEqual(comparison_guard_index, -1)
        self.assertLess(comparison_index - comparison_guard_index, 320)

        challenge_start = normalized_panel.index('data-public-lesson-step="challenge"')
        correction_start = normalized_panel.index('data-public-lesson-step="correction"')
        training_start = normalized_panel.index('data-public-lesson-step="training"')
        challenge_body = normalized_panel[challenge_start:correction_start]
        correction_body = normalized_panel[correction_start:training_start]
        self.assertIn("Trouve le meilleur coup.", challenge_body)
        self.assertIn("hiddenCoachObjective", challenge_body)
        self.assertIn("practiceHintForAnnotation", challenge_body)
        self.assertNotIn("solutionMove", challenge_body)
        self.assertNotIn("best_move_san", challenge_body)
        self.assertNotIn("Voir la ligne", challenge_body)
        self.assertIn('publicStep === "correction" && canShowSolutionData', normalized_panel)
        self.assertIn("solutionMove", correction_body)
        self.assertIn("Le meilleur coup était", correction_body)

        self.assertIn("reviewSolutionRevealState", app_source)
        self.assertIn("setSolutionRevealForAnnotation", app_source)
        self.assertIn("resetSolutionReveal", app_source)
        self.assertIn("makeSolutionRevealKey", app_source)
        self.assertIn("reviewAnimationRequestId", app_source)
        self.assertIn("reviewAnimationRequestIdRef", app_source)
        self.assertIn("nextReviewAnimationRequestId", app_source)
        self.assertIn('nextReviewAnimationRequestId(`show_review_annotation_${mode}`)', normalized_app)
        self.assertIn('nextReviewAnimationRequestId("try_move_start")', normalized_app)
        self.assertIn("animationRequestId !== reviewAnimationRequestIdRef.current", app_source)
        self.assertIn("reviewOverlayPhase", app_source)
        self.assertIn("setReviewOverlayPhase", app_source)
        self.assertIn('return `${gameId ?? "no-game"}:${ply ?? "unknown"}:${mode}:${phase}:${fen}`;', normalized_app)
        self.assertIn("currentOverlayPositionKey !== expectedOverlayPositionKey", app_source)
        self.assertIn("review_overlay_position_key_mismatch_clear", app_source)
        self.assertIn("handleSolutionHintAnnotation", app_source)
        self.assertIn('setSolutionRevealForAnnotation(annotation, "attempted")', normalized_app)
        self.assertIn('setSolutionRevealForAnnotation(annotation, "solution_revealed")', normalized_app)
        self.assertIn('setSolutionRevealForAnnotation(annotation, "pv_line")', normalized_app)
        self.assertIn('"played_move_shown"', normalized_app)
        self.assertIn('clearReviewOverlays("show_review_annotation")', normalized_app)
        self.assertIn('clearReviewOverlays("try_move_start")', normalized_app)
        self.assertIn('clearReviewOverlays("manual_pv_line_close", false)', normalized_app)
        self.assertIn('resetSolutionReveal("review_pov_changed")', normalized_app)
        self.assertIn('resetSolutionReveal("select_move")', normalized_app)
        self.assertIn('resetSolutionReveal("go_initial_position")', normalized_app)
        self.assertIn('resetSolutionReveal("go_live_position")', normalized_app)
        self.assertIn('resetSolutionReveal("review_tab_left")', normalized_app)
        self.assertIn('resetSolutionReveal("game_changed")', normalized_app)

    def test_frontend_opening_reality_contract_is_staticly_present(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        review_panel_source = read_review_panel_source()
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        normalized_app = app_source.replace("\r\n", "\n")

        self.assertIn("export type OpeningRealityEvidence", client_source)
        self.assertIn("opening_reality_evidence?: OpeningRealityEvidence | null", client_source)
        self.assertIn("opening_reality_evidence_version?: string | null", client_source)
        self.assertIn("last_book_ply?: number | null", client_source)
        self.assertIn("fen_before_exit?: string | null", client_source)
        self.assertIn("fen_after_exit?: string | null", client_source)
        self.assertIn("OpeningRealityCard", review_panel_source)
        self.assertIn("ReviewFocusTabs", review_panel_source)
        self.assertIn('useState<ReviewFocusKey>("summary")', review_panel_source)
        self.assertIn("Résumé", review_panel_source)
        self.assertIn("Apprendre", review_panel_source)
        self.assertIn("Ouverture", review_panel_source)
        self.assertIn("S'entraîner", review_panel_source)
        self.assertIn("Explorer", review_panel_source)
        self.assertNotIn("Laboratoire", review_panel_source)
        self.assertIn("Réalité de l'ouverture", review_panel_source)
        self.assertIn("Dernier coup de livre", review_panel_source)
        self.assertIn("Coup de sortie", review_panel_source)
        self.assertIn("Revoir la sortie", review_panel_source)
        self.assertIn("Voir le moment lié", review_panel_source)
        self.assertIn("Pas de gros problème détecté juste après la sortie.", review_panel_source)
        self.assertIn("hidden={!canShowLinkedMoment}", review_panel_source)
        self.assertIn("Ouverture non applicable", review_panel_source)
        self.assertIn("Intention d'ouverture", review_panel_source)
        self.assertIn("openingGuideState", app_source)
        self.assertIn('"last_book"', app_source)
        self.assertIn('"exit_move"', app_source)
        self.assertIn('"post_exit_sequence"', app_source)
        self.assertIn("handleReviewFocusChange", app_source)
        self.assertIn("OPENING_INTENTION_STORAGE_KEY_PREFIX", app_source)
        self.assertIn("readOpeningIntentionNote", app_source)
        self.assertIn("writeOpeningIntentionNote", app_source)
        self.assertIn("handleShowOpeningExit", app_source)
        self.assertIn("handleShowOpeningLinkedMoment", app_source)
        self.assertIn('clearReviewOverlays("show_opening_exit")', normalized_app)
        self.assertIn('clearReviewOverlays(`review_focus_${nextFocus}`)', normalized_app)
        self.assertIn('clearReviewOverlays("show_opening_linked_moment")', normalized_app)
        self.assertIn('resetSolutionReveal("show_opening_exit")', normalized_app)
        self.assertIn('setReviewOpeningFocusMessage("Dernier moment encore dans le livre.")', normalized_app)
        self.assertIn('setReviewOpeningFocusMessage("Premier vrai moment critique après la sortie.")', normalized_app)
        self.assertIn('setSelectedReviewPov("both")', normalized_app)

    def test_v5_4_ui_lesson_mode_information_architecture_is_staticly_present(self) -> None:
        review_panel_source = read_review_panel_source()
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        normalized_panel = review_panel_source.replace("\r\n", "\n")
        normalized_app = app_source.replace("\r\n", "\n")

        self.assertIn("export type ReviewLessonStep", review_panel_source)
        for step in ('"observe"', '"try"', '"played"', '"solution"', '"compare"', '"takeaway"'):
            self.assertIn(step, review_panel_source)

        self.assertIn('useState<ReviewFocusKey>("summary")', review_panel_source)
        for label in ("Résumé", "Apprendre", "S'entraîner", "Explorer"):
            self.assertIn(label, review_panel_source)
        self.assertIn('{effectiveFocus === "summary" && (', normalized_panel)
        self.assertIn('{effectiveFocus === "learn" && (', normalized_panel)
        self.assertIn('{effectiveFocus === "practice" && (', normalized_panel)
        self.assertIn('{effectiveFocus === "lab" && (', normalized_panel)
        self.assertIn('setActiveFocus("learn")', normalized_panel)

        summary_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "review" / "ReviewCockpitSummary.tsx"
        ).read_text(encoding="utf-8")
        self.assertNotIn('<details className="review-score-details">', summary_source)
        self.assertNotIn("Écart diagnostique", summary_source)
        self.assertIn('<details className="review-analysis-options">', normalized_panel)
        self.assertIn("ReviewTechnicalDetails", normalized_panel)
        self.assertIn("<summary>Options d'analyse</summary>", normalized_panel)

        self.assertIn("export type ReviewPublicLessonStep", review_panel_source)
        self.assertIn("REVIEW_PUBLIC_LESSON_STEPS", review_panel_source)
        self.assertIn("review-public-stepper", review_panel_source)
        self.assertNotIn("REVIEW_LESSON_STEPS.map", normalized_panel)
        lesson_panel_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "review" / "ReviewLessonPanel.tsx"
        ).read_text(encoding="utf-8")
        self.assertNotIn('role="tab"', lesson_panel_source)
        for label in ("Défi", "Correction", "Entraînement"):
            self.assertIn(label, review_panel_source)
        old_visible_labels = ("Observer", "Essayer", "Coup joué", "Solution", "Comparer", "À retenir")
        self.assertLess(
            sum(1 for label in old_visible_labels if label in lesson_panel_source),
            len(old_visible_labels),
        )

        challenge_start = normalized_panel.index('data-public-lesson-step="challenge"')
        correction_start = normalized_panel.index('data-public-lesson-step="correction"')
        training_start = normalized_panel.index('data-public-lesson-step="training"')
        challenge_body = normalized_panel[challenge_start:correction_start]
        correction_body = normalized_panel[correction_start:training_start]
        training_body = normalized_panel[training_start:]
        self.assertIn("Trouve le meilleur coup.", challenge_body)
        self.assertIn("Impact potentiel", challenge_body)
        self.assertIn("Essayer", challenge_body)
        self.assertIn("Voir la correction", challenge_body)
        self.assertNotIn("solutionMove", challenge_body)
        self.assertNotIn("best_move_san", challenge_body)
        self.assertNotIn("Voir la ligne", challenge_body)

        self.assertIn("Voici ce que ton coup a permis.", correction_body)
        self.assertIn("Le meilleur coup était", correction_body)
        self.assertIn("Voir la ligne", correction_body)
        self.assertIn("Réessayer", correction_body)
        self.assertIn("Continuer", correction_body)

        self.assertIn("Transforme ce moment en entraînement.", training_body)
        self.assertIn("À retenir", training_body)
        self.assertIn("S'entraîner", training_body)
        self.assertIn("Moment suivant", training_body)

        self.assertIn(
            'const canShowLineComparison = lessonStep === "compare" || revealMode === "pv_line";',
            normalized_panel,
        )
        comparison_index = normalized_panel.index("<ReviewLineComparison")
        comparison_guard_index = normalized_panel.rfind(
            "canShowLineComparison",
            0,
            comparison_index,
        )
        self.assertNotEqual(comparison_guard_index, -1)
        self.assertLess(comparison_index - comparison_guard_index, 320)

        self.assertIn("ReviewStepStatus", app_source)
        self.assertIn("Position critique - trouve le meilleur coup.", review_panel_source)
        self.assertIn("Ton coup et la correction sont affichés.", review_panel_source)
        self.assertIn("La correction montre l'idée à retenir.", review_panel_source)
        self.assertIn("Compare les deux futurs.", review_panel_source)
        self.assertIn('className="primary"', review_panel_source)
        self.assertNotIn('className="review-board-hint"', normalized_app)
        self.assertNotIn('className="guided-replay-controls"', normalized_app)

        coach_card_start = normalized_panel.index("function ReviewCoachMomentCard")
        comparison_function_start = normalized_panel.index("function ReviewLineComparison")
        coach_card_body = normalized_panel[coach_card_start:comparison_function_start]
        self.assertNotIn("ReviewPvContrastTechnicalDetails", coach_card_body)
        self.assertNotIn("Détails techniques PV", coach_card_body)
        self.assertNotIn("best branch", review_panel_source.lower())
        self.assertNotIn("best branch", app_source.lower())

    def test_v5_4_ui_2_review_cockpit_contract_is_staticly_present(self) -> None:
        review_panel_source = read_review_panel_source()
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )
        normalized_panel = review_panel_source.replace("\r\n", "\n")
        normalized_app = app_source.replace("\r\n", "\n")

        self.assertIn(
            'type ReviewFocusKey = "summary" | "learn" | "practice" | "lab"',
            review_panel_source,
        )
        self.assertIn('useState<ReviewFocusKey>("summary")', review_panel_source)
        for label in ("Résumé", "Apprendre", "S'entraîner", "Explorer"):
            self.assertIn(label, review_panel_source)
        for guard in (
            '{effectiveFocus === "summary" && (',
            '{effectiveFocus === "learn" && (',
            '{effectiveFocus === "practice" && (',
            '{effectiveFocus === "lab" && (',
        ):
            self.assertIn(guard, normalized_panel)

        self.assertIn("ReviewCockpitSummary", review_panel_source)
        self.assertIn("reviewCockpitPriorities", review_panel_source)
        self.assertIn("visibleMoments = priorities.slice(0, 3)", review_panel_source)
        self.assertIn("Moments clés", review_panel_source)
        self.assertIn("S'entraîner sur cette Review", review_panel_source)
        self.assertIn("Explorer les détails", review_panel_source)
        self.assertIn("Le Score coach combine précision et gravité", review_panel_source)
        self.assertIn("L'analyse recommandée utilise un profil fiable", review_panel_source)
        self.assertIn('data-review-incomplete-single-cta="true"', review_panel_source)

        summary_start = normalized_panel.index("function ReviewCockpitSummary")
        summary_end = normalized_panel.index("function estimatePracticeMinutes", summary_start)
        summary_body = normalized_panel[summary_start:summary_end]
        for token in ("NeuroScore", "reviewCockpitPriorities", "review-key-moment-list", "review-training-card"):
            self.assertIn(token, summary_body)
        for forbidden_token in ("NeuroMonitor", "NeuroBrain", "BrainAtlas", "CognitiveMap", "neuro3d", "cortex"):
            self.assertNotIn(forbidden_token, summary_body)
        self.assertNotIn("ReviewAnalysisOptions", summary_body)
        self.assertNotIn("ReviewPvContrastTechnicalDetails", summary_body)

        incomplete_start = normalized_panel.index('if (!review || review.status === "not_generated")')
        incomplete_end = normalized_panel.index("return (\n    <div className=\"review-content\">", incomplete_start)
        incomplete_body = normalized_panel[incomplete_start:incomplete_end]
        self.assertIn("ReviewAnalysisUnavailableMessage", incomplete_body)
        self.assertNotIn("ReviewAnalysisProfileSelector", incomplete_body)
        self.assertNotIn("Analyse standard recommandée", incomplete_body)

        self.assertNotIn('<details className="review-score-details">', summary_body)
        self.assertNotIn("Écart diagnostique", summary_body)
        self.assertNotIn("criticality_score", summary_body)
        self.assertNotIn("diagnostic_gap", summary_body)
        self.assertNotIn("neuro_score_diag", summary_body)
        self.assertIn('<details className="review-analysis-options">', normalized_panel)
        self.assertNotIn('<details className="review-analysis-options" open', normalized_panel)
        self.assertIn("ReviewTechnicalDetails", normalized_panel)
        self.assertIn("<summary>Options d'analyse</summary>", normalized_panel)

        self.assertIn("setReviewFocusKey(\"summary\")", normalized_app)
        self.assertIn(
            "const activeReviewDisplayFocus: ReviewFocusKey = reviewPracticeState?.active",
            normalized_app,
        )
        self.assertIn("focusKey={activeReviewDisplayFocus}", normalized_app)
        self.assertNotIn("activeReviewDisplayFocus === \"summary\"", normalized_app)
        self.assertNotIn("activeReviewDisplayFocus !== \"summary\"", normalized_app)

        self.assertIn(".review-cockpit-summary", styles_source)
        self.assertIn(".review-main-navigation", styles_source)
        self.assertIn(".review-summary-simple", styles_source)
        self.assertIn(".review-key-moment-list", styles_source)
        self.assertIn(".review-training-card", styles_source)
        self.assertNotIn(".review-brain-map-v2", styles_source)

        self.assertNotIn("Meilleur choix", review_panel_source)
        self.assertNotIn("best branch", review_panel_source.lower())
        self.assertNotIn("best branch", app_source.lower())

    def test_v5_4_ui_3d1_neuroflow_panel_is_removed_from_v1_ui(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        cockpit_source = (
            PROJECT_ROOT
            / "frontend"
            / "src"
            / "components"
            / "review"
            / "ReviewCockpitSummary.tsx"
        ).read_text(encoding="utf-8")
        landing_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "LandingPage.tsx"
        ).read_text(encoding="utf-8")
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )
        normalized_app = app_source.replace("\r\n", "\n")

        removed_paths = [
            PROJECT_ROOT / "frontend" / "src" / "components" / "NeuroFlowPanel.tsx",
            PROJECT_ROOT / "frontend" / "src" / "components" / "NeuroMonitorBrain.tsx",
            PROJECT_ROOT / "frontend" / "src" / "components" / "neuro3d" / "NeuroMonitorBrain3D.tsx",
            PROJECT_ROOT / "frontend" / "src" / "components" / "neuro3d" / "neuroBrainVisualModel.ts",
            PROJECT_ROOT / "frontend" / "src" / "components" / "neuro3d" / "neuroBrainTypes.ts",
        ]
        for path in removed_paths:
            self.assertFalse(path.exists(), str(path))

        for forbidden in (
            "NeuroFlowPanel",
            "NeuroMonitorBrain",
            "NeuroMonitorBrain3D",
            "boardNeuroBrainData",
            "board-neuro3d-monitor",
            "review-neuro3d-monitor",
            "neuro3d",
        ):
            self.assertNotIn(forbidden, app_source)
            self.assertNotIn(forbidden, cockpit_source)
            self.assertNotIn(forbidden, landing_source)
            self.assertNotIn(forbidden, styles_source)

        self.assertIn("<ReviewStepStatus", app_source)
        self.assertIn('activeTab === "review" && (', normalized_app)
        self.assertIn("S'entraîner sur cette Review", cockpit_source)
        self.assertIn("DecisionHeroVisual", landing_source)
        self.assertNotIn("cerveau réel", landing_source.lower())
        self.assertNotIn("mesure neurologique", landing_source.lower())
        self.assertIn("@media (prefers-reduced-motion: reduce)", styles_source)

    def test_v5_4_ui_4_review_clarity_contract_is_staticly_present(self) -> None:
        review_dir = PROJECT_ROOT / "frontend" / "src" / "components" / "review"
        labels_source = (review_dir / "reviewLabels.ts").read_text(encoding="utf-8")
        cockpit_source = (review_dir / "ReviewCockpitSummary.tsx").read_text(encoding="utf-8")
        panel_source = (review_dir / "ReviewPanel.tsx").read_text(encoding="utf-8")
        pov_source = (review_dir / "ReviewScoreDetails.tsx").read_text(encoding="utf-8")
        lab_source = (review_dir / "ReviewLaboratoryPanel.tsx").read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )
        normalized_panel = panel_source.replace("\r\n", "\n")

        for label in ("Résumé", "Apprendre", "S'entraîner", "Explorer"):
            self.assertIn(f'label: "{label}"', labels_source)
        for old_key in ('key: "opening"', 'key: "lesson"', 'key: "explorer"'):
            self.assertNotIn(old_key, labels_source)

        self.assertIn("review-pov-selector compact", pov_source)
        self.assertIn("Changer", pov_source)
        self.assertIn("{open && (", pov_source)
        self.assertNotIn("<span>Analyser :</span>", pov_source)

        self.assertIn("NeuroScore", cockpit_source)
        self.assertIn("S'entraîner sur cette Review", cockpit_source)
        self.assertIn("Moments clés", cockpit_source)
        self.assertIn("visibleMoments = priorities.slice(0, 3)", cockpit_source)
        self.assertIn("Explorer les détails", cockpit_source)
        self.assertIn(".slice(0, 3)", (review_dir / "reviewViewModel.ts").read_text(encoding="utf-8"))
        self.assertNotIn("solutionBranch", cockpit_source)

        for forbidden in ("NeuroMonitor", "NeuroBrain", "BrainAtlas", "CognitiveMap", "neuro3d", "cortex"):
            self.assertNotIn(forbidden, cockpit_source)
            self.assertNotIn(forbidden, panel_source)

        self.assertIn('{effectiveFocus === "learn" && (', normalized_panel)
        self.assertIn('{effectiveFocus === "practice" && (', normalized_panel)
        self.assertIn('{effectiveFocus === "lab" && (', normalized_panel)
        self.assertNotIn('{effectiveFocus === "opening" && (', normalized_panel)
        self.assertNotIn('{effectiveFocus === "explorer" && (', normalized_panel)

        for token in (
            "Explorer tous les coups",
            "Ouverture détaillée",
            "Options d'analyse",
            "Détails techniques",
            "Preuves PV",
        ):
            self.assertIn(token, lab_source)
        self.assertNotIn('<details className="review-score-details">', cockpit_source)
        self.assertNotIn("Écart diagnostique", cockpit_source)
        summary_body = cockpit_source[cockpit_source.index("export function ReviewCockpitSummary") :]
        self.assertNotIn("ReviewTechnicalDetails", summary_body)
        self.assertNotIn("Options d'analyse", summary_body)
        self.assertNotIn("criticality_score", summary_body)
        self.assertNotIn("diagnostic_gap", summary_body)
        self.assertNotIn("neuro_score_diag", summary_body)

        self.assertIn(
            "const activeReviewDisplayFocus: ReviewFocusKey = reviewPracticeState?.active",
            app_source,
        )
        self.assertIn("focusKey={activeReviewDisplayFocus}", app_source)
        self.assertNotIn('activeReviewDisplayFocus === "summary"', app_source)
        self.assertNotIn('activeReviewDisplayFocus !== "summary"', app_source)
        self.assertIn(".review-main-navigation", styles_source)
        self.assertIn(".review-summary-simple", styles_source)
        self.assertIn(".review-training-card", styles_source)
        self.assertNotIn(".review-brain-map-v2", styles_source)
        self.assertIn(".review-laboratory", styles_source)

        for marker in ("Ã", "Â", "â", "�", "prÃ", "?coul?", "z?ro"):
            self.assertNotIn(marker, cockpit_source + panel_source + pov_source + lab_source)

    def test_v5_5_neuro_visuals_are_research_only_not_v1_ui(self) -> None:
        neuro3d_dir = PROJECT_ROOT / "frontend" / "src" / "components" / "neuro3d"
        frontend_src = PROJECT_ROOT / "frontend" / "src"
        research_backlog = (PROJECT_ROOT / "docs" / "RESEARCH_BACKLOG.md").read_text(
            encoding="utf-8"
        )
        feature_boundaries = (
            PROJECT_ROOT / "docs" / "PLAN_FEATURE_BOUNDARIES.md"
        ).read_text(encoding="utf-8")

        self.assertFalse((frontend_src / "components" / "NeuroMonitorBrain.tsx").exists())
        self.assertFalse((frontend_src / "components" / "NeuroFlowPanel.tsx").exists())
        self.assertFalse((neuro3d_dir / "NeuroMonitorBrain3D.tsx").exists())
        self.assertFalse((neuro3d_dir / "neuroBrainVisualModel.ts").exists())
        self.assertFalse((neuro3d_dir / "neuroBrainTypes.ts").exists())
        self.assertIn("RESEARCH / not V1 / not user-facing", research_backlog)
        self.assertIn("NeuroMonitor / brain visual", feature_boundaries)
        self.assertIn("research", feature_boundaries.lower())
        self.assertIn("hide", feature_boundaries.lower())

    def test_v5_5_review_summary_has_no_neuro_visual_contract(self) -> None:
        review_dir = PROJECT_ROOT / "frontend" / "src" / "components" / "review"
        cockpit_source = (review_dir / "ReviewCockpitSummary.tsx").read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )

        self.assertIn("NeuroScore", cockpit_source)
        self.assertIn("S'entraîner sur cette Review", cockpit_source)
        self.assertIn("visibleMoments = priorities.slice(0, 3)", cockpit_source)
        self.assertIn("review-reference-details", cockpit_source)
        self.assertIn("review-training-card", cockpit_source)
        for forbidden in (
            "buildNeuroMonitorBrainData",
            "findNeuroMonitorAnnotationForDomain",
            "handleBrainDomainClick",
            "review-neuro3d-monitor",
            "brainData",
            "NeuroFlowPanel",
        ):
            self.assertNotIn(forbidden, cockpit_source)
            self.assertNotIn(forbidden, app_source)
        for forbidden_selector in (
            ".review-brain-map-v2",
            ".neuroflow-panel",
            ".neuro-monitor-brain",
            ".neuro-brain-visual",
            "@keyframes neuro3d-flow",
        ):
            self.assertNotIn(forbidden_selector, styles_source)

    def test_v5_4_landing_1_landing_page_navigation_contract_is_staticly_present(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        landing_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "LandingPage.tsx"
        ).read_text(encoding="utf-8")
        logo_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "NeuroChessLogo.tsx"
        ).read_text(encoding="utf-8")
        review_panel_source = read_review_panel_source()
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )
        normalized_app = app_source.replace("\r\n", "\n")

        self.assertIn("export function LandingPage", landing_source)
        self.assertIn("function DecisionHeroVisual", landing_source)
        self.assertIn("export function NeuroChessLogo", logo_source)
        self.assertIn("import { LandingPage }", app_source)
        self.assertIn("import { NeuroChessLogo }", app_source)
        self.assertIn("function NeuroChessApp", app_source)
        self.assertIn("<LandingPage", app_source)
        self.assertIn("<NeuroChessApp", app_source)
        self.assertIn("normalizeRoute(readCurrentPath())", app_source)
        self.assertIn('pathname.startsWith("/app") ? "/app" : "/"', normalized_app)
        self.assertIn('currentRoute === "/app"', app_source)
        self.assertIn("window.history.pushState", app_source)
        self.assertIn('onNavigateApp={() => navigateTo("/app")}', normalized_app)
        self.assertIn('onNavigateHome={() => navigateTo("/")}', normalized_app)

        self.assertIn('href = "/"', logo_source)
        self.assertIn('variant = "light"', logo_source)
        self.assertIn('"compact"', logo_source)
        self.assertIn('href="/app"', landing_source)
        self.assertIn("Commencer", landing_source)
        self.assertIn("Importer une partie", landing_source)
        self.assertIn("Ouvrir l'app", landing_source)
        for token in (
            "Fonctionnalites",
            "Parcours",
            "Methode",
            "Comprends ta partie",
            "Review coach",
            "NeuroScore",
            "Practice Review",
            "Import PGN",
            "Stockfish local",
        ):
            self.assertIn(token, landing_source)
        for section_id in (
            'id="features"',
            'id="how-it-works"',
            'id="science"',
        ):
            self.assertIn(section_id, landing_source)
        self.assertNotIn("Tarifs", landing_source)
        self.assertNotIn('id="pricing"', landing_source)
        self.assertNotIn("landing-price-card", landing_source)

        self.assertIn("decision-visual", landing_source)
        self.assertIn("DecisionHeroVisual", landing_source)
        self.assertIn("Stockfish local", landing_source)
        self.assertIn("une action utile", landing_source.lower())
        for forbidden_user_facing in (
            "NeuroMonitor",
            "Neuro-Monitor",
            "NeuroBrain",
            "BrainAtlas",
            "CognitiveMap",
            "neuro3d",
            "cortex",
            "cartographie",
            "brain",
        ):
            self.assertNotIn(forbidden_user_facing, landing_source)
        for forbidden_claim in (
            "EEG",
            "mesure neurologique",
            "mesure votre cerveau en temps réel",
        ):
            self.assertNotIn(forbidden_claim.lower(), landing_source.lower())

        self.assertIn(".landing-page", styles_source)
        self.assertIn(".landing-nav", styles_source)
        self.assertIn(".landing-hero", styles_source)
        self.assertIn(".decision-visual", styles_source)
        self.assertIn(".landing-card", styles_source)
        self.assertIn(".neuro-logo", styles_source)
        self.assertIn("@keyframes landing-decision-flow", styles_source)
        self.assertIn("@media (prefers-reduced-motion: reduce)", styles_source)
        self.assertNotIn(".landing-page", review_panel_source)
        self.assertIn("ReviewPanel", app_source)

        for marker in ("Ã", "Â", "â", "�", "prÃ", "?coul?", "z?ro"):
            self.assertNotIn(marker, landing_source)
            self.assertNotIn(marker, logo_source)

    def test_v5_5_home_ux_removes_monitor_and_keeps_calm_entry_contract(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        landing_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "LandingPage.tsx"
        ).read_text(encoding="utf-8")
        logo_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "NeuroChessLogo.tsx"
        ).read_text(encoding="utf-8")
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )

        self.assertIn("home-shell", landing_source)
        self.assertIn("home-continuum", landing_source)
        self.assertIn("DecisionHeroVisual", landing_source)
        self.assertIn("Review guidee", landing_source)
        self.assertIn("Importer une partie", landing_source)
        self.assertIn("entrainement depuis tes parties", landing_source)
        self.assertIn("une action utile a chaque etape", landing_source)

        self.assertIn('"header"', logo_source)
        self.assertIn('variant="header"', landing_source)
        self.assertIn('variant="header"', app_source)
        self.assertIn('href="/"', app_source)
        self.assertIn("onNavigateHome()", app_source)
        self.assertIn("app-brand-title", app_source)

        for selector in (
            ".home-shell",
            ".home-continuum",
            ".decision-visual",
            ".app-header",
            ".app-brand",
            ".app-brand-logo",
            ".app-brand-title",
            "@keyframes landing-decision-flow",
        ):
            self.assertIn(selector, styles_source)

        for forbidden in (
            "HomeNeuroMonitor",
            "NeuroMonitorBrain",
            "NeuroFlowPanel",
            "home-neuro-monitor",
            "neuro-monitor-brain",
            "neuro-brain-visual",
            "neuro-monitor-flow",
            "brain",
            "cortex",
        ):
            self.assertNotIn(forbidden, landing_source)
            self.assertNotIn(forbidden, styles_source)

        for forbidden_claim in ("cerveau réel", "mesure neurologique", "LLM"):
            self.assertNotIn(forbidden_claim.lower(), landing_source.lower())

        for marker in ("Ã", "Â", "â", "�", "prÃ", "?coul?", "z?ro"):
            self.assertNotIn(marker, landing_source)
            self.assertNotIn(marker, logo_source)

    def test_frontend_live_eventsource_contract_is_staticly_present(self) -> None:
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        evaluation_bar_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "EvaluationBar.tsx"
        ).read_text(encoding="utf-8")

        self.assertIn("liveAnalysisStreamUrl", client_source)
        self.assertIn("new EventSource", app_source)
        self.assertIn("eventSource.close()", app_source)
        self.assertIn("update.session_id !== currentLiveSessionRef.current", app_source)
        self.assertIn("update.fen !== currentBoardFen", app_source)
        self.assertIn("normalizeBoardEvaluationContext(update.context) !== currentContext", app_source)
        self.assertIn('kind === "live"', evaluation_bar_source)
        self.assertIn('return "live"', evaluation_bar_source)

    def test_frontend_live_stale_update_guard_is_strict(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        normalized = app_source.replace("\r\n", "\n")

        self.assertIn("update.session_id !== currentLiveSessionRef.current", normalized)
        self.assertIn("const currentBoardFen = boardFenRef.current", normalized)
        self.assertIn(
            "currentBoardFen && update.fen && update.fen !== currentBoardFen",
            normalized,
        )
        self.assertIn("const currentContext = currentBoardContextRef.current", normalized)
        self.assertIn(
            "normalizeBoardEvaluationContext(update.context) !== currentContext",
            normalized,
        )
        self.assertNotIn(
            "update.fen !== currentFenRef.current &&\n"
            "        update.ply !== currentPlyRef.current",
            normalized,
        )

    def test_frontend_ignored_live_update_cannot_replace_evaluation_or_warn(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        normalized = app_source.replace("\r\n", "\n")
        stale_guard_start = normalized.index(
            "if (update.session_id !== currentLiveSessionRef.current)"
        )
        valid_update_start = normalized.index("const now = Date.now();")
        stale_guard_block = normalized[stale_guard_start:valid_update_start]

        self.assertIn("return;", stale_guard_block)
        self.assertNotIn("setEvaluation(update.evaluation_display)", stale_guard_block)
        self.assertNotIn("setEvaluationSource(update.evaluation_source)", stale_guard_block)
        self.assertNotIn('setLiveStatus("analyse live indisponible")', stale_guard_block)

    def test_frontend_valid_live_update_replaces_evaluation_and_source(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        normalized = app_source.replace("\r\n", "\n")
        valid_update_start = normalized.index("const now = Date.now();")
        valid_update_block = normalized[valid_update_start:]

        self.assertIn("setEvaluation(update.evaluation_display)", valid_update_block)
        self.assertIn("setEvaluationFen(update.fen ?? currentBoardFen ?? null)", valid_update_block)
        self.assertIn("setEvaluationSource({", valid_update_block)
        self.assertIn("kind: liveSourceKindForContext(currentContext)", valid_update_block)
        self.assertIn("hasValidLiveUpdateRef.current = true", valid_update_block)
        self.assertIn("clearTransientEngineStartupState()", valid_update_block)
        self.assertIn("setLiveStatus(null)", valid_update_block)

    def test_frontend_live_warning_state_cleanup_is_staticly_present(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )

        self.assertIn("hasValidLiveUpdateRef", app_source)
        self.assertIn("liveStoppedNormallyRef", app_source)
        self.assertIn("hasValidLiveUpdateRef.current = true", app_source)
        self.assertIn("setLiveStatus(null)", app_source)
        self.assertIn('update.type === "analysis_stopped"', app_source)
        self.assertIn("liveStoppedNormallyRef.current = true", app_source)
        self.assertIn("!hasValidLiveUpdateRef.current", app_source)
        self.assertIn("!liveStoppedNormallyRef.current", app_source)
        self.assertIn("currentLiveSessionRef.current = null", app_source)

    def test_frontend_cannot_show_live_warning_after_valid_live_update(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )

        self.assertIn("hasValidLiveUpdateRef.current = true", app_source)
        self.assertIn("setEvaluationSource({", app_source)
        self.assertIn("liveSourceKindForContext(currentContext)", app_source)
        self.assertIn("!hasValidLiveUpdateRef.current", app_source)
        self.assertNotIn('setLiveStatus("analyse live indisponible");\\n      eventSource.close();', app_source)

    def test_frontend_filters_engine_warning_when_evaluation_is_valid(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )

        self.assertIn("ANALYSIS_UNAVAILABLE_WARNINGS", app_source)
        self.assertIn('"analysis_engine_unavailable"', app_source)
        self.assertIn('"engine_unavailable"', app_source)
        self.assertIn('"live_analysis_unavailable"', app_source)
        self.assertIn("EVALUATION_SOURCE_KINDS", app_source)
        self.assertIn('"shallow"', app_source)
        self.assertIn('"live"', app_source)
        self.assertIn('"deep"', app_source)
        self.assertIn('"calibration"', app_source)
        self.assertIn("const hasVisibleEvaluation = hasUsableEvaluation", app_source)
        self.assertIn("const suppressTransientAnalysisWarnings", app_source)
        self.assertIn("engineWarmupGraceActive", app_source)
        self.assertIn("const visibleWarnings = suppressTransientAnalysisWarnings", app_source)
        self.assertIn("removeAnalysisUnavailableWarnings(warnings)", app_source)
        self.assertIn("visibleWarnings.length > 0", app_source)
        self.assertNotIn("warnings.length > 0 &&", app_source)

    def test_frontend_live_update_clears_obsolete_analysis_warnings(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        normalized = app_source.replace("\r\n", "\n")
        valid_update_start = normalized.index("const now = Date.now();")
        valid_update_end = normalized.index("eventSource.onerror")
        valid_update_block = normalized[valid_update_start:valid_update_end]

        self.assertIn("update.evaluation_source?.kind === \"live\"", valid_update_block)
        self.assertIn("setWarnings(removeAnalysisUnavailableWarnings)", valid_update_block)
        self.assertIn("engine_warmup_cleared_by_live", valid_update_block)
        self.assertIn("clearTransientEngineStartupState()", valid_update_block)
        self.assertIn("setLiveStatus(null)", valid_update_block)

    def test_frontend_live_warning_requires_no_existing_evaluation(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )

        self.assertIn("const hasValidEvaluationRef = useRef(false)", app_source)
        self.assertIn("hasValidEvaluationRef.current = hasVisibleEvaluation", app_source)
        self.assertIn("!hasValidEvaluationRef.current", app_source)
        self.assertIn("ENGINE_WARMUP_GRACE_MS = 3500", app_source)
        self.assertIn("BOARD_EVALUATION_RETRY_DELAYS_MS = [500, 1500, 3000, 5000]", app_source)
        self.assertIn("scheduleBoardEvaluationRetry", app_source)
        self.assertIn("Initialisation du moteur...", app_source)
        self.assertIn("engineWarningGraceActive", app_source)
        self.assertIn("beginEngineWarmupGrace", app_source)
        self.assertIn("engine_warmup_started_for_game", app_source)
        self.assertIn("engine_warmup_warning_suppressed", app_source)
        self.assertIn("engine_warning_confirmed_after_retries", app_source)
        self.assertIn("stale_engine_warning_ignored", app_source)
        self.assertIn("setEngineWarningGraceActive(true)", app_source)
        self.assertIn("setBoardEvaluationRetryNonce", app_source)

    def test_frontend_apply_state_drops_obsolete_analysis_warnings(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        normalized = app_source.replace("\r\n", "\n")
        apply_state_start = normalized.index("function applyState")
        apply_state_end = normalized.index("const statusText")
        apply_state_block = normalized[apply_state_start:apply_state_end]

        self.assertIn("const nextEvaluation = state.evaluation_display ?? state.evaluation", apply_state_block)
        self.assertIn("const nextEvaluationSource = state.evaluation_source ?? null", apply_state_block)
        self.assertIn("hasUsableEvaluation(nextEvaluation, nextEvaluationSource)", apply_state_block)
        self.assertIn("engine_warning_received", apply_state_block)
        self.assertIn("engine_warmup_cleared_by_shallow", apply_state_block)
        self.assertIn("shallow_update_success_clears_warning", apply_state_block)
        self.assertIn("removeAnalysisUnavailableWarnings(nextWarnings)", apply_state_block)

    def test_frontend_review_controls_are_minimal_and_gated(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        review_panel_source = read_review_panel_source()
        review_state_source = (
            PROJECT_ROOT / "frontend" / "src" / "reviewState.ts"
        ).read_text(encoding="utf-8")

        self.assertIn("export type ReviewResponse", client_source)
        self.assertIn("generateReview", client_source)
        self.assertIn("getReview", client_source)
        self.assertIn("startReviewJob", client_source)
        self.assertIn("getReviewJob", client_source)
        self.assertIn("cancelReviewJob", client_source)
        self.assertIn("rebuildReviewMetrics", client_source)
        self.assertIn("/review/rebuild-metrics", client_source)
        self.assertIn("ReviewJobResponse", client_source)
        self.assertIn("review_work_active", client_source)
        self.assertIn("scheduled_deep_count", client_source)
        self.assertIn("failed_deep_count", client_source)
        self.assertIn("failed_deep_details", client_source)
        self.assertIn("force_retry_failed", client_source)
        self.assertIn("force_reanalysis", client_source)
        self.assertIn("reviewPanelDisplayStatus", review_panel_source)
        self.assertIn('displayStatus === "not_reviewable"', review_panel_source)
        self.assertNotIn("if (loading)", review_panel_source)
        self.assertIn("Partie trop courte", review_state_source)
        self.assertIn("makeShortGameReviewResponse", app_source)
        self.assertIn("isTooShortReviewError", app_source)
        self.assertIn("review_not_reviewable_wins", app_source)
        self.assertIn("review_job_start_request", app_source)
        self.assertIn("review_job_start_response", app_source)
        self.assertIn("review_job_poll_started", app_source)
        self.assertIn("review_job_poll_cleared", app_source)
        self.assertIn("review_pending_timeout", app_source)
        self.assertIn("review_timeout_triggered", app_source)
        self.assertIn("completed_position_count", app_source)
        self.assertIn("required_position_count", app_source)
        self.assertIn("review_poll_created", app_source)
        self.assertIn("review_poll_cleared", app_source)
        self.assertIn("reviewJobPollIntervalRef", app_source)
        self.assertIn("handleCancelReviewJob", app_source)
        self.assertIn("export const MIN_REVIEW_HALF_MOVES = 10", review_state_source)
        self.assertIn("const canRequestReview = isGameCompleted", app_source)
        self.assertIn("Voir la Review", app_source)
        self.assertIn("Moments à revoir", review_panel_source)
        self.assertIn("Analyse approfondie en cours", review_panel_source)
        self.assertIn("L'analyse approfondie continue en arrière-plan", review_state_source)
        self.assertIn("Vérifiez à nouveau dans quelques instants", review_state_source)
        self.assertIn("Aucun moment majeur détecté", review_state_source)
        self.assertIn("Reprendre", review_panel_source)
        self.assertIn("Vérifier à nouveau", review_panel_source)
        self.assertIn("Relancer l'analyse", review_panel_source)
        self.assertIn("forceRetryFailed: hasFailedDeep", review_panel_source)
        self.assertIn("L'analyse approfondie a échoué", review_state_source)
        self.assertIn("cp_loss_label", review_panel_source)
        self.assertNotIn("moment.cp_loss}", review_panel_source)

    def test_frontend_review_spinner_hard_stop_contract_is_staticly_present(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        review_state_source = (
            PROJECT_ROOT / "frontend" / "src" / "reviewState.ts"
        ).read_text(encoding="utf-8")
        review_panel_source = read_review_panel_source()
        normalized_state = review_state_source.replace("\r\n", "\n")

        self.assertIn("export const REVIEW_PENDING_TIMEOUT_MS = 60_000", review_state_source)
        self.assertIn("reviewPendingStartedAtRef", app_source)
        self.assertIn("if (reviewPendingStartedAtRef.current === null)", app_source)
        self.assertIn("Date.now() - startedAt", app_source)
        self.assertIn("elapsed >= REVIEW_PENDING_TIMEOUT_MS", app_source)
        self.assertIn("triggerReviewTimeout", app_source)
        self.assertIn("clearReviewPolling(\"timeout\")", app_source)
        self.assertIn("dispatchReviewEvent({ type: \"timeout\" })", app_source)
        self.assertIn("reviewPollIntervalRef", app_source)
        self.assertIn("window.clearInterval(reviewPollIntervalRef.current)", app_source)
        self.assertIn("clearReviewPolling(\"game_id_changed\")", app_source)
        self.assertIn("clearReviewPolling(\"unmount\")", app_source)
        self.assertIn("clearReviewJobPolling(\"retry_or_generate\")", app_source)
        self.assertIn("clearReviewPolling(`terminal_${nextStatus}`)", app_source)
        self.assertIn("clearReviewJobPolling(\"review_job_completed\")", app_source)
        self.assertIn("clearReviewPolling(\"retry_or_generate\")", app_source)
        self.assertIn("pendingStartedAt: null", normalized_state)
        self.assertIn("event.type === \"generate_started\"", normalized_state)
        self.assertIn("state.status === \"generating\" ? \"generating\" : \"pending\"", normalized_state)
        self.assertIn("displayStatus === \"timeout\"", review_panel_source)
        self.assertIn("displayStatus === \"stalled\"", review_panel_source)
        self.assertIn("displayStatus === \"pending_background\"", review_panel_source)
        self.assertIn("displayStatus === \"pending\" || displayStatus === \"generating\"", review_panel_source)
        self.assertLess(
            normalized_state.index('responseStatus === "not_reviewable"'),
            normalized_state.index('state.status === "timeout"'),
        )
        self.assertLess(
            review_panel_source.index('displayStatus === "not_reviewable"'),
            review_panel_source.index('displayStatus === "pending"'),
        )
        self.assertNotIn("if (loading)", review_panel_source)
        self.assertNotIn("loading:", review_panel_source)

    def test_frontend_review_visible_spinner_timeout_contract_is_staticly_present(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        review_state_source = (
            PROJECT_ROOT / "frontend" / "src" / "reviewState.ts"
        ).read_text(encoding="utf-8")
        review_panel_source = read_review_panel_source()
        normalized_app = app_source.replace("\r\n", "\n")
        normalized_state = review_state_source.replace("\r\n", "\n")

        self.assertIn("export const REVIEW_VISIBLE_SPINNER_TIMEOUT_MS = 3_000", normalized_state)
        self.assertIn("pending_background", normalized_state)
        self.assertIn("visible_spinner_elapsed", normalized_state)
        self.assertIn("REVIEW_PENDING_BACKGROUND_MESSAGE", normalized_state)
        self.assertIn("REVIEW_STALLED_MESSAGE", normalized_state)
        self.assertIn("response.review_work_active !== true", normalized_state)
        self.assertIn('response.status === "stalled"', normalized_state)
        self.assertIn("L'analyse approfondie continue en arrière-plan", normalized_state)
        self.assertIn("Vérifiez à nouveau dans quelques instants", normalized_state)
        self.assertIn("L'analyse approfondie n'a pas pu être lancée", normalized_state)
        self.assertIn("REVIEW_FAILED_DEEP_MESSAGE", normalized_state)
        self.assertIn("reviewVisibleSpinnerTimerRef", normalized_app)
        self.assertIn("reviewVisibleSpinnerTimedOutRef", normalized_app)
        self.assertIn("window.setTimeout", normalized_app)
        self.assertIn("REVIEW_VISIBLE_SPINNER_TIMEOUT_MS", normalized_app)
        self.assertIn("triggerReviewPendingBackground", normalized_app)
        self.assertIn('debugLog("review_visible_spinner_timeout"', normalized_app)
        self.assertIn('clearReviewPolling("visible_spinner_timeout")', normalized_app)
        self.assertIn('dispatchReviewEvent({ type: "visible_spinner_elapsed" })', normalized_app)
        self.assertIn("setReviewLoading(false)", normalized_app)
        self.assertIn("startReviewVisibleSpinnerTimer(targetGameId)", normalized_app)
        self.assertIn("startReviewJob(targetGameId,", normalized_app)
        self.assertIn("startReviewJobPolling(job)", normalized_app)
        self.assertIn("getReviewJob(jobId)", normalized_app)
        self.assertIn("cancelReviewJob(reviewJob.job_id)", normalized_app)
        self.assertLess(
            normalized_app.index("startReviewVisibleSpinnerTimer(targetGameId)"),
            normalized_app.index("const nextReview = await getReview(targetGameId,"),
        )
        self.assertIn("reviewVisibleSpinnerTimedOutRef.current", normalized_app)
        self.assertIn('clearReviewJobPolling("review_job_completed")', normalized_app)
        self.assertIn('clearReviewPolling("pending_background_check")', normalized_app)
        self.assertIn("nextReview.review_work_active", normalized_app)
        self.assertIn("nextReview.failed_deep_details", normalized_app)
        self.assertIn('clearReviewVisibleSpinnerTimer("game_id_changed")', normalized_app)
        self.assertIn('clearReviewVisibleSpinnerTimer("unmount")', normalized_app)
        self.assertIn("window.clearTimeout(reviewVisibleSpinnerTimerRef.current)", normalized_app)
        self.assertIn('displayStatus === "pending_background"', review_panel_source)
        self.assertIn("REVIEW_PENDING_BACKGROUND_MESSAGE", review_panel_source)
        self.assertIn("Vérifier à nouveau", review_panel_source)
        self.assertIn("Relancer l'analyse", review_panel_source)
        pending_background_block = review_panel_source[
            review_panel_source.index('displayStatus === "pending_background"'):
            review_panel_source.index('displayStatus === "pending"', review_panel_source.index('displayStatus === "pending_background"'))
        ]
        self.assertIn("onCheck", pending_background_block)
        self.assertNotIn("Réessayer", pending_background_block)
        pending_background_index = normalized_state.index('state.status === "pending_background"')
        pending_index = normalized_state.index('responseStatus === "pending"')
        self.assertLess(pending_background_index, pending_index)

    def test_frontend_review_no_significant_moments_contract_is_staticly_present(self) -> None:
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        review_state_source = (
            PROJECT_ROOT / "frontend" / "src" / "reviewState.ts"
        ).read_text(encoding="utf-8")
        review_panel_source = read_review_panel_source()

        self.assertIn("empty_reason", client_source)
        self.assertIn('"no_significant_moments"', client_source)
        self.assertIn("analyzed_deep_count", client_source)
        self.assertIn("review_work_active", client_source)
        self.assertIn("REVIEW_NO_SIGNIFICANT_MOMENTS_MESSAGE", review_state_source)
        self.assertIn(
            "Aucun moment majeur détecté : la partie est restée trop équilibrée",
            review_state_source,
        )
        self.assertIn("hasNoSignificantMoments", review_panel_source)
        self.assertIn('review?.empty_reason === "no_significant_moments"', review_panel_source)
        self.assertIn("review?.moments.length === 0", review_panel_source)
        no_significant_start = review_panel_source.index("if (hasNoSignificantMoments)")
        pending_background_start = review_panel_source.index('displayStatus === "pending_background"')
        spinner_start = review_panel_source.index('displayStatus === "pending"')
        self.assertLess(no_significant_start, pending_background_start)
        self.assertLess(no_significant_start, spinner_start)
        no_significant_block = review_panel_source[
            no_significant_start:pending_background_start
        ]
        self.assertIn("REVIEW_NO_SIGNIFICANT_MOMENTS_MESSAGE", no_significant_block)
        self.assertNotIn("REVIEW_PENDING_BACKGROUND_MESSAGE", no_significant_block)
        self.assertNotIn("spinner", no_significant_block)
        self.assertNotIn("onCheck", no_significant_block)
        self.assertIn("renderFocusedReviewModule(true)", no_significant_block)
        self.assertIn("resetPicker", review_panel_source)
        self.assertNotIn("Vérifier à nouveau", no_significant_block)
        self.assertNotIn("Réessayer", no_significant_block)
        self.assertIn("handleReviewCheck", app_source)
        self.assertIn("const nextReview = await getReview(targetGameId,", app_source)
        self.assertIn('dispatchReviewEvent({ type: "check_started" })', app_source)
        self.assertIn("onCheck={handleReviewCheck}", app_source)
        self.assertIn("missing_deep_count === 0", review_state_source)
        self.assertIn("Array.isArray(response.moments)", review_state_source)
        self.assertIn("response.moments.length === 0", review_state_source)
        self.assertIn("response.review_work_active !== true", review_state_source)
        self.assertIn('return "stalled"', review_state_source)

    def test_frontend_review_criticality_fields_and_labels_are_present(self) -> None:
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        review_panel_source = read_review_panel_source()

        for token in (
            "mover_win_loss",
            "criticality_score",
            "moment_type",
            "zone_before",
            "zone_after",
            "zone_transition",
            "eval_source_kind",
            "eval_depth_before",
            "eval_depth_after",
        ):
            self.assertIn(token, client_source)

        self.assertIn("momentTypeLabel", review_panel_source)
        self.assertIn("turning_point", review_panel_source)
        self.assertIn("lost_advantage", review_panel_source)
        self.assertIn("aggravation", review_panel_source)
        self.assertIn("decisive", review_panel_source)
        self.assertIn("Tournant de partie", review_panel_source)
        self.assertIn("Avantage laissé filer", review_panel_source)
        self.assertIn("Aggravation", review_panel_source)
        self.assertIn("Moment décisif", review_panel_source)

    def test_review_score_summary_contract_is_staticly_present(self) -> None:
        review_service_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "review_service.py"
        ).read_text(encoding="utf-8")
        review_metrics_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "metrics" / "review_metrics.py"
        ).read_text(encoding="utf-8")
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        review_panel_source = read_review_panel_source()

        self.assertIn('REVIEW_SCORE_FORMULA_VERSION = DUAL_REVIEW_SCORE_FORMULA_VERSION', review_service_source)
        self.assertIn('DUAL_REVIEW_SCORE_FORMULA_VERSION = "dual_lichess_neuro_v1"', review_metrics_source)
        self.assertIn('MOVE_ACCURACY_FORMULA_VERSION = "lichess_exp_uncertainty_v1"', review_metrics_source)
        self.assertIn('GAME_ACCURACY_FORMULA_VERSION = "lichess_weighted_harmonic_v1"', review_metrics_source)
        self.assertIn('NEURO_SCORE_FORMULA_VERSION = "neuro_diagnostic_regularized_v1"', review_metrics_source)
        self.assertIn("def white_percent_from_eval", review_metrics_source)
        self.assertIn("def move_accuracy_from_win_loss", review_service_source)
        self.assertIn("103.1668100711649", review_metrics_source)
        self.assertIn("-0.04354415386753951", review_metrics_source)
        self.assertIn("def lichess_like_game_accuracy", review_metrics_source)
        self.assertIn("def neuro_diagnostic_score", review_metrics_source)
        self.assertIn("def review_metric_bundle", review_metrics_source)
        self.assertIn("volatility_weight", review_metrics_source)
        self.assertIn("harmonic_mean", review_metrics_source)
        self.assertIn("persistence_weight", review_metrics_source)
        self.assertIn("cluster_weight", review_metrics_source)
        self.assertIn("omega = clamp", review_metrics_source)
        self.assertIn("100.0 * exp(-0.035 * z_value)", review_metrics_source)
        self.assertIn("def build_review_evidence_for_move", review_service_source)
        self.assertIn('REVIEW_EVIDENCE_SCHEMA_VERSION = "review_evidence_v1"', review_service_source)
        self.assertIn("def review_score_confidence", review_service_source)
        self.assertIn("MIN_ANALYZED_MOVES_FOR_REVIEW_SCORE = 5", review_service_source)
        self.assertIn("mover_win_percent_loss(", review_service_source)
        self.assertIn("_stable_score_for_analysis", review_service_source)
        self.assertIn("_review_analysis_origin", review_service_source)
        self.assertIn("_review_analysis_state", review_service_source)
        self.assertIn("_review_analysis_quality", review_service_source)
        self.assertIn("_review_score_audit_row", review_service_source)

        for token in (
            "white_review_score",
            "black_review_score",
            "user_review_score",
            "opponent_review_score",
            "white_lichess_like_accuracy",
            "black_lichess_like_accuracy",
            "user_lichess_like_accuracy",
            "opponent_lichess_like_accuracy",
            "white_public_neuro_score",
            "black_public_neuro_score",
            "user_public_neuro_score",
            "opponent_public_neuro_score",
            "public_neuro_score",
            "public_score_formula_version",
            "qualitative_game_label",
            "qualitative_game_label_formula_version",
            "white_neuro_score",
            "black_neuro_score",
            "user_neuro_score",
            "opponent_neuro_score",
            "white_diagnostic_gap",
            "black_diagnostic_gap",
            "user_diagnostic_gap",
            "opponent_diagnostic_gap",
            "headline_neurochess_score",
            "headline_score_formula_version",
            "review_summary_sentence",
            "review_score_confidence",
            "score_formula_version",
            "move_accuracy_formula_version",
            "game_accuracy_formula_version",
            "neuro_score_formula_version",
            "score_analyzed_moves_white",
            "score_analyzed_moves_black",
            "score_missing_moves_white",
            "score_missing_moves_black",
            "deep_coverage",
            "required_position_count",
            "deep_done_count",
            "deep_missing_count",
            "deep_failed_count",
            "review_analysis_origin",
            "review_analysis_state",
            "review_analysis_quality",
            "number_of_moves_white",
            "number_of_moves_black",
            "white_score_debug",
            "black_score_debug",
            "review_score_audit_rows",
        ):
            self.assertIn(token, client_source)

        self.assertIn("ReviewScoreSummary", review_panel_source)
        self.assertIn("Score coach", review_panel_source)
        self.assertIn("Précision de référence", review_panel_source)
        self.assertIn("review-headline-score", review_panel_source)
        self.assertIn("Détails techniques / audit", review_panel_source)
        self.assertIn("NeuroScore coach", review_panel_source)
        self.assertIn("Score diagnostic interne", review_panel_source)
        self.assertIn("Écart diagnostique interne", review_panel_source)
        self.assertIn("Adversaire", review_panel_source)
        self.assertIn("NeuroScore", review_panel_source)
        self.assertIn("Blancs", review_panel_source)
        self.assertIn("Noirs", review_panel_source)
        self.assertIn("Score indicatif", review_panel_source)
        self.assertIn("Recalculer les métriques", review_panel_source)
        self.assertIn("Cette analyse complète doit être mise à jour", review_panel_source)
        self.assertIn("score_availability", client_source)
        self.assertIn("review_score_alias_of", client_source)
        self.assertIn("Analyse déjà disponible", review_panel_source)
        self.assertIn("Debug score Review", review_panel_source)
        self.assertIn("data-review-score-debug", review_panel_source)
        self.assertIn("data-review-score-audit-table", review_panel_source)
        self.assertIn("Audit coups scorés", review_panel_source)
        self.assertIn("review_analysis_quality", review_panel_source)
        self.assertIn("required_position_count", review_panel_source)
        self.assertIn("formatReviewScore", review_panel_source)
        self.assertIn("non disponible", review_panel_source)
        self.assertNotIn("ACPL", review_panel_source)
        self.assertNotIn("Elo", review_panel_source)
        self.assertNotIn("prÃ", review_panel_source)
        self.assertNotIn("Ã", review_panel_source)
        self.assertNotIn("Â", review_panel_source)

    def test_v5_3a4_time_budgeted_review_profiles_contract_is_present(self) -> None:
        review_service_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "review_service.py"
        ).read_text(encoding="utf-8")
        analysis_service_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "analysis_service.py"
        ).read_text(encoding="utf-8")
        stockfish_service_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "engines" / "stockfish_service.py"
        ).read_text(encoding="utf-8")
        migrations_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "data" / "migrations.py"
        ).read_text(encoding="utf-8")
        routes_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "api" / "game_routes.py"
        ).read_text(encoding="utf-8")
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        review_panel_source = read_review_panel_source()

        self.assertIn('REVIEW_ANALYSIS_DEFAULT_PROFILE = "standard"', review_service_source)
        self.assertIn('"quick": 1', review_service_source)
        self.assertIn('"standard": 2', review_service_source)
        self.assertIn('"deep": 3', review_service_source)
        self.assertIn('"live_continuous": 0', review_service_source)
        self.assertIn("compute_review_total_budget_seconds", review_service_source)
        self.assertIn("standard = 80", review_service_source)
        self.assertIn("standard = 140", review_service_source)
        self.assertIn("standard = 220", review_service_source)
        self.assertIn("standard = 300", review_service_source)
        self.assertIn("return min(450", review_service_source)
        self.assertIn("compute_review_per_position_time_ms", review_service_source)
        self.assertIn("return max(1000, min(10000, raw_ms))", review_service_source)
        self.assertIn("return max(2000, min(15000, raw_ms))", review_service_source)
        self.assertIn("return max(300, min(1500, raw_ms))", review_service_source)
        self.assertIn("required_review_fens_for_contexts", review_service_source)
        self.assertIn("_analysis_satisfies_profile", review_service_source)
        self.assertIn("profile_rank < requested_rank", review_service_source)
        self.assertIn('limit_mode not in {"time", "time_with_max_depth", "terminal"}', review_service_source)
        self.assertIn("requested_time < min_requested_time_ms", review_service_source)
        self.assertIn('analysis_limit_mode="time"', review_service_source)
        self.assertIn("requested_depth=None", review_service_source)
        self.assertIn("requested_multipv=requested_multipv", review_service_source)
        self.assertIn("review_multipv_for_profile", review_service_source)
        self.assertIn("legacy_cache_ignored_count", review_service_source)

        for token in (
            "analysis_profile",
            "requested_time_ms",
            "requested_depth",
            "requested_multipv",
            "analysis_limit_mode",
            "settings_json",
        ):
            self.assertIn(token, migrations_source)
            self.assertIn(token, analysis_service_source)

        self.assertIn("0007_v5_3a4_review_analysis_profiles", migrations_source)
        self.assertIn('VALID_ANALYSIS_LIMIT_MODES = {', analysis_service_source)
        self.assertIn('"continuous"', analysis_service_source)
        self.assertIn('analysis_limit_mode != "time"', analysis_service_source)
        self.assertIn('kwargs["limit_mode"] = analysis_limit_mode', analysis_service_source)
        self.assertIn('"analysis_profile": _row_get(row, "analysis_profile")', analysis_service_source)
        self.assertIn('"requested_time_ms": _row_get(row, "requested_time_ms")', analysis_service_source)
        self.assertIn('"analysis_limit_mode": _row_get(row, "analysis_limit_mode")', analysis_service_source)
        self.assertIn('if limit_mode == "time":', stockfish_service_source)
        self.assertIn("chess.engine.Limit(time=time_budget_sec)", stockfish_service_source)
        self.assertIn('if analysis_limit_mode == "time":', stockfish_service_source)
        self.assertIn("requested_depth\": depth if limit_mode != \"time\" else None", stockfish_service_source)
        self.assertIn('profile: str = Query("standard")', routes_source)
        self.assertIn("_review_analysis_batch_limit", routes_source)
        self.assertIn("process_pending_analyses", routes_source)

        for token in (
            "review_analysis_profile",
            "review_score_profile",
            "analysis_profile_used",
            "completed_position_count",
            "pending_position_count",
            "failed_position_count",
            "total_budget_seconds",
            "per_position_time_ms",
            "analysis_limit_mode",
            "requested_multipv",
            "cache_hits",
            "cache_misses",
            "legacy_cache_ignored_count",
        ):
            self.assertIn(token, client_source)

        for token in (
            "review_analysis_profile",
            "completed_position_count",
            "total_budget_seconds",
            "per_position_time_ms",
            "analysis_limit_mode",
            "requested_multipv",
            "cache_hits",
            "cache_misses",
            "legacy_cache_ignored_count",
        ):
            self.assertIn(token, review_panel_source)

        self.assertIn("profile?:", client_source)
        self.assertIn("params.set(\"profile\", options.profile)", client_source)
        self.assertIn("getReview(", client_source)
        self.assertIn("profile: targetProfile", app_source)
        self.assertIn("reviewAnalysisProfileRef", app_source)
        self.assertIn('type ReviewAnalysisProfile = "quick" | "standard" | "deep"', app_source)
        self.assertIn('useState<ReviewAnalysisProfile>("standard")', app_source)
        self.assertIn("profile: targetProfile", app_source)
        self.assertIn("ReviewAnalysisProfileSelector", review_panel_source)
        self.assertNotIn('<option value="quick">', review_panel_source)
        self.assertIn("Standard recommand", review_panel_source)
        self.assertIn("Approfondie", review_panel_source)
        self.assertIn("Lancer l'analyse recommand", review_panel_source)
        self.assertIn("Analyse rapide disponible", review_panel_source)
        self.assertIn("Stockfish MultiPV", review_panel_source)
        self.assertIn("Debug score Review", review_panel_source)
        self.assertNotIn("V5.3.B", review_panel_source)
        self.assertNotIn("V6", review_panel_source)

    def test_v5_3a4b_engine_profiles_and_live_contract_is_present(self) -> None:
        engine_profiles_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "engines" / "engine_profiles.py"
        ).read_text(encoding="utf-8")
        live_service_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "live_analysis_service.py"
        ).read_text(encoding="utf-8")
        stockfish_service_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "engines" / "stockfish_service.py"
        ).read_text(encoding="utf-8")
        review_service_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "review_service.py"
        ).read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        eval_bar_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "EvaluationBar.tsx"
        ).read_text(encoding="utf-8")
        review_panel_source = read_review_panel_source()

        for token in (
            '"live_continuous"',
            "threads=4",
            "hash_mb=512",
            "threads=6",
            "hash_mb=1024",
            "threads=8",
            "hash_mb=2048",
            "UCI_AnalyseMode",
            "UCI_LimitStrength",
            "Skill Level",
        ):
            self.assertIn(token, engine_profiles_source)

        self.assertIn("LIVE_ANALYSIS_MAX_SECONDS: float | None = None", live_service_source)
        self.assertIn("chess.engine.Limit()", live_service_source)
        self.assertIn('"analysis_profile": analysis_profile', live_service_source)
        self.assertIn('"analysis_limit_mode": analysis_limit_mode', live_service_source)
        self.assertIn('"fen_key": session.fen', live_service_source)

        self.assertIn("chess.engine.Limit(time=time_budget_sec)", stockfish_service_source)
        self.assertIn("multipv=requested_multipv", stockfish_service_source)
        self.assertNotIn("Limit(depth=12, time=time_budget_sec)", stockfish_service_source)

        self.assertIn('"live_continuous": 0', review_service_source)
        self.assertIn('if profile == "live_continuous":', review_service_source)
        self.assertIn("analysis_threads", review_service_source)
        self.assertIn("analysis_hash_mb", review_service_source)

        self.assertIn('if (positionMode === "REVIEW")', app_source)
        self.assertIn("update.session_id !== currentLiveSessionRef.current", app_source)
        self.assertIn("update.fen !== currentBoardFen", app_source)
        self.assertIn("Stockfish analyse la position", app_source)
        self.assertIn("Stockfish analyse tant que la position reste affichee", eval_bar_source)
        self.assertIn("analysis_threads", review_panel_source)
        self.assertIn("analysis_hash_mb", review_panel_source)

    def test_backend_review_winloss_selection_contract_is_staticly_present(self) -> None:
        review_service_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "review_service.py"
        ).read_text(encoding="utf-8")

        self.assertIn(
            'SELECTION_ALGORITHM_VERSION = "moment_selection_criticality_v4"',
            review_service_source,
        )
        self.assertIn("CRITICALITY_THRESHOLD = 10.0", review_service_source)
        self.assertIn("MIN_KEY_MOMENT_WIN_LOSS = CRITICALITY_THRESHOLD", review_service_source)
        self.assertIn("def win_percent_from_engine_score", review_service_source)
        self.assertIn("def white_percent_from_eval", review_service_source)
        self.assertIn("def player_percent_from_white_percent", review_service_source)
        self.assertIn("LICHESS_WIN_PERCENT_COEFFICIENT", review_service_source)
        self.assertIn("def mover_win_percent_loss", review_service_source)
        self.assertIn("def is_significant_review_moment", review_service_source)
        self.assertIn("def player_eval_zone", review_service_source)
        self.assertIn("def criticality_score", review_service_source)
        self.assertIn("def transition_weight", review_service_source)
        self.assertIn("def persistence_weight", review_service_source)
        self.assertIn("def moment_type_for_transition", review_service_source)
        self.assertIn("def temporal_non_max_suppression", review_service_source)
        self.assertIn("NMS_WINDOW_PLIES = 2", review_service_source)
        self.assertIn("NMS_OVERRIDE_RATIO = 1.5", review_service_source)
        self.assertIn("STALLED_REVIEW_MESSAGE", review_service_source)
        self.assertIn("FAILED_DEEP_REVIEW_MESSAGE", review_service_source)
        self.assertIn("review_work_active", review_service_source)
        self.assertIn("scheduled_deep_count", review_service_source)
        self.assertIn("failed_deep_count", review_service_source)
        self.assertIn("failed_deep_details", review_service_source)
        self.assertIn("def _reset_failed_deep_analyses", review_service_source)
        self.assertIn("def _ensure_missing_deep_analyses", review_service_source)
        self.assertIn("def _deep_analysis_status_counts", review_service_source)
        self.assertIn("_review_analysis_batch_limit", (PROJECT_ROOT / "backend" / "neurochess" / "api" / "game_routes.py").read_text(encoding="utf-8"))
        self.assertIn("base_criticality_score < CRITICALITY_THRESHOLD", review_service_source)
        self.assertIn("review_label_from_moment_type(moment_type)", review_service_source)
        self.assertIn("base_criticality_score = criticality_score(", review_service_source)
        self.assertIn("temporal_non_max_suppression(candidates)", review_service_source)
        self.assertIn("moment_type", review_service_source)
        self.assertIn("zone_transition", review_service_source)
        self.assertIn("calculate_cp_loss(", review_service_source)
        self.assertIn("if status in {\"done\", \"partial\"} and not moments", review_service_source)
        self.assertIn('empty_reason = "no_significant_moments"', review_service_source)

    def test_review_stabilized_snapshot_contract_is_staticly_present(self) -> None:
        analysis_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "analysis_service.py"
        ).read_text(encoding="utf-8")
        review_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "review_service.py"
        ).read_text(encoding="utf-8")
        stockfish_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "engines" / "stockfish_service.py"
        ).read_text(encoding="utf-8")
        stabilized_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "core" / "stabilized_eval.py"
        ).read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        evaluation_bar_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "EvaluationBar.tsx"
        ).read_text(encoding="utf-8")
        normalized_app = app_source.replace("\r\n", "\n")

        self.assertIn("def compute_review_time_budget", stabilized_source)
        self.assertIn("clamp(30 +", stabilized_source)
        self.assertIn("def review_tail_window_ms", stabilized_source)
        self.assertIn("build_stabilized_eval_from_samples", stabilized_source)
        self.assertIn("final_eval_cp", stabilized_source)
        self.assertIn("tail_median_cp", stabilized_source)
        self.assertIn("stability_cp", stabilized_source)
        self.assertIn("exp(-float(stability_cp) / 80.0)", stabilized_source)
        self.assertIn("mate_detected", stabilized_source)
        self.assertIn("REVIEW_STABILIZED_EVAL_SOURCE_KIND", analysis_source)
        self.assertIn("stabilized_eval", analysis_source)
        self.assertIn("eval_source_kind", analysis_source)
        self.assertIn("def analyze_stabilized_fen", stockfish_source)
        self.assertIn("self._engine.analysis", stockfish_source)
        self.assertIn("build_stabilized_eval_from_final_analysis", stockfish_source)
        self.assertIn("reliability_score=reliability", review_source)
        self.assertIn("def _stable_eval_from_analysis_json", review_source)
        self.assertIn("REVIEW_STABILIZED_EVAL_SOURCE_KIND", review_source)
        self.assertIn("moment_selection_criticality_v4", review_source)
        self.assertIn("stabilized_eval?:", client_source)
        self.assertIn("REVIEW_STABILIZED_DEEP_SOURCE_KIND", app_source)
        self.assertIn("REVIEW_DEEP_SNAPSHOT_SOURCE_KIND", app_source)
        self.assertIn("review_stabilized_deep", app_source)
        self.assertIn("review_deep_snapshot", app_source)
        self.assertIn("reviewMomentSourceKind", app_source)
        self.assertIn("Évaluation non disponible pour ce moment", app_source)
        self.assertIn("review_stabilized_deep", evaluation_bar_source)
        self.assertIn("review_deep_snapshot", evaluation_bar_source)

        evaluation_state_start = normalized_app.index(
            "function evaluationBarStateForBoardFen"
        )
        review_moment_start = normalized_app.index(
            "const moment =",
            evaluation_state_start,
        )
        review_block = normalized_app[
            review_moment_start:
            normalized_app.index("function reviewMomentEvaluation", review_moment_start)
        ]
        self.assertIn("reviewMomentEvaluation(moment, reviewBarPhase)", review_block)
        self.assertIn("reviewMomentSourceKind(moment)", review_block)
        self.assertNotIn("positionEvaluationCache[moment.fen_before]", review_block)
        self.assertNotIn("review_live", review_block)
        self.assertIn('if (positionMode === "REVIEW")', normalized_app)
        historical_block = normalized_app[
            normalized_app.index('if (mode === "HISTORICAL")'):
            normalized_app.index('const moment =', normalized_app.index('if (mode === "HISTORICAL")'))
        ]
        self.assertIn("positionEvaluationCache[boardFen]", historical_block)
        self.assertNotIn("currentFen", historical_block.split("placeholder:")[0])

    def test_frontend_short_review_guard_blocks_generate_and_polling(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        review_state_source = (
            PROJECT_ROOT / "frontend" / "src" / "reviewState.ts"
        ).read_text(encoding="utf-8")
        normalized_app = app_source.replace("\r\n", "\n")
        normalized_state = review_state_source.replace("\r\n", "\n")

        self.assertIn("export const MIN_REVIEW_HALF_MOVES = 10", normalized_state)
        self.assertIn("export function isShortGameForReview", normalized_state)
        self.assertIn("halfMovesCount <= MIN_REVIEW_HALF_MOVES", normalized_state)
        self.assertIn("moveHistory?.moves.length ?? moves.length", normalized_app)
        min_line = next(
            line for line in normalized_state.splitlines()
            if line.startswith("export const MIN_REVIEW_HALF_MOVES")
        )
        min_review_half_moves = int(min_line.split("=")[1].strip(" ;"))
        self.assertTrue(9 <= min_review_half_moves)
        self.assertTrue(10 <= min_review_half_moves)
        self.assertFalse(11 <= min_review_half_moves)

        handle_review_start = normalized_app.index("async function handleReview")
        generate_request_start = normalized_app.index(
            'debugLog("review_job_start_request"',
            handle_review_start,
        )
        short_guard_block = normalized_app[handle_review_start:generate_request_start]
        self.assertIn("if (currentGameIsShortForReview)", short_guard_block)
        self.assertIn('setLastReviewGenerateStatus("blocked_short_game")', short_guard_block)
        self.assertIn('forceShortGameReviewState("short_game_before_generate", true)', short_guard_block)
        self.assertIn("return;", short_guard_block)

        self.assertLess(
            normalized_app.index("if (currentGameIsShortForReview)", handle_review_start),
            normalized_app.index("setReviewLoading(true)", handle_review_start),
        )
        self.assertLess(
            normalized_app.index("if (currentGameIsShortForReview)", handle_review_start),
            normalized_app.index("startReviewJob(targetGameId,", handle_review_start),
        )

        force_guard_start = normalized_app.index("function forceShortGameReviewState")
        force_guard_end = normalized_app.index("function startReviewPending")
        force_guard_block = normalized_app[force_guard_start:force_guard_end]
        self.assertIn("clearReviewPolling(reason)", force_guard_block)
        self.assertIn("makeShortGameReviewResponse(gameId, reviewHalfMovesCount)", force_guard_block)
        self.assertIn("applyReviewResponse(response, Date.now())", force_guard_block)
        self.assertIn("setReviewLoading(false)", force_guard_block)

        poll_start = normalized_app.index("async function pollReviewOnce")
        get_request_start = normalized_app.index(
            'debugLog("review_get_request"',
            poll_start,
        )
        poll_guard_block = normalized_app[poll_start:get_request_start]
        self.assertIn("if (currentGameIsShortForReview)", poll_guard_block)
        self.assertIn('setLastReviewGetStatus("blocked_short_game")', poll_guard_block)
        self.assertIn('forceShortGameReviewState("short_game_during_poll")', poll_guard_block)

        self.assertIn("response.game_id === gameId", normalized_app)
        self.assertIn("currentGameIsShortForReview", normalized_app)
        self.assertIn("reviewStatusFromResponse(response) !== \"not_reviewable\"", normalized_app)
        self.assertIn("review_not_reviewable_wins", normalized_app)

    def test_frontend_review_dev_debug_block_is_dev_only(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )

        self.assertIn("import.meta.env.DEV &&", app_source)
        self.assertIn("Review debug:", app_source)
        for field in (
            "game_id",
            "halfMovesCount",
            "MIN_REVIEW_HALF_MOVES",
            "isShortGameForReview",
            "reviewUiState",
            "review.status reçu",
            "loading",
            "pollingActive",
            "pendingStartedAt",
            "lastGenerateStatus",
            "lastGetStatus",
        ):
            self.assertIn(field, app_source)
        self.assertIn('data-review-debug="true"', app_source)
        self.assertIn(".review-debug", styles_source)

    def test_frontend_review_dev_diagnosis_logs_are_present(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        for log_name in (
            "review_job_start_request",
            "review_job_start_response",
            "review_job_poll_started",
            "review_job_poll_cleared",
            "review_get_request",
            "review_get_response",
            "review_state_transition",
            "review_poll_created",
            "review_poll_cleared",
            "review_pending_started_at",
            "review_pending_elapsed_ms",
            "review_timeout_triggered",
            "review_not_reviewable_wins",
        ):
            self.assertIn(log_name, app_source)

    def test_v5_3_a4d_frontend_review_hardening_is_present(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        review_panel_source = read_review_panel_source()
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")

        self.assertIn("APP_STATE_STORAGE_KEY", app_source)
        self.assertIn("restorePersistedAppState", app_source)
        self.assertIn("activeReviewJobId", app_source)
        self.assertIn("liveSuspendedForReview", app_source)
        self.assertIn("Analyse live en pause pendant la Review", app_source)
        self.assertIn("ForceReanalysisPicker", review_panel_source)
        self.assertIn("Standard recommandée", review_panel_source)
        self.assertIn("Approfondie", review_panel_source)
        self.assertNotIn('<option value="quick">', review_panel_source)
        self.assertIn("last_error?: string | null", client_source)
        self.assertIn("retryable?: boolean", client_source)

    def test_v5_3_a4e_finalization_lock_contract_is_present(self) -> None:
        database_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "data" / "database.py"
        ).read_text(encoding="utf-8")
        migrations_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "data" / "migrations.py"
        ).read_text(encoding="utf-8")
        review_job_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "review_job_service.py"
        ).read_text(encoding="utf-8")
        review_service_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "review_service.py"
        ).read_text(encoding="utf-8")
        review_panel_source = read_review_panel_source()

        self.assertIn("SQLITE_BUSY_TIMEOUT_MS = 30_000", database_source)
        self.assertIn("SQLITE_WRITE_LOCK", database_source)
        self.assertIn("execute_sqlite_write_with_retry", database_source)
        self.assertIn("0010_v5_3a4e_review_job_finalizing", migrations_source)
        self.assertIn("'finalizing'", migrations_source)
        self.assertIn("finalize_review_job", review_job_source)
        self.assertIn("status=\"finalizing\"", review_job_source)
        self.assertIn("coverage_is_complete(coverage)", review_job_source)
        self.assertIn("_complete_review_from_coverage", review_service_source)
        self.assertIn("execute_sqlite_write_with_retry(write_completed_review)", review_service_source)
        self.assertIn("Finalisation de la Review", review_panel_source)
        self.assertIn('reviewJob?.status === "finalizing"', review_panel_source)
        self.assertNotIn("last_seen", review_job_source)

    def test_frontend_review_does_not_show_forbidden_summary_metrics(self) -> None:
        checked_sources = [
            (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
                encoding="utf-8"
            ),
            (
                PROJECT_ROOT / "frontend" / "src" / "components" / "ReviewPanel.tsx"
            ).read_text(encoding="utf-8"),
        ]
        forbidden = (
            "ACPL",
            "score global",
            "blunder",
            "mistake",
            "inaccuracy",
            "mauvais coup",
            "coup nul",
            "impulsif",
            "mal calculé",
            "ne comprends pas",
            "erreur cognitive",
            "manque de patience",
            "dommage",
            "tu aurais dû",
            "style de jeu",
        )

        for source in checked_sources:
            lowered = source.lower()
            for word in forbidden:
                self.assertNotIn(word.lower(), lowered)

    def test_frontend_v4_1_uses_backend_move_history_contract(self) -> None:
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )

        self.assertIn("export type GameMoveHistory", client_source)
        self.assertIn("initial_fen: string", client_source)
        self.assertIn("current_fen: string", client_source)
        self.assertIn("fen_before: string", client_source)
        self.assertIn("fen_after: string", client_source)
        self.assertIn("getGameMoves", client_source)
        self.assertIn("setMoveHistory(history)", app_source)
        self.assertIn("setViewedFen(history.current_fen)", app_source)

    def test_frontend_v4_1_position_modes_and_off_by_one_are_locked(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )

        self.assertIn('type PositionMode = "LIVE" | "HISTORICAL" | "REVIEW"', app_source)
        self.assertIn("const [viewedFen, setViewedFen]", app_source)
        self.assertIn("const [displayedPositionPly, setDisplayedPositionPly]", app_source)
        self.assertIn("setViewedFen(move.fen_after)", app_source)
        self.assertIn("setDisplayedPositionPly(move.ply)", app_source)
        self.assertIn("setViewedFen(moment.fen_before)", app_source)
        self.assertIn("setDisplayedPositionPly(Math.max(0, moment.ply - 1))", app_source)
        self.assertIn('setPositionMode("REVIEW")', app_source)
        self.assertIn("selectedReviewMovePly", app_source)

    def test_frontend_v4_1_navigation_tabs_and_accessibility_are_present(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        board_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "ChessBoardPanel.tsx"
        ).read_text(encoding="utf-8")

        for token in ("goInitialPosition", "goPreviousPosition", "goNextPosition", "goLivePosition"):
            self.assertIn(token, app_source)
        self.assertIn('role="tablist"', app_source)
        self.assertIn('role="tab"', app_source)
        self.assertIn("aria-selected", app_source)
        self.assertIn("aria-controls", app_source)
        self.assertIn('role="tabpanel"', app_source)
        self.assertIn("import.meta.env.DEV", app_source)
        self.assertIn("isEditableTarget(event.target)", app_source)
        self.assertIn('event.key === "ArrowLeft"', app_source)
        self.assertIn('event.key === "ArrowRight"', app_source)
        self.assertIn('event.key === "Home"', app_source)
        self.assertIn('event.key === "End"', app_source)
        self.assertIn('role="img"', board_source)
        self.assertIn("aria-label={ariaLabel}", board_source)
        self.assertIn("arePiecesDraggable={Boolean(fen) && !disabled}", board_source)

    def test_frontend_v4_1_review_cards_are_scannable_without_raw_metrics(self) -> None:
        review_panel_source = read_review_panel_source()
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )

        self.assertIn("aria-label={`écart ${moment.cp_loss_label}`}", review_panel_source)
        self.assertIn("commentForLabel", review_panel_source)
        self.assertIn("Voir le coup joué", review_panel_source)
        self.assertIn("Voir le meilleur coup", review_panel_source)
        self.assertIn("review-badge", review_panel_source)
        self.assertIn("badge-notable", styles_source)
        self.assertIn("badge-important", styles_source)
        self.assertIn("badge-major", styles_source)
        self.assertIn("badge-large", styles_source)
        self.assertIn("badge-decisive", styles_source)
        self.assertNotIn("{moment.cp_loss}", review_panel_source)

    def test_frontend_v4_1_history_error_is_localized_to_moves_tab(self) -> None:
        move_history_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "MoveHistory.tsx"
        ).read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )

        self.assertIn("Impossible de charger l'historique.", move_history_source)
        self.assertIn("onRetry", move_history_source)
        self.assertIn("const canNavigate = Boolean(moveHistory)", app_source)
        self.assertIn("disabled={!canNavigate || displayedPositionPly === 0}", app_source)
        self.assertIn("disabled={!canNavigate || displayedPositionPly >= finalDisplayedPly}", app_source)

    def test_frontend_v4_1_1_evaluation_bar_is_context_aware(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        evaluation_bar_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "EvaluationBar.tsx"
        ).read_text(encoding="utf-8")
        normalized = app_source.replace("\r\n", "\n")

        self.assertIn("type EvaluationBarState", normalized)
        self.assertIn("evaluationBarStateForBoardFen", normalized)
        self.assertIn("const rawBoardFen = viewedFen ?? currentFen", normalized)
        self.assertIn("const boardFen = reviewExplorationActive", normalized)
        self.assertIn("boardEvaluationContextForPosition", normalized)
        self.assertIn('if (mode === "LIVE")', normalized)
        self.assertIn('if (mode === "HISTORICAL")', normalized)
        self.assertIn("evaluationFen === boardFen", normalized)
        self.assertIn("positionEvaluationCache", normalized)
        self.assertIn("loadPositionEvaluation(viewedFen)", normalized)
        self.assertIn("lookup?.evaluation", normalized)
        self.assertIn('"historical_deep"', normalized)
        self.assertIn('kind: "historical_pending"', normalized)
        self.assertIn('label: "analyse indisponible"', normalized)
        self.assertIn('sourceLabel: "historique"', normalized)
        self.assertIn('sourceLabel: "review"', normalized)
        self.assertIn("reviewPracticeState?.active", normalized)
        self.assertIn('"Review guidée"', normalized)
        self.assertIn('"Mode entraînement"', normalized)
        self.assertNotIn('"aucune evaluation disponible pour le moment de review"', normalized)
        self.assertIn("startLiveAnalysis({", normalized)
        self.assertIn("stopLiveAnalysis(sessionId)", normalized)
        self.assertIn("update.fen !== currentBoardFen", normalized)
        self.assertIn("normalizeBoardEvaluationContext(update.context) !== currentContext", normalized)
        self.assertIn("liveSourceKindForContext(currentContext)", normalized)
        self.assertIn("evaluation={evaluationBarState.evaluation}", normalized)
        self.assertIn("source={evaluationBarState.source}", normalized)
        self.assertIn("placeholder={evaluationBarState.placeholder}", normalized)
        self.assertNotIn(
            '<EvaluationBar evaluation={evaluation} source={evaluationSource}',
            normalized,
        )
        self.assertIn("export type EvaluationBarPlaceholder", evaluation_bar_source)
        self.assertIn("placeholder?.label", evaluation_bar_source)

    def test_frontend_v5_0_1_review_bar_uses_eval_before_not_live_or_after(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        normalized = app_source.replace("\r\n", "\n")
        review_start = normalized.index("const moment =", normalized.index("function evaluationBarStateForBoardFen"))
        review_block = normalized[review_start:normalized.index("function positionBadge")]

        self.assertIn("makeEvaluationDisplayFromEngineScore", review_block)
        self.assertIn("reviewMomentEvaluation(moment, reviewBarPhase)", review_block)
        self.assertIn("reviewMomentSourceKind(moment)", review_block)
        self.assertIn("reviewMomentDelta(moment)", review_block)
        self.assertIn('phase === "after" ? moment.eval_after_cp : moment.eval_before_cp', normalized)
        self.assertIn('phase === "after" ? moment.mate_after : moment.mate_before', normalized)

    def test_frontend_v5_1_9_review_ux_polish_contract_is_present(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        evaluation_bar_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "EvaluationBar.tsx"
        ).read_text(encoding="utf-8")
        review_panel_source = read_review_panel_source()
        board_panel_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "ChessBoardPanel.tsx"
        ).read_text(encoding="utf-8")
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )
        normalized = app_source.replace("\r\n", "\n")

        self.assertIn('type ReviewBarPhase = "before" | "after"', normalized)
        self.assertIn("reviewBarPhase", normalized)
        self.assertIn("reviewReplayTimersRef", normalized)
        self.assertIn("clearReviewReplayTimers", normalized)
        self.assertIn("setViewedFen(moment.fen_before)", normalized)
        self.assertIn("setViewedFen(targetFen)", normalized)
        self.assertIn('setReviewBarPhase("before")', normalized)
        self.assertIn('setReviewBarPhase(moveMode === "played" ? "after" : "before")', normalized)
        self.assertIn("reviewMomentEvaluation(moment, reviewBarPhase)", normalized)
        self.assertIn("reviewMomentDelta(moment)", normalized)
        self.assertIn("Évaluation non disponible pour ce moment.", normalized)
        self.assertIn("REVIEW_REPLAY_INITIAL_DELAY_MS = 1200", normalized)
        self.assertIn("REPLAY_INITIAL_PAUSE_MS = 1200", normalized)
        self.assertIn("REPLAY_MOVE_ANIMATION_MS = 800", normalized)
        self.assertIn("REPLAY_IMPACT_PAUSE_MS = 1500", normalized)
        self.assertIn("REPLAY_BEST_MOVE_PAUSE_MS = 1200", normalized)
        self.assertIn("REVIEW_REPLAY_MOVE_ANIMATION_MS = REPLAY_MOVE_ANIMATION_MS", normalized)
        self.assertIn("REVIEW_REPLAY_INITIAL_DELAY_MS", normalized)
        self.assertIn("REVIEW_REPLAY_MOVE_ANIMATION_MS", normalized)

        self.assertIn("animationDuration?: number", board_panel_source)
        self.assertIn("animationDuration={animationDuration}", board_panel_source)
        self.assertIn("export type EvaluationDelta", evaluation_bar_source)
        self.assertIn("delta?: EvaluationDelta | null", evaluation_bar_source)
        self.assertIn("eval-delta", evaluation_bar_source)
        self.assertIn("Variation joueur", review_panel_source)
        self.assertIn("review-delta", review_panel_source)
        self.assertIn("transition: height 560ms ease-out", styles_source)
        self.assertIn("transition: top 560ms ease-out", styles_source)

    def test_frontend_v5_2z_review_playback_bar_toggle_contract_is_present(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        evaluation_bar_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "EvaluationBar.tsx"
        ).read_text(encoding="utf-8")
        review_panel_source = read_review_panel_source()
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )
        review_service_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "review_service.py"
        ).read_text(encoding="utf-8")
        normalized = app_source.replace("\r\n", "\n")

        self.assertIn('SELECTION_ALGORITHM_VERSION = "moment_selection_criticality_v4"', review_service_source)
        self.assertIn("CRITICALITY_THRESHOLD = 10.0", review_service_source)
        self.assertIn('const EVAL_VISIBILITY_STORAGE_KEY = "neurochess.hideEvaluation"', normalized)
        self.assertIn("readHideEvaluationPreference", normalized)
        self.assertIn("writeHideEvaluationPreference(hideEvaluation)", normalized)
        self.assertIn("window.localStorage.getItem(EVAL_VISIBILITY_STORAGE_KEY)", normalized)
        self.assertIn("window.localStorage.setItem(", normalized)
        self.assertIn("Masquer l'évaluation", normalized)
        self.assertIn("className=\"evaluation-toggle\"", normalized)
        self.assertIn("hidden={hideEvaluation}", normalized)
        self.assertIn("hideEvaluation={hideEvaluation}", normalized)
        self.assertIn("REVIEW_REPLAY_INITIAL_DELAY_MS = 1200", normalized)
        self.assertIn("REVIEW_REPLAY_AFTER_HOLD_MS = 1500", normalized)
        self.assertIn("REPLAY_MOVE_ANIMATION_MS = 800", normalized)
        self.assertIn("REVIEW_REPLAY_MOVE_ANIMATION_MS = REPLAY_MOVE_ANIMATION_MS", normalized)
        self.assertIn("setViewedFen(moment.fen_before)", normalized)
        self.assertIn("setViewedFen(targetFen)", normalized)
        self.assertIn('setReviewBarPhase("before")', normalized)
        self.assertIn('setReviewBarPhase(moveMode === "played" ? "after" : "before")', normalized)
        self.assertIn("}, REVIEW_REPLAY_INITIAL_DELAY_MS)", normalized)
        self.assertIn("buildReviewSquareStyles", normalized)
        self.assertIn("addUciSquares(styles, moment.played_uci", normalized)
        self.assertIn("reviewMomentEvaluation(moment, reviewBarPhase)", normalized)
        self.assertIn('phase === "after" ? moment.eval_after_cp : moment.eval_before_cp', normalized)
        self.assertIn('phase === "after" ? moment.mate_after : moment.mate_before', normalized)
        self.assertIn("return makeEvaluationDisplayFromEngineScore(evalCp, mateIn)", normalized)
        self.assertIn("reviewMomentDelta(moment)", normalized)
        self.assertIn('return REVIEW_DEEP_SNAPSHOT_SOURCE_KIND', normalized)
        evaluation_state_block = normalized[
            normalized.index("function evaluationBarStateForBoardFen"):
            normalized.index("function reviewMomentEvaluation")
        ]
        self.assertNotIn("review_live", evaluation_state_block)

        self.assertIn("hidden?: boolean", evaluation_bar_source)
        self.assertIn("hidden = false", evaluation_bar_source)
        self.assertIn("if (hidden)", evaluation_bar_source)
        self.assertIn("Évaluation masquée", evaluation_bar_source)
        self.assertIn("delta &&", evaluation_bar_source)

        self.assertIn("hideEvaluation: boolean", review_panel_source)
        self.assertIn("hideEvaluation ? (", review_panel_source)
        self.assertIn("review-evaluation-hidden", review_panel_source)
        self.assertIn("!hideEvaluation && delta", review_panel_source)
        self.assertIn("Variation joueur", review_panel_source)

        self.assertIn(".evaluation-toggle", styles_source)
        self.assertIn(".eval-hidden", styles_source)
        self.assertIn(".review-evaluation-hidden", styles_source)

    def test_frontend_v5_2z2_review_replay_visible_contract_is_present(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        review_panel_source = read_review_panel_source()
        evaluation_bar_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "EvaluationBar.tsx"
        ).read_text(encoding="utf-8")
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )
        normalized = app_source.replace("\r\n", "\n")

        self.assertIn('type ReviewReplayState =', normalized)
        for state in (
            '"idle"',
            '"showing_before"',
            '"animating_move"',
            '"showing_after"',
        ):
            self.assertIn(state, normalized)
        self.assertIn("const [reviewReplayState, setReviewReplayState]", normalized)
        self.assertIn("REVIEW_REPLAY_INITIAL_DELAY_MS = 1200", normalized)
        self.assertIn("REVIEW_REPLAY_AFTER_HOLD_MS = 1500", normalized)
        self.assertIn("REPLAY_INITIAL_PAUSE_MS = 1200", normalized)
        self.assertIn("REPLAY_MOVE_ANIMATION_MS = 800", normalized)
        self.assertIn("REPLAY_IMPACT_PAUSE_MS = 1500", normalized)
        self.assertIn("REPLAY_BEST_MOVE_PAUSE_MS = 1200", normalized)
        self.assertIn("REPLAY_PV_LINE_PAUSE_MS = 1200", normalized)
        self.assertIn("REVIEW_REPLAY_MOVE_ANIMATION_MS = REPLAY_MOVE_ANIMATION_MS", normalized)
        self.assertIn("setReviewReplayState(\"showing_before\")", normalized)
        self.assertIn("setViewedFen(moment.fen_before)", normalized)
        self.assertIn("setReviewBarPhase(\"before\")", normalized)
        self.assertIn("setReviewReplayState(\"animating_move\")", normalized)
        self.assertIn("setViewedFen(targetFen)", normalized)
        self.assertIn("setReviewBarPhase(moveMode === \"played\" ? \"after\" : \"before\")", normalized)
        self.assertIn("setReviewReplayState(\"showing_after\")", normalized)
        self.assertIn(
            "REVIEW_REPLAY_INITIAL_DELAY_MS + REVIEW_REPLAY_AFTER_HOLD_MS",
            normalized,
        )
        self.assertIn("reviewReplayBadgeText(", normalized)
        self.assertIn("reviewReplayMoveMode", normalized)
        self.assertIn("Position avant le coup", normalized)
        self.assertIn("Coup joué", normalized)
        self.assertIn("Position après le coup", normalized)
        self.assertIn("review-replay-badge", normalized)
        self.assertIn("aria-live=\"polite\"", normalized)
        self.assertIn("reviewReplayDebug:", normalized)
        for token in (
            "reviewReplayState",
            "displayedFenKind",
            "playedUci",
            "hasFenBefore",
            "hasFenAfter",
            "hasEvalBefore",
            "hasEvalAfter",
            "hideEvaluation",
            "animationDuration",
        ):
            self.assertIn(token, normalized)
        self.assertIn("reviewDisplayedFenKind", normalized)
        self.assertIn("reviewMomentEvaluation(selectedReviewMoment, \"before\")", normalized)
        self.assertIn("reviewMomentEvaluation(selectedReviewMoment, \"after\")", normalized)
        self.assertIn("makeEvaluationDisplayFromEngineScore(evalCp, mateIn)", normalized)
        self.assertIn("moment.mate_before", review_panel_source)
        self.assertIn("moment.mate_after", review_panel_source)
        self.assertIn("Masquer l'évaluation", normalized)
        self.assertIn("neurochess.hideEvaluation", normalized)
        self.assertIn("Évaluation masquée", evaluation_bar_source)
        self.assertIn("hidden={hideEvaluation}", normalized)
        self.assertIn("!hideEvaluation && delta", review_panel_source)

        self.assertIn(".review-replay-badge", styles_source)
        self.assertIn(".review-replay-badge-animating_move", styles_source)
        self.assertIn(".review-replay-badge-showing_after", styles_source)

    def test_frontend_v5_2za_review_pedagogy_polish_contract_is_present(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        review_panel_source = read_review_panel_source()
        board_panel_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "ChessBoardPanel.tsx"
        ).read_text(encoding="utf-8")
        evaluation_bar_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "EvaluationBar.tsx"
        ).read_text(encoding="utf-8")
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )
        review_service_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "review_service.py"
        ).read_text(encoding="utf-8")
        normalized = app_source.replace("\r\n", "\n")

        self.assertIn('SELECTION_ALGORITHM_VERSION = "moment_selection_criticality_v4"', review_service_source)
        self.assertIn("CRITICALITY_THRESHOLD = 10.0", review_service_source)
        self.assertIn('type ReviewReplayMoveMode = "played" | "best"', normalized)
        self.assertIn("REVIEW_REPLAY_INITIAL_DELAY_MS = 1200", normalized)
        self.assertIn("REVIEW_REPLAY_AFTER_HOLD_MS = 1500", normalized)
        self.assertIn("REPLAY_INITIAL_PAUSE_MS = 1200", normalized)
        self.assertIn("REPLAY_MOVE_ANIMATION_MS = 800", normalized)
        self.assertIn("REPLAY_IMPACT_PAUSE_MS = 1500", normalized)
        self.assertIn("REPLAY_BEST_MOVE_PAUSE_MS = 1200", normalized)
        self.assertIn("REPLAY_PV_LINE_PAUSE_MS = 1200", normalized)
        self.assertIn("REVIEW_REPLAY_MOVE_ANIMATION_MS = REPLAY_MOVE_ANIMATION_MS", normalized)
        self.assertIn("REVIEW_PLAYED_ARROW_COLOR", normalized)
        self.assertIn("REVIEW_BEST_ARROW_COLOR", normalized)
        self.assertIn("setReviewReplayMoveMode(moveMode)", normalized)
        self.assertIn("moveMode === \"best\" ? moment.best_move_uci", normalized)
        self.assertIn("fenAfterUci(moment.fen_before, targetUci)", normalized)
        self.assertIn("setReviewBarPhase(moveMode === \"played\" ? \"after\" : \"before\")", normalized)
        self.assertIn("buildReviewBoardArrows", normalized)
        self.assertIn("uciToBoardArrow", normalized)
        self.assertIn(
            "customArrows={reviewExplorationActive ? [] : reviewBoardArrows}",
            normalized,
        )
        self.assertIn("customArrows?: BoardArrow[]", board_panel_source)
        self.assertIn("customArrows={customArrows as Arrow[] | undefined}", board_panel_source)
        self.assertIn("Voir le coup joué", review_panel_source)
        self.assertIn("Voir le meilleur coup", review_panel_source)
        self.assertIn("disabled={!moment.best_move_uci}", review_panel_source)
        self.assertIn("Joué", review_panel_source)
        self.assertIn("Meilleur", review_panel_source)
        self.assertIn("Meilleur coup suggéré", normalized)
        self.assertIn("Position après le meilleur coup", normalized)
        self.assertIn("deltaOverlay", normalized)
        self.assertIn("reviewMomentDeltaOverlay(moment)", normalized)
        self.assertIn("deltaOverlay?: EvaluationDeltaOverlay | null", evaluation_bar_source)
        self.assertIn("eval-delta-overlay", evaluation_bar_source)
        self.assertIn(".eval-delta-overlay-loss", styles_source)
        self.assertIn(".eval-delta-overlay-gain", styles_source)
        self.assertIn("<details className=\"review-debug\"", normalized)
        self.assertIn("<summary>Debug Review</summary>", normalized)
        self.assertNotIn("<div className=\"review-debug\"", normalized)
        self.assertIn("Masquer l'évaluation", normalized)
        self.assertIn("hidden={hideEvaluation}", normalized)

    def test_frontend_v5_2_universal_board_eval_session_guards(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        evaluation_bar_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "EvaluationBar.tsx"
        ).read_text(encoding="utf-8")
        normalized = app_source.replace("\r\n", "\n")

        self.assertIn("type BoardEvaluationContext", client_source)
        self.assertIn("context: BoardEvaluationContext", client_source)
        self.assertIn("review_moment_id?: string | null", client_source)
        self.assertIn("boardFenRef.current = boardFen", normalized)
        self.assertIn("currentBoardContextRef.current = boardEvaluationContext", normalized)
        self.assertIn("currentLiveSessionFenRef.current === boardFen", normalized)
        self.assertIn("currentLiveSessionContextRef.current === boardEvaluationContext", normalized)
        self.assertIn("review_moment_id: selectedReviewMomentId", normalized)
        self.assertIn("setEvaluationFen(update.fen ?? currentBoardFen ?? null)", normalized)
        self.assertIn('return "historical_live"', normalized)
        self.assertIn('return "review_live"', normalized)
        self.assertIn('return "final_live"', normalized)
        self.assertIn('return "initial_live"', normalized)
        self.assertIn('label: "analyse en cours"', normalized)
        self.assertIn("historique", evaluation_bar_source)
        self.assertIn("review", evaluation_bar_source)
        self.assertIn("finale", evaluation_bar_source)
        self.assertIn("depart", normalized)

    def test_frontend_v5_0_1_evaluation_display_helper_matches_contract(self) -> None:
        helper_source = (
            PROJECT_ROOT / "frontend" / "src" / "evaluationDisplay.ts"
        ).read_text(encoding="utf-8")

        self.assertIn("makeEvaluationDisplayFromEngineScore", helper_source)
        self.assertIn("Math.exp(-LICHESS_EVAL_FACTOR * evalCp)", helper_source)
        self.assertIn('label: `M${Math.abs(mateIn)}`', helper_source)
        self.assertIn('label: `-M${Math.abs(mateIn)}`', helper_source)
        self.assertIn("white_percent: 100.0", helper_source)
        self.assertIn("white_percent: 0.0", helper_source)
        self.assertIn("return null", helper_source)

    def test_frontend_v5_2_2_evaluation_bar_visual_rendering_is_explicit(self) -> None:
        evaluation_bar_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "EvaluationBar.tsx"
        ).read_text(encoding="utf-8")
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )

        self.assertIn("className=\"eval-bar-track\"", evaluation_bar_source)
        self.assertIn("className=\"eval-bar-black\"", evaluation_bar_source)
        self.assertIn("className=\"eval-bar-white\"", evaluation_bar_source)
        self.assertIn("className=\"eval-bar-cursor\"", evaluation_bar_source)
        self.assertIn("className=\"eval-bar-cursor eval-bar-cursor-muted\"", evaluation_bar_source)
        self.assertIn("const whitePercent = clampPercent(evaluation.white_percent)", evaluation_bar_source)
        self.assertIn("const blackPercent = clampPercent(100 - whitePercent)", evaluation_bar_source)
        self.assertIn('style={{ height: `${blackPercent}%` }}', evaluation_bar_source)
        self.assertIn('style={{ height: `${whitePercent}%` }}', evaluation_bar_source)
        self.assertIn('style={{ height: "50%" }}', evaluation_bar_source)
        self.assertIn("function clampPercent", evaluation_bar_source)
        self.assertNotIn("positionMode", evaluation_bar_source)
        self.assertIn(".eval-bar-track", styles_source)
        self.assertIn("flex-direction: column", styles_source)
        self.assertIn("height: 260px", styles_source)
        self.assertIn("min-height: 240px", styles_source)
        self.assertIn("width: 28px", styles_source)
        self.assertIn("min-width: 28px", styles_source)
        self.assertIn("flex: 0 0 260px", styles_source)
        self.assertIn(".eval-bar-cursor", styles_source)
        self.assertIn("position: absolute", styles_source)
        self.assertIn(".eval-disabled .eval-bar-track", styles_source)
        self.assertIn("repeating-linear-gradient", styles_source)
        self.assertIn("flex-direction: column", styles_source)
        self.assertIn("width: 76px", styles_source)

    def test_frontend_v5_0_1_historical_fetch_and_opening_ui_are_present(self) -> None:
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        normalized = app_source.replace("\r\n", "\n")

        self.assertIn("export type OpeningClassification", client_source)
        self.assertIn("getGameOpening", client_source)
        self.assertIn("classifyGameOpening", client_source)
        self.assertIn("importOpeningBook", client_source)
        self.assertIn("/openings/import-book", client_source)
        self.assertIn("getAnalysisByFen", client_source)
        self.assertIn("/analyses/by-fen", client_source)
        self.assertIn("opening-summary", normalized)
        self.assertIn("Ouverture :", normalized)
        self.assertIn("Classifier l'ouverture", normalized)
        self.assertIn("Préparation du book d'ouvertures...", normalized)
        self.assertIn("Book d'ouvertures local prêt.", normalized)
        self.assertNotIn("Book d'ouvertures non import", normalized)
        self.assertIn("lookupFromAnalysis", normalized)
        self.assertIn("analysis.status === \"pending\"", normalized)
        self.assertIn("analysis.status !== \"done\"", normalized)
        self.assertNotIn('id="tab-openings"', normalized)

    def test_frontend_v5_2_pgn_import_minimal_contract_is_present(self) -> None:
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )

        self.assertIn("export type PgnImportPreview", client_source)
        self.assertIn("export type PgnImportResult", client_source)
        self.assertIn("export type GameHistoryItem", client_source)
        self.assertIn("previewPgnImport", client_source)
        self.assertIn("importPgnGames", client_source)
        self.assertIn("getGameHistory", client_source)
        self.assertIn("getGame(gameId", client_source)
        self.assertIn("/games/import-pgn/preview", client_source)
        self.assertIn("/games/import-pgn", client_source)
        self.assertIn("/games/history", client_source)
        self.assertIn("return request<GameState>(`/games/${gameId}`)", client_source)
        self.assertIn("FormData", client_source)
        self.assertIn("Importer PGN", app_source)
        self.assertIn('accept=".pgn,.txt"', app_source)
        self.assertIn("Coller PGN", app_source)
        self.assertIn("Quel pseudo est le vôtre ?", app_source)
        self.assertIn("Prévisualiser", app_source)
        self.assertIn("Voir l'historique", app_source)
        self.assertIn("Historique", app_source)
        self.assertIn("parties importées", app_source)
        self.assertIn("doublons", app_source)
        self.assertIn("erreurs", app_source)
        self.assertIn("ouvertures classifiées", app_source)
        self.assertIn("handleOpenHistoryGame", app_source)
        self.assertIn("const state = await getGame(item.game_id)", app_source)
        self.assertIn("await loadMoveHistory(item.game_id, true)", app_source)
        self.assertIn("await loadOpeningClassification(item.game_id)", app_source)
        self.assertIn('nextTab: ActiveTab = "moves"', app_source)
        self.assertIn("historyScope", app_source)
        self.assertIn("Mes parties", app_source)
        self.assertIn("Importées", app_source)
        self.assertIn("Locales", app_source)
        self.assertIn("Observées", app_source)
        self.assertIn("Toutes", app_source)
        self.assertIn("game-library", app_source)
        self.assertIn("display_title", client_source)
        self.assertIn("display_subtitle", client_source)
        self.assertIn("chargée sur l'échiquier", app_source)
        self.assertIn("historyOpeningGameId", app_source)
        self.assertIn(".import-form", styles_source)
        self.assertIn(".game-library", styles_source)
        self.assertNotIn('id="tab-dashboard"', app_source)
        self.assertNotIn('id="tab-stats"', app_source)
        self.assertNotIn("Statistiques globales", app_source)

    def test_frontend_v5_2_2_history_library_contract_is_present(self) -> None:
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        styles_source = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(
            encoding="utf-8"
        )

        for token in (
            "game_category",
            "opponent_type",
            "display_title",
            "display_subtitle",
            "time_control_category",
            "review_summary_status",
            "is_reviewable",
            "metadata_quality",
        ):
            self.assertIn(token, client_source)

        for label in ("Mes parties", "Importées", "Locales", "IA", "Observées", "Toutes"):
            self.assertIn(label, app_source)

        for label in ("Local", "Lichess", "Chess.com", "Observée", "Incomplète"):
            self.assertIn(label, app_source)

        for label in (
            "Ouvrir",
            "Analyser",
            "Voir review",
            "Classifier ouverture",
            "À analyser",
            "Review disponible",
            "Analyse en cours",
            "Aucun moment majeur",
            "Trop courte",
            "Échec analyse",
        ):
            self.assertIn(label, app_source)

        history_panel_start = app_source.index('id="panel-history"')
        history_panel_end = app_source.index('id="panel-info"', history_panel_start)
        history_panel = app_source[history_panel_start:history_panel_end]
        self.assertIn("game-library", history_panel)
        self.assertIn("display_title", history_panel)
        self.assertNotIn("? - ?", history_panel)
        self.assertNotIn("score sur 100", history_panel.lower())
        self.assertNotIn("accuracy", history_panel.lower())
        self.assertNotIn("ACPL", history_panel)
        self.assertNotIn("V6", history_panel)
        self.assertIn(".history-scope-filters", styles_source)
        self.assertIn(".game-history-card", styles_source)

    def test_frontend_v4_1_1_review_failure_returns_to_live(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        normalized = app_source.replace("\r\n", "\n")
        handle_review_start = normalized.index("async function handleReview")
        catch_start = normalized.index("} catch (err) {", handle_review_start)
        catch_end = normalized.index("} finally", catch_start)
        catch_block = normalized[catch_start:catch_end]

        self.assertIn("isTooShortReviewError(err)", catch_block)
        self.assertIn('if (positionMode === "REVIEW")', catch_block)
        self.assertIn("goLivePosition()", catch_block)
        self.assertIn('setReviewError("Review temporairement indisponible.")', catch_block)

    def test_frontend_v4_1_1_drop_guard_stays_strict(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        board_source = (
            PROJECT_ROOT / "frontend" / "src" / "components" / "ChessBoardPanel.tsx"
        ).read_text(encoding="utf-8")

        self.assertIn('positionMode !== "LIVE"', app_source)
        self.assertIn('if (!gameId || busy !== "idle" || positionMode !== "LIVE")', app_source)
        self.assertIn("isGameCompleted", app_source)
        self.assertIn("if (!fen || disabled)", board_source)
        self.assertIn("return false;", board_source)

    def test_frontend_review_suspends_live_and_restores_job_state(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        normalized = app_source.replace("\r\n", "\n")

        self.assertIn(
            "const liveSuspendedForReview = reviewJobRunning;",
            normalized,
        )
        self.assertIn(
            "if (liveSuspendedForReview || liveSuspendedForPractice)",
            normalized,
        )
        self.assertIn(
            'setLiveInfoStatus("Analyse live en pause pendant la Review")',
            normalized,
        )
        self.assertIn(
            "setLiveInfoStatus(\"Analyse live en pause pendant l'exercice\")",
            normalized,
        )
        self.assertNotIn('liveSuspendedForReview = activeTab === "review"', normalized)
        self.assertIn("activeReviewJobId", normalized)
        self.assertIn("getReviewJob(saved.activeReviewJobId)", normalized)

    def test_frontend_review_diagnostics_client_contract_exists(self) -> None:
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")

        self.assertIn("ReviewJobDiagnostics", client_source)
        self.assertIn("getReviewJobDiagnostics", client_source)
        self.assertIn('`/review/jobs/${jobId}/diagnostics`', client_source)

    def test_frontend_review_reconcile_is_explicit_not_polling_loop(self) -> None:
        client_source = (
            PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts"
        ).read_text(encoding="utf-8")
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(
            encoding="utf-8"
        )
        panel_source = read_review_panel_source()
        normalized_app = app_source.replace("\r\n", "\n")

        self.assertIn("reconcileReviewJob", client_source)
        self.assertIn('`/review/jobs/${jobId}/reconcile`', client_source)
        poll_start = normalized_app.index("async function pollReviewJobOnce")
        poll_end = normalized_app.index("async function loadCompletedReviewAfterJob")
        poll_block = normalized_app[poll_start:poll_end]
        self.assertNotIn("reconcileReviewJob(", poll_block)
        self.assertIn("reviewJobNeedsExplicitReconcile(nextJob)", poll_block)
        self.assertIn('data-testid="review-reconcile"', panel_source)

    def test_backend_review_reconcile_endpoint_is_post_only(self) -> None:
        routes_source = (
            PROJECT_ROOT / "backend" / "neurochess" / "api" / "game_routes.py"
        ).read_text(encoding="utf-8")
        get_start = routes_source.index('@router.get("/review/jobs/{job_id}")')
        diagnostics_start = routes_source.index('@router.get("/review/jobs/{job_id}/diagnostics")')
        get_block = routes_source[get_start:diagnostics_start]

        self.assertIn('@router.post("/review/jobs/{job_id}/reconcile")', routes_source)
        self.assertNotIn("reconcile_review_job(", get_block)

    def _run_fake(
        self,
        fen: str,
        engine: CalibrationFakeEngine,
    ) -> dict[str, Any]:
        analysis = self.service.get_or_create_analysis(fen)
        result = self.service.run_analysis(analysis["id"], engine=engine)
        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "done")
        return result

    def _ten_controlled_fens(self) -> list[str]:
        board = chess.Board()
        moves = [
            "e2e4",
            "e7e5",
            "g1f3",
            "b8c6",
            "f1b5",
            "a7a6",
            "b5a4",
            "g8f6",
            "e1g1",
        ]
        fens = [board.fen()]
        for uci in moves:
            board.push(chess.Move.from_uci(uci))
            fens.append(board.fen())
        self.assertEqual(len(fens), 10)
        return fens

    def _analysis_count(self) -> int:
        with closing(sqlite3.connect(self.db_path)) as connection:
            return int(
                connection.execute(
                    "SELECT COUNT(*) FROM position_analyses"
                ).fetchone()[0]
            )


if __name__ == "__main__":
    unittest.main()


