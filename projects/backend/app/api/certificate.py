"""Certificate verify shortcut at /cert/verify (public convenience alias).

Write operations (issue) live under /faculty/cert/issue.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.domain.models import CertVerifyResponse
from app.usecases import certs_uc

router = APIRouter()


@router.get("/verify", response_model=CertVerifyResponse)
async def verify_cert(
    cert_hash: str = Query(..., min_length=64, max_length=64),
) -> CertVerifyResponse:
    """Public on-chain certificate verification (no JWT required)."""
    return await certs_uc.verify(cert_hash)
