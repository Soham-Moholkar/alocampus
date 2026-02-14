"""AI plan and execution API."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import TokenPayload, require_admin, require_faculty
from app.domain.models import AiActionType, AiExecuteResponse, AiPlanRequest, AiPlanResponse
from app.usecases import ai_uc

router = APIRouter(prefix="/ai")


@router.post("/faculty/poll-plan", response_model=AiPlanResponse)
async def faculty_poll_plan(
    body: AiPlanRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> AiPlanResponse:
    return await ai_uc.create_plan(AiActionType.FACULTY_POLL, body, user.address)


@router.post("/faculty/session-plan", response_model=AiPlanResponse)
async def faculty_session_plan(
    body: AiPlanRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> AiPlanResponse:
    return await ai_uc.create_plan(AiActionType.FACULTY_SESSION, body, user.address)


@router.post("/faculty/certificate-plan", response_model=AiPlanResponse)
async def faculty_certificate_plan(
    body: AiPlanRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> AiPlanResponse:
    return await ai_uc.create_plan(AiActionType.FACULTY_CERT, body, user.address)


@router.post("/admin/role-risk-plan", response_model=AiPlanResponse)
async def admin_role_risk_plan(
    body: AiPlanRequest,
    user: Annotated[TokenPayload, Depends(require_admin)],
) -> AiPlanResponse:
    return await ai_uc.create_plan(AiActionType.ADMIN_ROLE_RISK, body, user.address)


@router.post("/admin/system-remediation-plan", response_model=AiPlanResponse)
async def admin_system_plan(
    body: AiPlanRequest,
    user: Annotated[TokenPayload, Depends(require_admin)],
) -> AiPlanResponse:
    return await ai_uc.create_plan(AiActionType.ADMIN_SYSTEM, body, user.address)


@router.post("/coordination/task-plan", response_model=AiPlanResponse)
async def coordination_task_plan(
    body: AiPlanRequest,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> AiPlanResponse:
    return await ai_uc.create_plan(AiActionType.COORD_TASK, body, user.address)


@router.post("/execute/{intent_id}", response_model=AiExecuteResponse)
async def execute_intent(
    intent_id: str,
    user: Annotated[TokenPayload, Depends(require_faculty)],
) -> AiExecuteResponse:
    try:
        return await ai_uc.execute_intent(intent_id, user.address)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
