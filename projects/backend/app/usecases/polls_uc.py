"""Polls use-case: faculty creates on-chain, anyone lists from BFF cache."""

from __future__ import annotations

import json
import logging

from app.domain.models import CreatePollRequest, PollResponse, PollListResponse
from app.infra.algorand.chain import create_poll_on_chain
from app.infra.algorand.client import get_app_ids
from app.infra.db.models import get_poll, insert_poll, list_polls, upsert_poll_context
from app.usecases import activity_uc

logger = logging.getLogger(__name__)


async def create(req: CreatePollRequest, creator: str) -> PollResponse:
    """Create a poll on-chain and cache in SQLite."""
    poll_id, tx_id = create_poll_on_chain(
        question=req.question,
        options=req.options,
        start_round=req.start_round,
        end_round=req.end_round,
    )
    app_id = get_app_ids()["VotingContract"]

    await insert_poll(
        poll_id=poll_id,
        question=req.question,
        options_json=json.dumps(req.options),
        start_round=req.start_round,
        end_round=req.end_round,
        creator=creator,
        app_id=app_id,
        tx_id=tx_id,
    )

    await activity_uc.log_event(
        kind="poll_created",
        title=f"Poll #{poll_id} created",
        description=req.question,
        actor=creator,
        tx_id=tx_id,
        tags=[f"poll:{poll_id}"],
    )

    await upsert_poll_context(
        poll_id=poll_id,
        purpose="Official campus decision poll.",
        audience="all",
        category="governance",
        extra_note="Created from faculty voting workflow.",
        updated_by=creator,
        hash_value=f"seed:{poll_id}",
        anchor_tx_id=tx_id,
    )

    return PollResponse(
        poll_id=poll_id,
        question=req.question,
        options=req.options,
        start_round=req.start_round,
        end_round=req.end_round,
        creator=creator,
        app_id=app_id,
        tx_id=tx_id,
    )


async def list_all(limit: int = 100, offset: int = 0) -> PollListResponse:
    """List polls from SQLite cache (Indexer-backed initial population)."""
    rows = await list_polls(limit=limit, offset=offset)
    polls = [
        PollResponse(
            poll_id=r["poll_id"],
            question=r["question"],
            options=json.loads(r["options_json"]),
            start_round=r["start_round"],
            end_round=r["end_round"],
            creator=r["creator"],
            app_id=r["app_id"],
            tx_id=r.get("tx_id"),
            created=r.get("created"),
        )
        for r in rows
    ]
    return PollListResponse(polls=polls, count=len(polls))


async def get_by_id(poll_id: int) -> PollResponse | None:
    """Retrieve a single poll from BFF cache."""
    r = await get_poll(poll_id)
    if r is None:
        return None
    return PollResponse(
        poll_id=r["poll_id"],
        question=r["question"],
        options=json.loads(r["options_json"]),
        start_round=r["start_round"],
        end_round=r["end_round"],
        creator=r["creator"],
        app_id=r["app_id"],
        tx_id=r.get("tx_id"),
        created=r.get("created"),
    )
