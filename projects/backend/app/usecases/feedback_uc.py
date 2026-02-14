"""Feedback commit and aggregate use-cases."""

from __future__ import annotations

import json

from app.domain.models import FeedbackAggregateResponse, FeedbackCommitRequest, FeedbackCommitResponse
from app.infra.algorand.chain import anchor_note_on_chain
from app.infra.db.models import add_feedback_commit, feedback_aggregate
from app.usecases import activity_uc


async def commit(author: str, body: FeedbackCommitRequest) -> FeedbackCommitResponse:
    tx_id = body.tx_id
    if tx_id is None:
        note = f"feedback:{body.feedback_hash}".encode()
        tx_id = anchor_note_on_chain(note)

    feedback_id = await add_feedback_commit(
        author=author,
        feedback_hash=body.feedback_hash,
        course_code=body.course_code or None,
        metadata_json=json.dumps(body.metadata),
        tx_id=tx_id,
    )

    await activity_uc.log_event(
        kind="feedback_commit",
        title="Feedback hash committed",
        description=body.course_code or "feedback",
        actor=author,
        tx_id=tx_id,
        tags=["feedback", f"feedback:{feedback_id}"],
    )

    return FeedbackCommitResponse(ok=True, id=feedback_id, message="feedback hash committed")


async def aggregate() -> FeedbackAggregateResponse:
    raw = await feedback_aggregate()
    return FeedbackAggregateResponse(
        total_commits=int(raw.get("total_commits", 0)),
        unique_authors=int(raw.get("unique_authors", 0)),
        recent=list(raw.get("recent", [])),
    )
