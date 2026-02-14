"""Auth use-cases: nonce generation and Algorand signature verification."""

from __future__ import annotations

import base64
import secrets

from algosdk import encoding
from nacl.signing import VerifyKey
from nacl.exceptions import BadSignatureError

from app.infra.db.models import upsert_nonce, get_nonce, delete_nonce, get_role
from app.auth import create_jwt


async def generate_nonce(address: str) -> str:
    """Create a random nonce, store it, and return it."""
    nonce = secrets.token_hex(16)
    await upsert_nonce(address, nonce)
    return nonce


def _verify_signature(address: str, message: bytes, signature_b64: str) -> bool:
    """Verify an Ed25519 signature produced by an Algorand wallet.

    The wallet signs the raw message bytes with the account's Ed25519 key.
    """
    try:
        sig_bytes = base64.b64decode(signature_b64)
        # Decode the Algorand address to get the 32-byte public key
        pk_bytes = encoding.decode_address(address)
        verify_key = VerifyKey(pk_bytes)
        verify_key.verify(message, sig_bytes)
        return True
    except (BadSignatureError, Exception):
        return False


async def verify_and_issue_jwt(address: str, nonce: str, signature: str) -> str | None:
    """Verify nonce + signature, issue JWT, and clear the nonce.

    Returns the JWT string on success, or None on failure.
    """
    stored = await get_nonce(address)
    if stored is None or stored != nonce:
        return None

    message = f"AlgoCampus auth nonce: {nonce}".encode()
    if not _verify_signature(address, message, signature):
        return None

    await delete_nonce(address)

    role = await get_role(address)
    return create_jwt(address, role)
