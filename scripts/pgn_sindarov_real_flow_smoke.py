from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any

import chess
from fastapi.testclient import TestClient


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import app
from neurochess.api.game_routes import ACTIVE_SESSIONS, get_repository
from neurochess.data.database import init_db
from neurochess.data.repositories import Repository
from neurochess.engines.fake_engine import FakeStockfishService
from neurochess.pgn_import_service import parse_pgn_games


FIXTURE = (
    PROJECT_ROOT
    / "backend"
    / "tests"
    / "fixtures"
    / "pgn"
    / "real_lichess_sindarov_from_position.pgn"
)
SPECIAL_INITIAL_FEN = "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--use-current-db", action="store_true")
    parser.add_argument(
        "--allow-current-db-review",
        action="store_true",
        help="Also start a fake Review job against the current DB.",
    )
    args = parser.parse_args()

    if not FIXTURE.exists():
        print(f"Sindarov real PGN fixture missing: {FIXTURE}")
        return 2

    pgn_text = FIXTURE.read_text(encoding="utf-8")
    parsed, parse_errors = parse_pgn_games(pgn_text)
    if parse_errors:
        print("Sindarov real PGN parse failed:")
        for error in parse_errors[:5]:
            print(f"- {error}")
        return 1

    temp_dir: Path | None = None
    if args.use_current_db:
        db_path = PROJECT_ROOT / "neurochess.db"
        print(f"Using current DB: {db_path}")
    else:
        temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-sindarov-smoke-"))
        db_path = temp_dir / "sindarov_smoke.db"

    previous_env = _enable_fake_engine()
    try:
        init_db(db_path)
        repository = Repository(db_path)
        ACTIVE_SESSIONS.clear()
        app.dependency_overrides[get_repository] = lambda: repository
        client = TestClient(app)
        try:
            imported = client.post(
                "/games/import-pgn",
                json={
                    "pgn_text": pgn_text,
                    "user_alias": "SindarovGM",
                    "platform": "unknown",
                },
            )
            imported.raise_for_status()
            import_payload = imported.json()
            history = client.get("/games/history?scope=all&limit=200")
            history.raise_for_status()
            history_cards = _matching_sindarov_cards(history.json(), parsed)
            expected_initial_fens = {
                game.source_game_id: game.initial_fen for game in parsed
            }
            first_failure: tuple[int | str, str] | None = None

            for card in history_cards:
                expected_fen = expected_initial_fens.get(card.get("source_game_id"))
                failure = _check_history_card(card, expected_fen)
                if failure and first_failure is None:
                    first_failure = (card.get("game_id", "?"), failure)
                    break
                failure = _check_open_flow(client, int(card["game_id"]), expected_fen)
                if failure and first_failure is None:
                    first_failure = (card.get("game_id", "?"), failure)
                    break

            review_ok = False
            review_skipped = False
            if history_cards and (not args.use_current_db or args.allow_current_db_review):
                review_ok, review_failure = _check_review_start(
                    client,
                    int(history_cards[0]["game_id"]),
                )
                if review_failure and first_failure is None:
                    first_failure = (history_cards[0]["game_id"], review_failure)
            else:
                review_skipped = args.use_current_db

            repaired_count = int(import_payload.get("repaired_count") or 0)
            report = {
                "games_found": len(parsed),
                "imported_ok": len(history_cards),
                "repaired_existing": repaired_count,
                "history_cards_ok": first_failure is None and len(history_cards) == len(parsed),
                "open_flow_ok": first_failure is None,
                "replay_from_initial_fen_ok": first_failure is None,
                "review_start_ok": review_ok,
                "review_start_skipped": review_skipped,
                "first_failing_game_id": first_failure[0] if first_failure else None,
                "failure_reason": first_failure[1] if first_failure else None,
            }
            _print_report(report)
            return 0 if first_failure is None and (review_ok or review_skipped) else 1
        finally:
            client.close()
            app.dependency_overrides.clear()
            ACTIVE_SESSIONS.clear()
    finally:
        _restore_env(previous_env)
        if temp_dir is not None:
            shutil.rmtree(temp_dir, ignore_errors=True)


def _matching_sindarov_cards(cards: list[dict[str, Any]], parsed: list[Any]) -> list[dict[str, Any]]:
    game_ids = {game.source_game_id for game in parsed}
    return [
        card
        for card in cards
        if card.get("source_platform") == "lichess"
        and card.get("source_game_id") in game_ids
    ]


