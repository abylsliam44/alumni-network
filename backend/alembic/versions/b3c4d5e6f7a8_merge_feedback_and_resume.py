"""merge feedback and resume heads

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7, f1e2d3c4b5a6
Create Date: 2026-04-21 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = ('a2b3c4d5e6f7', 'f1e2d3c4b5a6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
