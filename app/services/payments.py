"""Stripe Connect payment integration.

This module handles:
- Provider onboarding (Stripe Connect Express accounts)
- Payment intent creation for orders
- Transfer/payout to providers after order completion
- Webhook handling for payment events
"""

import stripe

from app.config import get_settings

settings = get_settings()

if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key


async def create_connect_account(email: str, country: str = "US") -> dict:
    """Create a Stripe Connect Express account for a provider."""
    if not settings.stripe_secret_key:
        return {"id": "acct_demo_placeholder", "onboarding_url": "#"}

    account = stripe.Account.create(
        type="express",
        country=country,
        email=email,
        capabilities={
            "card_payments": {"requested": True},
            "transfers": {"requested": True},
        },
    )

    account_link = stripe.AccountLink.create(
        account=account.id,
        refresh_url=f"{settings.app_name}/stripe/refresh",
        return_url=f"{settings.app_name}/stripe/return",
        type="account_onboarding",
    )

    return {"id": account.id, "onboarding_url": account_link.url}


async def create_payment_intent(
    amount_cents: int,
    currency: str,
    seller_stripe_account_id: str | None,
    metadata: dict | None = None,
) -> dict:
    """Create a payment intent with optional transfer to connected account."""
    if not settings.stripe_secret_key:
        return {
            "id": "pi_demo_placeholder",
            "client_secret": "demo_secret",
            "status": "requires_payment_method",
        }

    params = {
        "amount": amount_cents,
        "currency": currency.lower(),
        "metadata": metadata or {},
    }

    if seller_stripe_account_id:
        platform_fee_cents = int(amount_cents * (settings.platform_fee_percent / 100))
        params["transfer_data"] = {
            "destination": seller_stripe_account_id,
        }
        params["application_fee_amount"] = platform_fee_cents

    intent = stripe.PaymentIntent.create(**params)
    return {
        "id": intent.id,
        "client_secret": intent.client_secret,
        "status": intent.status,
    }


async def create_transfer(
    amount_cents: int,
    destination_account_id: str,
    transfer_group: str | None = None,
) -> dict:
    """Transfer funds to a connected account after order completion."""
    if not settings.stripe_secret_key:
        return {"id": "tr_demo_placeholder", "amount": amount_cents}

    transfer = stripe.Transfer.create(
        amount=amount_cents,
        currency="usd",
        destination=destination_account_id,
        transfer_group=transfer_group,
    )
    return {"id": transfer.id, "amount": transfer.amount}


async def get_account_balance(account_id: str) -> dict:
    """Get balance for a connected account."""
    if not settings.stripe_secret_key:
        return {"available": 0, "pending": 0}

    balance = stripe.Balance.retrieve(stripe_account=account_id)
    available = sum(b.amount for b in balance.available) if balance.available else 0
    pending = sum(b.amount for b in balance.pending) if balance.pending else 0
    return {"available": available / 100, "pending": pending / 100}
