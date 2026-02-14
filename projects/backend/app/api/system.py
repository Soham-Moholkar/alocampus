"""System health API."""

from __future__ import annotations

from fastapi import APIRouter

from app.domain.models import SystemHealthResponse
from app.usecases import system_uc

router = APIRouter()


@router.get("/health", response_model=SystemHealthResponse)
async def system_health() -> SystemHealthResponse:
    return await system_uc.summary()
