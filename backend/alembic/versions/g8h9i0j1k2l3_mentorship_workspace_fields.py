"""mentorship workspace fields

Revision ID: g8h9i0j1k2l3
Revises: f7a8b9c0d1e2
Create Date: 2026-05-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "g8h9i0j1k2l3"
down_revision: Union[str, None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column("mentor_availability_slots", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "mentorship_requests",
        sa.Column("meeting_frequency", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mentorship_requests", "meeting_frequency")
    op.drop_column("user_profiles", "mentor_availability_slots")
