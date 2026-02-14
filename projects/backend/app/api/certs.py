"""Certificate list + on-chain verification routes (all roles can read/verify)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.auth import TokenPayload, get_current_user
from app.domain.models import CertListResponse, CertVerifyResponse
from app.usecases import certs_uc

router = APIRouter()


@router.get("", response_model=CertListResponse)
async def list_certs(
    user: Annotated[TokenPayload, Depends(get_current_user)],
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> CertListResponse:
    """List certs.  Students see their own; faculty/admin see all."""
    if user.role == "student":
        return await certs_uc.list_for_address(user.address, limit=limit)
    return await certs_uc.list_all(limit=limit, offset=offset)


@router.get("/verify", response_model=CertVerifyResponse)
async def verify_cert(
    cert_hash: str = Query(..., min_length=64, max_length=64),
) -> CertVerifyResponse:
    """On-chain verification of a certificate hash (public, no JWT needed)."""
    return await certs_uc.verify(cert_hash)
