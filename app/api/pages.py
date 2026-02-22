"""Server-rendered page routes using Jinja2 + HTMX."""

from fastapi import APIRouter, Depends, Request, Form, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin
from app.schemas.resource import ListingCreate, ListingFilter
from app.schemas.order import OrderCreate, OrderUpdate
from app.services import auth as auth_service
from app.services import listings as listing_service
from app.services import orders as order_service
from app.api.deps import get_optional_user, get_current_user

router = APIRouter(tags=["pages"])
templates = Jinja2Templates(directory="app/templates")


# --- Public Pages ---

@router.get("/", response_class=HTMLResponse)
async def home(request: Request, user: User | None = Depends(get_optional_user)):
    if user:
        return RedirectResponse(url="/dashboard", status_code=302)
    return templates.TemplateResponse("home.html", {"request": request, "user": user})


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, user: User | None = Depends(get_optional_user)):
    if user:
        return RedirectResponse(url="/dashboard", status_code=302)
    return templates.TemplateResponse("auth/login.html", {"request": request, "user": None})


@router.post("/login", response_class=HTMLResponse)
async def login_submit(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await auth_service.authenticate_user(db, email, password)
        response = RedirectResponse(url="/dashboard", status_code=302)
        response.set_cookie("access_token", result.access_token, httponly=True, samesite="lax", max_age=1800)
        response.set_cookie("refresh_token", result.refresh_token, httponly=True, samesite="lax", max_age=604800)
        return response
    except ValueError as e:
        return templates.TemplateResponse(
            "auth/login.html", {"request": request, "user": None, "error": str(e)}
        )


@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request, user: User | None = Depends(get_optional_user)):
    if user:
        return RedirectResponse(url="/dashboard", status_code=302)
    return templates.TemplateResponse("auth/register.html", {"request": request, "user": None})


@router.post("/register", response_class=HTMLResponse)
async def register_submit(
    request: Request,
    full_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form(default="both"),
    db: AsyncSession = Depends(get_db),
):
    try:
        data = UserCreate(email=email, password=password, full_name=full_name, role=role)
        result = await auth_service.register_user(db, data)
        response = RedirectResponse(url="/dashboard", status_code=302)
        response.set_cookie("access_token", result.access_token, httponly=True, samesite="lax", max_age=1800)
        response.set_cookie("refresh_token", result.refresh_token, httponly=True, samesite="lax", max_age=604800)
        return response
    except ValueError as e:
        return templates.TemplateResponse(
            "auth/register.html", {"request": request, "user": None, "error": str(e)}
        )


@router.get("/logout")
async def logout():
    response = RedirectResponse(url="/", status_code=302)
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return response


# --- Protected Pages ---

@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, user: User = Depends(get_current_user)):
    return templates.TemplateResponse(
        "dashboard/index.html",
        {"request": request, "user": user, "active_page": "dashboard"},
    )


@router.get("/marketplace", response_class=HTMLResponse)
async def marketplace(
    request: Request,
    resource_type: str | None = None,
    user: User | None = Depends(get_optional_user),
):
    return templates.TemplateResponse(
        "marketplace/index.html",
        {"request": request, "user": user, "active_page": "marketplace", "filter_type": resource_type},
    )


@router.get("/marketplace/{listing_id}", response_class=HTMLResponse)
async def listing_detail(
    request: Request,
    listing_id: str,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    listing = await listing_service.get_listing(db, listing_id)
    if not listing:
        return RedirectResponse(url="/marketplace", status_code=302)
    return templates.TemplateResponse(
        "marketplace/listing_detail.html",
        {"request": request, "user": user, "listing": listing, "active_page": "marketplace"},
    )


@router.get("/listings/new", response_class=HTMLResponse)
async def new_listing_page(
    request: Request,
    type: str = Query(default="solar"),
    user: User = Depends(get_current_user),
):
    return templates.TemplateResponse(
        "marketplace/listing_new.html",
        {"request": request, "user": user, "selected_type": type, "active_page": "new-listing"},
    )


@router.post("/listings/create")
async def create_listing_submit(
    request: Request,
    resource_type: str = Form(...),
    title: str = Form(...),
    description: str = Form(default=""),
    price_per_unit: float = Form(...),
    min_quantity: float = Form(default=1.0),
    location: str = Form(default=""),
    auto_accept: str = Form(default=""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Build config from form fields
    form_data = await request.form()
    config = {}
    for key, value in form_data.items():
        if key.startswith("config_") and value:
            config_key = key.replace("config_", "")
            config[config_key] = value

    try:
        data = ListingCreate(
            resource_type=resource_type,
            title=title,
            description=description or None,
            config=config,
            price_per_unit=price_per_unit,
            min_quantity=min_quantity,
            location=location or None,
            auto_accept=auto_accept == "true",
        )
        await listing_service.create_listing(db, user.id, data)
        return RedirectResponse(url="/dashboard", status_code=302)
    except ValueError as e:
        return templates.TemplateResponse(
            "marketplace/listing_new.html",
            {"request": request, "user": user, "selected_type": resource_type, "error": str(e), "active_page": "new-listing"},
        )


@router.get("/orders", response_class=HTMLResponse)
async def orders_page(
    request: Request,
    role: str = Query(default="all"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    orders = await order_service.get_user_orders(db, user.id, role)
    return templates.TemplateResponse(
        "dashboard/orders.html",
        {"request": request, "user": user, "orders": orders, "role": role, "active_page": "orders"},
    )


@router.post("/orders/create")
async def create_order_submit(
    listing_id: str = Form(...),
    quantity: float = Form(...),
    buyer_notes: str = Form(default=""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        data = OrderCreate(listing_id=listing_id, quantity=quantity, buyer_notes=buyer_notes or None)
        await order_service.create_order(db, user.id, data)
        return RedirectResponse(url="/orders?role=buyer", status_code=302)
    except ValueError:
        return RedirectResponse(url=f"/marketplace/{listing_id}", status_code=302)


@router.post("/orders/{order_id}/accept")
async def accept_order(
    order_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        data = OrderUpdate(status="accepted")
        await order_service.update_order(db, order_id, user.id, data)
    except ValueError:
        pass
    return RedirectResponse(url="/orders?role=seller", status_code=302)
