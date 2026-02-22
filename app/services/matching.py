"""Resource matching engine.

Matches buyers with the best available resource listings based on:
- Resource type
- Location proximity (for solar)
- Price competitiveness
- Provider reliability (rating, verification)
- Availability
"""

import math

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.resource import ResourceListing
from app.services.listings import _listing_to_response
from app.schemas.resource import ListingResponse


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in km."""
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _score_listing(
    listing: ListingResponse,
    buyer_lat: float | None = None,
    buyer_lon: float | None = None,
    max_price: float | None = None,
) -> float:
    """Score a listing for matching. Higher = better match."""
    score = 0.0

    # Verification bonus (+30 points)
    if listing.is_verified:
        score += 30.0

    # Rating score (up to 25 points)
    score += listing.avg_rating * 5.0

    # Track record (up to 20 points)
    score += min(listing.total_orders, 20)

    # Price competitiveness (up to 15 points)
    if max_price and listing.price_per_unit <= max_price:
        ratio = 1 - (listing.price_per_unit / max_price)
        score += ratio * 15.0

    # Proximity bonus for solar (up to 10 points, within 50km)
    if (
        buyer_lat is not None
        and buyer_lon is not None
        and listing.latitude is not None
        and listing.longitude is not None
    ):
        distance = _haversine_distance(buyer_lat, buyer_lon, listing.latitude, listing.longitude)
        if distance <= 50:
            score += (1 - distance / 50) * 10.0

    return round(score, 2)


async def find_matches(
    db: AsyncSession,
    resource_type: str,
    quantity: float,
    buyer_lat: float | None = None,
    buyer_lon: float | None = None,
    max_price: float | None = None,
    limit: int = 10,
) -> list[dict]:
    """Find and rank the best matching listings for a buyer's needs."""
    query = (
        select(ResourceListing)
        .options(
            selectinload(ResourceListing.owner),
            selectinload(ResourceListing.resource_type_rel),
        )
        .where(
            ResourceListing.resource_type == resource_type,
            ResourceListing.is_available == True,  # noqa: E712
            ResourceListing.min_quantity <= quantity,
        )
    )

    result = await db.execute(query)
    listings = result.scalars().all()

    scored = []
    for listing in listings:
        resp = _listing_to_response(listing)
        match_score = _score_listing(resp, buyer_lat, buyer_lon, max_price)
        scored.append({
            "listing": resp,
            "match_score": match_score,
            "distance_km": (
                round(_haversine_distance(buyer_lat, buyer_lon, resp.latitude, resp.longitude), 1)
                if buyer_lat and buyer_lon and resp.latitude and resp.longitude
                else None
            ),
        })

    scored.sort(key=lambda x: x["match_score"], reverse=True)
    return scored[:limit]
