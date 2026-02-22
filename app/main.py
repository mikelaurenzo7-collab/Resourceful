"""Resourceful — Home Resource Broker Platform.

Elite Python stack: FastAPI + SQLAlchemy 2.0 + HTMX + Tailwind CSS.
Transforms idle home assets (solar, bandwidth, GPU) into revenue streams.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import select

from app.config import get_settings
from app.database import init_db, _get_session_factory
from app.models.resource import ResourceType
from app.api import auth, listings, orders, marketplace, dashboard
from app.api.stripe import router as stripe_router
from app.api.pages import router as pages_router
from app.api.htmx import router as htmx_router
from app.middleware.csrf import CSRFMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.logging_config import setup_logging

settings = get_settings()
setup_logging(debug=settings.debug)
logger = logging.getLogger(__name__)


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
    logger.info("Resourceful started — %s v%s", settings.app_name, settings.app_version)
    yield
    # Shutdown
    logger.info("Resourceful shutting down")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Home resource broker: monetize excess solar, bandwidth, and GPU compute.",
    lifespan=lifespan,
)

# Security middleware
app.add_middleware(CSRFMiddleware)
app.add_middleware(RateLimitMiddleware)

# Static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# API routes
app.include_router(auth.router)
app.include_router(listings.router)
app.include_router(orders.router)
app.include_router(marketplace.router)
app.include_router(dashboard.router)

# Stripe routes
app.include_router(stripe_router)

# Page routes (server-rendered HTML)
app.include_router(pages_router)
app.include_router(htmx_router)

# Error page templates
_error_templates = Jinja2Templates(directory="app/templates")


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        return _error_templates.TemplateResponse(
            "errors/404.html", {"request": request, "user": None}, status_code=404
        )
    return JSONResponse(status_code=404, content={"detail": "Not found"})


@app.exception_handler(500)
async def server_error_handler(request: Request, exc):
    logger.exception("Internal server error: %s", exc)
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        return _error_templates.TemplateResponse(
            "errors/500.html", {"request": request, "user": None}, status_code=500
        )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health")
async def health_check():
    from app.database import get_db
    from sqlalchemy import text

    health = {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version,
        "checks": {},
    }

    # Database check
    try:
        async for db in get_db():
            await db.execute(text("SELECT 1"))
            health["checks"]["database"] = "ok"
    except Exception as e:
        health["status"] = "degraded"
        health["checks"]["database"] = f"error: {e}"

    # Stripe check
    health["checks"]["stripe"] = "configured" if settings.stripe_secret_key else "not configured"

    return health
