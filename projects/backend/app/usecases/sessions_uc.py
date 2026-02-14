"""Attendance sessions use-case: faculty creates on-chain, anyone lists from BFF cache."""

from __future__ import annotations

import logging

from app.domain.models import CreateSessionRequest, SessionResponse, SessionListResponse
from app.infra.algorand.chain import create_session_on_chain
from app.infra.algorand.client import get_app_ids
from app.infra.db.models import insert_session, list_sessions, get_session
from app.usecases import activity_uc

logger = logging.getLogger(__name__)


async def create(req: CreateSessionRequest, creator: str) -> SessionResponse:
    """Create a session on-chain and cache in SQLite."""
    session_id, tx_id = create_session_on_chain(
        course_code=req.course_code,
        session_ts=req.session_ts,
        open_round=req.open_round,
        close_round=req.close_round,
    )
    app_id = get_app_ids()["AttendanceContract"]

    await insert_session(
        session_id=session_id,
        course_code=req.course_code,
        session_ts=req.session_ts,
        open_round=req.open_round,
        close_round=req.close_round,
        creator=creator,
        app_id=app_id,
        tx_id=tx_id,
    )

    await activity_uc.log_event(
        kind="session_created",
        title=f"Session #{session_id} created",
        description=req.course_code,
        actor=creator,
        tx_id=tx_id,
        tags=[f"session:{session_id}"],
    )

    return SessionResponse(
        session_id=session_id,
        course_code=req.course_code,
        session_ts=req.session_ts,
        open_round=req.open_round,
        close_round=req.close_round,
        creator=creator,
        app_id=app_id,
        tx_id=tx_id,
    )


async def list_all(limit: int = 100, offset: int = 0) -> SessionListResponse:
    """List sessions from SQLite cache."""
    rows = await list_sessions(limit=limit, offset=offset)
    sessions = [
        SessionResponse(
            session_id=r["session_id"],
            course_code=r["course_code"],
            session_ts=r["session_ts"],
            open_round=r["open_round"],
            close_round=r["close_round"],
            creator=r["creator"],
            app_id=r["app_id"],
            tx_id=r.get("tx_id"),
            created=r.get("created"),
        )
        for r in rows
    ]
    return SessionListResponse(sessions=sessions, count=len(sessions))


async def get_by_id(session_id: int) -> SessionResponse | None:
    """Retrieve a single session from BFF cache."""
    r = await get_session(session_id)
    if r is None:
        return None
    return SessionResponse(
        session_id=r["session_id"],
        course_code=r["course_code"],
        session_ts=r["session_ts"],
        open_round=r["open_round"],
        close_round=r["close_round"],
        creator=r["creator"],
        app_id=r["app_id"],
        tx_id=r.get("tx_id"),
        created=r.get("created"),
    )
