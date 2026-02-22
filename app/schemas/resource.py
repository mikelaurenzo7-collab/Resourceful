from pydantic import BaseModel, Field
from datetime import datetime


class ResourceTypeResponse(BaseModel):
    slug: str
    name: str
    description: str
    unit: str
    icon: str
    color: str
    is_active: bool

    model_config = {"from_attributes": True}


class ListingCreate(BaseModel):
    resource_type: str = Field(..., min_length=1)
    title: str = Field(..., min_length=3, max_length=255)
    description: str | None = None
    config: dict = Field(default_factory=dict)
    price_per_unit: float = Field(..., gt=0)
    min_quantity: float = Field(default=1.0, gt=0)
    max_quantity: float | None = None
    currency: str = Field(default="USD", max_length=3)
    availability_schedule: dict | None = None
    auto_accept: bool = False
    price_floor: float | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class ListingUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    config: dict | None = None
    price_per_unit: float | None = Field(default=None, gt=0)
    min_quantity: float | None = Field(default=None, gt=0)
    max_quantity: float | None = None
    is_available: bool | None = None
    available_quantity: float | None = None
    availability_schedule: dict | None = None
    auto_accept: bool | None = None
    price_floor: float | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class ListingResponse(BaseModel):
    id: str
    user_id: str
    resource_type: str
    title: str
    description: str | None = None
    config: dict = {}
    price_per_unit: float
    min_quantity: float
    max_quantity: float | None = None
    currency: str = "USD"
    is_available: bool
    available_quantity: float
    availability_schedule: dict | None = None
    auto_accept: bool
    price_floor: float | None = None
    is_verified: bool
    total_orders: int
    total_revenue: float
    avg_rating: float
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    created_at: datetime
    updated_at: datetime

    # Joined fields
    owner_name: str | None = None
    resource_type_name: str | None = None
    resource_type_unit: str | None = None
    resource_type_icon: str | None = None
    resource_type_color: str | None = None

    model_config = {"from_attributes": True}


class ListingFilter(BaseModel):
    resource_type: str | None = None
    min_price: float | None = None
    max_price: float | None = None
    location: str | None = None
    is_verified: bool | None = None
    search: str | None = None
    sort_by: str = "created_at"
    sort_order: str = "desc"
    page: int = 1
    per_page: int = 20
