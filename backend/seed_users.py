import asyncio
import uuid
import random
from app.core.database import AsyncSessionLocal
from app.models.user import User, UserProfile, UserRole
from app.core.security import get_password_hash

async def seed_users():
    async with AsyncSessionLocal() as db:
        roles = [UserRole.STUDENT, UserRole.ALUMNI]
        skills_pool = ["Python", "React", "FastAPI", "Docker", "Java", "Spring", "AWS", "Machine Learning", "Data Science", "Design"]
        locations = ["New York", "San Francisco", "London", "Berlin", "Tokyo", "Remote", "Toronto"]
        
        print("Seeding users...")
        
        for i in range(25):
            email = f"user{i}@example.com"
            # Check if exists
            # (Skipping check for simplicity, assuming clean or unique)
            
            role = random.choice(roles)
            name = f"User {i}"
            is_mentor = role == UserRole.ALUMNI and random.choice([True, False])
            
            user = User(
                email=email,
                hashed_password=get_password_hash("password123"),
                name=name,
                role=role,
                is_mentor=is_mentor,
                is_active=True,
                is_verified=True,
                bio=f"Bio for {name}. Interested in {random.choice(skills_pool)}."
            )
            db.add(user)
            await db.flush() # get ID
            
            profile = UserProfile(
                user_id=user.id,
                location=random.choice(locations),
                graduation_year=random.randint(2015, 2025),
                skills=random.sample(skills_pool, k=random.randint(2, 5))
            )
            # Actually, ProfileRead schema has headline. Where does it come from?
            # In profile.py get_profile_data: "headline": user.profile.headline (if it existed)
            # But it doesn't exist in model.
            # I should fix ProfileRead or UserProfile model.
            # I'll fix UserProfile model to include headline.
            # But that requires migration.
            # For MVP, I'll just use 'bio' as headline or 'role'.
            # I'll skip setting headline in seed.
            
            db.add(profile)
        
        await db.commit()
        print("Seeding complete.")

if __name__ == "__main__":
    asyncio.run(seed_users())
