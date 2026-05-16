from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import security
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import TokenPayload

# Optional OAuth2 scheme - does not raise error if token missing
optional_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False
)


def _request_token(request: Request, bearer_token: Optional[str]) -> Optional[str]:
    if bearer_token:
        return bearer_token
    return request.cookies.get(settings.AUTH_ACCESS_COOKIE_NAME)


def _access_token_payload(token: str) -> TokenPayload:
    payload = security.verify_token(token)
    token_data = TokenPayload(**payload)
    if token_data.type not in (None, "access"):
        raise JWTError("Invalid token type")
    if not token_data.sub:
        raise JWTError("Missing token subject")
    return token_data


async def get_user_from_token(db: AsyncSession, token: Optional[str]) -> Optional[User]:
    if not token:
        return None

    try:
        token_data = _access_token_payload(token)
    except (JWTError, ValidationError):
        return None

    result = await db.execute(select(User).options(selectinload(User.profile)).where(User.id == token_data.sub))
    user = result.scalars().first()
    if not user or not user.is_active:
        return None
    return user


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    bearer_token: Optional[str] = Depends(optional_oauth2),
) -> User:
    token = _request_token(request, bearer_token)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    try:
        token_data = _access_token_payload(token)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    result = await db.execute(select(User).options(selectinload(User.profile)).where(User.id == token_data.sub))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def require_roles(roles: list[UserRole]):
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.is_admin:
            return current_user
        if current_user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail="The user doesn't have enough privileges"
            )
        return current_user
    return role_checker

def require_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin privileges required"
        )
    return current_user


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
    bearer_token: Optional[str] = Depends(optional_oauth2),
) -> Optional[User]:
    """
    Get current user if token provided, otherwise return None.
    Useful for endpoints accessible to both authenticated and anonymous users.
    """
    token = _request_token(request, bearer_token)
    return await get_user_from_token(db, token)
