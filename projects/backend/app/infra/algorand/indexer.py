"""Indexer query helpers for analytics, tx confirmation, and list views."""

from __future__ import annotations

import base64
import hashlib
import logging
from typing import Any, Optional

from algosdk.v2client.indexer import IndexerClient

from app.infra.algorand.client import get_indexer, get_app_ids

logger = logging.getLogger(__name__)

# ABI method selectors (first 4 bytes of SHA-512/256 of method signature)
def _selector(sig: str) -> str:
    """Return the hex-encoded 4-byte ABI method selector for a method signature."""
    h = hashlib.new("sha512_256", sig.encode()).digest()[:4]
    return base64.b64encode(h).decode()


# Pre-compute selectors for analytics counting
_SEL_CREATE_POLL = _selector("create_poll(string,string[],uint64,uint64)uint64")
_SEL_CAST_VOTE = _selector("cast_vote(uint64,uint64)bool")
_SEL_CAST_VOTE_DEP = _selector("cast_vote_with_deposit(pay,uint64,uint64)bool")
_SEL_CREATE_SESSION = _selector("create_session(string,uint64,uint64,uint64)uint64")
_SEL_CHECK_IN = _selector("check_in(uint64)bool")
_SEL_REGISTER_CERT = _selector("register_cert(byte[],address,uint64,uint64)bool")
_SEL_MINT_REG = _selector("mint_and_register(byte[],address,string,uint64)uint64")


# ── Transaction status ───────────────────────────────────

def lookup_tx(tx_id: str) -> Optional[dict[str, Any]]:
    """Return the transaction record from Indexer, or None if not yet indexed."""
    idx = get_indexer()
    try:
        resp = idx.transaction(tx_id)
        return resp.get("transaction")
    except Exception:
        return None


# ── App-call transaction listing ─────────────────────────

def _search_app_txns(app_id: int, limit: int = 500) -> list[dict]:
    """Fetch application call transactions for a given app ID."""
    idx = get_indexer()
    try:
        resp = idx.search_transactions(application_id=app_id, limit=limit)
        return resp.get("transactions", [])
    except Exception:
        logger.debug("Indexer search failed for app %d", app_id, exc_info=True)
        return []


def _count_by_selector(txns: list[dict]) -> dict[str, int]:
    """Group app-call transactions by their ABI method selector (base64)."""
    counts: dict[str, int] = {}
    for tx in txns:
        app_call = tx.get("application-transaction", {})
        args = app_call.get("application-args", [])
        sel = args[0] if args else "bare"
        counts[sel] = counts.get(sel, 0) + 1
    return counts


# ── Analytics (selector-aware) ───────────────────────────

def get_analytics_summary() -> dict[str, int]:
    """Build an analytics summary from Indexer data using ABI selectors."""
    try:
        ids = get_app_ids()
    except FileNotFoundError:
        return {
            "total_polls": 0,
            "total_votes": 0,
            "total_sessions": 0,
            "total_checkins": 0,
            "total_certs": 0,
        }

    voting_id = ids.get("VotingContract", 0)
    attendance_id = ids.get("AttendanceContract", 0)
    cert_id = ids.get("CertificateRegistryContract", 0)

    # ── Voting ──────────
    v_counts: dict[str, int] = {}
    if voting_id:
        v_counts = _count_by_selector(_search_app_txns(voting_id))
    total_polls = v_counts.get(_SEL_CREATE_POLL, 0)
    total_votes = v_counts.get(_SEL_CAST_VOTE, 0) + v_counts.get(_SEL_CAST_VOTE_DEP, 0)

    # ── Attendance ──────
    a_counts: dict[str, int] = {}
    if attendance_id:
        a_counts = _count_by_selector(_search_app_txns(attendance_id))
    total_sessions = a_counts.get(_SEL_CREATE_SESSION, 0)
    total_checkins = a_counts.get(_SEL_CHECK_IN, 0)

    # ── Certificates ────
    c_counts: dict[str, int] = {}
    if cert_id:
        c_counts = _count_by_selector(_search_app_txns(cert_id))
    total_certs = c_counts.get(_SEL_REGISTER_CERT, 0) + c_counts.get(_SEL_MINT_REG, 0)

    return {
        "total_polls": total_polls,
        "total_votes": total_votes,
        "total_sessions": total_sessions,
        "total_checkins": total_checkins,
        "total_certs": total_certs,
    }
