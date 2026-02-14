"""Thin query helpers over the SQLite tables.

All write helpers commit immediately.  For reads the row-factory is aiosqlite.Row.
"""

from __future__ import annotations

import time
from typing import Optional

import aiosqlite

from app.infra.db.database import get_db


# ── Nonces ───────────────────────────────────────────────

async def upsert_nonce(address: str, nonce: str) -> None:
    db = await get_db()
    await db.execute(
        "INSERT INTO nonces (address, nonce, created) VALUES (?, ?, ?) "
        "ON CONFLICT(address) DO UPDATE SET nonce=excluded.nonce, created=excluded.created",
        (address, nonce, time.time()),
    )
    await db.commit()


async def get_nonce(address: str) -> Optional[str]:
    db = await get_db()
    cur = await db.execute("SELECT nonce FROM nonces WHERE address = ?", (address,))
    row = await cur.fetchone()
    return row["nonce"] if row else None


async def delete_nonce(address: str) -> None:
    db = await get_db()
    await db.execute("DELETE FROM nonces WHERE address = ?", (address,))
    await db.commit()


# ── Roles ────────────────────────────────────────────────

async def upsert_role(address: str, role: str) -> None:
    db = await get_db()
    await db.execute(
        "INSERT INTO roles (address, role) VALUES (?, ?) "
        "ON CONFLICT(address) DO UPDATE SET role=excluded.role",
        (address, role),
    )
    await db.commit()


async def get_role(address: str) -> str:
    db = await get_db()
    cur = await db.execute("SELECT role FROM roles WHERE address = ?", (address,))
    row = await cur.fetchone()
    return row["role"] if row else "student"


# ── TX tracking ──────────────────────────────────────────

async def upsert_tx(tx_id: str, kind: str, status: str = "pending", confirmed_round: Optional[int] = None) -> None:
    db = await get_db()
    await db.execute(
        "INSERT INTO tx_tracking (tx_id, kind, status, confirmed_round) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(tx_id) DO UPDATE SET status=excluded.status, confirmed_round=excluded.confirmed_round",
        (tx_id, kind, status, confirmed_round),
    )
    await db.commit()


async def get_tx(tx_id: str) -> Optional[dict]:
    db = await get_db()
    cur = await db.execute("SELECT * FROM tx_tracking WHERE tx_id = ?", (tx_id,))
    row = await cur.fetchone()
    return dict(row) if row else None


async def list_pending_txs() -> list[dict]:
    db = await get_db()
    cur = await db.execute("SELECT * FROM tx_tracking WHERE status = 'pending'")
    return [dict(r) for r in await cur.fetchall()]


# ── Certificate metadata ─────────────────────────────────

async def store_cert_metadata(cert_hash: str, recipient: str, asset_id: int, metadata_json: str) -> None:
    db = await get_db()
    await db.execute(
        "INSERT INTO cert_metadata (cert_hash, recipient, asset_id, metadata, created) VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(cert_hash) DO UPDATE SET metadata=excluded.metadata",
        (cert_hash, recipient, asset_id, metadata_json, time.time()),
    )
    await db.commit()


async def get_cert_metadata(cert_hash: str) -> Optional[str]:
    db = await get_db()
    cur = await db.execute("SELECT metadata FROM cert_metadata WHERE cert_hash = ?", (cert_hash,))
    row = await cur.fetchone()
    return row["metadata"] if row else None


async def list_certs(limit: int = 100, offset: int = 0) -> list[dict]:
    db = await get_db()
    cur = await db.execute(
        "SELECT cert_hash, recipient, asset_id, created FROM cert_metadata "
        "ORDER BY created DESC LIMIT ? OFFSET ?",
        (limit, offset),
    )
    return [dict(r) for r in await cur.fetchall()]


async def list_certs_for_recipient(recipient: str, limit: int = 100) -> list[dict]:
    db = await get_db()
    cur = await db.execute(
        "SELECT cert_hash, recipient, asset_id, created FROM cert_metadata "
        "WHERE recipient = ? ORDER BY created DESC LIMIT ?",
        (recipient, limit),
    )
    return [dict(r) for r in await cur.fetchall()]


# ── Polls (BFF cache) ───────────────────────────────────

async def insert_poll(
    poll_id: int,
    question: str,
    options_json: str,
    start_round: int,
    end_round: int,
    creator: str,
    app_id: int,
    tx_id: str | None = None,
) -> None:
    db = await get_db()
    await db.execute(
        "INSERT INTO polls (poll_id, question, options_json, start_round, end_round, creator, app_id, tx_id, created) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (poll_id, question, options_json, start_round, end_round, creator, app_id, tx_id, time.time()),
    )
    await db.commit()


async def list_polls(limit: int = 100, offset: int = 0) -> list[dict]:
    db = await get_db()
    cur = await db.execute(
        "SELECT * FROM polls ORDER BY created DESC LIMIT ? OFFSET ?",
        (limit, offset),
    )
    return [dict(r) for r in await cur.fetchall()]


async def get_poll(poll_id: int) -> Optional[dict]:
    db = await get_db()
    cur = await db.execute("SELECT * FROM polls WHERE poll_id = ?", (poll_id,))
    row = await cur.fetchone()
    return dict(row) if row else None


# ── Sessions (BFF cache) ────────────────────────────────

async def insert_session(
    session_id: int,
    course_code: str,
    session_ts: int,
    open_round: int,
    close_round: int,
    creator: str,
    app_id: int,
    tx_id: str | None = None,
) -> None:
    db = await get_db()
    await db.execute(
        "INSERT INTO sessions (session_id, course_code, session_ts, open_round, close_round, creator, app_id, tx_id, created) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (session_id, course_code, session_ts, open_round, close_round, creator, app_id, tx_id, time.time()),
    )
    await db.commit()


async def list_sessions(limit: int = 100, offset: int = 0) -> list[dict]:
    db = await get_db()
    cur = await db.execute(
        "SELECT * FROM sessions ORDER BY created DESC LIMIT ? OFFSET ?",
        (limit, offset),
    )
    return [dict(r) for r in await cur.fetchall()]


async def get_session(session_id: int) -> Optional[dict]:
    db = await get_db()
    cur = await db.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,))
    row = await cur.fetchone()
    return dict(row) if row else None
