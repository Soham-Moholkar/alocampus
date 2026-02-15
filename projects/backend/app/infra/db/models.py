"""Database query helpers across SQLite fallback and PostgreSQL primary."""

from __future__ import annotations

import json
import time
import uuid
from typing import Any, Iterable, Optional

from app.infra.db.database import execute, fetch_all, fetch_one


# Nonces
async def upsert_nonce(address: str, nonce: str) -> None:
    await execute(
        "INSERT INTO nonces (address, nonce, created) VALUES (?, ?, ?) "
        "ON CONFLICT(address) DO UPDATE SET nonce=excluded.nonce, created=excluded.created",
        (address, nonce, time.time()),
    )


async def get_nonce(address: str) -> Optional[str]:
    row = await fetch_one("SELECT nonce FROM nonces WHERE address = ?", (address,))
    return str(row["nonce"]) if row else None


async def delete_nonce(address: str) -> None:
    await execute("DELETE FROM nonces WHERE address = ?", (address,))


# Roles
async def upsert_role(address: str, role: str) -> None:
    await execute(
        "INSERT INTO roles (address, role) VALUES (?, ?) "
        "ON CONFLICT(address) DO UPDATE SET role=excluded.role",
        (address, role),
    )


async def get_role(address: str) -> str:
    row = await fetch_one("SELECT role FROM roles WHERE address = ?", (address,))
    return str(row["role"]) if row else "student"


# TX tracking
async def upsert_tx(
    tx_id: str,
    kind: str,
    status: str = "pending",
    confirmed_round: Optional[int] = None,
    session_id: Optional[int] = None,
    course_code: Optional[str] = None,
    student_address: Optional[str] = None,
) -> None:
    await execute(
        "INSERT INTO tx_tracking (tx_id, kind, status, confirmed_round, session_id, course_code, student_address) "
        "VALUES (?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(tx_id) DO UPDATE SET "
        "kind=CASE WHEN excluded.kind = '' THEN tx_tracking.kind ELSE excluded.kind END, "
        "status=excluded.status, "
        "confirmed_round=COALESCE(excluded.confirmed_round, tx_tracking.confirmed_round), "
        "session_id=COALESCE(excluded.session_id, tx_tracking.session_id), "
        "course_code=COALESCE(excluded.course_code, tx_tracking.course_code), "
        "student_address=COALESCE(excluded.student_address, tx_tracking.student_address)",
        (tx_id, kind, status, confirmed_round, session_id, course_code, student_address),
    )


async def get_tx(tx_id: str) -> Optional[dict[str, Any]]:
    return await fetch_one("SELECT * FROM tx_tracking WHERE tx_id = ?", (tx_id,))


async def list_pending_txs() -> list[dict[str, Any]]:
    return await fetch_all("SELECT * FROM tx_tracking WHERE status = 'pending'")


# Certificate metadata
async def store_cert_metadata(cert_hash: str, recipient: str, asset_id: int, metadata_json: str) -> None:
    await execute(
        "INSERT INTO cert_metadata (cert_hash, recipient, asset_id, metadata, created) VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(cert_hash) DO UPDATE SET "
        "recipient=excluded.recipient, asset_id=excluded.asset_id, metadata=excluded.metadata",
        (cert_hash, recipient, asset_id, metadata_json, time.time()),
    )


async def get_cert_metadata(cert_hash: str) -> Optional[str]:
    row = await fetch_one("SELECT metadata FROM cert_metadata WHERE cert_hash = ?", (cert_hash,))
    return str(row["metadata"]) if row else None


