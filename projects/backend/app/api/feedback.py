"""Feedback commit and aggregate API."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth import TokenPayload, get_current_user, require_faculty
from app.domain.models import FeedbackAggregateResponse, FeedbackCommitRequest, FeedbackCommitResponse
from app.usecases import feedback_uc

router = APIRouter()


@router.post("/commit", response_model=FeedbackCommitResponse)
async def commit_feedback(
    body: FeedbackCommitRequest,
    user: Annotated[TokenPayload, Depends(get_current_user)],
) -> FeedbackCommitResponse:
    return await feedback_uc.commit(user.address, body)


@router.get("/aggregate", response_model=FeedbackAggregateResponse)
async def get_feedback_aggregate(
    _user: Annotated[TokenPayload, Depends(require_faculty)],
) -> FeedbackAggregateResponse:
    return await feedback_uc.aggregate()
