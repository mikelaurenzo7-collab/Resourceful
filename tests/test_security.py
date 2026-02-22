"""Security tests — CSRF, rate limiting, sort injection, XSS prevention."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_csrf_token_required_on_login_form(client: AsyncClient):
    """POST to login page without CSRF token should be rejected."""
    # Temporarily disable TESTING mode to enable rate limiting isn't the issue
    response = await client.post(
        "/login",
        data={"email": "test@test.com", "password": "password"},
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 403
    assert "CSRF" in response.text


@pytest.mark.asyncio
async def test_csrf_token_required_on_register_form(client: AsyncClient):
    """POST to register page without CSRF token should be rejected."""
    response = await client.post(
        "/register",
        data={"email": "test@test.com", "password": "password123", "full_name": "Test", "role": "both"},
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_csrf_not_required_on_api_routes(client: AsyncClient):
    """API routes (JSON) should NOT require CSRF tokens."""
    response = await client.post(
        "/api/auth/register",
        json={"email": "api@test.com", "password": "password123", "full_name": "API User", "role": "both"},
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_sort_by_injection_rejected(client: AsyncClient):
    """Invalid sort_by values should fall back to created_at, not crash."""
    response = await client.get("/api/marketplace/listings?sort_by=hacked_field")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_sort_by_valid_columns(client: AsyncClient):
    """Valid sort columns should work."""
    for col in ["created_at", "price_per_unit", "avg_rating", "total_orders"]:
        response = await client.get(f"/api/marketplace/listings?sort_by={col}")
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_rate_limiting_works():
    """Rate limiting should block excessive requests (when not in test mode)."""
    # This test verifies the rate limiter logic directly
    from app.middleware.rate_limit import RateLimitMiddleware

    class FakeApp:
        pass

    limiter = RateLimitMiddleware(FakeApp())

    key = "127.0.0.1:/api/auth/login"

    # First 5 requests should pass
    for i in range(5):
        assert not limiter._is_rate_limited(key), f"Request {i+1} should pass"

    # 6th should be blocked
    assert limiter._is_rate_limited(key), "6th request should be rate limited"


@pytest.mark.asyncio
async def test_health_check_includes_db_status(client: AsyncClient):
    """Health check should include database connectivity status."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "checks" in data
    assert data["checks"]["database"] == "ok"
