"""JWT helpers and FastAPI dependency for authenticated routes."""

from __future__ import annotations

import time
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import Settings, get_settings

_bearer = HTTPBearer(auto_error=True)


# ── Token creation ───────────────────────────────────────

def create_jwt(address: str, role: str, settings: Settings | None = None) -> str:
    s = settings or get_settings()
    now = int(time.time())
    payload = {
        "sub": address,
        "role": role,
        "iat": now,
        "exp": now + s.jwt_expire_minutes * 60,
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


# ── Token validation ─────────────────────────────────────

def _decode(token: str, settings: Settings) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token") from exc


class TokenPayload:
    """Parsed and validated JWT payload."""

    def __init__(self, address: str, role: str):
        self.address = address
        self.role = role


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> TokenPayload:
    data = _decode(creds.credentials, settings)
    addr = data.get("sub")
    role = data.get("role", "student")
    if not addr:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing sub")
    return TokenPayload(address=addr, role=role)


async def require_admin(user: Annotated[TokenPayload, Depends(get_current_user)]) -> TokenPayload:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "admin required")
    return user


async def require_faculty(user: Annotated[TokenPayload, Depends(get_current_user)]) -> TokenPayload:
    if user.role not in ("admin", "faculty"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "faculty or admin required")
    return user
