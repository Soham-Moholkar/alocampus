"""High-level helpers for BFF → on-chain ABI calls via ATC (LocalNet dev account).

All calls use the KMD dev account as sender (it is the contract admin post-deploy).
"""

from __future__ import annotations

import logging
from typing import Any

from algosdk.abi import Method
from algosdk.atomic_transaction_composer import (
    AccountTransactionSigner,
    AtomicTransactionComposer,
)

from app.infra.algorand.client import get_algod, get_app_ids, get_localnet_default_account

logger = logging.getLogger(__name__)

# ── Cached ABI method objects ────────────────────────────

_CREATE_POLL = Method.from_signature("create_poll(string,string[],uint64,uint64)uint64")
_CAST_VOTE = Method.from_signature("cast_vote(uint64,uint64)bool")
_CREATE_SESSION = Method.from_signature("create_session(string,uint64,uint64,uint64)uint64")
_CHECK_IN = Method.from_signature("check_in(uint64)bool")
_IS_PRESENT = Method.from_signature("is_present(uint64,address)bool")
_REGISTER_CERT = Method.from_signature("register_cert(byte[],address,uint64,uint64)bool")
_VERIFY_CERT = Method.from_signature("verify_cert(byte[])(address,uint64,uint64)")
_SET_ADMIN = Method.from_signature("set_admin(address,bool)void")
_SET_FACULTY = Method.from_signature("set_faculty(address,bool)void")

# ── Helpers ──────────────────────────────────────────────


def _atc_call(app_id: int, method: Method, args: list[Any], *, wait: int = 4) -> Any:
    """Execute a single ABI method call via ATC using the dev account.

    Returns the ABI return value of the first method result.
    """
    algod = get_algod()
    sender, sk = get_localnet_default_account()
    sp = algod.suggested_params()
    signer = AccountTransactionSigner(sk)

    atc = AtomicTransactionComposer()
    atc.add_method_call(
        app_id=app_id,
        method=method,
        sender=sender,
        sp=sp,
        signer=signer,
        method_args=args,
    )
    result = atc.execute(algod, wait_rounds=wait)
    return result.abi_results[0].return_value, result.tx_ids[0]


# ── Voting ───────────────────────────────────────────────


def create_poll_on_chain(
    question: str,
    options: list[str],
    start_round: int,
    end_round: int,
) -> tuple[int, str]:
    """Create a poll on VotingContract. Returns (poll_id, tx_id)."""
    ids = get_app_ids()
    app_id = ids["VotingContract"]
    ret, tx_id = _atc_call(app_id, _CREATE_POLL, [question, options, start_round, end_round])
    return int(ret), tx_id


# ── Attendance ───────────────────────────────────────────


def create_session_on_chain(
    course_code: str,
    session_ts: int,
    open_round: int,
    close_round: int,
) -> tuple[int, str]:
    """Create a session on AttendanceContract. Returns (session_id, tx_id)."""
    ids = get_app_ids()
    app_id = ids["AttendanceContract"]
    ret, tx_id = _atc_call(app_id, _CREATE_SESSION, [course_code, session_ts, open_round, close_round])
    return int(ret), tx_id


# ── Certificate verification (read-only) ────────────────


def verify_cert_on_chain(cert_hash_bytes: bytes) -> dict | None:
    """Call verify_cert on CertificateRegistryContract.

    Returns {"recipient": str, "asset_id": int, "issued_ts": int} or None.
    """
    ids = get_app_ids()
    app_id = ids.get("CertificateRegistryContract")
    if not app_id:
        return None
    try:
        ret, _ = _atc_call(app_id, _VERIFY_CERT, [cert_hash_bytes])
        # ret is a tuple (address_str, asset_id_int, issued_ts_int)
        return {
            "recipient": ret[0],
            "asset_id": int(ret[1]),
            "issued_ts": int(ret[2]),
        }
    except Exception:
        logger.debug("verify_cert failed", exc_info=True)
        return None


# ── Role management (push to all contracts) ──────────────


def push_role_on_chain(address: str, role: str) -> str | None:
    """Push admin/faculty role to all deployed contracts. Returns last tx_id."""
    try:
        ids = get_app_ids()
    except FileNotFoundError:
        logger.warning("App manifest not found — skipping on-chain role push")
        return None

    method = _SET_ADMIN if role == "admin" else _SET_FACULTY if role == "faculty" else None
    if method is None:
        return None  # students don't need on-chain registration

    last_tx: str | None = None
    for name, app_id in ids.items():
        try:
            _, tx_id = _atc_call(app_id, method, [address, True])
            last_tx = tx_id
            logger.info("Pushed role=%s for %s to %s (app %d) tx=%s", role, address, name, app_id, tx_id)
        except Exception:
            logger.exception("Failed to push role to %s (app %d)", name, app_id)

    return last_tx
