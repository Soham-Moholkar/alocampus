"""GET /health – liveness + detailed health checks."""

from __future__ import annotations

import logging

from fastapi import APIRouter

from app.infra.algorand.client import get_algod, get_indexer, get_app_ids
from app.infra.db.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "algocampus-bff"}


@router.get("/health/detailed")
async def health_detailed() -> dict:
    """Deep health check — probes algod, indexer, DB, and contract deployment."""
    checks: dict[str, dict] = {}

    # ── SQLite ────────────────────────────────────────────
    try:
        db = await get_db()
        await db.execute("SELECT 1")
        checks["database"] = {"status": "healthy"}
    except Exception as exc:
        checks["database"] = {"status": "unhealthy", "error": str(exc)}

    # ── algod ─────────────────────────────────────────────
    try:
        algod = get_algod()
        status = algod.status()
        checks["algod"] = {
            "status": "healthy",
            "last_round": status.get("last-round", 0),
        }
    except Exception as exc:
        checks["algod"] = {"status": "unhealthy", "error": str(exc)}

    # ── indexer ───────────────────────────────────────────
    try:
        indexer = get_indexer()
        ih = indexer.health()
        checks["indexer"] = {"status": "healthy", "round": ih.get("round", 0)}
    except Exception as exc:
        checks["indexer"] = {"status": "unhealthy", "error": str(exc)}

    # ── contracts ─────────────────────────────────────────
    try:
        ids = get_app_ids()
        checks["contracts"] = {"status": "healthy", "app_ids": ids}
    except FileNotFoundError:
        checks["contracts"] = {"status": "not_deployed", "error": "app_manifest.json not found"}
    except Exception as exc:
        checks["contracts"] = {"status": "unhealthy", "error": str(exc)}

    overall = "healthy" if all(c["status"] == "healthy" for c in checks.values()) else "degraded"
    return {"status": overall, "checks": checks}
