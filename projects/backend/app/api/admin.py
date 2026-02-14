"""Admin routes – role management."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth import TokenPayload, require_admin
from app.domain.models import SetRoleRequest, SetRoleResponse
from app.usecases import roles_uc

router = APIRouter()


@router.post("/role", response_model=SetRoleResponse)
async def set_role(
    body: SetRoleRequest,
    _admin: Annotated[TokenPayload, Depends(require_admin)],
) -> SetRoleResponse:
    msg = await roles_uc.set_role(body.address, body.role.value)
    return SetRoleResponse(ok=True, message=msg)
