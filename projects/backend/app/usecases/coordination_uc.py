"""Group coordination use-cases with on-chain anchoring."""

from __future__ import annotations

import base64
import hashlib
import json
import uuid

from app.domain.models import (
    CoordinationAnchorRequest,
    CoordinationTaskCreateRequest,
    CoordinationTaskListResponse,
    CoordinationTaskResponse,
    CoordinationVerifyResponse,
)
from app.infra.algorand.chain import anchor_note_on_chain
from app.infra.algorand.indexer import lookup_tx
from app.infra.db.models import (
    create_coordination_task,
    get_coordination_task,
    list_coordination_tasks,
    update_coordination_anchor,
    update_coordination_status,
)
from app.usecases import activity_uc


def _canonical_hash(payload: dict) -> str:
    packed = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(packed).hexdigest()


def _map_task(row: dict) -> CoordinationTaskResponse:
    return CoordinationTaskResponse(
        task_id=str(row["task_id"]),
        title=str(row["title"]),
        description=str(row.get("description") or ""),
        owner=str(row["owner"]),
        status=str(row["status"]),
        payload_hash=row.get("payload_hash"),
        anchor_tx_id=row.get("anchor_tx_id"),
        created=float(row.get("created") or 0),
        updated=float(row.get("updated") or 0),
    )


async def create(owner: str, body: CoordinationTaskCreateRequest) -> CoordinationTaskResponse:
    task_id = f"task-{uuid.uuid4().hex[:12]}"
    await create_coordination_task(
        task_id=task_id,
        title=body.title,
        description=body.description,
        owner=owner,
    )

    await activity_uc.log_event(
        kind="coordination_task_created",
        title="Coordination task created",
        description=body.title,
        actor=owner,
        tags=["coordination", f"coordination:{task_id}"],
    )

    row = await get_coordination_task(task_id)
    if not row:
        raise RuntimeError("task creation failed")
    return _map_task(row)


async def list_all(limit: int = 100, offset: int = 0) -> CoordinationTaskListResponse:
    rows = await list_coordination_tasks(limit=limit, offset=offset)
    items = [_map_task(row) for row in rows]
    return CoordinationTaskListResponse(tasks=items, count=len(items))


async def anchor(task_id: str, actor: str, body: CoordinationAnchorRequest) -> CoordinationVerifyResponse:
    row = await get_coordination_task(task_id)
    if not row:
        return CoordinationVerifyResponse(task_id=task_id, verified=False, message="task not found")

    payload_hash = _canonical_hash(body.payload)
    note = f"coord:{task_id}:{payload_hash}".encode()
    tx_id = anchor_note_on_chain(note)

    await update_coordination_anchor(task_id, payload_hash, tx_id)
    await update_coordination_status(task_id, "anchored")

    await activity_uc.log_event(
        kind="coordination_task_anchored",
        title="Coordination task anchored",
        description=row.get("title") or task_id,
        actor=actor,
        tx_id=tx_id,
        tags=["coordination", f"coordination:{task_id}", f"hash:{payload_hash}"],
    )

    return CoordinationVerifyResponse(
        task_id=task_id,
        verified=True,
        payload_hash=payload_hash,
        anchor_tx_id=tx_id,
        message="task anchored on-chain",
    )


async def verify(task_id: str) -> CoordinationVerifyResponse:
    row = await get_coordination_task(task_id)
    if not row:
        return CoordinationVerifyResponse(task_id=task_id, verified=False, message="task not found")

    payload_hash = row.get("payload_hash")
    tx_id = row.get("anchor_tx_id")
    if not payload_hash or not tx_id:
        return CoordinationVerifyResponse(
            task_id=task_id,
            verified=False,
            payload_hash=payload_hash,
            anchor_tx_id=tx_id,
            message="task not anchored",
        )

    tx = lookup_tx(str(tx_id))
    if not tx:
        return CoordinationVerifyResponse(
            task_id=task_id,
            verified=False,
            payload_hash=payload_hash,
            anchor_tx_id=str(tx_id),
            message="anchor tx not indexed yet",
        )

    note_raw = tx.get("note")
    decoded = ""
    if isinstance(note_raw, str):
        try:
            decoded = base64.b64decode(note_raw).decode()
        except Exception:
            decoded = ""

    expected = f"coord:{task_id}:{payload_hash}"
    return CoordinationVerifyResponse(
        task_id=task_id,
        verified=decoded == expected,
        payload_hash=str(payload_hash),
        anchor_tx_id=str(tx_id),
        message="verified" if decoded == expected else "note mismatch",
    )
