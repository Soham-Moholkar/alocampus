"""Poll list endpoints – Indexer/BFF-cache backed (all roles can read)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import TokenPayload, require_faculty
from app.domain.models import PollContextResponse, PollContextUpdateRequest, PollListResponse, PollResponse
from app.usecases import announcements_uc, polls_uc

router = APIRouter()


@router.get("", response_model=PollListResponse)
async def list_polls(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> PollListResponse:
    return await polls_uc.list_all(limit=limit, offset=offset)


@router.get("/{poll_id}", response_model=PollResponse)
async def get_poll(poll_id: int) -> PollResponse:
    result = await polls_uc.get_by_id(poll_id)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "poll not found")
    return result


@router.get("/{poll_id}/context", response_model=PollContextResponse)
async def get_poll_context(poll_id: int) -> PollContextResponse:
    result = await announcements_uc.get_context(poll_id)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "poll context not found")
    return result


@router.put("/{poll_id}/context", response_model=PollContextResponse)
async def put_poll_context(
    poll_id: int,
    body: PollContextUpdateRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> PollContextResponse:
    return await announcements_uc.upsert_context(poll_id, body, actor_address=user.address)
