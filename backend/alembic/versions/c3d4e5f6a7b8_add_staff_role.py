"""add_staff_role

Revision ID: c3d4e5f6a7b8
Revises: 007977c7f7e9
Create Date: 2026-01-19 21:41:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = '007977c7f7e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add STAFF value to userrole enum
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'STAFF'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values easily
    # Would need to recreate the enum type
    pass
