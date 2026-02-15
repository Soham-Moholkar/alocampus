"""Faculty-scoped write endpoints: create polls, sessions, and issue certs.

All endpoints require a JWT with role=faculty (or admin).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import TokenPayload, require_faculty
from app.domain.models import (
    CreatePollRequest,
    CreateSessionRequest,
    IssueCertRequest,
    IssueCertResponse,
    PollResponse,
    SessionCloseResponse,
    SessionResponse,
    SessionUpdateRequest,
)
from app.usecases import certificate_uc, polls_uc, sessions_uc

router = APIRouter()


@router.post("/polls", response_model=PollResponse)
async def create_poll(
    body: CreatePollRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> PollResponse:
    """Faculty creates a poll on-chain + BFF cache."""
    return await polls_uc.create(body, creator=user.address)


@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    body: CreateSessionRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> SessionResponse:
    """Faculty creates an attendance session on-chain + BFF cache."""
    return await sessions_uc.create(body, creator=user.address)


@router.patch("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: int,
    body: SessionUpdateRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> SessionResponse:
    """Faculty/admin updates local session metadata (additive, audit anchored)."""
    try:
        updated = await sessions_uc.update_by_id(session_id=session_id, req=body, actor=user.address)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session not found")
    return updated


@router.post("/sessions/{session_id}/close", response_model=SessionCloseResponse)
async def close_session(
    session_id: int,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> SessionCloseResponse:
    """Faculty/admin closes an attendance window early in BFF coordination layer."""
    result = await sessions_uc.close_by_id(session_id=session_id, actor=user.address)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "session not found")
    return result


@router.post("/cert/issue", response_model=IssueCertResponse)
async def issue_cert(
    body: IssueCertRequest,
    _fac: Annotated[TokenPayload, Depends(require_faculty)],
) -> IssueCertResponse:
    """Faculty issues a certificate: BFF mints ASA/NFT + registers on-chain."""
    return await certificate_uc.issue(body)
