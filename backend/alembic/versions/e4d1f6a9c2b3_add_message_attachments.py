"""add_message_attachments

Revision ID: e4d1f6a9c2b3
Revises: 007977c7f7e9
Create Date: 2026-03-16 10:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e4d1f6a9c2b3"
down_revision: Union[str, None] = "007977c7f7e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("attachment_url", sa.String(length=500), nullable=True))
    op.add_column("messages", sa.Column("attachment_name", sa.String(length=255), nullable=True))
    op.add_column("messages", sa.Column("attachment_mime_type", sa.String(length=255), nullable=True))
    op.add_column("messages", sa.Column("attachment_size", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "attachment_size")
    op.drop_column("messages", "attachment_mime_type")
    op.drop_column("messages", "attachment_name")
    op.drop_column("messages", "attachment_url")
