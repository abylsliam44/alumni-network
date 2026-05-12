"""Add mentor feedback table

Revision ID: a2b3c4d5e6f7
Revises: 55d004e75a94
Create Date: 2026-04-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = '55d004e75a94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mentor_feedback',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('mentor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('mentee_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('relationship_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['mentor_id'], ['users.id']),
        sa.ForeignKeyConstraint(['mentee_id'], ['users.id']),
        sa.ForeignKeyConstraint(['relationship_id'], ['mentorship_relationships.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('mentor_id', 'mentee_id', 'relationship_id', name='uq_mentor_feedback_per_relationship'),
    )

    # Add MENTOR_FEEDBACK to the notificationtype enum
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'MENTOR_FEEDBACK'")


def downgrade() -> None:
    op.drop_table('mentor_feedback')
    # Note: removing enum values is not supported in PostgreSQL without dropping/recreating the type
