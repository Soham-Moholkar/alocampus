"""AI planning and execution use-cases."""

from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any

from app.config import get_settings
from app.domain.models import (
    AiActionType,
    AiExecuteResponse,
    AiExecutionMode,
    AiPlanRequest,
    AiPlanResponse,
    AiRiskLevel,
)
from app.infra.ai import fallback_client, gemini_client, policy
from app.infra.algorand.chain import current_round, create_poll_ai_on_chain, create_session_ai_on_chain
from app.infra.algorand.client import get_app_ids
from app.infra.db.models import (
    add_ai_execution,
    add_ai_intent,
    get_ai_intent,
    insert_poll,
    insert_session,
    update_ai_intent_status,
)
from app.usecases import activity_uc


def _canonical_hash(payload: dict[str, Any]) -> str:
    packed = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(packed).hexdigest()


async def _provider_plan(action_type: AiActionType, req: AiPlanRequest) -> dict[str, Any]:
    settings = get_settings()
    if settings.ai_enabled and settings.gemini_api_key:
        try:
            return await gemini_client.generate_plan(action_type.value, req.prompt, req.context)
        except Exception:
            return fallback_client.build_plan(action_type.value, req.prompt, req.context)
    return fallback_client.build_plan(action_type.value, req.prompt, req.context)


async def create_plan(action_type: AiActionType, req: AiPlanRequest, actor: str) -> AiPlanResponse:
    settings = get_settings()
    risk = policy.infer_risk(action_type)
    mode = policy.execution_mode(action_type, req.auto_execute, settings.ai_auto_execute_low_risk)
    generated = await _provider_plan(action_type, req)

    payload = {
        "prompt": req.prompt,
        "context": req.context,
        "generated": generated,
        "payload": req.context.get("payload", {}),
    }

    intent_hash = _canonical_hash({"action_type": action_type.value, "payload": payload})
    intent_id = f"intent-{uuid.uuid4().hex[:12]}"

    await add_ai_intent(
        intent_id=intent_id,
        intent_hash=intent_hash,
        action_type=action_type.value,
        risk_level=risk.value,
        payload_json=json.dumps(payload),
        auto_execute=mode == AiExecutionMode.AUTO,
        status="planned",
        created_by=actor,
    )

    await activity_uc.log_event(
        kind="ai_plan_created",
        title=f"AI plan created ({action_type.value})",
        description=req.prompt[:180],
        actor=actor,
        tags=["ai", f"intent:{intent_id}", f"risk:{risk.value}"],
    )

    message = "plan created"
    if mode == AiExecutionMode.AUTO:
        exec_result = await execute_intent(intent_id, actor)
        message = f"auto execution status: {exec_result.status}"

    return AiPlanResponse(
        intent_id=intent_id,
        intent_hash=intent_hash,
        action_type=action_type,
        risk_level=risk,
        execution_mode=mode,
        plan={"generated": generated, "payload": payload.get("payload", {})},
        message=message,
    )


