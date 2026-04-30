from __future__ import annotations

import os
import shutil
import sys
import tempfile
import threading
import time
from pathlib import Path

import chess


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.data.database import init_db
from neurochess.data.repositories import Repository
from neurochess.engines.fake_engine import FakeStockfishService
from neurochess.review_job_service import ReviewJobService
from neurochess.review_service import ReviewService


REVIEWABLE_MOVES = [
    "e2e4",
    "e7e5",
    "g1f3",
    "b8c6",
    "f1b5",
    "a7a6",
    "b5a4",
    "g8f6",
    "e1g1",
    "f8e7",
    "f1e1",
]


def main() -> int:
    os.environ["NEUROCHESS_ENGINE_MODE"] = "fake"
    os.environ.setdefault("FAKE_ENGINE_DELAY_MS", "300")
    fake_delay_ms = int(os.environ.get("FAKE_ENGINE_DELAY_MS", "300"))
    os.environ["FAKE_ENGINE_HARD_TIMEOUT_MS"] = str(max(1000, fake_delay_ms + 750))
    os.environ.pop("FAKE_ENGINE_HANG_ON_INDEX", None)
    os.environ.pop("FAKE_ENGINE_FAIL_ON_INDEX", None)

    temp_dir = Path(tempfile.mkdtemp(prefix="neurochess2-review-smoke-"))
    try:
        db_path = temp_dir / "smoke.db"
        init_db(db_path)
        repository = Repository(db_path)
        job_service = ReviewJobService(db_path)
        review_service = ReviewService(db_path)

        print("review-smoke: normal deep job")
        game_id, positions = create_finished_game(repository)
        FakeStockfishService.reset_state()
        job = job_service.start_job(game_id, profile="deep", force_reanalysis=True)
        worker = threading.Thread(target=job_service.run_job, args=(job["job_id"],))
        worker.start()
        time.sleep(0.2)
        running = ReviewJobService(db_path).get_job(job["job_id"])
        assert running["status"] in {"queued", "running", "finalizing", "completed"}
        if running["status"] != "completed":
            review = review_service.get_review(game_id, profile="deep")
            assert review["status"] != "done", "score/moments appeared before completed"
        restored = ReviewJobService(db_path).get_job(job["job_id"])
        assert restored["job_id"] == job["job_id"], "refresh-style restore lost the job"
        worker.join(timeout=30)
        assert not worker.is_alive(), "normal Review worker did not finish"
        completed = job_service.get_job(job["job_id"])
        assert completed["status"] == "completed", completed
        assert completed["completed_position_count"] == len(positions)

        print("review-smoke: last-position hang recovery")
        second_game_id, second_positions = create_finished_game(repository)
        FakeStockfishService.reset_state()
        os.environ["FAKE_ENGINE_HARD_TIMEOUT_MS"] = "75"
        os.environ["FAKE_ENGINE_HANG_ON_INDEX"] = str(len(second_positions))
        stuck = job_service.start_job(
            second_game_id,
            profile="deep",
            force_reanalysis=True,
        )
        job_service.run_job(stuck["job_id"])
        stuck_status = job_service.get_job(stuck["job_id"])
        assert stuck_status["status"] in {"failed", "stalled"}, stuck_status
        assert stuck_status.get("retryable") is True, stuck_status

        os.environ.pop("FAKE_ENGINE_HANG_ON_INDEX", None)
        os.environ["FAKE_ENGINE_HARD_TIMEOUT_MS"] = str(max(1000, fake_delay_ms + 750))
        FakeStockfishService.reset_state()
        resumed = job_service.start_job(second_game_id, profile="deep")
        job_service.run_job(resumed["job_id"])
        resumed_status = job_service.get_job(resumed["job_id"])
        assert resumed_status["status"] == "completed", resumed_status

        diagnostics = job_service.get_job_diagnostics(resumed["job_id"])
        assert diagnostics["valid_analysis_count"] == diagnostics["required_position_count"]
        print("review-smoke: PASS")
        return 0
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def create_finished_game(repository: Repository) -> tuple[int, list[str]]:
    game_id = repository.create_game("classic")
    board = chess.Board()
    positions = [board.fen()]
    for ply, uci in enumerate(REVIEWABLE_MOVES, start=1):
        move = chess.Move.from_uci(uci)
        san = board.san(move)
        repository.add_move(
            game_id=game_id,
            ply=ply,
            fen_before=board.fen(),
            uci=uci,
            san=san,
            is_player=True,
        )
        board.push(move)
        positions.append(board.fen())
    repository.finish_game(game_id, result="*", pgn='[Result "*"]')
    return game_id, positions


if __name__ == "__main__":
    raise SystemExit(main())
