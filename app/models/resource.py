import uuid
from datetime import datetime

from sqlalchemy import String, Float, Boolean, DateTime, Text, ForeignKey, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ResourceType(Base):
    __tablename__ = "resource_types"

    slug: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)  # kWh, GB, GPU-hour
    icon: Mapped[str] = mapped_column(String(50), default="bolt")
    color: Mapped[str] = mapped_column(String(20), default="amber")
    verification_schema: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    listings: Mapped[list["ResourceListing"]] = relationship(back_populates="resource_type_rel")


class ResourceListing(Base):
    __tablename__ = "resource_listings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    resource_type: Mapped[str] = mapped_column(
        String(50), ForeignKey("resource_types.slug"), nullable=False, index=True
    )

    # Listing details
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Type-specific configuration (polymorphic via JSON)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    # Solar: {inverter_brand, panel_count, capacity_kw, meter_id}
    # Bandwidth: {isp, download_mbps, upload_mbps, ip_type}
    # GPU: {gpu_model, vram_gb, cuda_cores, driver_version}

    # Pricing
    price_per_unit: Mapped[float] = mapped_column(Float, nullable=False)
    min_quantity: Mapped[float] = mapped_column(Float, default=1.0)
    max_quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    # Availability
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    available_quantity: Mapped[float] = mapped_column(Float, default=0.0)
    availability_schedule: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # {monday: {start: "08:00", end: "18:00"}, ...}

    # Automation
    automation_rules: Mapped[dict] = mapped_column(JSON, default=dict)
    # {auto_accept: bool, price_floor: float, max_daily_orders: int}
    auto_accept: Mapped[bool] = mapped_column(Boolean, default=False)
    price_floor: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Verification
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Metrics
    total_orders: Mapped[int] = mapped_column(Integer, default=0)
    total_revenue: Mapped[float] = mapped_column(Float, default=0.0)
    avg_rating: Mapped[float] = mapped_column(Float, default=0.0)

    # Location (for solar, proximity matching)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="listings")  # noqa: F821
    resource_type_rel: Mapped["ResourceType"] = relationship(back_populates="listings")
    orders: Mapped[list["Order"]] = relationship(  # noqa: F821
        back_populates="listing", cascade="all, delete-orphan"
    )
