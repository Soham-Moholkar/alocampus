"""Compatibility alias for /me."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth import TokenPayload, get_current_user
from app.domain.models import MeResponse

router = APIRouter()


@router.get("/me", response_model=MeResponse)
async def me_alias(user: Annotated[TokenPayload, Depends(get_current_user)]) -> MeResponse:
    return MeResponse(address=user.address, role=user.role)
