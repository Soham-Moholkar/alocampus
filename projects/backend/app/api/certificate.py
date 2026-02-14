"""Certificate verify shortcut at /cert/verify (public convenience alias).

Write operations (issue) live under /faculty/cert/issue.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query
from fastapi import Depends

from app.auth import TokenPayload, require_faculty
from app.domain.models import CertVerifyResponse
from app.domain.models import IssueCertRequest, IssueCertResponse
from app.usecases import certs_uc
from app.usecases import certificate_uc

router = APIRouter()


@router.get("/verify", response_model=CertVerifyResponse)
async def verify_cert(
    cert_hash: str = Query(..., min_length=64, max_length=64),
) -> CertVerifyResponse:
    """Public on-chain certificate verification (no JWT required)."""
    return await certs_uc.verify(cert_hash)


@router.post("/issue", response_model=IssueCertResponse)
async def issue_cert_alias(
    body: IssueCertRequest,
    _user: Annotated[TokenPayload, Depends(require_faculty)],
) -> IssueCertResponse:
    """Compatibility alias for certificate issuance."""
    return await certificate_uc.issue(body)
