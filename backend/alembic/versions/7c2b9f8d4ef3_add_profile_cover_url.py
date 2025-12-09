"""Add cover_url to user_profiles

Revision ID: 7c2b9f8d4ef3
Revises: 5b9f7f4c2cbf
Create Date: 2025-12-09 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7c2b9f8d4ef3'
down_revision: Union[str, None] = '5b9f7f4c2cbf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_profiles', sa.Column('cover_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('user_profiles', 'cover_url')
