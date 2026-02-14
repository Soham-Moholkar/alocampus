"""Simple in-memory token-bucket rate limiter for FastAPI."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Callable

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response


class _Bucket:
    __slots__ = ("tokens", "last")

    def __init__(self, capacity: float):
        self.tokens = capacity
        self.last = time.monotonic()


class RateLimiter:
    """Per-IP token bucket (configurable capacity + refill rate)."""

    def __init__(self, capacity: float = 20.0, refill_per_sec: float = 2.0):
        self._cap = capacity
        self._rate = refill_per_sec
        self._buckets: dict[str, _Bucket] = defaultdict(lambda: _Bucket(self._cap))

    def allow(self, key: str) -> bool:
        b = self._buckets[key]
        now = time.monotonic()
        elapsed = now - b.last
        b.last = now
        b.tokens = min(self._cap, b.tokens + elapsed * self._rate)
        if b.tokens >= 1.0:
            b.tokens -= 1.0
            return True
        return False


_limiter = RateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Drop-in ASGI middleware — returns 429 when bucket is empty."""

    RATE_LIMITED_PREFIXES = ("/auth/", "/admin/")

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path
        if any(path.startswith(p) for p in self.RATE_LIMITED_PREFIXES):
            ip = request.client.host if request.client else "unknown"
            if not _limiter.allow(ip):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="rate limit exceeded — try again shortly",
                )
        return await call_next(request)
