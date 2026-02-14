"""Announcement management routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.auth import TokenPayload, require_faculty
from app.domain.models import (
    AnnouncementCreateRequest,
    AnnouncementListResponse,
    AnnouncementResponse,
    AnnouncementUpdateRequest,
)
from app.usecases import announcements_uc

router = APIRouter()


@router.get("", response_model=AnnouncementListResponse)
async def list_items(
    audience: str | None = Query(default=None),
    pollId: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> AnnouncementListResponse:
    return await announcements_uc.list_feed(
        audience=audience,
        poll_id=pollId,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=AnnouncementResponse)
async def create_item(
    body: AnnouncementCreateRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> AnnouncementResponse:
    return await announcements_uc.create(body, actor_address=user.address, actor_role=user.role)


@router.put("/{announcement_id}", response_model=AnnouncementResponse)
async def update_item(
    announcement_id: str,
    body: AnnouncementUpdateRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> AnnouncementResponse:
    return await announcements_uc.update(
        announcement_id=announcement_id,
        body=body,
        actor_address=user.address,
        actor_role=user.role,
    )


@router.delete("/{announcement_id}")
async def delete_item(
    announcement_id: str,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> dict[str, bool]:
    await announcements_uc.delete(
        announcement_id=announcement_id,
        actor_address=user.address,
        actor_role=user.role,
    )
    return {"ok": True}
