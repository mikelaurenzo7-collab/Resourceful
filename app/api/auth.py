from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserUpdate, UserResponse, TokenResponse
from app.services import auth as auth_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        result = await auth_service.register_user(db, data)
        # Set cookie for browser-based auth
        response.set_cookie(
            key="access_token",
            value=result.access_token,
            httponly=True,
            samesite="lax",
            max_age=60 * 30,
        )
        response.set_cookie(
            key="refresh_token",
            value=result.refresh_token,
            httponly=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 7,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        result = await auth_service.authenticate_user(db, data.email, data.password)
        response.set_cookie(
            key="access_token",
            value=result.access_token,
            httponly=True,
            samesite="lax",
            max_age=60 * 30,
        )
        response.set_cookie(
            key="refresh_token",
            value=result.refresh_token,
            httponly=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 7,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    db: AsyncSession = Depends(get_db),
    token: str = "",
):
    try:
        result = await auth_service.refresh_access_token(db, token)
        response.set_cookie(
            key="access_token",
            value=result.access_token,
            httponly=True,
            samesite="lax",
            max_age=60 * 30,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    await db.flush()
    return UserResponse.model_validate(current_user)
