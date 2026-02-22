"""HTMX partial endpoints — return HTML fragments, not full pages."""

from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.resource import ResourceListing
from app.models.order import Order
from app.schemas.resource import ListingFilter
from app.services import listings as listing_service
from app.api.deps import get_current_user, get_optional_user

router = APIRouter(prefix="/htmx", tags=["htmx"])
templates = Jinja2Templates(directory="app/templates")


@router.get("/dashboard/stats", response_class=HTMLResponse)
async def dashboard_stats(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Active listings
    listings_result = await db.execute(
        select(func.count(ResourceListing.id)).where(
            ResourceListing.user_id == user.id,
            ResourceListing.is_available == True,  # noqa: E712
        )
    )
    active_listings = listings_result.scalar() or 0

    # Revenue
    revenue_result = await db.execute(
        select(func.coalesce(func.sum(Order.seller_payout), 0.0)).where(
            Order.seller_id == user.id, Order.status == "completed"
        )
    )
    total_revenue = revenue_result.scalar() or 0.0

    # Pending orders
    pending_result = await db.execute(
        select(func.count(Order.id)).where(
            Order.seller_id == user.id, Order.status == "pending"
        )
    )
    pending_orders = pending_result.scalar() or 0

    # Completed
    completed_result = await db.execute(
        select(func.count(Order.id)).where(
            Order.seller_id == user.id, Order.status == "completed"
        )
    )
    completed_orders = completed_result.scalar() or 0

    stats = {
        "active_listings": active_listings,
        "total_revenue": total_revenue,
        "pending_orders": pending_orders,
        "completed_orders": completed_orders,
    }
    return templates.TemplateResponse(
        "components/stats_cards.html", {"request": request, "stats": stats}
    )


@router.get("/dashboard/listings", response_class=HTMLResponse)
async def dashboard_listings(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    listings = await listing_service.get_user_listings(db, user.id)
    html_parts = []
    if listings:
        for listing in listings[:5]:
            color = {"solar": "amber", "bandwidth": "blue", "gpu": "purple"}.get(listing.resource_type, "gray")
            html_parts.append(f"""
            <div class="bg-gray-800 rounded-lg p-4 flex items-center justify-between animate-fade-in">
                <div class="flex items-center space-x-3">
                    <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-{color}-400/10 text-{color}-400 ring-1 ring-inset ring-{color}-400/30">
                        {listing.resource_type}
                    </span>
                    <div>
                        <div class="text-white text-sm font-medium">{listing.title}</div>
                        <div class="text-gray-500 text-xs">${listing.price_per_unit:.2f}/{listing.resource_type_unit or 'unit'}</div>
                    </div>
                </div>
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs {'text-green-400 bg-green-400/10' if listing.is_available else 'text-red-400 bg-red-400/10'}">
                    {'Active' if listing.is_available else 'Inactive'}
                </span>
            </div>""")
        return HTMLResponse("".join(html_parts))
    else:
        return HTMLResponse("""
        <div class="text-center py-8">
            <p class="text-gray-500 text-sm">No listings yet. Create your first one!</p>
            <a href="/listings/new" class="mt-2 inline-block text-brand-400 hover:text-brand-300 text-sm font-medium">+ Create Listing</a>
        </div>""")


@router.get("/dashboard/orders", response_class=HTMLResponse)
async def dashboard_orders(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services import orders as order_service
    orders = await order_service.get_user_orders(db, user.id, "seller")
    html_parts = []
    if orders:
        for order in orders[:5]:
            status_colors = {
                "pending": "yellow", "accepted": "blue", "active": "blue",
                "completed": "green", "cancelled": "red",
            }
            color = status_colors.get(order.status, "gray")
            html_parts.append(f"""
            <div class="bg-gray-800 rounded-lg p-4 flex items-center justify-between animate-fade-in">
                <div>
                    <div class="text-white text-sm font-medium">{order.listing_title or 'Order'}</div>
                    <div class="text-gray-500 text-xs">{order.quantity} units &middot; ${order.total_price:.2f}</div>
                </div>
                <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-{color}-400/10 text-{color}-400">
                    {order.status.title()}
                </span>
            </div>""")
        return HTMLResponse("".join(html_parts))
    else:
        return HTMLResponse("""
        <div class="text-center py-8">
            <p class="text-gray-500 text-sm">No orders yet.</p>
        </div>""")


@router.get("/marketplace/listings", response_class=HTMLResponse)
async def marketplace_listings(
    request: Request,
    resource_type: str | None = None,
    search: str | None = None,
    sort_by: str = "created_at",
    page: int = Query(default=1, ge=1),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    filters = ListingFilter(
        resource_type=resource_type,
        search=search,
        sort_by=sort_by,
        page=page,
    )
    listings, total = await listing_service.search_listings(db, filters)

    if listings:
        html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">'
        for listing in listings:
            html += templates.get_template("components/listing_card.html").render(
                listing=listing, request=request
            )
        html += "</div>"

        if total > filters.per_page:
            pages = (total + filters.per_page - 1) // filters.per_page
            html += f'<div class="mt-6 text-center text-gray-400 text-sm">Page {page} of {pages} ({total} listings)</div>'

        return HTMLResponse(html)
    else:
        return HTMLResponse("""
        <div class="text-center py-16">
            <svg class="mx-auto h-12 w-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <h3 class="mt-2 text-sm font-medium text-white">No listings found</h3>
            <p class="mt-1 text-sm text-gray-400">Try adjusting your filters or check back later.</p>
        </div>""")


@router.get("/listing-config/{resource_type}", response_class=HTMLResponse)
async def listing_config_fields(request: Request, resource_type: str):
    template_map = {
        "solar": "components/config_solar.html",
        "bandwidth": "components/config_bandwidth.html",
        "gpu": "components/config_gpu.html",
    }
    template_name = template_map.get(resource_type, "components/config_solar.html")
    return templates.TemplateResponse(template_name, {"request": request})
