import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    response = await client.post("/api/auth/register", json={
        "email": "newuser@example.com",
        "password": "securepass123",
        "full_name": "New User",
        "role": "provider",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["access_token"]
    assert data["refresh_token"]
    assert data["user"]["email"] == "newuser@example.com"
    assert data["user"]["full_name"] == "New User"
    assert data["user"]["role"] == "provider"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "dup@example.com",
        "password": "securepass123",
        "full_name": "User One",
        "role": "provider",
    })
    response = await client.post("/api/auth/register", json={
        "email": "dup@example.com",
        "password": "securepass123",
        "full_name": "User Two",
        "role": "provider",
    })
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_login(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "login@example.com",
        "password": "securepass123",
        "full_name": "Login User",
        "role": "both",
    })
    response = await client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "securepass123",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"]
    assert data["user"]["email"] == "login@example.com"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "wrong@example.com",
        "password": "securepass123",
        "full_name": "Wrong Pass",
        "role": "both",
    })
    response = await client.post("/api/auth/login", json={
        "email": "wrong@example.com",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me(auth_client: AsyncClient):
    response = await auth_client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["full_name"] == "Test User"


@pytest.mark.asyncio
async def test_get_me_unauthorized(client: AsyncClient):
    response = await client.get("/api/auth/me")
    assert response.status_code == 401
