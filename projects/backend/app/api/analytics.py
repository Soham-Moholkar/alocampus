"""Analytics – Indexer-backed aggregate counts."""

from __future__ import annotations

from fastapi import APIRouter

from app.domain.models import AnalyticsSummary
from app.usecases import analytics_uc

router = APIRouter()


@router.get("/summary", response_model=AnalyticsSummary)
async def summary() -> AnalyticsSummary:
    return await analytics_uc.summary()
