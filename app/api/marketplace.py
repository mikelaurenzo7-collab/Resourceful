from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.resource import ResourceType
from app.schemas.resource import ResourceTypeResponse, ListingResponse, ListingFilter
from app.services import listings as listing_service
from app.services import matching as matching_service

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])


@router.get("/resource-types", response_model=list[ResourceTypeResponse])
async def get_resource_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ResourceType).where(ResourceType.is_active == True).order_by(ResourceType.name)  # noqa: E712
    )
    return [ResourceTypeResponse.model_validate(rt) for rt in result.scalars().all()]


@router.get("/listings")
async def search_listings(
    resource_type: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    location: str | None = None,
    is_verified: bool | None = None,
    search: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    filters = ListingFilter(
        resource_type=resource_type,
        min_price=min_price,
        max_price=max_price,
        location=location,
        is_verified=is_verified,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )
    listings, total = await listing_service.search_listings(db, filters)
    return {
        "listings": listings,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if per_page else 0,
    }


@router.get("/match")
async def find_matches(
    resource_type: str = Query(...),
    quantity: float = Query(..., gt=0),
    latitude: float | None = None,
    longitude: float | None = None,
    max_price: float | None = None,
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    matches = await matching_service.find_matches(
        db,
        resource_type=resource_type,
        quantity=quantity,
        buyer_lat=latitude,
        buyer_lon=longitude,
        max_price=max_price,
        limit=limit,
    )
    return {"matches": matches, "total": len(matches)}
