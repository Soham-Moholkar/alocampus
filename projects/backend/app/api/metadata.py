"""Local ARC-3 metadata serving – no external calls."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.infra.db.models import get_cert_metadata

router = APIRouter()


@router.get("/cert/{cert_hash}.json")
async def serve_metadata(cert_hash: str) -> JSONResponse:
    """Serve ARC-3 metadata from local SQLite store.  No Pinata / IPFS needed."""
    raw = await get_cert_metadata(cert_hash)
    if raw is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "metadata not found")
    return JSONResponse(content=json.loads(raw), media_type="application/json")
