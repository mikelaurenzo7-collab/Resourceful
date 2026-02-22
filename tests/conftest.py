import os

# Force SQLite for tests BEFORE any app imports
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_resourceful.db"
os.environ["DEBUG"] = "true"
os.environ["TESTING"] = "1"

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app
from app.models.resource import ResourceType

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
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Seed resource types
    async with TestSessionLocal() as session:
        session.add_all([
            ResourceType(slug="solar", name="Solar Export", unit="kWh",
                         description="Solar export", icon="sun", color="amber"),
            ResourceType(slug="bandwidth", name="Bandwidth", unit="GB",
                         description="Bandwidth leasing", icon="wifi", color="blue"),
            ResourceType(slug="gpu", name="GPU Compute", unit="GPU-hour",
                         description="GPU compute", icon="cpu", color="purple"),
        ])
        await session.commit()

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
    reg = await client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "testpass123",
        "full_name": "Test User",
        "role": "both",
    })
    assert reg.status_code == 201, f"Register failed: {reg.status_code} {reg.text}"
    token = reg.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client
