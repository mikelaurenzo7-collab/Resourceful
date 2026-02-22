from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.resource import ResourceListing
from app.models.order import Order
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Active listings count
    listings_result = await db.execute(
        select(func.count(ResourceListing.id)).where(
            ResourceListing.user_id == current_user.id,
            ResourceListing.is_available == True,  # noqa: E712
        )
    )
    active_listings = listings_result.scalar() or 0

    # Total revenue
    revenue_result = await db.execute(
        select(func.coalesce(func.sum(Order.seller_payout), 0.0)).where(
            Order.seller_id == current_user.id,
            Order.status == "completed",
        )
    )
    total_revenue = revenue_result.scalar() or 0.0

    # Order counts by status
    pending_result = await db.execute(
        select(func.count(Order.id)).where(
            Order.seller_id == current_user.id,
            Order.status == "pending",
        )
    )
    pending_orders = pending_result.scalar() or 0

    active_orders_result = await db.execute(
        select(func.count(Order.id)).where(
            Order.seller_id == current_user.id,
            Order.status.in_(["accepted", "active"]),
        )
    )
    active_orders = active_orders_result.scalar() or 0

    completed_result = await db.execute(
        select(func.count(Order.id)).where(
            Order.seller_id == current_user.id,
            Order.status == "completed",
        )
    )
    completed_orders = completed_result.scalar() or 0

    # Purchases as buyer
    purchases_result = await db.execute(
        select(func.count(Order.id)).where(Order.buyer_id == current_user.id)
    )
    total_purchases = purchases_result.scalar() or 0

    spent_result = await db.execute(
        select(func.coalesce(func.sum(Order.total_price), 0.0)).where(
            Order.buyer_id == current_user.id,
            Order.status == "completed",
        )
    )
    total_spent = spent_result.scalar() or 0.0

    return {
        "active_listings": active_listings,
        "total_revenue": round(total_revenue, 2),
        "pending_orders": pending_orders,
        "active_orders": active_orders,
        "completed_orders": completed_orders,
        "total_purchases": total_purchases,
        "total_spent": round(total_spent, 2),
    }


@router.get("/recent-activity")
async def get_recent_activity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Recent orders (as seller)
    orders_result = await db.execute(
        select(Order)
        .where(Order.seller_id == current_user.id)
        .order_by(Order.created_at.desc())
        .limit(10)
    )
    recent_orders = orders_result.scalars().all()

    # Recent purchases (as buyer)
    purchases_result = await db.execute(
        select(Order)
        .where(Order.buyer_id == current_user.id)
        .order_by(Order.created_at.desc())
        .limit(10)
    )
    recent_purchases = purchases_result.scalars().all()

    return {
        "recent_orders": [
            {
                "id": o.id,
                "quantity": o.quantity,
                "total_price": o.total_price,
                "status": o.status,
                "created_at": o.created_at.isoformat(),
            }
            for o in recent_orders
        ],
        "recent_purchases": [
            {
                "id": p.id,
                "quantity": p.quantity,
                "total_price": p.total_price,
                "status": p.status,
                "created_at": p.created_at.isoformat(),
            }
            for p in recent_purchases
        ],
    }
