"""Resourceful — Home Resource Broker Platform.

Elite Python stack: FastAPI + SQLAlchemy 2.0 + HTMX + Tailwind CSS.
Transforms idle home assets (solar, bandwidth, GPU) into revenue streams.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.config import get_settings
from app.database import init_db, _get_session_factory
from app.models.resource import ResourceType
from app.api import auth, listings, orders, marketplace, dashboard
from app.api.pages import router as pages_router
from app.api.htmx import router as htmx_router

settings = get_settings()


async def seed_resource_types():
    """Seed the default resource types if they don't exist."""
    defaults = [
        ResourceType(
            slug="solar",
            name="Solar Export",
            description="Sell excess solar energy from your panels to local buyers or grid programs.",
            unit="kWh",
            icon="sun",
            color="amber",
            verification_schema={
                "required": ["capacity_kw"],
                "optional": ["inverter_brand", "panel_count", "meter_id"],
            },
        ),
        ResourceType(
            slug="bandwidth",
            name="Bandwidth",
            description="Lease your unused internet bandwidth to CDN, caching, and edge compute services.",
            unit="GB",
            icon="wifi",
            color="blue",
            verification_schema={
                "required": ["download_mbps", "upload_mbps"],
                "optional": ["isp", "ip_type"],
            },
        ),
        ResourceType(
            slug="gpu",
            name="GPU Compute",
            description="Rent out idle GPU power for AI inference, model training, and rendering workloads.",
            unit="GPU-hour",
            icon="cpu",
            color="purple",
            verification_schema={
                "required": ["gpu_model", "vram_gb"],
                "optional": ["cuda_cores", "driver_version"],
            },
        ),
    ]

    async with _get_session_factory()() as session:
        for rt in defaults:
            existing = await session.execute(
                select(ResourceType).where(ResourceType.slug == rt.slug)
            )
            if not existing.scalar_one_or_none():
                session.add(rt)
        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await seed_resource_types()
    yield
    # Shutdown (cleanup if needed)


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Home resource broker: monetize excess solar, bandwidth, and GPU compute.",
    lifespan=lifespan,
)

# Static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# API routes
app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(orders.router)
app.include_router(marketplace.router)
app.include_router(dashboard.router)

# Page routes (server-rendered HTML)
app.include_router(pages_router)
app.include_router(htmx_router)


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version,
    }
