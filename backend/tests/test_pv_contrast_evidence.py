from __future__ import annotations

import inspect
import sys
import unittest
from pathlib import Path
from typing import Any

import chess


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.metrics.pv_contrast import (  # noqa: E402
    PV_CONTRAST_EVIDENCE_VERSION,
    build_pv_contrast_evidence,
)


TACTICAL_FEN = "6k1/8/8/8/8/8/4Q3/4K3 w - - 0 1"
START_FEN = chess.STARTING_FEN


class PvContrastEvidenceTests(unittest.TestCase):
    def test_best_pv_available_builds_best_branch_final_fen(self) -> None:
        annotation = self._annotation(
            fen_before=START_FEN,
            played="d2d3",
            best="e2e4",
            top_moves=[{"uci": "e2e4", "pv": ["e2e4", "e7e5", "g1f3"]}],
        )

        evidence = build_pv_contrast_evidence(annotation)

        self.assertEqual(evidence["schema_version"], PV_CONTRAST_EVIDENCE_VERSION)
        self.assertTrue(evidence["available"])
        self.assertEqual(evidence["best_branch"]["line_length"], 3)
        self.assertEqual(evidence["best_branch"]["pv"][0]["uci"], "e2e4")
        self.assertIsNotNone(evidence["best_branch"]["final_fen"])

    def test_analysis_after_extracts_opponent_best_reply(self) -> None:
        fen_after = _fen_after(TACTICAL_FEN, "e2e3")
        annotation = self._annotation(
            fen_before=TACTICAL_FEN,
            played="e2e3",
            best="e2e8",
            top_moves=[{"uci": "e2e8", "pv": ["e2e8", "g8g7"]}],
        )
        analyses_by_fen = {
            fen_after: {
                "analysis_json": {
                    "top_moves": [{"uci": "g8f7", "pv": ["g8f7"]}],
                }
            }
        }

        evidence = build_pv_contrast_evidence(annotation, analyses_by_fen)

        self.assertEqual(evidence["played_branch"]["opponent_best_reply_uci"], "g8f7")
        self.assertEqual(evidence["played_branch"]["pv"][1]["uci"], "g8f7")

    def test_illegal_partial_pv_stops_cleanly_and_records_missing_data(self) -> None:
        annotation = self._annotation(
            fen_before=START_FEN,
            played="d2d3",
            best="e2e4",
            top_moves=[{"uci": "e2e4", "pv": ["e2e4", "a1a8", "g1f3"]}],
        )

        evidence = build_pv_contrast_evidence(annotation)

        self.assertEqual([move["uci"] for move in evidence["best_branch"]["pv"]], ["e2e4"])
        self.assertIn("best_branch_pv_illegal_move", evidence["missing_data"])

    def test_forcing_best_move_vs_quiet_played_is_forcing(self) -> None:
        annotation = self._annotation(
            fen_before=TACTICAL_FEN,
            played="e2e3",
            best="e2e8",
            top_moves=[{"uci": "e2e8", "pv": ["e2e8", "g8g7"]}],
            player_before=55.0,
            win_loss=18.0,
        )

        evidence = build_pv_contrast_evidence(annotation)

        self.assertEqual(evidence["contrast"]["main_difference_type"], "forcing")
        self.assertIn("more forcing", " ".join(evidence["contrast"]["safe_explanation_bullets"]))

    def test_conversion_case_takes_priority(self) -> None:
        annotation = self._annotation(
            fen_before=START_FEN,
            played="d2d3",
            best="e2e4",
            top_moves=[{"uci": "e2e4", "pv": ["e2e4"]}],
            player_before=82.0,
            win_loss=12.0,
            tags=["conversion_issue"],
        )

        evidence = build_pv_contrast_evidence(annotation)

        self.assertEqual(evidence["contrast"]["main_difference_type"], "conversion")

    def test_defense_case_takes_priority(self) -> None:
        annotation = self._annotation(
            fen_before=START_FEN,
            played="d2d3",
            best="e2e4",
            top_moves=[{"uci": "e2e4", "pv": ["e2e4"]}],
            player_before=30.0,
            win_loss=8.0,
            missed_gain=14.0,
            tags=["defensive_resource_missed"],
        )

        evidence = build_pv_contrast_evidence(annotation)

        self.assertEqual(evidence["contrast"]["main_difference_type"], "defense")

    def test_missing_data_is_low_confidence_without_crash(self) -> None:
        evidence = build_pv_contrast_evidence({"fen_before": START_FEN})

        self.assertFalse(evidence["available"])
        self.assertEqual(evidence["confidence"], "low")
        self.assertIn("played_move_missing", evidence["missing_data"])
        self.assertIn("best_move_missing", evidence["missing_data"])

    def test_module_does_not_call_stockfish_or_analysis(self) -> None:
        source = inspect.getsource(build_pv_contrast_evidence)

        self.assertNotIn("Stockfish", source)
        self.assertNotIn("analyze_fen", source)

    def _annotation(
        self,
        *,
        fen_before: str,
        played: str,
        best: str,
        top_moves: list[dict[str, Any]],
        player_before: float = 50.0,
        win_loss: float = 10.0,
        missed_gain: float | None = None,
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        return {
            "fen_before": fen_before,
            "fen_after": _fen_after(fen_before, played),
            "uci": played,
            "san": _san_for_uci(fen_before, played),
            "side": "white",
            "best_move_uci": best,
            "best_move_san": _san_for_uci(fen_before, best),
            "top_moves": top_moves,
            "player_win_percent_before": player_before,
            "win_loss": win_loss,
            "missed_gain": missed_gain,
            "tags": tags or [],
        }


def _fen_after(fen: str, uci: str) -> str:
    board = chess.Board(fen)
    board.push(chess.Move.from_uci(uci))
    return board.fen()


def _san_for_uci(fen: str, uci: str) -> str:
    board = chess.Board(fen)
    move = chess.Move.from_uci(uci)
    return board.san(move)


if __name__ == "__main__":
    unittest.main()
