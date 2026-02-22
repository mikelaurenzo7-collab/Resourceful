from pydantic import BaseModel, Field
from datetime import datetime


class UserCreate(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)
    role: str = Field(default="provider", pattern="^(provider|consumer|both)$")


class UserLogin(BaseModel):
    email: str
    password: str


class UserUpdate(BaseModel):
    full_name: str | None = None
    bio: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    role: str | None = Field(default=None, pattern="^(provider|consumer|both)$")


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    bio: str | None = None
    location: str | None = None
    is_verified: bool = False
    stripe_onboarding_complete: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
