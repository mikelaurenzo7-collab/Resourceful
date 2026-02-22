from datetime import datetime

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.resource import ResourceListing, ResourceType
from app.schemas.resource import ListingCreate, ListingUpdate, ListingResponse, ListingFilter


def _listing_to_response(listing: ResourceListing) -> ListingResponse:
    data = {
        "id": listing.id,
        "user_id": listing.user_id,
        "resource_type": listing.resource_type,
        "title": listing.title,
        "description": listing.description,
        "config": listing.config or {},
        "price_per_unit": listing.price_per_unit,
        "min_quantity": listing.min_quantity,
        "max_quantity": listing.max_quantity,
        "currency": listing.currency,
        "is_available": listing.is_available,
        "available_quantity": listing.available_quantity,
        "availability_schedule": listing.availability_schedule,
        "auto_accept": listing.auto_accept,
        "price_floor": listing.price_floor,
        "is_verified": listing.is_verified,
        "total_orders": listing.total_orders,
        "total_revenue": listing.total_revenue,
        "avg_rating": listing.avg_rating,
        "location": listing.location,
        "latitude": listing.latitude,
        "longitude": listing.longitude,
        "created_at": listing.created_at,
        "updated_at": listing.updated_at,
    }
    if listing.owner:
        data["owner_name"] = listing.owner.full_name
    if listing.resource_type_rel:
        data["resource_type_name"] = listing.resource_type_rel.name
        data["resource_type_unit"] = listing.resource_type_rel.unit
        data["resource_type_icon"] = listing.resource_type_rel.icon
        data["resource_type_color"] = listing.resource_type_rel.color
    return ListingResponse(**data)


async def create_listing(
    db: AsyncSession, user_id: str, data: ListingCreate
) -> ListingResponse:
    # Verify resource type exists
    rt = await db.execute(select(ResourceType).where(ResourceType.slug == data.resource_type))
    if not rt.scalar_one_or_none():
        raise ValueError(f"Unknown resource type: {data.resource_type}")

    listing = ResourceListing(
        user_id=user_id,
        resource_type=data.resource_type,
        title=data.title,
        description=data.description,
        config=data.config,
        price_per_unit=data.price_per_unit,
        min_quantity=data.min_quantity,
        max_quantity=data.max_quantity,
        currency=data.currency,
        availability_schedule=data.availability_schedule,
        auto_accept=data.auto_accept,
        price_floor=data.price_floor,
        location=data.location,
        latitude=data.latitude,
        longitude=data.longitude,
    )
    db.add(listing)
    await db.flush()

    # Reload with relationships
    result = await db.execute(
        select(ResourceListing)
        .options(selectinload(ResourceListing.owner), selectinload(ResourceListing.resource_type_rel))
        .where(ResourceListing.id == listing.id)
    )
    listing = result.scalar_one()
    return _listing_to_response(listing)


async def get_listing(db: AsyncSession, listing_id: str) -> ListingResponse | None:
    result = await db.execute(
        select(ResourceListing)
        .options(selectinload(ResourceListing.owner), selectinload(ResourceListing.resource_type_rel))
        .where(ResourceListing.id == listing_id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        return None
    return _listing_to_response(listing)


async def get_user_listings(db: AsyncSession, user_id: str) -> list[ListingResponse]:
    result = await db.execute(
        select(ResourceListing)
        .options(selectinload(ResourceListing.owner), selectinload(ResourceListing.resource_type_rel))
        .where(ResourceListing.user_id == user_id)
        .order_by(ResourceListing.created_at.desc())
    )
    return [_listing_to_response(row) for row in result.scalars().all()]


async def update_listing(
    db: AsyncSession, listing_id: str, user_id: str, data: ListingUpdate
) -> ListingResponse:
    result = await db.execute(
        select(ResourceListing)
        .options(selectinload(ResourceListing.owner), selectinload(ResourceListing.resource_type_rel))
        .where(ResourceListing.id == listing_id, ResourceListing.user_id == user_id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise ValueError("Listing not found or access denied")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(listing, field, value)
    listing.updated_at = datetime.utcnow()

    await db.flush()
    return _listing_to_response(listing)


async def delete_listing(db: AsyncSession, listing_id: str, user_id: str) -> bool:
    result = await db.execute(
        select(ResourceListing).where(
            ResourceListing.id == listing_id, ResourceListing.user_id == user_id
        )
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise ValueError("Listing not found or access denied")
    await db.delete(listing)
    return True


async def search_listings(
    db: AsyncSession, filters: ListingFilter
) -> tuple[list[ListingResponse], int]:
    query = (
        select(ResourceListing)
        .options(selectinload(ResourceListing.owner), selectinload(ResourceListing.resource_type_rel))
        .where(ResourceListing.is_available == True)  # noqa: E712
    )
    count_query = select(func.count(ResourceListing.id)).where(
        ResourceListing.is_available == True  # noqa: E712
    )

    if filters.resource_type:
        query = query.where(ResourceListing.resource_type == filters.resource_type)
        count_query = count_query.where(ResourceListing.resource_type == filters.resource_type)

    if filters.min_price is not None:
        query = query.where(ResourceListing.price_per_unit >= filters.min_price)
        count_query = count_query.where(ResourceListing.price_per_unit >= filters.min_price)

    if filters.max_price is not None:
        query = query.where(ResourceListing.price_per_unit <= filters.max_price)
        count_query = count_query.where(ResourceListing.price_per_unit <= filters.max_price)

    if filters.is_verified is not None:
        query = query.where(ResourceListing.is_verified == filters.is_verified)
        count_query = count_query.where(ResourceListing.is_verified == filters.is_verified)

    if filters.search:
        search_term = f"%{filters.search}%"
        search_filter = or_(
            ResourceListing.title.ilike(search_term),
            ResourceListing.description.ilike(search_term),
            ResourceListing.location.ilike(search_term),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    # Sorting (whitelist to prevent injection via getattr)
    allowed_sort = {"created_at", "price_per_unit", "avg_rating", "total_orders"}
    sort_field = filters.sort_by if filters.sort_by in allowed_sort else "created_at"
    sort_col = getattr(ResourceListing, sort_field)
    if filters.sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    # Pagination
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (filters.page - 1) * filters.per_page
    query = query.offset(offset).limit(filters.per_page)

    result = await db.execute(query)
    listings = [_listing_to_response(row) for row in result.scalars().all()]

    return listings, total
