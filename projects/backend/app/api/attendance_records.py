"""Attendance record read/review routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.auth import TokenPayload, get_current_user, require_faculty
from app.domain.models import AttendanceRecordListResponse, AttendanceRecordStatusUpdateRequest
from app.usecases import attendance_records_uc

router = APIRouter()


@router.get("/me", response_model=AttendanceRecordListResponse)
async def list_my_records(
    user: Annotated[TokenPayload, Depends(get_current_user)],
    course_code: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> AttendanceRecordListResponse:
    return await attendance_records_uc.list_my(
        student_address=user.address,
        course_code=course_code,
        limit=limit,
        offset=offset,
    )


@router.get("/session/{session_id}", response_model=AttendanceRecordListResponse)
async def list_session_records(
    session_id: int,
    _user: Annotated[TokenPayload, Depends(require_faculty)],
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> AttendanceRecordListResponse:
    return await attendance_records_uc.list_for_session(session_id=session_id, limit=limit, offset=offset)


@router.put("/{record_id}/status")
async def update_record_status(
    record_id: str,
    body: AttendanceRecordStatusUpdateRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> dict[str, bool]:
    await attendance_records_uc.review_update(record_id=record_id, status=body.status, actor=user.address)
    return {"ok": True}
