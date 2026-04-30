from __future__ import annotations

from math import log10


def expected_score(player_rating: float, opponent_rating: float) -> float:
    exponent = (opponent_rating - player_rating) / 400.0

    try:
        expected = 1.0 / (1.0 + 10.0**exponent)
    except OverflowError:
        expected = 0.0 if exponent > 0 else 1.0

    return max(0.0, min(1.0, expected))


def rating_difference_from_expected_score(expected: float) -> float:
    safe_expected = max(1e-6, min(1.0 - 1e-6, expected))
    return -400.0 * log10((1.0 / safe_expected) - 1.0)


def confidence_label(num_games: int) -> str:
    if num_games < 3:
        return "very_low"
    if num_games < 8:
        return "low"
    if num_games < 20:
        return "medium"
    return "high"


def rating_uncertainty_estimate(num_games: int) -> int:
    if num_games <= 0:
        return 500
    if num_games < 3:
        return 400
    if num_games < 8:
        return 250
    if num_games < 20:
        return 150
    return 80


def format_rating_estimate(rating: int, uncertainty: int) -> str:
    return f"{rating} ± {uncertainty}"


def explain_rating_limitations(num_games: int) -> str:
    if num_games < 3:
        return "Trop peu de parties pour une estimation fiable."
    if num_games < 8:
        return "Estimation indicative, forte incertitude."
    if num_games < 20:
        return "Estimation utile mais encore perfectible."
    return "Estimation relativement stable, mais non équivalente à un Elo officiel."
