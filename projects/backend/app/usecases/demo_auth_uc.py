"""Credential-based demo auth for role-entry UX (non-wallet)."""

from __future__ import annotations

import time

import bcrypt
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.config import get_settings
from app.domain.models import (
    DemoAuthLoginRequest,
    DemoAuthLoginResponse,
    DemoUserProfile,
)
from app.infra.db import models as db

_DEMO_TOKEN_TYPE = "demo-auth"


def _profile_from_row(row: dict) -> DemoUserProfile:
    return DemoUserProfile(
        id=str(row["id"]),
        role=str(row["role"]),
        username=str(row["username"]),
        display_name=str(row["display_name"]),
        identifier=str(row["identifier"]),
        is_active=bool(row.get("is_active", True)),
    )


def _make_demo_token(*, user_id: str, role: str, username: str, remember_me: bool) -> str:
    settings = get_settings()
    now = int(time.time())
    ttl_seconds = 60 * 60 * 24 * 30 if remember_me else 60 * 60 * 24
    payload = {
        "typ": _DEMO_TOKEN_TYPE,
        "uid": user_id,
        "role": role,
        "username": username,
        "iat": now,
        "exp": now + ttl_seconds,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode_demo_token(token: str) -> dict:
    settings = get_settings()
    try:
        data = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid demo token") from exc
    if data.get("typ") != _DEMO_TOKEN_TYPE or not data.get("uid"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid demo token payload")
    return data


async def login(req: DemoAuthLoginRequest) -> DemoAuthLoginResponse:
    row = await db.get_demo_user(req.role.value, req.username.strip())
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")
    if not bool(row.get("is_active", True)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "demo user disabled")

    stored_hash = str(row["password_hash"])
    if not bcrypt.checkpw(req.password.encode("utf-8"), stored_hash.encode("utf-8")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")

    profile = _profile_from_row(row)
    token = _make_demo_token(
        user_id=profile.id,
        role=profile.role.value,
        username=profile.username,
        remember_me=req.remember_me,
    )

    return DemoAuthLoginResponse(demo_token=token, profile=profile)


async def profile_from_token(token: str) -> DemoUserProfile:
    payload = _decode_demo_token(token)
    row = await db.get_demo_user_by_id(str(payload["uid"]))
    if row is None or not bool(row.get("is_active", True)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "demo session not found")
    return _profile_from_row(row)


async def list_users(role: str | None = None) -> list[DemoUserProfile]:
    rows = await db.list_demo_users(role=role)
    return [_profile_from_row(row) for row in rows]

