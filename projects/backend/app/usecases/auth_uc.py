"""Auth use-cases: nonce generation and Algorand signature verification."""

from __future__ import annotations

import secrets

from algosdk import util

from app.auth import create_jwt
from app.infra.db.models import delete_nonce, get_nonce, get_role, upsert_nonce
from app.usecases import activity_uc


async def generate_nonce(address: str) -> str:
    """Create a random nonce, store it, and return it."""
    nonce = secrets.token_hex(16)
    await upsert_nonce(address, nonce)
    return nonce


def _verify_signature(address: str, message: bytes, signature_b64: str) -> bool:
    try:
        return bool(util.verify_bytes(message, signature_b64, address))
    except Exception:
        return False


async def verify_and_issue_jwt(address: str, nonce: str, signature: str) -> str | None:
    """Verify nonce + signature, issue JWT, and clear the nonce."""
    stored = await get_nonce(address)
    if stored is None or stored != nonce:
        await activity_uc.log_event(
            kind="auth_verify_failed",
            title="Auth verification failed",
            description="nonce mismatch",
            actor=address,
            tags=["auth", "failed"],
        )
        return None

    message = f"AlgoCampus auth nonce: {nonce}".encode()
    if not _verify_signature(address, message, signature):
        await activity_uc.log_event(
            kind="auth_verify_failed",
            title="Auth verification failed",
            description="signature mismatch",
            actor=address,
            tags=["auth", "failed"],
        )
        return None

    await delete_nonce(address)
    role = await get_role(address)
    token = create_jwt(address, role)

    await activity_uc.log_event(
        kind="auth_verified",
        title="Auth verified",
        description=f"role={role}",
        actor=address,
        tags=["auth", f"role:{role}"],
    )

    return token
