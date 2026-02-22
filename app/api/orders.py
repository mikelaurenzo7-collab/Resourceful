from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.order import OrderCreate, OrderUpdate, OrderResponse
from app.services import orders as order_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await order_service.create_order(db, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", response_model=list[OrderResponse])
async def get_my_orders(
    role: str = Query(default="all", pattern="^(all|buyer|seller)$"),
    order_status: str | None = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await order_service.get_user_orders(db, current_user.id, role, order_status)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await order_service.get_order(db, order_id, current_user.id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return result


@router.patch("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: str,
    data: OrderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await order_service.update_order(db, order_id, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
