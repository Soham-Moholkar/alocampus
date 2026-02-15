"""Database bootstrap and query helpers with Postgres primary and SQLite fallback."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Iterable

import aiosqlite

try:
    import asyncpg
except Exception:  # pragma: no cover
    asyncpg = None

from app.config import get_settings

logger = logging.getLogger(__name__)

_sqlite_db: aiosqlite.Connection | None = None
_pg_pool: Any = None
_backend: str = "sqlite"


_SCHEMA_SQLITE = """
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
    confirmed_round INTEGER,
    session_id      INTEGER,
    course_code     TEXT,
    student_address TEXT
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

CREATE TABLE IF NOT EXISTS activity_events (
    id          TEXT PRIMARY KEY,
    kind        TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    actor       TEXT,
    tx_id       TEXT,
    created     REAL NOT NULL,
    tags_json   TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS feedback_commits (
    id            TEXT PRIMARY KEY,
    author        TEXT NOT NULL,
    hash          TEXT NOT NULL,
    course_code   TEXT,
    metadata_json TEXT,
    tx_id         TEXT,
    created       REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS coordination_tasks (
    task_id      TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    description  TEXT,
    owner        TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'open',
    payload_hash TEXT,
    anchor_tx_id TEXT,
    created      REAL NOT NULL,
    updated      REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_intents (
    intent_id    TEXT PRIMARY KEY,
    intent_hash  TEXT NOT NULL UNIQUE,
    action_type  TEXT NOT NULL,
    risk_level   TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    auto_execute INTEGER NOT NULL DEFAULT 0,
    status       TEXT NOT NULL,
    created      REAL NOT NULL,
    updated      REAL NOT NULL,
    created_by   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_executions (
    execution_id    TEXT PRIMARY KEY,
    intent_id       TEXT NOT NULL,
    status          TEXT NOT NULL,
    message         TEXT,
    tx_id           TEXT,
    confirmed_round INTEGER,
    created         REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    body           TEXT NOT NULL,
    poll_id        INTEGER,
    category       TEXT NOT NULL,
    audience       TEXT NOT NULL,
    author_address TEXT NOT NULL,
    author_role    TEXT NOT NULL,
    is_pinned      INTEGER NOT NULL DEFAULT 0,
    is_deleted     INTEGER NOT NULL DEFAULT 0,
    hash           TEXT NOT NULL,
    anchor_tx_id   TEXT,
    created        REAL NOT NULL,
    updated        REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_context (
    poll_id      INTEGER PRIMARY KEY,
    purpose      TEXT NOT NULL,
    audience     TEXT NOT NULL,
    category     TEXT NOT NULL,
    extra_note   TEXT NOT NULL DEFAULT '',
    updated_by   TEXT NOT NULL,
    hash         TEXT NOT NULL,
    anchor_tx_id TEXT,
    updated      REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS user_profiles (
    address             TEXT PRIMARY KEY,
    display_name        TEXT,
    avatar_path         TEXT,
    avatar_hash         TEXT,
    avatar_anchor_tx_id TEXT,
    updated             REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_users (
    id            TEXT PRIMARY KEY,
    role          TEXT NOT NULL,
    username      TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    identifier    TEXT NOT NULL,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created       REAL NOT NULL,
    updated       REAL NOT NULL,
    UNIQUE(role, username),
    UNIQUE(role, identifier)
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id              TEXT PRIMARY KEY,
    session_id      INTEGER NOT NULL,
    course_code     TEXT NOT NULL,
    student_address TEXT NOT NULL,
    status          TEXT NOT NULL,
    tx_id           TEXT,
    anchor_tx_id    TEXT,
    attended_at     REAL NOT NULL,
    created         REAL NOT NULL,
    UNIQUE(session_id, student_address)
);

CREATE INDEX IF NOT EXISTS idx_tx_tracking_status ON tx_tracking(status);
CREATE INDEX IF NOT EXISTS idx_polls_created ON polls(created DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created DESC);
CREATE INDEX IF NOT EXISTS idx_cert_metadata_created ON cert_metadata(created DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_events(created DESC);
CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_events(actor);
CREATE INDEX IF NOT EXISTS idx_activity_kind ON activity_events(kind);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_commits(created DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_author ON feedback_commits(author);
CREATE INDEX IF NOT EXISTS idx_coord_tasks_updated ON coordination_tasks(updated DESC);
CREATE INDEX IF NOT EXISTS idx_ai_intents_status ON ai_intents(status);
CREATE INDEX IF NOT EXISTS idx_ai_intents_action ON ai_intents(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_exec_intent ON ai_executions(intent_id);
CREATE INDEX IF NOT EXISTS idx_announcements_updated ON announcements(updated DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_poll ON announcements(poll_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records(student_address, attended_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_records_course ON attendance_records(course_code, attended_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_users_role ON demo_users(role);
"""

_PG_SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS roles (
        address  TEXT PRIMARY KEY,
        role     TEXT NOT NULL DEFAULT 'student'
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS nonces (
        address  TEXT PRIMARY KEY,
        nonce    TEXT NOT NULL,
        created  DOUBLE PRECISION NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tx_tracking (
        tx_id           TEXT PRIMARY KEY,
        kind            TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending',
        confirmed_round BIGINT,
        session_id      BIGINT,
        course_code     TEXT,
        student_address TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS cert_metadata (
        cert_hash   TEXT PRIMARY KEY,
        recipient   TEXT NOT NULL,
        asset_id    BIGINT,
        metadata    TEXT NOT NULL,
        created     DOUBLE PRECISION NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS polls (
        poll_id       BIGINT PRIMARY KEY,
        question      TEXT NOT NULL,
        options_json  TEXT NOT NULL,
        start_round   BIGINT NOT NULL,
        end_round     BIGINT NOT NULL,
        creator       TEXT NOT NULL,
        app_id        BIGINT NOT NULL,
        tx_id         TEXT,
        created       DOUBLE PRECISION NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS sessions (
        session_id    BIGINT PRIMARY KEY,
        course_code   TEXT NOT NULL,
        session_ts    BIGINT NOT NULL,
        open_round    BIGINT NOT NULL,
        close_round   BIGINT NOT NULL,
        creator       TEXT NOT NULL,
        app_id        BIGINT NOT NULL,
        tx_id         TEXT,
        created       DOUBLE PRECISION NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS activity_events (
        id          TEXT PRIMARY KEY,
        kind        TEXT NOT NULL,
        title       TEXT NOT NULL,
        description TEXT,
        actor       TEXT,
        tx_id       TEXT,
        created     DOUBLE PRECISION NOT NULL,
        tags_json   TEXT NOT NULL DEFAULT '[]'
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS feedback_commits (
        id            TEXT PRIMARY KEY,
        author        TEXT NOT NULL,
        hash          TEXT NOT NULL,
        course_code   TEXT,
        metadata_json TEXT,
        tx_id         TEXT,
        created       DOUBLE PRECISION NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS coordination_tasks (
        task_id      TEXT PRIMARY KEY,
        title        TEXT NOT NULL,
        description  TEXT,
        owner        TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'open',
        payload_hash TEXT,
        anchor_tx_id TEXT,
        created      DOUBLE PRECISION NOT NULL,
        updated      DOUBLE PRECISION NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ai_intents (
        intent_id    TEXT PRIMARY KEY,
        intent_hash  TEXT NOT NULL UNIQUE,
        action_type  TEXT NOT NULL,
        risk_level   TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        auto_execute BOOLEAN NOT NULL DEFAULT FALSE,
        status       TEXT NOT NULL,
        created      DOUBLE PRECISION NOT NULL,
        updated      DOUBLE PRECISION NOT NULL,
        created_by   TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ai_executions (
        execution_id    TEXT PRIMARY KEY,
        intent_id       TEXT NOT NULL,
        status          TEXT NOT NULL,
        message         TEXT,
        tx_id           TEXT,
        confirmed_round BIGINT,
        created         DOUBLE PRECISION NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS announcements (
        id             TEXT PRIMARY KEY,
        title          TEXT NOT NULL,
        body           TEXT NOT NULL,
        poll_id        BIGINT,
        category       TEXT NOT NULL,
        audience       TEXT NOT NULL,
        author_address TEXT NOT NULL,
        author_role    TEXT NOT NULL,
        is_pinned      BOOLEAN NOT NULL DEFAULT FALSE,
        is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,
        hash           TEXT NOT NULL,
        anchor_tx_id   TEXT,
        created        DOUBLE PRECISION NOT NULL,
        updated        DOUBLE PRECISION NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS poll_context (
        poll_id      BIGINT PRIMARY KEY,
        purpose      TEXT NOT NULL,
        audience     TEXT NOT NULL,
        category     TEXT NOT NULL,
        extra_note   TEXT NOT NULL DEFAULT '',
        updated_by   TEXT NOT NULL,
        hash         TEXT NOT NULL,
        anchor_tx_id TEXT,
        updated      DOUBLE PRECISION NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user_profiles (
        address             TEXT PRIMARY KEY,
        display_name        TEXT,
        avatar_path         TEXT,
        avatar_hash         TEXT,
        avatar_anchor_tx_id TEXT,
        updated             DOUBLE PRECISION NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS demo_users (
        id            TEXT PRIMARY KEY,
        role          TEXT NOT NULL,
        username      TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        display_name  TEXT NOT NULL,
        identifier    TEXT NOT NULL,
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        created       DOUBLE PRECISION NOT NULL,
        updated       DOUBLE PRECISION NOT NULL,
        UNIQUE(role, username),
        UNIQUE(role, identifier)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS attendance_records (
        id              TEXT PRIMARY KEY,
        session_id      BIGINT NOT NULL,
        course_code     TEXT NOT NULL,
        student_address TEXT NOT NULL,
        status          TEXT NOT NULL,
        tx_id           TEXT,
        anchor_tx_id    TEXT,
        attended_at     DOUBLE PRECISION NOT NULL,
        created         DOUBLE PRECISION NOT NULL,
        UNIQUE(session_id, student_address)
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_tx_tracking_status ON tx_tracking(status)",
    "CREATE INDEX IF NOT EXISTS idx_polls_created ON polls(created DESC)",
    "CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created DESC)",
    "CREATE INDEX IF NOT EXISTS idx_cert_metadata_created ON cert_metadata(created DESC)",
    "CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_events(created DESC)",
    "CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_events(actor)",
    "CREATE INDEX IF NOT EXISTS idx_activity_kind ON activity_events(kind)",
    "CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_commits(created DESC)",
    "CREATE INDEX IF NOT EXISTS idx_feedback_author ON feedback_commits(author)",
    "CREATE INDEX IF NOT EXISTS idx_coord_tasks_updated ON coordination_tasks(updated DESC)",
    "CREATE INDEX IF NOT EXISTS idx_ai_intents_status ON ai_intents(status)",
    "CREATE INDEX IF NOT EXISTS idx_ai_intents_action ON ai_intents(action_type)",
    "CREATE INDEX IF NOT EXISTS idx_ai_exec_intent ON ai_executions(intent_id)",
    "CREATE INDEX IF NOT EXISTS idx_announcements_updated ON announcements(updated DESC)",
    "CREATE INDEX IF NOT EXISTS idx_announcements_poll ON announcements(poll_id)",
    "CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records(student_address, attended_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_attendance_records_course ON attendance_records(course_code, attended_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_demo_users_role ON demo_users(role)",
]


_SQLITE_UPGRADE_STATEMENTS = [
    "ALTER TABLE tx_tracking ADD COLUMN session_id INTEGER",
    "ALTER TABLE tx_tracking ADD COLUMN course_code TEXT",
    "ALTER TABLE tx_tracking ADD COLUMN student_address TEXT",
]

_POSTGRES_UPGRADE_STATEMENTS = [
    "ALTER TABLE tx_tracking ADD COLUMN IF NOT EXISTS session_id BIGINT",
    "ALTER TABLE tx_tracking ADD COLUMN IF NOT EXISTS course_code TEXT",
    "ALTER TABLE tx_tracking ADD COLUMN IF NOT EXISTS student_address TEXT",
]


def _sqlite_path_from_url(url: str, default_path: Path) -> Path:
    if not url:
        return default_path
    normalized = url.strip()
    for prefix in ("sqlite+aiosqlite:///", "sqlite:///"):
        if normalized.startswith(prefix):
            raw = normalized[len(prefix):]
            return Path(raw)
    return default_path


def _to_postgres_placeholders(sql: str) -> str:
    parts = sql.split("?")
    if len(parts) == 1:
        return sql
    rebuilt = [parts[0]]
    for idx, tail in enumerate(parts[1:], start=1):
        rebuilt.append(f"${idx}{tail}")
    return "".join(rebuilt)


async def _init_postgres(dsn: str) -> bool:
    global _pg_pool, _backend

    if asyncpg is None:
        logger.warning("asyncpg unavailable; falling back to SQLite")
        return False

    settings = get_settings()
    try:
        _pg_pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=1,
            max_size=max(2, settings.db_pool_size),
            command_timeout=settings.db_timeout_seconds,
        )
        async with _pg_pool.acquire() as conn:
            for statement in _PG_SCHEMA_STATEMENTS:
                await conn.execute(statement)
            for statement in _POSTGRES_UPGRADE_STATEMENTS:
                await conn.execute(statement)
        _backend = "postgres"
        logger.info("Database backend: postgres")
        return True
    except Exception:
        logger.exception("Failed to initialize PostgreSQL; falling back to SQLite")
        _pg_pool = None
        return False


async def _init_sqlite(path: Path) -> None:
    global _sqlite_db, _backend
    path.parent.mkdir(parents=True, exist_ok=True)
    _sqlite_db = await aiosqlite.connect(str(path))
    _sqlite_db.row_factory = aiosqlite.Row
    await _sqlite_db.executescript(_SCHEMA_SQLITE)
    for statement in _SQLITE_UPGRADE_STATEMENTS:
        try:
            await _sqlite_db.execute(statement)
        except Exception:
            pass
    await _sqlite_db.commit()
    _backend = "sqlite"
    logger.info("Database backend: sqlite (%s)", path)


async def init_db(path: Path | None = None) -> None:
    settings = get_settings()

    if settings.database_url and await _init_postgres(settings.database_url):
        return

    sqlite_path = path or _sqlite_path_from_url(settings.sqlite_fallback_url, settings.db_full_path)
    await _init_sqlite(sqlite_path)


async def close_db() -> None:
    global _sqlite_db, _pg_pool
    if _sqlite_db is not None:
        await _sqlite_db.close()
        _sqlite_db = None
    if _pg_pool is not None:
        await _pg_pool.close()
        _pg_pool = None


def active_backend() -> str:
    return _backend


async def ping_db() -> bool:
    try:
        if _backend == "postgres":
            if _pg_pool is None:
                return False
            async with _pg_pool.acquire() as conn:
                await conn.execute("SELECT 1")
            return True

        if _sqlite_db is None:
            return False
        cur = await _sqlite_db.execute("SELECT 1")
        await cur.fetchone()
        return True
    except Exception:
        return False


async def execute(sql: str, params: Iterable[Any] = ()) -> None:
    p = tuple(params)
    if _backend == "postgres":
        if _pg_pool is None:
            raise RuntimeError("PostgreSQL pool is not initialized")
        statement = _to_postgres_placeholders(sql)
        async with _pg_pool.acquire() as conn:
            await conn.execute(statement, *p)
        return

    if _sqlite_db is None:
        raise RuntimeError("SQLite database is not initialized")
    await _sqlite_db.execute(sql, p)
    await _sqlite_db.commit()


async def fetch_one(sql: str, params: Iterable[Any] = ()) -> dict[str, Any] | None:
    p = tuple(params)
    if _backend == "postgres":
        if _pg_pool is None:
            raise RuntimeError("PostgreSQL pool is not initialized")
        statement = _to_postgres_placeholders(sql)
        async with _pg_pool.acquire() as conn:
            row = await conn.fetchrow(statement, *p)
        return dict(row) if row else None

    if _sqlite_db is None:
        raise RuntimeError("SQLite database is not initialized")
    cur = await _sqlite_db.execute(sql, p)
    row = await cur.fetchone()
    return dict(row) if row else None


async def fetch_all(sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
    p = tuple(params)
    if _backend == "postgres":
        if _pg_pool is None:
            raise RuntimeError("PostgreSQL pool is not initialized")
        statement = _to_postgres_placeholders(sql)
        async with _pg_pool.acquire() as conn:
            rows = await conn.fetch(statement, *p)
        return [dict(row) for row in rows]

    if _sqlite_db is None:
        raise RuntimeError("SQLite database is not initialized")
    cur = await _sqlite_db.execute(sql, p)
    rows = await cur.fetchall()
    return [dict(row) for row in rows]
