import pytest
from httpx import AsyncClient

from app.models.resource import ResourceType


@pytest.fixture(autouse=True)
async def seed_types(db_session):
    db_session.add(ResourceType(
        slug="solar", name="Solar", unit="kWh",
        description="Solar export", icon="sun", color="amber",
    ))
    await db_session.commit()


async def _create_seller(client: AsyncClient) -> tuple[str, str]:
    """Create a seller user and return (token, listing_id)."""
    reg = await client.post("/api/auth/register", json={
        "email": "seller@example.com",
        "password": "sellerpass123",
        "full_name": "Seller User",
        "role": "provider",
    })
    token = reg.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"

    listing = await client.post("/api/listings/", json={
        "resource_type": "solar",
        "title": "Test Solar",
        "price_per_unit": 0.10,
        "min_quantity": 1.0,
        "auto_accept": False,
    })
    listing_id = listing.json()["id"]
    return token, listing_id


@pytest.mark.asyncio
async def test_create_order(client: AsyncClient):
    seller_token, listing_id = await _create_seller(client)

    # Register buyer
    buyer = await client.post("/api/auth/register", json={
        "email": "buyer@example.com",
        "password": "buyerpass123",
        "full_name": "Buyer User",
        "role": "consumer",
    })
    buyer_token = buyer.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {buyer_token}"

    response = await client.post("/api/orders/", json={
        "listing_id": listing_id,
        "quantity": 10.0,
        "buyer_notes": "Need this ASAP",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["quantity"] == 10.0
    assert data["total_price"] == 1.0  # 10 * 0.10
    assert data["status"] == "pending"
    assert data["platform_fee"] == 0.08  # 8% of 1.0
    assert data["seller_payout"] == 0.92


@pytest.mark.asyncio
async def test_cannot_buy_own_listing(client: AsyncClient):
    seller_token, listing_id = await _create_seller(client)
    client.headers["Authorization"] = f"Bearer {seller_token}"

    response = await client.post("/api/orders/", json={
        "listing_id": listing_id,
        "quantity": 5.0,
    })
    assert response.status_code == 400
    assert "own listing" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_auto_accept_order(client: AsyncClient):
    # Create seller with auto_accept
    reg = await client.post("/api/auth/register", json={
        "email": "auto@example.com",
        "password": "autopass123",
        "full_name": "Auto Seller",
        "role": "provider",
    })
    token = reg.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"

    listing = await client.post("/api/listings/", json={
        "resource_type": "solar",
        "title": "Auto Accept Solar",
        "price_per_unit": 0.05,
        "auto_accept": True,
    })
    listing_id = listing.json()["id"]

    # Register buyer
    buyer = await client.post("/api/auth/register", json={
        "email": "autobuyer@example.com",
        "password": "buyerpass123",
        "full_name": "Auto Buyer",
        "role": "consumer",
    })
    client.headers["Authorization"] = f"Bearer {buyer.json()['access_token']}"

    response = await client.post("/api/orders/", json={
        "listing_id": listing_id,
        "quantity": 20.0,
    })
    assert response.status_code == 201
    assert response.json()["status"] == "accepted"
