"""Activity feed use-cases."""

from __future__ import annotations

from app.domain.models import ActivityItem, ActivityListResponse
from app.infra.db.models import add_activity_event, list_activity_events


async def log_event(
    kind: str,
    title: str,
    description: str = "",
    actor: str | None = None,
    tx_id: str | None = None,
    tags: list[str] | None = None,
) -> str:
    return await add_activity_event(
        kind=kind,
        title=title,
        description=description,
        actor=actor,
        tx_id=tx_id,
        tags=tags or [],
    )


async def list_feed(
    limit: int = 100,
    offset: int = 0,
    address: str | None = None,
    poll_id: int | None = None,
    kind: str | None = None,
    session_id: int | None = None,
    tag: str | None = None,
) -> ActivityListResponse:
    rows = await list_activity_events(
        limit=limit,
        offset=offset,
        address=address,
        poll_id=poll_id,
        kind=kind,
        session_id=session_id,
        tag=tag,
    )
    items = [
        ActivityItem(
            id=str(row["id"]),
            kind=str(row["kind"]),
            title=str(row["title"]),
            description=str(row.get("description") or ""),
            actor=row.get("actor"),
            tx_id=row.get("tx_id"),
            created=float(row.get("created") or 0),
            tags=list(row.get("tags") or []),
        )
        for row in rows
    ]
    return ActivityListResponse(items=items, count=len(items))
