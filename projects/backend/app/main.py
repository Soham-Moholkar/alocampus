"""FastAPI application factory."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.rate_limit import RateLimitMiddleware
from app.infra.db.database import init_db, close_db
from app.api import router as api_router

logger = logging.getLogger(__name__)

# Allowed frontend origins
_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup / shutdown hooks."""
    settings = get_settings()
    await init_db(settings.db_full_path)
    logger.info("AlgoCampus BFF started")
    yield  # app runs here
    await close_db()
    logger.info("AlgoCampus BFF shut down gracefully")


def create_app() -> FastAPI:
    app = FastAPI(
        title="AlgoCampus BFF",
        version="0.2.0",
        description="Blockchain-powered campus platform — voting, attendance, certificates",
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RateLimitMiddleware)

    # ── Routes ───────────────────────────────────────────
    app.include_router(api_router)

    return app


app = create_app()
