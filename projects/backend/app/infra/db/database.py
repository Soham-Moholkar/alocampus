"""Async SQLite database helpers (aiosqlite)."""

from __future__ import annotations

import aiosqlite
from pathlib import Path
from typing import Optional

_db: Optional[aiosqlite.Connection] = None

_SCHEMA = """
CREATE TABLE IF NOT EXISTS roles (
    address  TEXT PRIMARY KEY,
    role     TEXT NOT NULL DEFAULT 'student'
);

CREATE TABLE IF NOT EXISTS nonces (
    address  TEXT PRIMARY KEY,
    nonce    TEXT NOT NULL,
    created  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS tx_tracking (
    tx_id           TEXT PRIMARY KEY,
    kind            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    confirmed_round INTEGER
);

CREATE TABLE IF NOT EXISTS cert_metadata (
    cert_hash   TEXT PRIMARY KEY,
    recipient   TEXT NOT NULL,
    asset_id    INTEGER,
    metadata    TEXT NOT NULL,
    created     REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS polls (
    poll_id         INTEGER PRIMARY KEY,
    question        TEXT NOT NULL,
    options_json    TEXT NOT NULL,
    start_round     INTEGER NOT NULL,
    end_round       INTEGER NOT NULL,
    creator         TEXT NOT NULL,
    app_id          INTEGER NOT NULL,
    tx_id           TEXT,
    created         REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id      INTEGER PRIMARY KEY,
    course_code     TEXT NOT NULL,
    session_ts      INTEGER NOT NULL,
    open_round      INTEGER NOT NULL,
    close_round     INTEGER NOT NULL,
    creator         TEXT NOT NULL,
    app_id          INTEGER NOT NULL,
    tx_id           TEXT,
    created         REAL NOT NULL
);
"""


async def init_db(path: Path) -> None:
    global _db
    path.parent.mkdir(parents=True, exist_ok=True)
    _db = await aiosqlite.connect(str(path))
    _db.row_factory = aiosqlite.Row
    await _db.executescript(_SCHEMA)
    await _db.commit()


async def get_db() -> aiosqlite.Connection:
    if _db is None:
        raise RuntimeError("DB not initialised – call init_db first")
    return _db
