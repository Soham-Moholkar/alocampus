"""Activity feed API."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.domain.models import ActivityListResponse
from app.usecases import activity_uc

router = APIRouter()


@router.get("", response_model=ActivityListResponse)
async def get_activity(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    address: str | None = Query(default=None),
    pollId: int | None = Query(default=None),
    kind: str | None = Query(default=None),
    sessionId: int | None = Query(default=None),
    tag: str | None = Query(default=None),
) -> ActivityListResponse:
    return await activity_uc.list_feed(
        limit=limit,
        offset=offset,
        address=address,
        poll_id=pollId,
        kind=kind,
        session_id=sessionId,
        tag=tag,
    )
