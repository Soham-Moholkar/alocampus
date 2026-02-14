"""Attendance record use-cases with on-chain anchoring for check-ins."""

from __future__ import annotations

import time

from app.domain.models import AttendanceRecordListResponse, AttendanceRecordResponse
from app.infra.algorand.chain import anchor_note_on_chain
from app.infra.db.models import (
    list_attendance_records_for_session,
    list_attendance_records_for_student,
    update_attendance_record_status,
    upsert_attendance_record,
)
from app.usecases import activity_uc


def _map_record(row: dict) -> AttendanceRecordResponse:
    return AttendanceRecordResponse(
        id=str(row["id"]),
        session_id=int(row["session_id"]),
        course_code=str(row["course_code"]),
        student_address=str(row["student_address"]),
        status=str(row["status"]),
        tx_id=row.get("tx_id"),
        anchor_tx_id=row.get("anchor_tx_id"),
        attended_at=float(row.get("attended_at") or 0),
        created=float(row.get("created") or 0),
    )


async def list_my(
    student_address: str,
    course_code: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> AttendanceRecordListResponse:
    rows = await list_attendance_records_for_student(
        student_address=student_address,
        course_code=course_code,
        limit=limit,
        offset=offset,
    )
    records = [_map_record(row) for row in rows]
    return AttendanceRecordListResponse(records=records, count=len(records))


async def list_for_session(session_id: int, limit: int = 100, offset: int = 0) -> AttendanceRecordListResponse:
    rows = await list_attendance_records_for_session(session_id=session_id, limit=limit, offset=offset)
    records = [_map_record(row) for row in rows]
    return AttendanceRecordListResponse(records=records, count=len(records))


async def record_checkin(
    session_id: int,
    student_address: str,
    course_code: str,
    tx_id: str,
) -> AttendanceRecordResponse:
    note = f"attend:{session_id}:{student_address}:{tx_id}".encode()
    anchor_tx_id = anchor_note_on_chain(note)
    attended_at = time.time()

    record_id = await upsert_attendance_record(
        session_id=session_id,
        course_code=course_code,
        student_address=student_address,
        status="present",
        tx_id=tx_id,
        anchor_tx_id=anchor_tx_id,
        attended_at=attended_at,
    )

    await activity_uc.log_event(
        kind="attendance_recorded",
        title=f"Attendance recorded session #{session_id}",
        description=course_code,
        actor=student_address,
        tx_id=tx_id,
        tags=["attendance", f"session:{session_id}", f"student:{student_address}"],
    )

    return AttendanceRecordResponse(
        id=record_id,
        session_id=session_id,
        course_code=course_code,
        student_address=student_address,
        status="present",
        tx_id=tx_id,
        anchor_tx_id=anchor_tx_id,
        attended_at=attended_at,
        created=attended_at,
    )


async def review_update(record_id: str, status: str, actor: str) -> None:
    await update_attendance_record_status(record_id=record_id, status=status)
    await activity_uc.log_event(
        kind="attendance_review_updated",
        title=f"Attendance record updated ({status})",
        description=record_id,
        actor=actor,
        tags=["attendance", "review", f"record:{record_id}"],
    )
