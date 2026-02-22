"""Order lifecycle tests — full state machine transitions."""

import pytest
from httpx import AsyncClient


async def _setup_order(client: AsyncClient) -> tuple[str, str, str, str]:
    """Create seller, listing, buyer, and a pending order. Returns (seller_token, buyer_token, listing_id, order_id)."""
    # Register seller
    seller = await client.post("/api/auth/register", json={
        "email": "seller@lifecycle.com",
        "password": "sellerpass123",
        "full_name": "Seller",
        "role": "provider",
    })
    seller_token = seller.json()["access_token"]

    # Create listing
    client.headers["Authorization"] = f"Bearer {seller_token}"
    listing = await client.post("/api/listings/", json={
        "resource_type": "solar",
        "title": "Lifecycle Test Solar",
        "price_per_unit": 0.10,
        "min_quantity": 1.0,
    })
    listing_id = listing.json()["id"]

    # Register buyer
    buyer = await client.post("/api/auth/register", json={
        "email": "buyer@lifecycle.com",
        "password": "buyerpass123",
        "full_name": "Buyer",
        "role": "consumer",
    })
    buyer_token = buyer.json()["access_token"]

    # Create order
    client.headers["Authorization"] = f"Bearer {buyer_token}"
    order = await client.post("/api/orders/", json={
        "listing_id": listing_id,
        "quantity": 10.0,
    })
    order_id = order.json()["id"]

    return seller_token, buyer_token, listing_id, order_id


@pytest.mark.asyncio
async def test_order_accept(client: AsyncClient):
    """Seller can accept a pending order."""
    seller_token, buyer_token, listing_id, order_id = await _setup_order(client)

    client.headers["Authorization"] = f"Bearer {seller_token}"
    response = await client.patch(f"/api/orders/{order_id}", json={"status": "accepted"})
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
    assert response.json()["accepted_at"] is not None


@pytest.mark.asyncio
async def test_order_full_lifecycle(client: AsyncClient):
    """Order goes through: pending -> accepted -> active -> completed."""
    seller_token, buyer_token, listing_id, order_id = await _setup_order(client)

    # Seller accepts
    client.headers["Authorization"] = f"Bearer {seller_token}"
    r = await client.patch(f"/api/orders/{order_id}", json={"status": "accepted"})
    assert r.json()["status"] == "accepted"

    # Seller activates
    r = await client.patch(f"/api/orders/{order_id}", json={"status": "active"})
    assert r.json()["status"] == "active"

    # Seller completes
    r = await client.patch(f"/api/orders/{order_id}", json={"status": "completed"})
    assert r.json()["status"] == "completed"
    assert r.json()["completed_at"] is not None


@pytest.mark.asyncio
async def test_buyer_cannot_accept(client: AsyncClient):
    """Buyer cannot accept their own order — only seller can."""
    seller_token, buyer_token, listing_id, order_id = await _setup_order(client)

    client.headers["Authorization"] = f"Bearer {buyer_token}"
    response = await client.patch(f"/api/orders/{order_id}", json={"status": "accepted"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_buyer_can_cancel(client: AsyncClient):
    """Buyer can cancel a pending order."""
    seller_token, buyer_token, listing_id, order_id = await _setup_order(client)

    client.headers["Authorization"] = f"Bearer {buyer_token}"
    response = await client.patch(f"/api/orders/{order_id}", json={"status": "cancelled"})
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    assert response.json()["cancelled_at"] is not None


@pytest.mark.asyncio
async def test_invalid_transition(client: AsyncClient):
    """Cannot skip from pending directly to completed."""
    seller_token, buyer_token, listing_id, order_id = await _setup_order(client)

    client.headers["Authorization"] = f"Bearer {seller_token}"
    response = await client.patch(f"/api/orders/{order_id}", json={"status": "completed"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_seller_notes(client: AsyncClient):
    """Seller can add notes to an order."""
    seller_token, buyer_token, listing_id, order_id = await _setup_order(client)

    client.headers["Authorization"] = f"Bearer {seller_token}"
    response = await client.patch(f"/api/orders/{order_id}", json={
        "status": "accepted",
        "seller_notes": "Will deliver by noon",
    })
    assert response.status_code == 200
    assert response.json()["seller_notes"] == "Will deliver by noon"
