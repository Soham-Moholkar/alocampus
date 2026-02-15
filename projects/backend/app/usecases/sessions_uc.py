"""Attendance sessions use-case: faculty creates on-chain, anyone lists from BFF cache."""

from __future__ import annotations

import logging
import time

from app.domain.models import (
    CreateSessionRequest,
    SessionCloseResponse,
    SessionListResponse,
    SessionResponse,
    SessionUpdateRequest,
)
from app.infra.algorand.chain import anchor_note_on_chain, create_session_on_chain, current_round
from app.infra.algorand.client import get_app_ids
from app.infra.db.models import get_session, insert_session, list_sessions, update_session
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


async def update_by_id(session_id: int, req: SessionUpdateRequest, actor: str) -> SessionResponse | None:
    current = await get_session(session_id)
    if current is None:
        return None

    next_course = req.course_code if req.course_code is not None else str(current["course_code"])
    next_ts = req.session_ts if req.session_ts is not None else int(current["session_ts"])
    next_open = req.open_round if req.open_round is not None else int(current["open_round"])
    next_close = req.close_round if req.close_round is not None else int(current["close_round"])

    if next_close <= next_open:
        raise ValueError("close_round must be greater than open_round")

    await update_session(
        session_id=session_id,
        course_code=next_course,
        session_ts=next_ts,
        open_round=next_open,
        close_round=next_close,
    )

    anchor_tx_id: str | None = None
    try:
        note = f"session-edit:{session_id}:{actor}:{int(time.time())}".encode()
        anchor_tx_id = anchor_note_on_chain(note)
    except Exception:
        logger.exception("Session update anchor failed")

    await activity_uc.log_event(
        kind="session_updated",
        title=f"Session #{session_id} updated",
        description=next_course,
        actor=actor,
        tx_id=anchor_tx_id,
        tags=["session:update", f"session:{session_id}"],
    )
    return await get_by_id(session_id)


async def close_by_id(session_id: int, actor: str) -> SessionCloseResponse | None:
    current = await get_session(session_id)
    if current is None:
        return None

    round_now = current_round()
    existing_close = int(current["close_round"])
    next_close = round_now if round_now < existing_close else existing_close

    await update_session(session_id=session_id, close_round=next_close)

    anchor_tx_id: str | None = None
    try:
        note = f"session-close:{session_id}:{next_close}:{actor}".encode()
        anchor_tx_id = anchor_note_on_chain(note)
    except Exception:
        logger.exception("Session close anchor failed")

    await activity_uc.log_event(
        kind="session_closed",
        title=f"Session #{session_id} closed",
        description=f"close_round={next_close}",
        actor=actor,
        tx_id=anchor_tx_id,
        tags=["session:close", f"session:{session_id}"],
    )

    return SessionCloseResponse(
        session_id=session_id,
        close_round=next_close,
        anchor_tx_id=anchor_tx_id,
        message="session closed",
    )
