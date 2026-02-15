"""FastAPI application factory."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.rate_limit import RateLimitMiddleware
from app.infra.db.database import close_db, init_db
from app.api import router as api_router
from app.seed.demo_users import seed_demo_users


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup / shutdown hooks."""
    await init_db()
    await seed_demo_users()
    try:
        yield  # app runs here
    finally:
        await close_db()


def create_app() -> FastAPI:
    app = FastAPI(
        title="AlgoCampus BFF",
        version="0.1.0",
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RateLimitMiddleware)

    # ── Routes ───────────────────────────────────────────
    app.include_router(api_router)

    return app


app = create_app()
