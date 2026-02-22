import pytest
from httpx import AsyncClient

from app.models.resource import ResourceType


@pytest.fixture(autouse=True)
async def seed_types(db_session):
    """Seed resource types for listing tests."""
    for slug, name, unit in [
        ("solar", "Solar Export", "kWh"),
        ("bandwidth", "Bandwidth", "GB"),
        ("gpu", "GPU Compute", "GPU-hour"),
    ]:
        db_session.add(ResourceType(
            slug=slug, name=name, unit=unit,
            description=f"{name} resource type", icon="bolt", color="amber",
        ))
    await db_session.commit()


@pytest.mark.asyncio
async def test_create_listing(auth_client: AsyncClient):
    response = await auth_client.post("/api/listings/", json={
        "resource_type": "solar",
        "title": "10kW Solar Array",
        "description": "South-facing panels, peak afternoon export",
        "price_per_unit": 0.08,
        "min_quantity": 5.0,
        "config": {"inverter_brand": "enphase", "capacity_kw": 10},
        "location": "Austin, TX",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "10kW Solar Array"
    assert data["price_per_unit"] == 0.08
    assert data["resource_type"] == "solar"
    assert data["config"]["inverter_brand"] == "enphase"


@pytest.mark.asyncio
async def test_create_listing_invalid_type(auth_client: AsyncClient):
    response = await auth_client.post("/api/listings/", json={
        "resource_type": "nonexistent",
        "title": "Bad Listing",
        "price_per_unit": 1.0,
    })
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_get_my_listings(auth_client: AsyncClient):
    await auth_client.post("/api/listings/", json={
        "resource_type": "gpu",
        "title": "RTX 4090 Compute",
        "price_per_unit": 0.50,
        "config": {"gpu_model": "rtx_4090", "vram_gb": 24},
    })
    response = await auth_client.get("/api/listings/mine")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "RTX 4090 Compute"


@pytest.mark.asyncio
async def test_update_listing(auth_client: AsyncClient):
    create_resp = await auth_client.post("/api/listings/", json={
        "resource_type": "bandwidth",
        "title": "Fiber Bandwidth",
        "price_per_unit": 0.05,
        "config": {"download_mbps": 1000, "upload_mbps": 500},
    })
    listing_id = create_resp.json()["id"]

    response = await auth_client.patch(f"/api/listings/{listing_id}", json={
        "price_per_unit": 0.04,
        "title": "Updated Fiber Bandwidth",
    })
    assert response.status_code == 200
    assert response.json()["price_per_unit"] == 0.04
    assert response.json()["title"] == "Updated Fiber Bandwidth"


@pytest.mark.asyncio
async def test_delete_listing(auth_client: AsyncClient):
    create_resp = await auth_client.post("/api/listings/", json={
        "resource_type": "solar",
        "title": "To Delete",
        "price_per_unit": 0.10,
    })
    listing_id = create_resp.json()["id"]

    response = await auth_client.delete(f"/api/listings/{listing_id}")
    assert response.status_code == 204

    get_resp = await auth_client.get(f"/api/listings/{listing_id}")
    assert get_resp.status_code == 404
