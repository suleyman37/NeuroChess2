from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.analysis_service import AnalysisService, InvalidFenError
from neurochess.engines.stockfish_service import StockfishServiceError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate one FEN with the V3.9a calibration path.",
    )
    parser.add_argument("--fen", required=True, help="FEN to evaluate")
    parser.add_argument(
        "--mode",
        choices=["calibration"],
        default="calibration",
        help="Evaluation mode. V3.9a exposes calibration only.",
    )
    parser.add_argument("--depth", type=int, default=22)
    parser.add_argument("--time", type=float, default=30.0)
    parser.add_argument("--nodes", type=int, default=None)
    parser.add_argument("--multipv", type=int, default=1)
    args = parser.parse_args(argv)

    service = AnalysisService()

    try:
        payload = service.evaluate_calibration(
            fen=args.fen,
            depth=args.depth,
            time=args.time,
            nodes=args.nodes,
            multipv=args.multipv,
        )
    except InvalidFenError:
        print(
            json.dumps(
                {
                    "error": "invalid_fen",
                    "message": "The provided FEN is not valid standard chess FEN.",
                    "fen": args.fen,
                },
                ensure_ascii=False,
                sort_keys=True,
            ),
            file=sys.stderr,
        )
        return 2
    except StockfishServiceError as exc:
        print(
            json.dumps(
                {
                    "error": "engine_unavailable",
                    "message": str(exc),
                    "fen": args.fen,
                },
                ensure_ascii=False,
                sort_keys=True,
            ),
            file=sys.stderr,
        )
        return 3

    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
