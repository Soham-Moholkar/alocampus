"""Credential-based demo auth routes for role login UX."""

from __future__ import annotations

from fastapi import APIRouter, Header, Query

from app.domain.models import (
    DemoAuthLoginRequest,
    DemoAuthLoginResponse,
    DemoAuthLogoutResponse,
    DemoUserProfile,
)
from app.usecases import demo_auth_uc

router = APIRouter()


@router.post("/login", response_model=DemoAuthLoginResponse)
async def demo_login(body: DemoAuthLoginRequest) -> DemoAuthLoginResponse:
    return await demo_auth_uc.login(body)


@router.post("/logout", response_model=DemoAuthLogoutResponse)
async def demo_logout() -> DemoAuthLogoutResponse:
    return DemoAuthLogoutResponse()


@router.get("/profile", response_model=DemoUserProfile)
async def demo_profile(
    x_demo_token: str = Header(..., alias="X-Demo-Token"),
) -> DemoUserProfile:
    return await demo_auth_uc.profile_from_token(x_demo_token)


@router.get("/users", response_model=list[DemoUserProfile])
async def demo_users(
    role: str | None = Query(default=None, pattern="^(student|faculty|admin)$"),
) -> list[DemoUserProfile]:
    return await demo_auth_uc.list_users(role=role)

