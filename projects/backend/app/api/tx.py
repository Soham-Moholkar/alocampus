"""Transaction tracking routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.domain.models import TrackTxRequest, TxStatus
from app.usecases import tx_uc

router = APIRouter()


@router.post("/track", response_model=TxStatus)
async def track(body: TrackTxRequest) -> TxStatus:
    return await tx_uc.track(
        body.tx_id,
        body.kind,
        session_id=body.session_id,
        course_code=body.course_code,
        student_address=body.student_address,
    )


@router.get("/track/{tx_id}", response_model=TxStatus)
async def get_status(tx_id: str) -> TxStatus:
    result = await tx_uc.get_status(tx_id)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "tx not tracked")
    return result
