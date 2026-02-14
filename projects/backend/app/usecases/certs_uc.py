"""Certificate list + on-chain verification use-case."""

from __future__ import annotations

import logging

from app.config import get_settings
from app.domain.models import CertListItem, CertListResponse, CertVerifyResponse
from app.infra.algorand.chain import verify_cert_on_chain
from app.infra.db.models import list_certs, list_certs_for_recipient

logger = logging.getLogger(__name__)


async def list_all(limit: int = 100, offset: int = 0) -> CertListResponse:
    """List certificates from SQLite BFF cache."""
    rows = await list_certs(limit=limit, offset=offset)
    items = [
        CertListItem(
            cert_hash=r["cert_hash"],
            recipient=r["recipient"],
            asset_id=r.get("asset_id"),
            created=r.get("created"),
        )
        for r in rows
    ]
    return CertListResponse(certs=items, count=len(items))


async def list_for_address(address: str, limit: int = 100) -> CertListResponse:
    """List certificates for a specific recipient address."""
    rows = await list_certs_for_recipient(address, limit=limit)
    items = [
        CertListItem(
            cert_hash=r["cert_hash"],
            recipient=r["recipient"],
            asset_id=r.get("asset_id"),
            created=r.get("created"),
        )
        for r in rows
    ]
    return CertListResponse(certs=items, count=len(items))


async def verify(cert_hash_hex: str) -> CertVerifyResponse:
    """Verify a certificate on-chain via CertificateRegistryContract.verify_cert."""
    try:
        cert_hash_bytes = bytes.fromhex(cert_hash_hex)
    except ValueError:
        return CertVerifyResponse(
            valid=False,
            cert_hash=cert_hash_hex,
            message="invalid hex hash",
        )

    result = verify_cert_on_chain(cert_hash_bytes)
    if result is None:
        return CertVerifyResponse(
            valid=False,
            cert_hash=cert_hash_hex,
            message="certificate not found on-chain",
        )

    settings = get_settings()
    return CertVerifyResponse(
        valid=True,
        cert_hash=cert_hash_hex,
        recipient=result["recipient"],
        asset_id=result["asset_id"],
        issued_ts=result["issued_ts"],
        metadata_url=f"{settings.bff_base_url}/metadata/cert/{cert_hash_hex}.json",
        message="verified",
    )
