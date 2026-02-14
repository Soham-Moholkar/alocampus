"""Deterministic fallback planner when AI provider is disabled/unavailable."""

from __future__ import annotations

from typing import Any


def build_plan(action_type: str, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
    return {
        "provider": "fallback",
        "action": action_type,
        "summary": prompt[:240],
        "steps": [
            "Validate role permissions",
            "Validate payload against smart-contract constraints",
            "Submit on-chain transaction via BFF service",
            "Track transaction status and persist audit event",
        ],
        "context": context,
    }
