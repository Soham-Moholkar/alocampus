"""Auth routes – nonce challenge / verify / me."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import TokenPayload, get_current_user
from app.domain.models import (
    MeResponse,
    NonceRequest,
    NonceResponse,
    TokenResponse,
    VerifyRequest,
)
from app.usecases import auth_uc

router = APIRouter()


@router.post("/nonce", response_model=NonceResponse)
async def request_nonce(body: NonceRequest) -> NonceResponse:
    nonce = await auth_uc.generate_nonce(body.address)
    return NonceResponse(nonce=nonce)


@router.post("/verify", response_model=TokenResponse)
async def verify(body: VerifyRequest) -> TokenResponse:
    token = await auth_uc.verify_and_issue_jwt(
        body.address, body.nonce, body.signature
    )
    if token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "verification failed")
    return TokenResponse(jwt=token)


@router.get("/me", response_model=MeResponse)  # docs kept under /auth
async def me(
    user: Annotated[TokenPayload, Depends(get_current_user)],
) -> MeResponse:
    return MeResponse(address=user.address, role=user.role)
