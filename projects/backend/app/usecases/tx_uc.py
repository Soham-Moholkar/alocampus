"""Transaction tracking use-case with background polling."""

from __future__ import annotations

import asyncio
import logging

from app.domain.models import TxStatus
from app.infra.algorand.indexer import lookup_tx as indexer_lookup
from app.infra.db.models import get_tx, upsert_tx
from app.usecases import attendance_records_uc
from app.usecases import activity_uc

logger = logging.getLogger(__name__)


async def track(
    tx_id: str,
    kind: str,
    session_id: int | None = None,
    course_code: str | None = None,
    student_address: str | None = None,
) -> TxStatus:
    """Record a tx and kick off background polling for confirmation."""
    await upsert_tx(
        tx_id,
        kind,
        session_id=session_id,
        course_code=course_code,
        student_address=student_address,
    )
    await activity_uc.log_event(
        kind="tx_tracked",
        title="Transaction tracking started",
        description=kind,
        tx_id=tx_id,
        tags=["tx", f"tx:{tx_id}", f"kind:{kind}"],
    )

    asyncio.create_task(_poll_tx(tx_id))
    return TxStatus(tx_id=tx_id, kind=kind, status="pending")


async def get_status(tx_id: str) -> TxStatus | None:
    row = await get_tx(tx_id)
    if row is None:
        return None
    return TxStatus(
        tx_id=row["tx_id"],
        kind=row["kind"],
        status=row["status"],
        confirmed_round=row.get("confirmed_round"),
    )


async def _poll_tx(tx_id: str, max_attempts: int = 30, interval: float = 2.0) -> None:
    for _ in range(max_attempts):
        await asyncio.sleep(interval)
        try:
            info = indexer_lookup(tx_id)
            if info and info.get("confirmed-round"):
                row = await get_tx(tx_id)
                kind = row["kind"] if row else "other"
                confirmed_round = int(info["confirmed-round"])
                await upsert_tx(
                    tx_id,
                    kind=kind,
                    status="confirmed",
                    confirmed_round=confirmed_round,
                )
                if (
                    kind == "checkin"
                    and row
                    and row.get("session_id") is not None
                    and row.get("course_code")
                    and row.get("student_address")
                ):
                    try:
                        await attendance_records_uc.record_checkin(
                            session_id=int(row["session_id"]),
                            course_code=str(row["course_code"]),
                            student_address=str(row["student_address"]),
                            tx_id=tx_id,
                        )
                    except Exception:
                        logger.exception("Failed to upsert attendance record from tx tracking")
                await activity_uc.log_event(
                    kind="tx_confirmed",
                    title="Transaction confirmed",
                    description=kind,
                    tx_id=tx_id,
                    tags=["tx", f"tx:{tx_id}", f"kind:{kind}"],
                )
                logger.info("tx %s confirmed at round %d", tx_id, confirmed_round)
                return
        except Exception:
            logger.debug("poll attempt failed for %s", tx_id, exc_info=True)

    row = await get_tx(tx_id)
    if row and row["status"] == "pending":
        await upsert_tx(tx_id, kind=row["kind"], status="failed")
        await activity_uc.log_event(
            kind="tx_failed",
            title="Transaction timed out",
            description=row["kind"],
            tx_id=tx_id,
            tags=["tx", f"tx:{tx_id}", "failed"],
        )
        logger.warning("tx %s timed out - marked failed", tx_id)
