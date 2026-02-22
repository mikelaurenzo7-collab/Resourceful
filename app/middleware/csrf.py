"""CSRF protection middleware using itsdangerous for token signing."""

import secrets

from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, HTMLResponse

from app.config import get_settings

SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
EXEMPT_PATHS = {"/api/stripe/webhook"}  # Stripe sends its own signature


def _get_serializer() -> URLSafeTimedSerializer:
    settings = get_settings()
    return URLSafeTimedSerializer(settings.secret_key, salt="csrf-token")


def generate_csrf_token() -> str:
    """Generate a signed CSRF token."""
    s = _get_serializer()
    return s.dumps(secrets.token_hex(16))


def validate_csrf_token(token: str, max_age: int = 3600) -> bool:
    """Validate a signed CSRF token (valid for 1 hour by default)."""
    s = _get_serializer()
    try:
        s.loads(token, max_age=max_age)
        return True
    except (BadSignature, SignatureExpired):
        return False


class CSRFMiddleware(BaseHTTPMiddleware):
    """Validate CSRF tokens on state-changing requests to page routes."""

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip safe methods
        if request.method in SAFE_METHODS:
            return await call_next(request)

        # Skip API routes (they use JWT auth, not cookies)
        path = request.url.path
        if path.startswith("/api/"):
            return await call_next(request)

        # Skip exempt paths
        if path in EXEMPT_PATHS:
            return await call_next(request)

        # Validate CSRF token on form submissions
        content_type = request.headers.get("content-type", "")
        if "form" in content_type or "multipart" in content_type:
            form = await request.form()
            token = form.get("csrf_token", "")
            if not token or not validate_csrf_token(token):
                return HTMLResponse(
                    content="<h1>403 Forbidden</h1><p>Invalid or missing CSRF token. Please go back and try again.</p>",
                    status_code=403,
                )

        return await call_next(request)
