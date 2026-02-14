"""Faculty-scoped write endpoints: create polls, sessions, and issue certs.

All endpoints require a JWT with role=faculty (or admin).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth import TokenPayload, require_faculty
from app.domain.models import (
    CreatePollRequest,
    CreateSessionRequest,
    IssueCertRequest,
    IssueCertResponse,
    PollResponse,
    SessionResponse,
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


@router.post("/cert/issue", response_model=IssueCertResponse)
async def issue_cert(
    body: IssueCertRequest,
    _fac: Annotated[TokenPayload, Depends(require_faculty)],
) -> IssueCertResponse:
    """Faculty issues a certificate: BFF mints ASA/NFT + registers on-chain."""
    return await certificate_uc.issue(body)
