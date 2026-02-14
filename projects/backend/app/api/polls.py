"""Poll list endpoints – Indexer/BFF-cache backed (all roles can read)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.domain.models import PollListResponse, PollResponse
from app.usecases import polls_uc

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
