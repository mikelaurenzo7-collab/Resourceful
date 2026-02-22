"""Stripe Connect endpoints — onboarding, callbacks, webhooks."""

import logging

import stripe
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.models.order import Order
from app.api.deps import get_current_user
from app.services.auth import get_user_by_id

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/stripe", tags=["stripe"])


@router.get("/connect")
async def start_stripe_connect(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Connect Express account and redirect to onboarding."""
    if not settings.stripe_secret_key:
        return RedirectResponse(url="/profile", status_code=302)

    stripe.api_key = settings.stripe_secret_key

    db_user = await get_user_by_id(db, user.id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Create Connect account if not already created
    if not db_user.stripe_account_id:
        account = stripe.Account.create(
            type="express",
            country="US",
            email=db_user.email,
            capabilities={
                "card_payments": {"requested": True},
                "transfers": {"requested": True},
            },
        )
        db_user.stripe_account_id = account.id
        await db.flush()
    else:
        account = stripe.Account.retrieve(db_user.stripe_account_id)

    # Create onboarding link
    base_url = str(request.base_url).rstrip("/")
    account_link = stripe.AccountLink.create(
        account=db_user.stripe_account_id,
        refresh_url=f"{base_url}/stripe/refresh",
        return_url=f"{base_url}/stripe/callback",
        type="account_onboarding",
    )

    return RedirectResponse(url=account_link.url, status_code=302)


@router.get("/callback")
async def stripe_callback(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Handle return from Stripe onboarding."""
    if not settings.stripe_secret_key:
        return RedirectResponse(url="/profile", status_code=302)

    stripe.api_key = settings.stripe_secret_key

    db_user = await get_user_by_id(db, user.id)
    if db_user and db_user.stripe_account_id:
        account = stripe.Account.retrieve(db_user.stripe_account_id)
        if account.charges_enabled:
            db_user.stripe_onboarding_complete = True
            await db.flush()
            logger.info("Stripe onboarding complete for user %s", user.id)

    return RedirectResponse(url="/profile", status_code=302)


@router.get("/refresh")
async def stripe_refresh(
    request: Request,
    user: User = Depends(get_current_user),
):
    """Handle Stripe refresh — redirect back to onboarding."""
    return RedirectResponse(url="/stripe/connect", status_code=302)


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Stripe webhook events."""
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        return JSONResponse({"status": "skipped"})

    stripe.api_key = settings.stripe_secret_key
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except (ValueError, stripe.error.SignatureVerificationError):
        logger.warning("Invalid Stripe webhook signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "payment_intent.succeeded":
        order_id = data.get("metadata", {}).get("order_id")
        if order_id:
            from sqlalchemy import select
            result = await db.execute(select(Order).where(Order.id == order_id))
            order = result.scalar_one_or_none()
            if order:
                order.stripe_payment_intent_id = data["id"]
                await db.flush()
                logger.info("Payment succeeded for order %s", order_id)

    elif event_type == "payment_intent.payment_failed":
        order_id = data.get("metadata", {}).get("order_id")
        logger.warning("Payment failed for order %s", order_id)

    elif event_type == "account.updated":
        account_id = data["id"]
        from sqlalchemy import select
        result = await db.execute(
            select(User).where(User.stripe_account_id == account_id)
        )
        user = result.scalar_one_or_none()
        if user and data.get("charges_enabled"):
            user.stripe_onboarding_complete = True
            await db.flush()
            logger.info("Stripe account %s is now active", account_id)

    return JSONResponse({"status": "ok"})
