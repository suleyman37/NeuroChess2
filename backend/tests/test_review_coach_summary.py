from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.metrics.review_metrics import (  # noqa: E402
    HEADLINE_SCORE_FORMULA_VERSION,
    headline_neurochess_score,
)
from neurochess.review_service import _build_review_summary_sentence  # noqa: E402


class HeadlineScoreTests(unittest.TestCase):
    def test_headline_score_blends_accuracy_and_raw_neuro_score(self) -> None:
        self.assertEqual(HEADLINE_SCORE_FORMULA_VERSION, "headline_neurochess_score_v1")
        self.assertAlmostEqual(
            headline_neurochess_score(80.0, 60.0, 20.0) or 0.0,
            71.0,
            places=2,
        )

    def test_headline_score_uses_positive_gap_penalty_without_bonus(self) -> None:
        self.assertAlmostEqual(
            headline_neurochess_score(80.0, None, 10.0) or 0.0,
            75.5,
            places=2,
        )
        self.assertEqual(headline_neurochess_score(80.0, None, -10.0), 80.0)

    def test_headline_score_clamps(self) -> None:
        self.assertEqual(headline_neurochess_score(140.0, 140.0, -10.0), 100.0)
        self.assertEqual(headline_neurochess_score(5.0, None, 50.0), 0.0)


class ReviewSummarySentenceTests(unittest.TestCase):
    def test_high_public_score_sentence(self) -> None:
        sentence = _build_review_summary_sentence(
            coach_score=91.0,
            public_score=91.0,
            review_sections={"to_review": []},
            confidence="high",
        )
        self.assertIn("Partie solide", sentence)

    def test_public_high_but_coach_low_sentence(self) -> None:
        sentence = _build_review_summary_sentence(
            coach_score=62.0,
            public_score=87.0,
            review_sections={"to_review": []},
            confidence="high",
        )
        self.assertIn("précision moyenne", sentence)
        self.assertIn("moments critiques", sentence)

    def test_summary_does_not_depend_on_diagnostic_gap(self) -> None:
        sentence = _build_review_summary_sentence(
            coach_score=76.0,
            public_score=76.0,
            review_sections={"to_review": []},
            confidence="high",
        )
        self.assertNotIn("impact durable", sentence)
        self.assertNotIn("diagnostique", sentence.lower())

    def test_conversion_cluster_and_missed_opportunity_sentences(self) -> None:
        self.assertIn(
            "conversion",
            _build_review_summary_sentence(
                coach_score=70.0,
                public_score=70.0,
                review_sections={
                    "to_review": [
                        {"tags": ["conversion_issue"]},
                        {"tags": ["conversion_issue"]},
                    ]
                },
                confidence="high",
            ),
        )
        self.assertIn(
            "bascul",
            _build_review_summary_sentence(
                coach_score=70.0,
                public_score=70.0,
                review_sections={
                    "to_review": [{"tags": ["cluster"]}, {"tags": ["cluster"]}]
                },
                confidence="high",
            ),
        )
        self.assertIn(
            "opportunités",
            _build_review_summary_sentence(
                coach_score=70.0,
                public_score=70.0,
                review_sections={
                    "to_review": [
                        {"tags": ["missed_opportunity"]},
                        {"tags": ["missed_opportunity"]},
                    ]
                },
                confidence="high",
            ),
        )

    def test_low_confidence_prefix(self) -> None:
        sentence = _build_review_summary_sentence(
            coach_score=50.0,
            public_score=50.0,
            review_sections={"to_review": []},
            confidence="low",
        )
        self.assertTrue(sentence.startswith("Score indicatif"))


if __name__ == "__main__":
    unittest.main()
