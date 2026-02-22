from pydantic import BaseModel, Field
from datetime import datetime


class OrderCreate(BaseModel):
    listing_id: str
    quantity: float = Field(..., gt=0)
    buyer_notes: str | None = None


class OrderUpdate(BaseModel):
    status: str | None = Field(
        default=None, pattern="^(accepted|active|completed|cancelled|disputed)$"
    )
    seller_notes: str | None = None
    delivery_data: dict | None = None


class OrderResponse(BaseModel):
    id: str
    listing_id: str
    buyer_id: str
    seller_id: str
    quantity: float
    unit_price: float
    total_price: float
    platform_fee: float
    seller_payout: float
    currency: str
    status: str
    delivery_data: dict | None = None
    buyer_notes: str | None = None
    seller_notes: str | None = None
    created_at: datetime
    accepted_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None

    # Joined fields
    listing_title: str | None = None
    buyer_name: str | None = None
    seller_name: str | None = None
    resource_type: str | None = None

    model_config = {"from_attributes": True}
