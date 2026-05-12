"""add_job_interviews

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-05-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE applicationstatus ADD VALUE IF NOT EXISTS 'VIEWED'")
    op.execute("ALTER TYPE applicationstatus ADD VALUE IF NOT EXISTS 'SHORTLISTED'")
    op.execute("ALTER TYPE applicationstatus ADD VALUE IF NOT EXISTS 'INTERVIEW'")
    op.execute("ALTER TYPE applicationstatus ADD VALUE IF NOT EXISTS 'HIRED'")

    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'JOB_APPLICATION_SUBMITTED'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'JOB_APPLICATION_STATUS_CHANGED'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'JOB_INTERVIEW_SCHEDULED'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'JOB_INTERVIEW_CANCELLED'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'JOB_APPLICATION_MESSAGE'")

    interview_status = postgresql.ENUM("SCHEDULED", "COMPLETED", "CANCELLED", name="jobinterviewstatus")
    interview_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "job_interviews",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("application_id", sa.UUID(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(), nullable=False),
        sa.Column("room_name", sa.String(length=255), nullable=False),
        sa.Column("status", postgresql.ENUM(name="jobinterviewstatus", create_type=False), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["application_id"], ["job_applications.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("job_interviews")
    sa.Enum(name="jobinterviewstatus").drop(op.get_bind(), checkfirst=True)
