"""Simple in-memory rate limiter for auth endpoints."""

import os
import time
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

# Rate limit: max_requests per window_seconds
MAX_REQUESTS = 5
WINDOW_SECONDS = 60
RATE_LIMITED_PREFIXES = ("/api/auth/login", "/api/auth/register", "/login", "/register")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limit auth endpoints by client IP."""

    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[str, list[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _is_rate_limited(self, key: str) -> bool:
        now = time.monotonic()
        # Prune old entries
        self._hits[key] = [t for t in self._hits[key] if now - t < WINDOW_SECONDS]
        if len(self._hits[key]) >= MAX_REQUESTS:
            return True
        self._hits[key].append(now)
        return False

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method != "POST":
            return await call_next(request)

        # Skip rate limiting in test/debug mode
        if os.environ.get("TESTING") == "1":
            return await call_next(request)

        path = request.url.path
        if not any(path.startswith(prefix) for prefix in RATE_LIMITED_PREFIXES):
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        key = f"{client_ip}:{path}"

        if self._is_rate_limited(key):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
            )

        return await call_next(request)
