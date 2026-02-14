"""System health use-cases."""

from __future__ import annotations

from app.domain.models import SystemHealthComponent, SystemHealthResponse
from app.infra.algorand.client import get_algod, get_indexer, get_kmd
from app.infra.db.database import active_backend, ping_db


def _component(ok: bool, detail: str) -> SystemHealthComponent:
    return SystemHealthComponent(status="ok" if ok else "error", detail=detail)


async def summary() -> SystemHealthResponse:
    db_ok = await ping_db()

    try:
        algod = get_algod()
        algod.status()
        algod_ok = True
        algod_detail = "reachable"
    except Exception as exc:  # pragma: no cover
        algod_ok = False
        algod_detail = f"unreachable: {exc}"

    try:
        indexer = get_indexer()
        indexer.health()
        indexer_ok = True
        indexer_detail = "reachable"
    except Exception as exc:  # pragma: no cover
        indexer_ok = False
        indexer_detail = f"unreachable: {exc}"

    try:
        kmd = get_kmd()
        kmd.versions()
        kmd_ok = True
        kmd_detail = "reachable"
    except Exception as exc:  # pragma: no cover
        kmd_ok = False
        kmd_detail = f"unreachable: {exc}"

    all_ok = db_ok and algod_ok and indexer_ok and kmd_ok

    return SystemHealthResponse(
        status="ok" if all_ok else "degraded",
        backend=active_backend(),
        bff=_component(True, "running"),
        db=_component(db_ok, "connected" if db_ok else "not connected"),
        algod=_component(algod_ok, algod_detail),
        indexer=_component(indexer_ok, indexer_detail),
        kmd=_component(kmd_ok, kmd_detail),
    )
