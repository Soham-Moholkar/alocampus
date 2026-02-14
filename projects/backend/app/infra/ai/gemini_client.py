"""Gemini API client wrapper (server-side only)."""

from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings


def _endpoint(model: str, api_key: str) -> str:
    return (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )


async def generate_plan(action_type: str, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("gemini api key is not configured")

    full_prompt = (
        "You are an automation planner for an Algorand campus platform. "
        "Return strict JSON only with keys: summary, steps, risks, suggested_payload. "
        f"Action type: {action_type}. Prompt: {prompt}. Context: {context}"
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": full_prompt},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 800,
        },
    }

    timeout = httpx.Timeout(settings.gemini_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(_endpoint(settings.gemini_model, settings.gemini_api_key), json=payload)
        resp.raise_for_status()
        data = resp.json()

    text = ""
    try:
        candidates = data.get("candidates", [])
        first = candidates[0]
        parts = first["content"]["parts"]
        text = "\n".join(part.get("text", "") for part in parts)
    except Exception:
        text = ""

    return {
        "provider": "gemini",
        "raw": text,
        "response": data,
    }