async def list_certs(limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
    return await fetch_all(
        "SELECT cert_hash, recipient, asset_id, created FROM cert_metadata "
        "ORDER BY created DESC LIMIT ? OFFSET ?",
        (limit, offset),
    )


async def list_certs_for_recipient(recipient: str, limit: int = 100) -> list[dict[str, Any]]:
    return await fetch_all(
        "SELECT cert_hash, recipient, asset_id, created FROM cert_metadata "
        "WHERE recipient = ? ORDER BY created DESC LIMIT ?",
        (recipient, limit),
    )


# Poll cache
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
    await execute(
        "INSERT INTO polls (poll_id, question, options_json, start_round, end_round, creator, app_id, tx_id, created) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (poll_id, question, options_json, start_round, end_round, creator, app_id, tx_id, time.time()),
    )


async def list_polls(limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
    return await fetch_all("SELECT * FROM polls ORDER BY created DESC LIMIT ? OFFSET ?", (limit, offset))


async def get_poll(poll_id: int) -> Optional[dict[str, Any]]:
    return await fetch_one("SELECT * FROM polls WHERE poll_id = ?", (poll_id,))


# Session cache
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
    await execute(
        "INSERT INTO sessions (session_id, course_code, session_ts, open_round, close_round, creator, app_id, tx_id, created) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (session_id, course_code, session_ts, open_round, close_round, creator, app_id, tx_id, time.time()),
    )


async def list_sessions(limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
    return await fetch_all("SELECT * FROM sessions ORDER BY created DESC LIMIT ? OFFSET ?", (limit, offset))


async def get_session(session_id: int) -> Optional[dict[str, Any]]:
    return await fetch_one("SELECT * FROM sessions WHERE session_id = ?", (session_id,))


async def update_session(
    session_id: int,
    course_code: str | None = None,
    session_ts: int | None = None,
    open_round: int | None = None,
    close_round: int | None = None,
) -> None:
    current = await get_session(session_id)
    if not current:
        return
    await execute(
        "UPDATE sessions SET course_code = ?, session_ts = ?, open_round = ?, close_round = ? WHERE session_id = ?",
        (
            course_code if course_code is not None else current.get("course_code"),
            session_ts if session_ts is not None else current.get("session_ts"),
            open_round if open_round is not None else current.get("open_round"),
            close_round if close_round is not None else current.get("close_round"),
            session_id,
        ),
    )


# Activity events
async def add_activity_event(
    kind: str,
    title: str,
    description: str = "",
    actor: str | None = None,
    tx_id: str | None = None,
    tags: Iterable[str] | None = None,
    event_id: str | None = None,
) -> str:
    eid = event_id or f"evt-{uuid.uuid4().hex}"
    tags_json = json.dumps(list(tags or []))
    await execute(
        "INSERT INTO activity_events (id, kind, title, description, actor, tx_id, created, tags_json) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (eid, kind, title, description, actor, tx_id, time.time(), tags_json),
    )
    return eid


async def list_activity_events(
    limit: int = 100,
    offset: int = 0,
    address: str | None = None,
    kind: str | None = None,
    poll_id: int | None = None,
    session_id: int | None = None,
    tag: str | None = None,
) -> list[dict[str, Any]]:
    conditions: list[str] = []
    params: list[Any] = []

    if address:
        conditions.append("actor = ?")
        params.append(address)
    if kind:
        conditions.append("kind = ?")
        params.append(kind)

    derived_tags: list[str] = []
    if poll_id is not None:
        derived_tags.append(f"poll:{poll_id}")
    if session_id is not None:
        derived_tags.append(f"session:{session_id}")
    if tag:
        derived_tags.append(tag)

    for entry in derived_tags:
        conditions.append("tags_json LIKE ?")
        params.append(f"%\"{entry}\"%")

    where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.extend([limit, offset])

    rows = await fetch_all(
        f"SELECT id, kind, title, description, actor, tx_id, created, tags_json "
        f"FROM activity_events {where_sql} ORDER BY created DESC LIMIT ? OFFSET ?",
        params,
    )

    for row in rows:
        raw = row.get("tags_json")
        if isinstance(raw, str):
            try:
                row["tags"] = json.loads(raw)
            except json.JSONDecodeError:
                row["tags"] = []
        else:
            row["tags"] = []
    return rows


# Feedback
async def add_feedback_commit(
    author: str,
    feedback_hash: str,
    course_code: str | None = None,
    metadata_json: str | None = None,
    tx_id: str | None = None,
    entry_id: str | None = None,
) -> str:
    fid = entry_id or f"fdbk-{uuid.uuid4().hex}"
    await execute(
        "INSERT INTO feedback_commits (id, author, hash, course_code, metadata_json, tx_id, created) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (fid, author, feedback_hash, course_code, metadata_json, tx_id, time.time()),
    )
    return fid


async def list_feedback_commits(limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
    return await fetch_all(
        "SELECT id, author, hash, course_code, metadata_json, tx_id, created "
        "FROM feedback_commits ORDER BY created DESC LIMIT ? OFFSET ?",
        (limit, offset),
    )


async def feedback_aggregate() -> dict[str, Any]:
    row = await fetch_one(
        "SELECT COUNT(*) AS total_commits, COUNT(DISTINCT author) AS unique_authors FROM feedback_commits"
    )
    recent = await fetch_all(
        "SELECT id, author, hash, course_code, tx_id, created "
        "FROM feedback_commits ORDER BY created DESC LIMIT 10"
    )
    return {
        "total_commits": int(row["total_commits"]) if row and row.get("total_commits") is not None else 0,
        "unique_authors": int(row["unique_authors"]) if row and row.get("unique_authors") is not None else 0,
        "recent": recent,
    }


# Coordination
async def create_coordination_task(
    task_id: str,
    title: str,
    description: str,
    owner: str,
    status: str = "open",
) -> None:
    ts = time.time()
    await execute(
        "INSERT INTO coordination_tasks (task_id, title, description, owner, status, created, updated) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (task_id, title, description, owner, status, ts, ts),
    )


async def list_coordination_tasks(limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
    return await fetch_all(
        "SELECT * FROM coordination_tasks ORDER BY updated DESC LIMIT ? OFFSET ?",
        (limit, offset),
    )


async def get_coordination_task(task_id: str) -> Optional[dict[str, Any]]:
    return await fetch_one("SELECT * FROM coordination_tasks WHERE task_id = ?", (task_id,))


async def update_coordination_anchor(task_id: str, payload_hash: str, anchor_tx_id: str) -> None:
    await execute(
        "UPDATE coordination_tasks SET payload_hash = ?, anchor_tx_id = ?, updated = ? WHERE task_id = ?",
        (payload_hash, anchor_tx_id, time.time(), task_id),
    )


async def update_coordination_status(task_id: str, status: str) -> None:
    await execute(
        "UPDATE coordination_tasks SET status = ?, updated = ? WHERE task_id = ?",
        (status, time.time(), task_id),
    )


# AI intents + executions
async def add_ai_intent(
    intent_id: str,
    intent_hash: str,
    action_type: str,
    risk_level: str,
    payload_json: str,
    auto_execute: bool,
    status: str,
    created_by: str,
) -> None:
    ts = time.time()
    await execute(
        "INSERT INTO ai_intents "
        "(intent_id, intent_hash, action_type, risk_level, payload_json, auto_execute, status, created, updated, created_by) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (intent_id, intent_hash, action_type, risk_level, payload_json, int(auto_execute), status, ts, ts, created_by),
    )


async def get_ai_intent(intent_id: str) -> Optional[dict[str, Any]]:
    return await fetch_one("SELECT * FROM ai_intents WHERE intent_id = ?", (intent_id,))


async def update_ai_intent_status(intent_id: str, status: str) -> None:
    await execute("UPDATE ai_intents SET status = ?, updated = ? WHERE intent_id = ?", (status, time.time(), intent_id))


async def add_ai_execution(
    execution_id: str,
    intent_id: str,
    status: str,
    message: str,
    tx_id: str | None,
    confirmed_round: int | None = None,
) -> None:
    await execute(
        "INSERT INTO ai_executions (execution_id, intent_id, status, message, tx_id, confirmed_round, created) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (execution_id, intent_id, status, message, tx_id, confirmed_round, time.time()),
    )


async def list_ai_executions(intent_id: str) -> list[dict[str, Any]]:
    return await fetch_all(
        "SELECT * FROM ai_executions WHERE intent_id = ? ORDER BY created DESC",
        (intent_id,),
    )


# Profiles
async def get_user_profile(address: str) -> Optional[dict[str, Any]]:
    return await fetch_one("SELECT * FROM user_profiles WHERE address = ?", (address,))


async def upsert_user_profile(
    address: str,
    display_name: str | None = None,
    avatar_path: str | None = None,
    avatar_hash: str | None = None,
    avatar_anchor_tx_id: str | None = None,
) -> None:
    await execute(
        "INSERT INTO user_profiles (address, display_name, avatar_path, avatar_hash, avatar_anchor_tx_id, updated) "
        "VALUES (?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(address) DO UPDATE SET "
        "display_name=COALESCE(excluded.display_name, user_profiles.display_name), "
        "avatar_path=COALESCE(excluded.avatar_path, user_profiles.avatar_path), "
        "avatar_hash=COALESCE(excluded.avatar_hash, user_profiles.avatar_hash), "
        "avatar_anchor_tx_id=COALESCE(excluded.avatar_anchor_tx_id, user_profiles.avatar_anchor_tx_id), "
        "updated=excluded.updated",
        (address, display_name, avatar_path, avatar_hash, avatar_anchor_tx_id, time.time()),
    )


async def clear_user_avatar(address: str) -> None:
    await execute(
        "UPDATE user_profiles SET avatar_path = NULL, avatar_hash = NULL, avatar_anchor_tx_id = NULL, updated = ? "
        "WHERE address = ?",
        (time.time(), address),
    )


# Poll context
async def get_poll_context(poll_id: int) -> Optional[dict[str, Any]]:
    return await fetch_one("SELECT * FROM poll_context WHERE poll_id = ?", (poll_id,))


async def upsert_poll_context(
    poll_id: int,
    purpose: str,
    audience: str,
    category: str,
    extra_note: str,
    updated_by: str,
    hash_value: str,
    anchor_tx_id: str | None = None,
) -> None:
    await execute(
        "INSERT INTO poll_context (poll_id, purpose, audience, category, extra_note, updated_by, hash, anchor_tx_id, updated) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(poll_id) DO UPDATE SET "
        "purpose=excluded.purpose, audience=excluded.audience, category=excluded.category, extra_note=excluded.extra_note, "
        "updated_by=excluded.updated_by, hash=excluded.hash, anchor_tx_id=excluded.anchor_tx_id, updated=excluded.updated",
        (poll_id, purpose, audience, category, extra_note, updated_by, hash_value, anchor_tx_id, time.time()),
    )


# Announcements
async def create_announcement(
    announcement_id: str,
    title: str,
    body: str,
    poll_id: int | None,
    category: str,
    audience: str,
    author_address: str,
    author_role: str,
    is_pinned: bool,
    hash_value: str,
    anchor_tx_id: str | None,
) -> None:
    ts = time.time()
    await execute(
        "INSERT INTO announcements "
        "(id, title, body, poll_id, category, audience, author_address, author_role, is_pinned, is_deleted, hash, anchor_tx_id, created, updated) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)",
        (
            announcement_id,
            title,
            body,
            poll_id,
            category,
            audience,
            author_address,
            author_role,
            int(is_pinned),
            hash_value,
            anchor_tx_id,
            ts,
            ts,
        ),
    )


async def get_announcement(announcement_id: str) -> Optional[dict[str, Any]]:
    return await fetch_one("SELECT * FROM announcements WHERE id = ?", (announcement_id,))


async def list_announcements(
    audience: str | None = None,
    poll_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
    include_deleted: bool = False,
) -> list[dict[str, Any]]:
    conditions: list[str] = []
    params: list[Any] = []

    if not include_deleted:
        conditions.append("is_deleted = 0")
    if audience and audience != "all":
        conditions.append("(audience = ? OR audience = 'all')")
        params.append(audience)
    if poll_id is not None:
        conditions.append("poll_id = ?")
        params.append(poll_id)

    where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.extend([limit, offset])

    return await fetch_all(
        "SELECT * FROM announcements "
        f"{where_sql} ORDER BY is_pinned DESC, updated DESC LIMIT ? OFFSET ?",
        params,
    )


async def update_announcement(
    announcement_id: str,
    title: str | None = None,
    body: str | None = None,
    category: str | None = None,
    audience: str | None = None,
    is_pinned: bool | None = None,
    hash_value: str | None = None,
    anchor_tx_id: str | None = None,
) -> None:
    current = await get_announcement(announcement_id)
    if not current:
        return
    await execute(
        "UPDATE announcements SET "
        "title = ?, body = ?, category = ?, audience = ?, is_pinned = ?, hash = ?, anchor_tx_id = ?, updated = ? "
        "WHERE id = ?",
        (
            title if title is not None else current.get("title"),
            body if body is not None else current.get("body"),
            category if category is not None else current.get("category"),
            audience if audience is not None else current.get("audience"),
            int(is_pinned) if is_pinned is not None else int(current.get("is_pinned") or 0),
            hash_value if hash_value is not None else current.get("hash"),
            anchor_tx_id if anchor_tx_id is not None else current.get("anchor_tx_id"),
            time.time(),
            announcement_id,
        ),
    )


async def soft_delete_announcement(announcement_id: str) -> None:
    await execute(
        "UPDATE announcements SET is_deleted = 1, updated = ? WHERE id = ?",
        (time.time(), announcement_id),
    )


# Attendance records
async def upsert_attendance_record(
    session_id: int,
    course_code: str,
    student_address: str,
    status: str,
    tx_id: str | None = None,
    anchor_tx_id: str | None = None,
    attended_at: float | None = None,
) -> str:
    row = await fetch_one(
        "SELECT id FROM attendance_records WHERE session_id = ? AND student_address = ?",
        (session_id, student_address),
    )
    record_id = str(row["id"]) if row else f"att-{uuid.uuid4().hex}"
    ts = attended_at if attended_at is not None else time.time()
    await execute(
        "INSERT INTO attendance_records "
        "(id, session_id, course_code, student_address, status, tx_id, anchor_tx_id, attended_at, created) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(session_id, student_address) DO UPDATE SET "
        "course_code=excluded.course_code, status=excluded.status, tx_id=COALESCE(excluded.tx_id, attendance_records.tx_id), "
        "anchor_tx_id=COALESCE(excluded.anchor_tx_id, attendance_records.anchor_tx_id), attended_at=excluded.attended_at",
        (record_id, session_id, course_code, student_address, status, tx_id, anchor_tx_id, ts, time.time()),
    )
    return record_id


async def list_attendance_records_for_student(
    student_address: str,
    course_code: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    if course_code:
        return await fetch_all(
            "SELECT * FROM attendance_records WHERE student_address = ? AND course_code = ? "
            "ORDER BY attended_at DESC LIMIT ? OFFSET ?",
            (student_address, course_code, limit, offset),
        )
    return await fetch_all(
        "SELECT * FROM attendance_records WHERE student_address = ? "
        "ORDER BY attended_at DESC LIMIT ? OFFSET ?",
        (student_address, limit, offset),
    )


async def list_attendance_records_for_session(
    session_id: int,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    return await fetch_all(
        "SELECT * FROM attendance_records WHERE session_id = ? ORDER BY attended_at DESC LIMIT ? OFFSET ?",
        (session_id, limit, offset),
    )


async def get_attendance_record(record_id: str) -> Optional[dict[str, Any]]:
    return await fetch_one("SELECT * FROM attendance_records WHERE id = ?", (record_id,))


async def update_attendance_record_status(record_id: str, status: str) -> None:
    await execute(
        "UPDATE attendance_records SET status = ?, attended_at = ? WHERE id = ?",
        (status, time.time(), record_id),
    )


# Demo auth users
async def upsert_demo_user(
    user_id: str,
    role: str,
    username: str,
    password_hash: str,
    display_name: str,
    identifier: str,
    is_active: bool = True,
) -> None:
    ts = time.time()
    await execute(
        "INSERT INTO demo_users (id, role, username, password_hash, display_name, identifier, is_active, created, updated) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET "
        "role=excluded.role, username=excluded.username, password_hash=excluded.password_hash, display_name=excluded.display_name, "
        "identifier=excluded.identifier, is_active=excluded.is_active, updated=excluded.updated",
        (
            user_id,
            role,
            username,
            password_hash,
            display_name,
            identifier,
            int(is_active),
            ts,
            ts,
        ),
    )


async def get_demo_user(role: str, username_or_identifier: str) -> Optional[dict[str, Any]]:
    return await fetch_one(
        "SELECT id, role, username, password_hash, display_name, identifier, is_active "
        "FROM demo_users WHERE role = ? AND (username = ? OR identifier = ?)",
        (role, username_or_identifier, username_or_identifier),
    )


async def get_demo_user_by_id(user_id: str) -> Optional[dict[str, Any]]:
    return await fetch_one(
        "SELECT id, role, username, password_hash, display_name, identifier, is_active "
        "FROM demo_users WHERE id = ?",
        (user_id,),
    )


async def list_demo_users(role: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
    if role:
        return await fetch_all(
            "SELECT id, role, username, display_name, identifier, is_active, created, updated "
            "FROM demo_users WHERE role = ? ORDER BY username ASC LIMIT ?",
            (role, limit),
        )
    return await fetch_all(
        "SELECT id, role, username, display_name, identifier, is_active, created, updated "
        "FROM demo_users ORDER BY role ASC, username ASC LIMIT ?",
        (limit,),
    )
