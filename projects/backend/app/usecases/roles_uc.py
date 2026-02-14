"""Role management use-case: update local DB + push to on-chain allowlist."""

from __future__ import annotations

import logging

from app.infra.db.models import upsert_role
from app.infra.algorand.chain import push_role_on_chain

logger = logging.getLogger(__name__)


async def set_role(address: str, role: str) -> str:
    """Store role locally and push to on-chain allowlists.

    Returns a human-readable status message.
    """
    await upsert_role(address, role)
    tx_id = push_role_on_chain(address, role)
    if tx_id:
        return f"Role '{role}' set for {address} — on-chain tx {tx_id}"
    return f"Role '{role}' set locally for {address} (on-chain push skipped or failed)"
