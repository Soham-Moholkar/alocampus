"""Announcements and poll context use-cases with on-chain hash anchoring."""

from __future__ import annotations

import hashlib
import json
import time
import uuid

from fastapi import HTTPException, status

from app.domain.models import (
    AnnouncementCreateRequest,
    AnnouncementListResponse,
    AnnouncementResponse,
    AnnouncementUpdateRequest,
    PollContextResponse,
    PollContextUpdateRequest,
)
from app.infra.algorand.chain import anchor_note_on_chain
from app.infra.db.models import (
    create_announcement,
    get_announcement,
    get_poll_context,
    list_announcements,
    soft_delete_announcement,
    update_announcement,
    upsert_poll_context,
)
from app.usecases import activity_uc


def _hash_payload(payload: dict) -> str:
    packed = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(packed).hexdigest()


def _map_announcement(row: dict) -> AnnouncementResponse:
    return AnnouncementResponse(
        id=str(row["id"]),
        title=str(row["title"]),
        body=str(row["body"]),
        poll_id=row.get("poll_id"),
        category=str(row["category"]),
        audience=str(row["audience"]),
        author_address=str(row["author_address"]),
        author_role=str(row["author_role"]),
        is_pinned=bool(row.get("is_pinned")),
        hash=str(row.get("hash") or ""),
        anchor_tx_id=row.get("anchor_tx_id"),
        created=float(row.get("created") or 0),
        updated=float(row.get("updated") or 0),
    )


def _ensure_manage_permission(row: dict, actor_address: str, actor_role: str) -> None:
    if actor_role == "admin":
        return
    if str(row.get("author_address")) != actor_address:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "only owner or admin can modify this announcement")


async def list_feed(
    audience: str | None = None,
    poll_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
    include_deleted: bool = False,
) -> AnnouncementListResponse:
    rows = await list_announcements(
        audience=audience,
        poll_id=poll_id,
        limit=limit,
        offset=offset,
        include_deleted=include_deleted,
    )
    items = [_map_announcement(row) for row in rows]
    return AnnouncementListResponse(items=items, count=len(items))


async def create(
    body: AnnouncementCreateRequest,
    actor_address: str,
    actor_role: str,
) -> AnnouncementResponse:
    announcement_id = f"ann-{uuid.uuid4().hex[:12]}"
    canonical = {
        "id": announcement_id,
        "title": body.title,
        "body": body.body,
        "poll_id": body.poll_id,
        "category": body.category,
        "audience": body.audience,
        "author_address": actor_address,
        "author_role": actor_role,
        "is_pinned": body.is_pinned,
        "created": int(time.time()),
    }
    digest = _hash_payload(canonical)
    anchor_tx_id = anchor_note_on_chain(f"announce:{announcement_id}:{digest}:create".encode())

    await create_announcement(
        announcement_id=announcement_id,
        title=body.title,
        body=body.body,
        poll_id=body.poll_id,
        category=body.category,
        audience=body.audience,
        author_address=actor_address,
        author_role=actor_role,
        is_pinned=body.is_pinned,
        hash_value=digest,
        anchor_tx_id=anchor_tx_id,
    )

    await activity_uc.log_event(
        kind="announcement_created",
        title=body.title,
        description=body.category,
        actor=actor_address,
        tx_id=anchor_tx_id,
        tags=["announcement", f"announcement:{announcement_id}", f"audience:{body.audience}"],
    )

    row = await get_announcement(announcement_id)
    if not row:
        raise RuntimeError("announcement creation failed")
    return _map_announcement(row)


