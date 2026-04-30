from __future__ import annotations

import sys
import unittest
from pathlib import Path

import chess


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.metrics.opening_reality import (  # noqa: E402
    OPENING_REALITY_EVIDENCE_VERSION,
    build_opening_reality_evidence,
)


class OpeningRealityEvidenceTests(unittest.TestCase):
    def test_standard_opening_detects_out_of_book_move(self) -> None:
        moves = _moves(["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"])
        evidence = build_opening_reality_evidence(
            game={"initial_fen": chess.STARTING_FEN},
            opening_classification={
                "opening_name": "Ruy Lopez",
                "eco_code": "C60",
                "last_book_ply": 5,
                "out_of_book_ply": 6,
                "out_of_book_color": "black",
                "out_of_book_fen": moves[5]["fen_before"],
                "classification_status": "matched",
                "confidence": "medium",
                "source": "lichess_chess_openings",
            },
            moves=moves,
            move_annotations=[],
        )

        self.assertEqual(evidence["schema_version"], OPENING_REALITY_EVIDENCE_VERSION)
        self.assertTrue(evidence["available"])
        self.assertEqual(evidence["opening_name"], "Ruy Lopez")
        self.assertEqual(evidence["eco"], "C60")
        self.assertEqual(evidence["source"], "lichess_book")
        self.assertEqual(evidence["book_until_ply"], 5)
        self.assertEqual(evidence["last_book_ply"], 5)
        self.assertEqual(evidence["last_book_move_san"], "Bb5")
        self.assertEqual(evidence["last_book_move_uci"], "f1b5")
        self.assertEqual(evidence["out_of_book_ply"], 6)
        self.assertEqual(evidence["exit_ply"], 6)
        self.assertEqual(evidence["out_of_book_move_san"], "a6")
        self.assertEqual(evidence["exit_move_san"], "a6")
        self.assertEqual(evidence["out_of_book_move_uci"], "a7a6")
        self.assertEqual(evidence["exit_move_uci"], "a7a6")
        self.assertEqual(evidence["out_of_book_fen"], moves[5]["fen_before"])
        self.assertEqual(evidence["fen_before_exit"], moves[5]["fen_before"])
        self.assertEqual(evidence["fen_after_exit"], moves[5]["fen_after"])
        self.assertEqual(evidence["last_book_fen"], moves[4]["fen_after"])
        self.assertEqual(evidence["move_number_exit"], 3)
        self.assertEqual(evidence["exit_color"], "black")
        self.assertEqual(evidence["side_to_move_at_exit"], "black")

    def test_critical_moment_within_eight_plies_after_exit_is_linked(self) -> None:
        moves = _moves(["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"])
        evidence = build_opening_reality_evidence(
            game={"initial_fen": chess.STARTING_FEN},
            opening_classification={
                "opening_name": "Ruy Lopez",
                "eco_code": "C60",
                "last_book_ply": 5,
                "out_of_book_ply": 6,
                "out_of_book_color": "black",
                "out_of_book_fen": moves[5]["fen_before"],
                "classification_status": "matched",
                "confidence": "medium",
                "source": "internal_seed",
            },
            moves=moves,
            move_annotations=[
                _annotation(6, "black", "a6", "a7a6", "playable", 2.0),
                _annotation(
                    10,
                    "black",
                    "Be7",
                    "f8e7",
                    "to_review",
                    8.2,
                    ["persistent_loss"],
                ),
            ],
        )

        self.assertEqual(evidence["source"], "local_book")
        self.assertEqual(evidence["critical_moment_after_exit"]["ply"], 10)
        self.assertEqual(evidence["first_loss_after_exit"]["ply"], 10)
        self.assertIn("premier vrai problème", evidence["summary"])
        self.assertIn("moment critique", evidence["recommendation"])

    def test_no_critical_moment_reports_no_immediate_issue(self) -> None:
        moves = _moves(["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"])
        evidence = build_opening_reality_evidence(
            game={"initial_fen": chess.STARTING_FEN},
            opening_classification={
                "opening_name": "Ruy Lopez",
                "eco_code": "C60",
                "last_book_ply": 5,
                "out_of_book_ply": 6,
                "out_of_book_color": "black",
                "out_of_book_fen": moves[5]["fen_before"],
                "classification_status": "matched",
                "confidence": "medium",
            },
            moves=moves,
            move_annotations=[
                _annotation(6, "black", "a6", "a7a6", "good", 1.0),
                _annotation(8, "black", "Nf6", "g8f6", "good", 2.0),
            ],
        )

        self.assertIsNone(evidence["critical_moment_after_exit"])
        self.assertIsNone(evidence["first_loss_after_exit"])
        self.assertIn("n'a pas immédiatement entraîné", evidence["summary"])

    def test_low_impact_playable_after_exit_is_not_linked_as_problem(self) -> None:
        moves = _moves(["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"])
        evidence = build_opening_reality_evidence(
            game={"initial_fen": chess.STARTING_FEN},
            opening_classification={
                "opening_name": "Ruy Lopez",
                "eco_code": "C60",
                "last_book_ply": 5,
                "out_of_book_ply": 6,
                "out_of_book_color": "black",
                "out_of_book_fen": moves[5]["fen_before"],
                "classification_status": "matched",
                "confidence": "medium",
            },
            moves=moves,
            move_annotations=[
                _annotation(8, "black", "Nf6", "g8f6", "playable", 2.0),
            ],
        )

        self.assertIsNone(evidence["critical_moment_after_exit"])
        self.assertIsNone(evidence["first_loss_after_exit"])

    def test_significant_loss_after_exit_is_linked_even_without_bad_category(self) -> None:
        moves = _moves(["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"])
        evidence = build_opening_reality_evidence(
            game={"initial_fen": chess.STARTING_FEN},
            opening_classification={
                "opening_name": "Ruy Lopez",
                "eco_code": "C60",
                "last_book_ply": 5,
                "out_of_book_ply": 6,
                "out_of_book_color": "black",
                "out_of_book_fen": moves[5]["fen_before"],
                "classification_status": "matched",
                "confidence": "medium",
            },
            moves=moves,
            move_annotations=[
                _annotation(8, "black", "Nf6", "g8f6", "playable", 7.4),
            ],
        )

        self.assertEqual(evidence["critical_moment_after_exit"]["ply"], 8)
        self.assertEqual(evidence["first_loss_after_exit"]["ply"], 8)

    def test_good_or_excellent_low_loss_after_exit_is_not_linked(self) -> None:
        moves = _moves(["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"])
        evidence = build_opening_reality_evidence(
            game={"initial_fen": chess.STARTING_FEN},
            opening_classification={
                "opening_name": "Ruy Lopez",
                "eco_code": "C60",
                "last_book_ply": 5,
                "out_of_book_ply": 6,
                "out_of_book_color": "black",
                "out_of_book_fen": moves[5]["fen_before"],
                "classification_status": "matched",
                "confidence": "medium",
            },
            moves=moves,
            move_annotations=[
                _annotation(8, "black", "Nf6", "g8f6", "good", 2.0),
                _annotation(9, "white", "O-O", "e1g1", "excellent", 1.0),
            ],
        )

        self.assertIsNone(evidence["critical_moment_after_exit"])
        self.assertIsNone(evidence["first_loss_after_exit"])

    def test_from_position_is_not_applicable(self) -> None:
        special_fen = (
            "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        )
        evidence = build_opening_reality_evidence(
            game={"initial_fen": special_fen},
            opening_classification={
                "classification_status": "not_applicable_from_position",
            },
            moves=[],
            move_annotations=[],
        )

        self.assertFalse(evidence["available"])
        self.assertEqual(evidence["status"], "not_applicable_from_position")
        self.assertIn("position spéciale", evidence["summary"])

    def test_missing_data_is_explicit_and_does_not_crash(self) -> None:
        evidence = build_opening_reality_evidence(
            game={"initial_fen": chess.STARTING_FEN},
            opening_classification=None,
            moves=[],
            move_annotations=[],
        )

        self.assertFalse(evidence["available"])
        self.assertEqual(evidence["status"], "missing_data")
        self.assertIn("opening_classification_missing", evidence["missing_data"])

    def test_opening_reality_module_does_not_import_engine_layers(self) -> None:
        source = (
            BACKEND_ROOT / "neurochess" / "metrics" / "opening_reality.py"
        ).read_text(encoding="utf-8")
        for forbidden in (
            "Stockfish",
            "AnalysisService",
            "LiveAnalysisService",
            "position_analyses",
            "get_or_create_analysis",
        ):
            self.assertNotIn(forbidden, source)


def _moves(uci_moves: list[str]) -> list[dict[str, object]]:
    board = chess.Board()
    rows: list[dict[str, object]] = []
    for ply, uci in enumerate(uci_moves, start=1):
        move = chess.Move.from_uci(uci)
        rows.append(
            {
                "ply": ply,
                "fen_before": board.fen(),
                "uci": uci,
                "san": board.san(move),
            }
        )
        board.push(move)
        rows[-1]["fen_after"] = board.fen()
    return rows


def _annotation(
    ply: int,
    color: str,
    san: str,
    uci: str,
    primary_category: str,
    win_loss: float,
    tags: list[str] | None = None,
) -> dict[str, object]:
    return {
        "ply": ply,
        "move_number": (ply + 1) // 2,
        "color": color,
        "san": san,
        "uci": uci,
        "primary_category": primary_category,
        "category_label": "À revoir" if primary_category == "to_review" else "Bon",
        "tags": tags or [],
        "win_loss": win_loss,
        "impact_label": "important",
    }


if __name__ == "__main__":
    unittest.main()
