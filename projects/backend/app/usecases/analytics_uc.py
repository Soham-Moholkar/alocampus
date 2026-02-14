"""Analytics use-case backed by Indexer queries."""

from __future__ import annotations

from app.domain.models import AnalyticsSummary
from app.infra.algorand.indexer import get_analytics_summary as _raw


async def summary() -> AnalyticsSummary:
    data = _raw()
    return AnalyticsSummary(**data)