async def update(
    announcement_id: str,
    body: AnnouncementUpdateRequest,
    actor_address: str,
    actor_role: str,
) -> AnnouncementResponse:
    row = await get_announcement(announcement_id)
    if not row or bool(row.get("is_deleted")):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "announcement not found")
    _ensure_manage_permission(row, actor_address, actor_role)

    next_payload = {
        "id": announcement_id,
        "title": body.title if body.title is not None else row.get("title"),
        "body": body.body if body.body is not None else row.get("body"),
        "poll_id": row.get("poll_id"),
        "category": body.category if body.category is not None else row.get("category"),
        "audience": body.audience if body.audience is not None else row.get("audience"),
        "author_address": row.get("author_address"),
        "author_role": row.get("author_role"),
        "is_pinned": body.is_pinned if body.is_pinned is not None else bool(row.get("is_pinned")),
        "updated": int(time.time()),
    }
    digest = _hash_payload(next_payload)
    anchor_tx_id = anchor_note_on_chain(f"announce:{announcement_id}:{digest}:update".encode())

    await update_announcement(
        announcement_id=announcement_id,
        title=body.title,
        body=body.body,
        category=body.category,
        audience=body.audience,
        is_pinned=body.is_pinned,
        hash_value=digest,
        anchor_tx_id=anchor_tx_id,
    )

    await activity_uc.log_event(
        kind="announcement_updated",
        title=str(next_payload["title"]),
        description=str(next_payload["category"]),
        actor=actor_address,
        tx_id=anchor_tx_id,
        tags=["announcement", f"announcement:{announcement_id}"],
    )

    updated = await get_announcement(announcement_id)
    if not updated:
        raise RuntimeError("announcement update failed")
    return _map_announcement(updated)


async def delete(announcement_id: str, actor_address: str, actor_role: str) -> None:
    row = await get_announcement(announcement_id)
    if not row or bool(row.get("is_deleted")):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "announcement not found")
    _ensure_manage_permission(row, actor_address, actor_role)

    digest = _hash_payload({"id": announcement_id, "op": "delete", "ts": int(time.time())})
    anchor_tx_id = anchor_note_on_chain(f"announce:{announcement_id}:{digest}:delete".encode())
    await soft_delete_announcement(announcement_id)

    await activity_uc.log_event(
        kind="announcement_deleted",
        title=str(row.get("title") or announcement_id),
        description="soft_deleted",
        actor=actor_address,
        tx_id=anchor_tx_id,
        tags=["announcement", f"announcement:{announcement_id}", "deleted"],
    )


async def get_context(poll_id: int) -> PollContextResponse | None:
    row = await get_poll_context(poll_id)
    if not row:
        return None
    return PollContextResponse(
        poll_id=int(row["poll_id"]),
        purpose=str(row["purpose"]),
        audience=str(row["audience"]),
        category=str(row["category"]),
        extra_note=str(row.get("extra_note") or ""),
        updated_by=str(row["updated_by"]),
        hash=str(row["hash"]),
        anchor_tx_id=row.get("anchor_tx_id"),
        updated=float(row.get("updated") or 0),
    )


async def upsert_context(
    poll_id: int,
    body: PollContextUpdateRequest,
    actor_address: str,
) -> PollContextResponse:
    canonical = {
        "poll_id": poll_id,
        "purpose": body.purpose,
        "audience": body.audience,
        "category": body.category,
        "extra_note": body.extra_note,
        "updated_by": actor_address,
        "updated": int(time.time()),
    }
    digest = _hash_payload(canonical)
    anchor_tx_id = anchor_note_on_chain(f"pollctx:{poll_id}:{digest}".encode())

    await upsert_poll_context(
        poll_id=poll_id,
        purpose=body.purpose,
        audience=body.audience,
        category=body.category,
        extra_note=body.extra_note,
        updated_by=actor_address,
        hash_value=digest,
        anchor_tx_id=anchor_tx_id,
    )

    await activity_uc.log_event(
        kind="poll_context_updated",
        title=f"Poll context updated #{poll_id}",
        description=body.category,
        actor=actor_address,
        tx_id=anchor_tx_id,
        tags=["poll_context", f"poll:{poll_id}"],
    )

    result = await get_context(poll_id)
    if not result:
        raise RuntimeError("poll context upsert failed")
    return result
