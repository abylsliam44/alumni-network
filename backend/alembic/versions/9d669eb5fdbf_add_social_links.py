"""add_social_links

Revision ID: 9d669eb5fdbf
Revises: a1b2c3d4e5f6
Create Date: 2025-12-12 04:54:40.461054

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d669eb5fdbf'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add social link columns to user_profiles
    op.add_column('user_profiles', sa.Column('github_url', sa.String(length=500), nullable=True))
    op.add_column('user_profiles', sa.Column('website_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('user_profiles', 'website_url')
    op.drop_column('user_profiles', 'github_url')
