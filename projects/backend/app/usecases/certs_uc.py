"""Certificate list + on-chain verification use-case."""

from __future__ import annotations

import hashlib
import json
import logging
import re

from app.config import get_settings
from app.domain.models import CertListItem, CertListResponse, CertUploadVerifyResult, CertVerifyResponse
from app.infra.algorand.chain import verify_cert_on_chain
from app.infra.db.models import list_certs, list_certs_for_recipient

logger = logging.getLogger(__name__)
_HEX64 = re.compile(r"\b[a-fA-F0-9]{64}\b")


def _extract_hash_from_obj(payload: object) -> str | None:
    if isinstance(payload, dict):
        for key, value in payload.items():
            if key.lower() in {"cert_hash", "certificate_hash", "hash"} and isinstance(value, str):
                candidate = value.strip().lower()
                if _HEX64.fullmatch(candidate):
                    return candidate
            nested = _extract_hash_from_obj(value)
            if nested:
                return nested
    elif isinstance(payload, list):
        for item in payload:
            nested = _extract_hash_from_obj(item)
            if nested:
                return nested
    return None


def _scan_candidates(text: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for match in _HEX64.findall(text):
        candidate = match.lower()
        if candidate not in seen:
            out.append(candidate)
            seen.add(candidate)
    return out


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


def parse_upload(filename: str, content_type: str, raw: bytes) -> CertUploadVerifyResult:
    lower_name = filename.lower()
    is_json = content_type.startswith("application/json") or lower_name.endswith(".json")
    is_text = content_type.startswith("text/") or lower_name.endswith(".txt")
    is_pdf = content_type == "application/pdf" or lower_name.endswith(".pdf")
    is_image = content_type.startswith("image/")

    if is_image:
        return CertUploadVerifyResult(
            ok=False,
            source="image",
            message="server-side image QR decoding is unavailable in local mode; use client QR scan",
        )

    decoded = raw.decode("utf-8", errors="ignore")
    if not decoded and is_pdf:
        decoded = raw.decode("latin-1", errors="ignore")

    candidates = _scan_candidates(decoded)
    if candidates:
        return CertUploadVerifyResult(
            ok=True,
            source="pdf" if is_pdf else "text",
            cert_hash=candidates[0],
            candidates=candidates,
            message="hash extracted from uploaded content",
        )

    if is_json:
        try:
            payload = json.loads(decoded)
        except Exception:
            payload = None
        if payload is not None:
            direct = _extract_hash_from_obj(payload)
            if direct:
                return CertUploadVerifyResult(
                    ok=True,
                    source="json",
                    cert_hash=direct,
                    candidates=[direct],
                    message="hash extracted from cert_hash field",
                )
            canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
            hashed = hashlib.sha256(canonical).hexdigest()
            return CertUploadVerifyResult(
                ok=True,
                source="json",
                cert_hash=hashed,
                candidates=[],
                message="no explicit cert_hash field; returning canonical JSON SHA-256",
            )

    if is_text:
        hashed = hashlib.sha256(raw).hexdigest()
        return CertUploadVerifyResult(
            ok=True,
            source="text",
            cert_hash=hashed,
            candidates=[],
            message="no explicit hash found; returning text SHA-256",
        )

    if is_pdf:
        return CertUploadVerifyResult(
            ok=False,
            source="pdf",
            message="pdf parsed but no 64-char hash candidate detected",
        )

    return CertUploadVerifyResult(
        ok=False,
        source="binary",
        message="unsupported upload format",
    )
