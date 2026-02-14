"""Transaction tracking use-case with background polling."""

from __future__ import annotations

import asyncio
import logging

from app.infra.db.models import upsert_tx, get_tx, list_pending_txs
from app.infra.algorand.indexer import lookup_tx as indexer_lookup
from app.domain.models import TxStatus

logger = logging.getLogger(__name__)


async def track(tx_id: str, kind: str) -> TxStatus:
    """Record a tx and kick off a background task to poll for confirmation."""
    await upsert_tx(tx_id, kind)

    # Fire-and-forget polling
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
    """Poll algod/indexer until the transaction is confirmed or we give up."""
    for _ in range(max_attempts):
        await asyncio.sleep(interval)
        try:
            info = indexer_lookup(tx_id)
            if info and info.get("confirmed-round"):
                await upsert_tx(
                    tx_id,
                    kind="",  # kind already stored — upsert keeps it
                    status="confirmed",
                    confirmed_round=info["confirmed-round"],
                )
                logger.info("tx %s confirmed at round %d", tx_id, info["confirmed-round"])
                return
        except Exception:
            logger.debug("poll attempt failed for %s", tx_id, exc_info=True)

    # Give up
    row = await get_tx(tx_id)
    if row and row["status"] == "pending":
        await upsert_tx(tx_id, kind=row["kind"], status="failed")
        logger.warning("tx %s timed out – marked failed", tx_id)
