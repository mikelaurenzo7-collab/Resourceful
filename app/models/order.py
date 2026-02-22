import uuid
from datetime import datetime

from sqlalchemy import String, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    listing_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("resource_listings.id"), nullable=False, index=True
    )
    buyer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    seller_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )

    # Order details
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    total_price: Mapped[float] = mapped_column(Float, nullable=False)
    platform_fee: Mapped[float] = mapped_column(Float, default=0.0)
    seller_payout: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    # Status: pending -> accepted -> active -> completed | cancelled | disputed
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)

    # Stripe
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_transfer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Resource-specific delivery data
    delivery_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Solar: {kwh_delivered, meter_readings: [...]}
    # Bandwidth: {gb_transferred, avg_speed_mbps}
    # GPU: {job_id, runtime_seconds, gpu_utilization}

    # Notes
    buyer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    seller_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    listing: Mapped["ResourceListing"] = relationship(back_populates="orders")  # noqa: F821
    buyer: Mapped["User"] = relationship(  # noqa: F821
        back_populates="orders_as_buyer", foreign_keys=[buyer_id]
    )
    seller: Mapped["User"] = relationship(  # noqa: F821
        back_populates="orders_as_seller", foreign_keys=[seller_id]
    )