async def execute_intent(intent_id: str, actor: str) -> AiExecuteResponse:
    row = await get_ai_intent(intent_id)
    if row is None:
        raise RuntimeError("intent not found")

    action_type = AiActionType(str(row["action_type"]))
    risk = AiRiskLevel(str(row["risk_level"]))
    mode = AiExecutionMode.AUTO if bool(row.get("auto_execute")) else AiExecutionMode.APPROVAL_REQUIRED

    if risk != AiRiskLevel.LOW and mode != AiExecutionMode.AUTO:
        await update_ai_intent_status(intent_id, "approval_required")
        return AiExecuteResponse(
            intent_id=intent_id,
            status="approval_required",
            risk_level=risk,
            execution_mode=AiExecutionMode.APPROVAL_REQUIRED,
            message="high-risk action requires manual approval",
        )

    payload = json.loads(str(row["payload_json"]))
    action_payload: dict[str, Any] = payload.get("payload") or {}
    intent_hash_hex = str(row["intent_hash"])
    intent_hash = bytes.fromhex(intent_hash_hex)
    expires_round = current_round() + 30

    tx_id: str | None = None
    message = "executed"
    action_tags: list[str] = []

    try:
        if action_type == AiActionType.FACULTY_POLL:
            question = str(action_payload.get("question", "")).strip()
            options = list(action_payload.get("options", []))
            start_round = int(action_payload.get("start_round", 0))
            end_round = int(action_payload.get("end_round", 0))
            if not question or len(options) < 2 or end_round <= start_round:
                raise RuntimeError("invalid poll payload")
            poll_id, tx_id = create_poll_ai_on_chain(question, options, start_round, end_round, intent_hash, expires_round)
            app_ids = get_app_ids()
            app_id = int(app_ids.get("VotingContract", 0))
            if app_id:
                await insert_poll(
                    poll_id=int(poll_id),
                    question=question,
                    options_json=json.dumps(options),
                    start_round=start_round,
                    end_round=end_round,
                    creator=actor,
                    app_id=app_id,
                    tx_id=tx_id,
                )
            message = f"poll created via ai: {poll_id}"
            action_tags = [f"poll:{poll_id}"]

        elif action_type == AiActionType.FACULTY_SESSION:
            course_code = str(action_payload.get("course_code", "")).strip()
            session_ts = int(action_payload.get("session_ts", 0))
            open_round = int(action_payload.get("open_round", 0))
            close_round = int(action_payload.get("close_round", 0))
            if not course_code or close_round <= open_round:
                raise RuntimeError("invalid session payload")
            session_id, tx_id = create_session_ai_on_chain(
                course_code,
                session_ts,
                open_round,
                close_round,
                intent_hash,
                expires_round,
            )
            app_ids = get_app_ids()
            app_id = int(app_ids.get("AttendanceContract", 0))
            if app_id:
                await insert_session(
                    session_id=int(session_id),
                    course_code=course_code,
                    session_ts=session_ts,
                    open_round=open_round,
                    close_round=close_round,
                    creator=actor,
                    app_id=app_id,
                    tx_id=tx_id,
                )
            message = f"session created via ai: {session_id}"
            action_tags = [f"session:{session_id}"]

        else:
            await update_ai_intent_status(intent_id, "approval_required")
            return AiExecuteResponse(
                intent_id=intent_id,
                status="approval_required",
                risk_level=risk,
                execution_mode=AiExecutionMode.APPROVAL_REQUIRED,
                message="action requires explicit approval workflow",
            )

        await update_ai_intent_status(intent_id, "executed")
        execution_id = f"exec-{uuid.uuid4().hex[:12]}"
        await add_ai_execution(
            execution_id=execution_id,
            intent_id=intent_id,
            status="executed",
            message=message,
            tx_id=tx_id,
            confirmed_round=None,
        )

        await activity_uc.log_event(
            kind="ai_execution",
            title=f"AI execution ({action_type.value})",
            description=message,
            actor=actor,
            tx_id=tx_id,
            tags=["ai", f"intent:{intent_id}", f"risk:{risk.value}", *action_tags],
        )

        return AiExecuteResponse(
            intent_id=intent_id,
            status="executed",
            risk_level=risk,
            execution_mode=mode,
            tx_id=tx_id,
            message=message,
        )
    except Exception as exc:
        await update_ai_intent_status(intent_id, "failed")
        execution_id = f"exec-{uuid.uuid4().hex[:12]}"
        await add_ai_execution(
            execution_id=execution_id,
            intent_id=intent_id,
            status="failed",
            message=str(exc),
            tx_id=tx_id,
            confirmed_round=None,
        )
        await activity_uc.log_event(
            kind="ai_execution_failed",
            title=f"AI execution failed ({action_type.value})",
            description=str(exc),
            actor=actor,
            tx_id=tx_id,
            tags=["ai", f"intent:{intent_id}", "failed"],
        )
        return AiExecuteResponse(
            intent_id=intent_id,
            status="failed",
            risk_level=risk,
            execution_mode=mode,
            tx_id=tx_id,
            message=str(exc),
        )
