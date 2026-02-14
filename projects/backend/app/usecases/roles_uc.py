"""Role management use-case: update local DB + push to on-chain allowlist."""

from __future__ import annotations

import logging

from app.infra.algorand.chain import push_role_on_chain
from app.infra.db.models import upsert_role
from app.usecases import activity_uc

logger = logging.getLogger(__name__)


async def set_role(address: str, role: str) -> str:
    """Store role locally and push to on-chain allowlists."""
    await upsert_role(address, role)
    tx_id = push_role_on_chain(address, role)

    await activity_uc.log_event(
        kind="role_change",
        title="Role updated",
        description=f"{address} -> {role}",
        actor=address,
        tx_id=tx_id,
        tags=["role", f"role:{role}"],
    )

    if tx_id:
        return f"Role '{role}' set for {address} - on-chain tx {tx_id}"
    return f"Role '{role}' set locally for {address} (on-chain push skipped or failed)"
