import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="provider", nullable=False)
    # provider | consumer | both | admin

    # Stripe Connect
    stripe_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)

    # Profile
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    listings: Mapped[list["ResourceListing"]] = relationship(  # noqa: F821
        back_populates="owner", cascade="all, delete-orphan"
    )
    orders_as_buyer: Mapped[list["Order"]] = relationship(  # noqa: F821
        back_populates="buyer", foreign_keys="Order.buyer_id"
    )
    orders_as_seller: Mapped[list["Order"]] = relationship(  # noqa: F821
        back_populates="seller", foreign_keys="Order.seller_id"
    )
