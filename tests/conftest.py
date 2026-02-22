import os

# Force SQLite for tests BEFORE any app imports
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_resourceful.db"

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite+aiosqlite:///./test_resourceful.db"

engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient):
    """Client with authenticated user."""
    await client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "testpass123",
        "full_name": "Test User",
        "role": "both",
    })
    response = await client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "testpass123",
    })
    token = response.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client
