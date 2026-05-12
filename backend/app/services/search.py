from typing import List, Optional, Tuple
from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User, UserProfile, UserRole

class SearchService:
    @staticmethod
    async def search_users(
        db: AsyncSession,
        query: Optional[str] = None,
        role: Optional[UserRole] = None,
        is_mentor: Optional[bool] = None,
        skills: Optional[List[str]] = None,
        location: Optional[str] = None,
        graduation_year: Optional[int] = None,
        page: int = 1,
        limit: int = 20
    ) -> Tuple[List[User], int]:
        
        stmt = select(User).join(UserProfile, isouter=True).options(selectinload(User.profile))
        
        filters = []
        
        # Role filter
        if role:
            filters.append(User.role == role)

        if is_mentor is not None:
            filters.append(User.is_mentor.is_(is_mentor))
            
        # Location filter
        if location:
            filters.append(UserProfile.location.ilike(f"%{location}%"))
            
        # Graduation year filter
        if graduation_year:
            filters.append(UserProfile.graduation_year == graduation_year)
            
        # Skills filter (JSONB)
        # Assuming skills is a JSON array of strings ["Python", "React"]
        if skills:
            for skill in skills:
                # PostgreSQL JSONB containment operator @>
                # We need to cast the skill to a JSONB array or check if it exists in the list
                # For simplicity in SQLAlchemy with JSONB, we can use:
                # UserProfile.skills.contains([skill])
                filters.append(UserProfile.skills.contains([skill]))

        # Full-text search (Name, Bio, Headline)
        if query:
            search_term = f"%{query}%"
            filters.append(or_(
                User.name.ilike(search_term),
                User.bio.ilike(search_term),
                # UserProfile.headline doesn't exist in model yet, checking UserProfile model...
                # It has 'skills', 'experience', etc. 
                # Let's check UserProfile model again.
                # It has 'availability', 'location', 'linkedin_url'.
                # 'headline' was in schema but maybe not in model? 
                # In Step 376 view_file, UserProfile has: education, skills, experience, career_interests, availability, location, graduation_year, linkedin_url, visibility_settings.
                # No 'headline'. User has 'bio'.
                # So we search User.name and User.bio.
                # And maybe UserProfile.location.
            ))
            
        if filters:
            stmt = stmt.where(and_(*filters))
            
        # Count total
        count_stmt = select(func.count()).select_from(User).join(UserProfile, isouter=True)
        if filters:
            count_stmt = count_stmt.where(and_(*filters))
            
        total_result = await db.execute(count_stmt)
        total = total_result.scalar() or 0
        
        # Order newest first so freshly added users are visible
        stmt = stmt.order_by(User.created_at.desc())
        # Pagination
        stmt = stmt.offset((page - 1) * limit).limit(limit)
        
        result = await db.execute(stmt)
        users = result.scalars().all()
        
        return users, total
