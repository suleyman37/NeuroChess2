from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


BACKEND_ROOT = Path(__file__).resolve().parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from neurochess.analysis_service import recover_pending_analyses
from neurochess.api.game_routes import router as game_router
from neurochess.data.database import init_db
from neurochess.live_analysis_service import get_default_live_analysis_service


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    init_db()
    recover_pending_analyses()
    try:
        yield
    finally:
        get_default_live_analysis_service().stop_all()


app = FastAPI(title="NeuroChess 2", version="v3", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):517[3-9]$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(game_router)


def main() -> None:
    init_db()
    print("NeuroChess 2 database initialized.")


if __name__ == "__main__":
    main()