def _check_history_card(card: dict[str, Any], expected_initial_fen: str | None) -> str | None:
    if not card.get("game_id"):
        return "history card missing local game_id"
    if not card.get("white_name") or not card.get("black_name"):
        return "history card missing player names"
    if card.get("source_platform") != "lichess":
        return "history card source is not lichess"
    if card.get("variant") != "From Position":
        return "history card variant is not From Position"
    if expected_initial_fen is None:
        return "history card source_game_id was not in parsed PGN"
    if card.get("initial_fen") != expected_initial_fen:
        return "history card initial_fen is not the header FEN"
    if card.get("import_status") != "ok":
        return f"history card import_status is {card.get('import_status')}"
    if not card.get("is_special_position"):
        return "history card missing special-position flag"
    return None


def _check_open_flow(
    client: TestClient,
    game_id: int,
    expected_initial_fen: str | None,
) -> str | None:
    state = client.get(f"/games/{game_id}")
    if state.status_code != 200:
        return f"open endpoint failed: HTTP {state.status_code} {state.text}"
    moves = client.get(f"/games/{game_id}/moves")
    if moves.status_code != 200:
        return f"moves endpoint failed: HTTP {moves.status_code} {moves.text}"
    diagnostics = client.get(f"/games/{game_id}/diagnostics")
    if diagnostics.status_code != 200:
        return f"diagnostics endpoint failed: HTTP {diagnostics.status_code} {diagnostics.text}"

    moves_payload = moves.json()
    if expected_initial_fen is None:
        return "missing expected initial_fen for open flow"
    if moves_payload["initial_fen"] != expected_initial_fen:
        return "moves endpoint returned STARTING_FEN or wrong initial_fen"
    replay_error = _replay_moves_payload(moves_payload)
    if replay_error:
        return replay_error
    diagnostics_payload = diagnostics.json()
    if not diagnostics_payload["can_open"]:
        return f"diagnostics can_open=false: {diagnostics_payload}"
    if not diagnostics_payload["can_analyze"]:
        return f"diagnostics can_analyze=false: {diagnostics_payload}"
    return None


def _check_review_start(client: TestClient, game_id: int) -> tuple[bool, str | None]:
    review = client.post(
        f"/games/{game_id}/review/jobs",
        json={"profile": "standard", "force_reanalysis": True},
    )
    if review.status_code not in {200, 202}:
        return False, f"review job start failed: HTTP {review.status_code} {review.text}"
    payload = review.json()
    if payload.get("status") == "failed":
        return False, f"review job failed at start: {payload}"
    return True, None


def _replay_moves_payload(payload: dict[str, Any]) -> str | None:
    board = chess.Board(payload["initial_fen"])
    if board.fen() == chess.STARTING_FEN:
        return "replay unexpectedly starts from STARTING_FEN"
    for move_payload in payload["moves"]:
        if board.fen() != move_payload["fen_before"]:
            return f"fen_before mismatch at ply {move_payload['ply']}"
        move = chess.Move.from_uci(move_payload["played_uci"])
        if move not in board.legal_moves:
            return (
                f"illegal move at ply {move_payload['ply']}: "
                f"{move_payload['played_san']} {move_payload['played_uci']}"
            )
        board.push(move)
    return None


def _enable_fake_engine() -> dict[str, str | None]:
    previous = {
        "NEUROCHESS_ENGINE_MODE": os.environ.get("NEUROCHESS_ENGINE_MODE"),
        "FAKE_ENGINE_DELAY_MS": os.environ.get("FAKE_ENGINE_DELAY_MS"),
        "FAKE_ENGINE_HARD_TIMEOUT_MS": os.environ.get("FAKE_ENGINE_HARD_TIMEOUT_MS"),
    }
    os.environ["NEUROCHESS_ENGINE_MODE"] = "fake"
    os.environ["FAKE_ENGINE_DELAY_MS"] = "1"
    os.environ["FAKE_ENGINE_HARD_TIMEOUT_MS"] = "1000"
    FakeStockfishService.reset_state()
    return previous


def _restore_env(previous: dict[str, str | None]) -> None:
    for key, value in previous.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    FakeStockfishService.reset_state()


def _print_report(report: dict[str, Any]) -> None:
    print("Sindarov real PGN:")
    print(f"- games found: {report['games_found']}")
    print(f"- imported ok: {report['imported_ok']}")
    print(f"- repaired existing: {report['repaired_existing']}")
    print(f"- history cards ok: {'yes' if report['history_cards_ok'] else 'no'}")
    print(f"- open flow ok: {'yes' if report['open_flow_ok'] else 'no'}")
    print(
        "- replay from initial_fen ok: "
        f"{'yes' if report['replay_from_initial_fen_ok'] else 'no'}"
    )
    if report["review_start_skipped"]:
        print("- review start ok: skipped on current DB safe mode")
    else:
        print(f"- review start ok: {'yes' if report['review_start_ok'] else 'no'}")
    print(f"- first failing game_id: {report['first_failing_game_id']}")
    print(f"- failure reason: {report['failure_reason']}")


if __name__ == "__main__":
    raise SystemExit(main())
