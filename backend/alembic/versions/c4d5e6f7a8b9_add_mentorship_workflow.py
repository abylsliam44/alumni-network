"""add mentorship workflow

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-05-10 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


relationship_status = postgresql.ENUM(
    "ACTIVE",
    "COMPLETED",
    name="mentorshiprelationshipstatus",
    create_type=False,
)
session_status = postgresql.ENUM(
    "PLANNED",
    "DONE",
    "CANCELLED",
    name="mentorshipsessionstatus",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    relationship_status.create(bind, checkfirst=True)
    session_status.create(bind, checkfirst=True)

    op.add_column("mentorship_requests", sa.Column("goals", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("mentorship_requests", sa.Column("expected_duration", sa.String(length=50), nullable=True))
    op.add_column("mentorship_requests", sa.Column("preferred_format", sa.String(length=50), nullable=True))
    op.add_column("mentorship_requests", sa.Column("decline_reason", sa.Text(), nullable=True))

    op.add_column("mentorship_relationships", sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        "mentorship_relationships",
        sa.Column("status", relationship_status, server_default="ACTIVE", nullable=False),
    )
    op.add_column("mentorship_relationships", sa.Column("expected_duration", sa.String(length=50), nullable=True))
    op.add_column("mentorship_relationships", sa.Column("preferred_format", sa.String(length=50), nullable=True))
    op.create_foreign_key(
        "fk_mentorship_relationships_request_id",
        "mentorship_relationships",
        "mentorship_requests",
        ["request_id"],
        ["id"],
    )
    op.alter_column("mentorship_relationships", "status", server_default=None)

    op.create_table(
        "mentorship_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relationship_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("goal", sa.Text(), nullable=True),
        sa.Column("milestones", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("meeting_frequency", sa.String(length=50), nullable=True),
        sa.Column("expected_duration", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("next_step", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["relationship_id"], ["mentorship_relationships.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("relationship_id"),
    )

    op.create_table(
        "mentorship_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relationship_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("topic", sa.String(length=255), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("status", session_status, server_default="PLANNED", nullable=False),
        sa.Column("room_name", sa.String(length=180), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["relationship_id"], ["mentorship_relationships.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.alter_column("mentorship_sessions", "status", server_default=None)


def downgrade() -> None:
    op.drop_table("mentorship_sessions")
    op.drop_table("mentorship_plans")
    op.drop_constraint("fk_mentorship_relationships_request_id", "mentorship_relationships", type_="foreignkey")
    op.drop_column("mentorship_relationships", "preferred_format")
    op.drop_column("mentorship_relationships", "expected_duration")
    op.drop_column("mentorship_relationships", "status")
    op.drop_column("mentorship_relationships", "request_id")
    op.drop_column("mentorship_requests", "decline_reason")
    op.drop_column("mentorship_requests", "preferred_format")
    op.drop_column("mentorship_requests", "expected_duration")
    op.drop_column("mentorship_requests", "goals")

    session_status.drop(op.get_bind(), checkfirst=True)
    relationship_status.drop(op.get_bind(), checkfirst=True)
