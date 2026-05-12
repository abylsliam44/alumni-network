from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.ai.people_recommendations import upsert_user_embedding
from app.core import security
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserProfile, UserRole
from app.schemas.auth import AuthResponse, RegisterRequest, Token
from app.schemas.user import UserRead

router = APIRouter()


def _cookie_kwargs(max_age: int) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "httponly": True,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "max_age": max_age,
        "path": "/",
    }
    if settings.AUTH_COOKIE_DOMAIN:
        kwargs["domain"] = settings.AUTH_COOKIE_DOMAIN
    return kwargs


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        settings.AUTH_ACCESS_COOKIE_NAME,
        access_token,
        **_cookie_kwargs(settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60),
    )
    response.set_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        refresh_token,
        **_cookie_kwargs(settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60),
    )


def _clear_auth_cookies(response: Response) -> None:
    delete_kwargs = {"path": "/"}
    if settings.AUTH_COOKIE_DOMAIN:
        delete_kwargs["domain"] = settings.AUTH_COOKIE_DOMAIN
    response.delete_cookie(settings.AUTH_ACCESS_COOKIE_NAME, **delete_kwargs)
    response.delete_cookie(settings.AUTH_REFRESH_COOKIE_NAME, **delete_kwargs)


@router.post("/login", response_model=Token, response_model_exclude_none=True)
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token = security.create_access_token(user.id)
    refresh_token = security.create_refresh_token(user.id)
    _set_auth_cookies(response, access_token, refresh_token)
    
    return {
        "token_type": "bearer",
    }

@router.post("/register", response_model=AuthResponse, response_model_exclude_none=True)
async def register(
    response: Response,
    user_in: RegisterRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Create new user without the need to be logged in
    """
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalars().first()
    
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system",
        )
        
    role_value = user_in.role or UserRole.STUDENT
    if role_value not in [UserRole.STUDENT, UserRole.ALUMNI, UserRole.STAFF, UserRole.HR]:
        raise HTTPException(status_code=400, detail="Invalid role. Choose STUDENT, ALUMNI, STAFF, or HR.")

    user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        name=user_in.name,
        role=role_value,
        is_mentor=False,
        is_admin=False,
        system_roles=["JOB_APPLICANT", "JOB_POSTER"] if role_value == UserRole.HR else ["JOB_APPLICANT"],
    )
    
    # Create empty profile for user
    profile = UserProfile(user=user)
    
    db.add(user)
    db.add(profile)
    await db.commit()
    await db.refresh(user)
    # Ensure profile attributes are loaded before embedding and never block signup
    try:
        await db.refresh(profile)
        await upsert_user_embedding(user, profile)
    except Exception:
        # Vector store/embedding failures should not prevent registration
        pass

    access_token = security.create_access_token(user.id)
    refresh_token = security.create_refresh_token(user.id)
    _set_auth_cookies(response, access_token, refresh_token)

    return {
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserRead)
async def read_users_me(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user
    """
    return current_user


@router.post("/refresh", response_model=Token, response_model_exclude_none=True)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Refresh access token
    """
    refresh_token = request.cookies.get(settings.AUTH_REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = security.verify_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
                headers={"WWW-Authenticate": "Bearer"},
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = security.create_access_token(user_id)
    # Be polite and return a new refresh token too to extend session
    new_refresh_token = security.create_refresh_token(user_id)
    _set_auth_cookies(response, access_token, new_refresh_token)
    
    return {
        "token_type": "bearer",
    }


@router.post("/logout")
async def logout(response: Response) -> dict[str, bool]:
    _clear_auth_cookies(response)
    return {"ok": True}
