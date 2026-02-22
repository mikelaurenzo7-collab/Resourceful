import pytest
from httpx import AsyncClient

from app.models.resource import ResourceType


@pytest.fixture(autouse=True)
async def seed_types(db_session):
    for slug, name, unit, color in [
        ("solar", "Solar Export", "kWh", "amber"),
        ("bandwidth", "Bandwidth", "GB", "blue"),
        ("gpu", "GPU Compute", "GPU-hour", "purple"),
    ]:
        db_session.add(ResourceType(
            slug=slug, name=name, unit=unit,
            description=f"{name} resource", icon="bolt", color=color,
        ))
    await db_session.commit()


@pytest.mark.asyncio
async def test_get_resource_types(client: AsyncClient):
    response = await client.get("/api/marketplace/resource-types")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    slugs = {rt["slug"] for rt in data}
    assert slugs == {"solar", "bandwidth", "gpu"}


@pytest.mark.asyncio
async def test_search_listings_empty(client: AsyncClient):
    response = await client.get("/api/marketplace/listings")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["listings"] == []


@pytest.mark.asyncio
async def test_search_listings_with_data(auth_client: AsyncClient):
    # Create a listing
    await auth_client.post("/api/listings/", json={
        "resource_type": "solar",
        "title": "Searchable Solar",
        "price_per_unit": 0.08,
        "description": "Great panels on the roof",
    })

    # Search should find it
    response = await auth_client.get("/api/marketplace/listings?search=solar")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["listings"][0]["title"] == "Searchable Solar"


@pytest.mark.asyncio
async def test_search_filter_by_type(auth_client: AsyncClient):
    await auth_client.post("/api/listings/", json={
        "resource_type": "solar",
        "title": "Solar One",
        "price_per_unit": 0.08,
    })
    await auth_client.post("/api/listings/", json={
        "resource_type": "gpu",
        "title": "GPU One",
        "price_per_unit": 0.50,
    })

    solar_resp = await auth_client.get("/api/marketplace/listings?resource_type=solar")
    assert solar_resp.json()["total"] == 1
    assert solar_resp.json()["listings"][0]["resource_type"] == "solar"

    gpu_resp = await auth_client.get("/api/marketplace/listings?resource_type=gpu")
    assert gpu_resp.json()["total"] == 1
    assert gpu_resp.json()["listings"][0]["resource_type"] == "gpu"


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
