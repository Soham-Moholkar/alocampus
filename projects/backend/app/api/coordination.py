"""Coordination task API."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.auth import TokenPayload, require_faculty
from app.domain.models import (
    CoordinationAnchorRequest,
    CoordinationTaskCreateRequest,
    CoordinationTaskListResponse,
    CoordinationTaskResponse,
    CoordinationVerifyResponse,
)
from app.usecases import coordination_uc

router = APIRouter()


@router.post("/tasks", response_model=CoordinationTaskResponse)
async def create_task(
    body: CoordinationTaskCreateRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> CoordinationTaskResponse:
    return await coordination_uc.create(user.address, body)


@router.get("/tasks", response_model=CoordinationTaskListResponse)
async def list_tasks(
    _user: Annotated[TokenPayload, Depends(require_faculty)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> CoordinationTaskListResponse:
    return await coordination_uc.list_all(limit=limit, offset=offset)


@router.post("/tasks/{task_id}/anchor", response_model=CoordinationVerifyResponse)
async def anchor_task(
    task_id: str,
    body: CoordinationAnchorRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> CoordinationVerifyResponse:
    return await coordination_uc.anchor(task_id=task_id, actor=user.address, body=body)


@router.get("/tasks/{task_id}/verify", response_model=CoordinationVerifyResponse)
async def verify_task(
    task_id: str,
    _user: Annotated[TokenPayload, Depends(require_faculty)],
) -> CoordinationVerifyResponse:
    return await coordination_uc.verify(task_id)
