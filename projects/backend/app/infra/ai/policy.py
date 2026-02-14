"""Risk policy for AI execution."""

from __future__ import annotations

from app.domain.models import AiActionType, AiExecutionMode, AiRiskLevel


LOW_RISK_ACTIONS = {
    AiActionType.FACULTY_POLL,
    AiActionType.FACULTY_SESSION,
}


def infer_risk(action_type: AiActionType) -> AiRiskLevel:
    if action_type in LOW_RISK_ACTIONS:
        return AiRiskLevel.LOW
    if action_type == AiActionType.FACULTY_CERT:
        return AiRiskLevel.HIGH
    if action_type == AiActionType.ADMIN_ROLE_RISK:
        return AiRiskLevel.HIGH
    if action_type == AiActionType.ADMIN_SYSTEM:
        return AiRiskLevel.MEDIUM
    return AiRiskLevel.MEDIUM


def execution_mode(action_type: AiActionType, auto_execute_requested: bool, auto_execute_enabled: bool) -> AiExecutionMode:
    if auto_execute_requested and auto_execute_enabled and action_type in LOW_RISK_ACTIONS:
        return AiExecutionMode.AUTO
    return AiExecutionMode.APPROVAL_REQUIRED
