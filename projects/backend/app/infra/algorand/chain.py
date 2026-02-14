"""High-level helpers for BFF -> on-chain ABI calls via ATC (LocalNet dev account)."""

from __future__ import annotations

import logging
from typing import Any

from algosdk import transaction
from algosdk.abi import Method
from algosdk.atomic_transaction_composer import AccountTransactionSigner, AtomicTransactionComposer

from app.infra.algorand.client import get_algod, get_app_ids, get_localnet_default_account

logger = logging.getLogger(__name__)

_CREATE_POLL = Method.from_signature("create_poll(string,string[],uint64,uint64)uint64")
_CREATE_POLL_AI = Method.from_signature("create_poll_ai(string,string[],uint64,uint64,byte[])uint64")
_CREATE_SESSION = Method.from_signature("create_session(string,uint64,uint64,uint64)uint64")
_CREATE_SESSION_AI = Method.from_signature("create_session_ai(string,uint64,uint64,uint64,byte[])uint64")
_CHECK_IN = Method.from_signature("check_in(uint64)bool")
_IS_PRESENT = Method.from_signature("is_present(uint64,address)bool")
_REGISTER_CERT = Method.from_signature("register_cert(byte[],address,uint64,uint64)bool")
_REGISTER_CERT_AI = Method.from_signature("register_cert_ai(byte[],address,uint64,uint64,byte[])bool")
_MINT_REGISTER_AI = Method.from_signature("mint_and_register_ai(byte[],address,string,uint64,byte[])uint64")
_VERIFY_CERT = Method.from_signature("verify_cert(byte[])(address,uint64,uint64)")
_SET_ADMIN = Method.from_signature("set_admin(address,bool)void")
_SET_FACULTY = Method.from_signature("set_faculty(address,bool)void")
_RECORD_AI_INTENT = Method.from_signature("record_ai_intent(byte[],uint64)bool")


def _atc_call(app_id: int, method: Method, args: list[Any], *, wait: int = 4) -> Any:
    """Execute a single ABI method call via ATC using the dev account."""
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


def _app_id(name: str) -> int:
    ids = get_app_ids()
    value = ids.get(name)
    if not value:
        raise RuntimeError(f"App id missing for {name}")
    return int(value)


def current_round() -> int:
    algod = get_algod()
    status = algod.status()
    return int(status.get("last-round", 0))


def record_ai_intent_on_chain(contract_name: str, intent_hash: bytes, expires_round: int) -> str:
    app_id = _app_id(contract_name)
    _, tx_id = _atc_call(app_id, _RECORD_AI_INTENT, [intent_hash, expires_round])
    return tx_id


# Voting

def create_poll_on_chain(question: str, options: list[str], start_round: int, end_round: int) -> tuple[int, str]:
    app_id = _app_id("VotingContract")
    ret, tx_id = _atc_call(app_id, _CREATE_POLL, [question, options, start_round, end_round])
    return int(ret), tx_id


def create_poll_ai_on_chain(
    question: str,
    options: list[str],
    start_round: int,
    end_round: int,
    intent_hash: bytes,
    expires_round: int,
) -> tuple[int, str]:
    app_id = _app_id("VotingContract")
    record_ai_intent_on_chain("VotingContract", intent_hash, expires_round)
    ret, tx_id = _atc_call(app_id, _CREATE_POLL_AI, [question, options, start_round, end_round, intent_hash])
    return int(ret), tx_id


# Attendance

def create_session_on_chain(course_code: str, session_ts: int, open_round: int, close_round: int) -> tuple[int, str]:
    app_id = _app_id("AttendanceContract")
    ret, tx_id = _atc_call(app_id, _CREATE_SESSION, [course_code, session_ts, open_round, close_round])
    return int(ret), tx_id


def create_session_ai_on_chain(
    course_code: str,
    session_ts: int,
    open_round: int,
    close_round: int,
    intent_hash: bytes,
    expires_round: int,
) -> tuple[int, str]:
    app_id = _app_id("AttendanceContract")
    record_ai_intent_on_chain("AttendanceContract", intent_hash, expires_round)
    ret, tx_id = _atc_call(app_id, _CREATE_SESSION_AI, [course_code, session_ts, open_round, close_round, intent_hash])
    return int(ret), tx_id


# Certificates

def register_cert_ai_on_chain(
    cert_hash_bytes: bytes,
    recipient: str,
    asset_id: int,
    issued_ts: int,
    intent_hash: bytes,
    expires_round: int,
) -> str:
    app_id = _app_id("CertificateRegistryContract")
    record_ai_intent_on_chain("CertificateRegistryContract", intent_hash, expires_round)
    _, tx_id = _atc_call(
        app_id,
        _REGISTER_CERT_AI,
        [cert_hash_bytes, recipient, asset_id, issued_ts, intent_hash],
    )
    return tx_id


def mint_and_register_ai_on_chain(
    cert_hash_bytes: bytes,
    recipient: str,
    metadata_url: str,
    issued_ts: int,
    intent_hash: bytes,
    expires_round: int,
) -> tuple[int, str]:
    app_id = _app_id("CertificateRegistryContract")
    record_ai_intent_on_chain("CertificateRegistryContract", intent_hash, expires_round)
    ret, tx_id = _atc_call(
        app_id,
        _MINT_REGISTER_AI,
        [cert_hash_bytes, recipient, metadata_url, issued_ts, intent_hash],
    )
    return int(ret), tx_id


def verify_cert_on_chain(cert_hash_bytes: bytes) -> dict | None:
    app_id = get_app_ids().get("CertificateRegistryContract")
    if not app_id:
        return None
    try:
        ret, _ = _atc_call(int(app_id), _VERIFY_CERT, [cert_hash_bytes])
        return {
            "recipient": ret[0],
            "asset_id": int(ret[1]),
            "issued_ts": int(ret[2]),
        }
    except Exception:
        logger.debug("verify_cert failed", exc_info=True)
        return None


# Role management

def push_role_on_chain(address: str, role: str) -> str | None:
    try:
        ids = get_app_ids()
    except FileNotFoundError:
        logger.warning("App manifest not found; skipping on-chain role push")
        return None

    method = _SET_ADMIN if role == "admin" else _SET_FACULTY if role == "faculty" else None
    if method is None:
        return None

    last_tx: str | None = None
    for name, app_id in ids.items():
        try:
            _, tx_id = _atc_call(int(app_id), method, [address, True])
            last_tx = tx_id
            logger.info("Pushed role=%s for %s to %s (app %d) tx=%s", role, address, name, app_id, tx_id)
        except Exception:
            logger.exception("Failed to push role to %s (app %d)", name, app_id)
    return last_tx


# General-purpose on-chain anchor for audit trails (feedback / coordination)
def anchor_note_on_chain(note: bytes) -> str:
    algod = get_algod()
    sender, sk = get_localnet_default_account()
    sp = algod.suggested_params()
    txn = transaction.PaymentTxn(sender=sender, sp=sp, receiver=sender, amt=0, note=note)
    signed = txn.sign(sk)
    tx_id = algod.send_transaction(signed)
    transaction.wait_for_confirmation(algod, tx_id, 4)
    return tx_id
