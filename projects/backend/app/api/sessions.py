"""Attendance session list endpoints – BFF-cache backed (all roles can read)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.domain.models import SessionListResponse, SessionResponse
from app.usecases import sessions_uc

router = APIRouter()


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> SessionListResponse:
    return await sessions_uc.list_all(limit=limit, offset=offset)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: int) -> SessionResponse:
    result = await sessions_uc.get_by_id(session_id)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session not found")
    return result
