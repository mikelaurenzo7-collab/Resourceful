from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.resource import ListingCreate, ListingUpdate, ListingResponse
from app.services import listings as listing_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/listings", tags=["listings"])


@router.post("/", response_model=ListingResponse, status_code=status.HTTP_201_CREATED)
async def create_listing(
    data: ListingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await listing_service.create_listing(db, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/mine", response_model=list[ListingResponse])
async def get_my_listings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await listing_service.get_user_listings(db, current_user.id)


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(listing_id: str, db: AsyncSession = Depends(get_db)):
    result = await listing_service.get_listing(db, listing_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    return result


@router.patch("/{listing_id}", response_model=ListingResponse)
async def update_listing(
    listing_id: str,
    data: ListingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await listing_service.update_listing(db, listing_id, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listing(
    listing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await listing_service.delete_listing(db, listing_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
