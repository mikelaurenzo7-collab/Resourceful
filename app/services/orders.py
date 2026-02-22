import logging
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.order import Order
from app.models.resource import ResourceListing
from app.schemas.order import OrderCreate, OrderUpdate, OrderResponse
from app.services import payments as payment_service

logger = logging.getLogger(__name__)
settings = get_settings()


def _order_to_response(order: Order) -> OrderResponse:
    data = {
        "id": order.id,
        "listing_id": order.listing_id,
        "buyer_id": order.buyer_id,
        "seller_id": order.seller_id,
        "quantity": float(order.quantity),
        "unit_price": float(order.unit_price),
        "total_price": float(order.total_price),
        "platform_fee": float(order.platform_fee),
        "seller_payout": float(order.seller_payout),
        "currency": order.currency,
        "status": order.status,
        "delivery_data": order.delivery_data,
        "buyer_notes": order.buyer_notes,
        "seller_notes": order.seller_notes,
        "created_at": order.created_at,
        "accepted_at": order.accepted_at,
        "completed_at": order.completed_at,
        "cancelled_at": order.cancelled_at,
    }
    if order.listing:
        data["listing_title"] = order.listing.title
        data["resource_type"] = order.listing.resource_type
    if order.buyer:
        data["buyer_name"] = order.buyer.full_name
    if order.seller:
        data["seller_name"] = order.seller.full_name
    return OrderResponse(**data)


async def create_order(db: AsyncSession, buyer_id: str, data: OrderCreate) -> OrderResponse:
    # Get listing with owner
    result = await db.execute(
        select(ResourceListing)
        .options(selectinload(ResourceListing.owner))
        .where(ResourceListing.id == data.listing_id)
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise ValueError("Listing not found")

    if not listing.is_available:
        raise ValueError("Listing is not currently available")

    if listing.user_id == buyer_id:
        raise ValueError("Cannot purchase your own listing")

    if data.quantity < listing.min_quantity:
        raise ValueError(f"Minimum quantity is {listing.min_quantity}")

    if listing.max_quantity and data.quantity > listing.max_quantity:
        raise ValueError(f"Maximum quantity is {listing.max_quantity}")

    # Calculate pricing with Decimal precision
    price = Decimal(str(listing.price_per_unit))
    qty = Decimal(str(data.quantity))
    total_price = round(float(qty * price), 2)
    platform_fee = round(total_price * (settings.platform_fee_percent / 100), 2)
    seller_payout = round(total_price - platform_fee, 2)

    # Determine initial status
    initial_status = "accepted" if listing.auto_accept else "pending"

    order = Order(
        listing_id=listing.id,
        buyer_id=buyer_id,
        seller_id=listing.user_id,
        quantity=data.quantity,
        unit_price=float(price),
        total_price=total_price,
        platform_fee=platform_fee,
        seller_payout=seller_payout,
        currency=listing.currency,
        status=initial_status,
        buyer_notes=data.buyer_notes,
        accepted_at=datetime.utcnow() if listing.auto_accept else None,
    )
    db.add(order)

    # Update listing metrics
    listing.total_orders += 1

    await db.flush()

    # Create Stripe PaymentIntent if Stripe is configured
    if settings.stripe_secret_key and listing.owner:
        try:
            amount_cents = int(total_price * 100)
            pi = await payment_service.create_payment_intent(
                amount_cents=amount_cents,
                currency=listing.currency,
                seller_stripe_account_id=listing.owner.stripe_account_id,
                metadata={"order_id": order.id, "listing_id": listing.id},
            )
            order.stripe_payment_intent_id = pi.get("id")
            await db.flush()
            logger.info("PaymentIntent %s created for order %s", pi.get("id"), order.id)
        except Exception:
            logger.exception("Failed to create PaymentIntent for order %s", order.id)

    # Reload with relationships
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.listing),
            selectinload(Order.buyer),
            selectinload(Order.seller),
        )
        .where(Order.id == order.id)
    )
    order = result.scalar_one()
    return _order_to_response(order)


async def get_order(db: AsyncSession, order_id: str, user_id: str) -> OrderResponse | None:
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.listing),
            selectinload(Order.buyer),
            selectinload(Order.seller),
        )
        .where(
            Order.id == order_id,
            or_(Order.buyer_id == user_id, Order.seller_id == user_id),
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        return None
    return _order_to_response(order)


async def get_user_orders(
    db: AsyncSession, user_id: str, role: str = "all", status: str | None = None
) -> list[OrderResponse]:
    query = (
        select(Order)
        .options(
            selectinload(Order.listing),
            selectinload(Order.buyer),
            selectinload(Order.seller),
        )
    )

    if role == "buyer":
        query = query.where(Order.buyer_id == user_id)
    elif role == "seller":
        query = query.where(Order.seller_id == user_id)
    else:
        query = query.where(or_(Order.buyer_id == user_id, Order.seller_id == user_id))

    if status:
        query = query.where(Order.status == status)

    query = query.order_by(Order.created_at.desc())
    result = await db.execute(query)
    return [_order_to_response(o) for o in result.scalars().all()]


async def update_order(
    db: AsyncSession, order_id: str, user_id: str, data: OrderUpdate
) -> OrderResponse:
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.listing),
            selectinload(Order.buyer),
            selectinload(Order.seller),
        )
        .where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise ValueError("Order not found")

    # Validate permissions based on status transition
    if data.status:
        _validate_status_transition(order, data.status, user_id)

        order.status = data.status
        if data.status == "accepted":
            order.accepted_at = datetime.utcnow()
        elif data.status == "completed":
            order.completed_at = datetime.utcnow()
            # Update listing revenue
            if order.listing:
                order.listing.total_revenue = float(
                    Decimal(str(order.listing.total_revenue)) + Decimal(str(order.seller_payout))
                )
            # Create Stripe transfer to seller
            if settings.stripe_secret_key and order.seller and order.seller.stripe_account_id:
                try:
                    payout_cents = int(float(order.seller_payout) * 100)
                    transfer = await payment_service.create_transfer(
                        amount_cents=payout_cents,
                        destination_account_id=order.seller.stripe_account_id,
                        transfer_group=order.id,
                    )
                    order.stripe_transfer_id = transfer.get("id")
                    logger.info("Transfer %s created for order %s", transfer.get("id"), order.id)
                except Exception:
                    logger.exception("Failed to create transfer for order %s", order.id)
        elif data.status == "cancelled":
            order.cancelled_at = datetime.utcnow()

    if data.seller_notes is not None and order.seller_id == user_id:
        order.seller_notes = data.seller_notes

    if data.delivery_data is not None and order.seller_id == user_id:
        order.delivery_data = data.delivery_data

    await db.flush()
    return _order_to_response(order)


def _validate_status_transition(order: Order, new_status: str, user_id: str):
    valid_transitions = {
        "pending": {"accepted", "cancelled"},
        "accepted": {"active", "cancelled"},
        "active": {"completed", "cancelled", "disputed"},
        "completed": set(),
        "cancelled": set(),
        "disputed": {"completed", "cancelled"},
    }

    if new_status not in valid_transitions.get(order.status, set()):
        raise ValueError(f"Cannot transition from '{order.status}' to '{new_status}'")

    # Seller can accept/complete, buyer can cancel/dispute
    seller_actions = {"accepted", "active", "completed"}
    buyer_actions = {"cancelled", "disputed"}

    if new_status in seller_actions and order.seller_id != user_id:
        raise ValueError("Only the seller can perform this action")
    if new_status in buyer_actions and order.buyer_id != user_id:
        raise ValueError("Only the buyer can perform this action")
