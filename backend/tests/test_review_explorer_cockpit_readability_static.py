from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


class ReviewExplorerCockpitReadabilityStaticTests(unittest.TestCase):
    def test_explorer_cockpit_actions_and_line_analysis_copy_are_wired(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(encoding="utf-8")
        fr_source = (PROJECT_ROOT / "frontend" / "src" / "i18n" / "fr.ts").read_text(encoding="utf-8")
        client_source = (PROJECT_ROOT / "frontend" / "src" / "api" / "client.ts").read_text(encoding="utf-8")
        routes_source = (PROJECT_ROOT / "backend" / "neurochess" / "api" / "game_routes.py").read_text(encoding="utf-8")

        for token in (
            "Analyser ce coup",
            "Analyser la ligne",
            "Précision",
            "Rapide",
            "Standard",
            "Précise",
            "Exploration locale",
            "non enregistré comme exercice",
            "Évaluation de la ligne…",
            "Mise à jour…",
        ):
            self.assertIn(token, fr_source)
        for token in (
            "review-explorer-cockpit-actions",
            "review-explorer-analyze-move",
            "review-explorer-analyze-line",
            "review-explorer-analysis-preset",
        ):
            self.assertIn(token, app_source)
        self.assertIn("evaluateReviewExplorerLine", client_source)
        self.assertIn("/api/review/explorer/evaluate-line", client_source)
        self.assertIn("/api/review/explorer/evaluate-line", routes_source)

    def test_eval_bar_and_line_player_readability_css_are_present(self) -> None:
        styles = (PROJECT_ROOT / "frontend" / "src" / "styles.css").read_text(encoding="utf-8")

        for selector in (
            ".eval-placeholder",
            ".review-line-player-dock .review-practice-pv-stepper",
            ".review-line-player-dock .review-block-title strong",
            ".review-line-player-dock .review-pv-line-mode button.active",
            ".review-decision-card-head > span",
            ".review-practice-head h3",
        ):
            self.assertIn(selector, styles)
        self.assertIn("rgba(7, 10, 26, 0.96)", styles)
        self.assertIn("border-style: solid", styles)
        self.assertNotIn("bleu ciel", styles.lower())

    def test_today_start_raw_unavailable_move_copy_is_removed(self) -> None:
        fr_source = (PROJECT_ROOT / "frontend" / "src" / "i18n" / "fr.ts").read_text(encoding="utf-8")
        training_service = (
            PROJECT_ROOT / "backend" / "neurochess" / "training_item_service.py"
        ).read_text(encoding="utf-8")

        self.assertNotIn("coup indisponible", fr_source)
        self.assertIn("Coup de la partie non disponible pour cette révision", fr_source)
        self.assertIn("source_san", training_service)
        self.assertIn("source_uci", training_service)

    def test_new_browser_smokes_exist(self) -> None:
        for script_name in (
            "browser_explorer_cockpit_actions_near_board_smoke.mjs",
            "browser_explorer_analyze_line_smoke.mjs",
            "browser_eval_bar_stability_smoke.mjs",
            "browser_today_start_context_smoke.mjs",
            "browser_line_player_readability_smoke.mjs",
        ):
            self.assertTrue((PROJECT_ROOT / "scripts" / script_name).exists(), script_name)

    def test_no_forbidden_raw_metric_copy_in_new_explorer_surface(self) -> None:
        app_source = (PROJECT_ROOT / "frontend" / "src" / "App.tsx").read_text(encoding="utf-8")
        cockpit_slice = app_source.split("review-explorer-cockpit-actions", 1)[1].split(
            "review-line-player-dock",
            1,
        )[0]
        for forbidden in (
            "raw_wdl",
            "criticality_score",
            "diagnostic_gap",
            "neuro_score_diag",
            "Transfer Gap",
            "FSRS",
            "ETV",
        ):
            self.assertNotIn(forbidden, cockpit_slice)


if __name__ == "__main__":
    unittest.main()
