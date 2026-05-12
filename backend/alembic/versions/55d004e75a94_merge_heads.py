"""merge_heads

Revision ID: 55d004e75a94
Revises: 1d42908b91dd, b2c3d4e5f6g7
Create Date: 2026-01-18 17:43:13.030854

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '55d004e75a94'
down_revision: Union[str, None] = ('1d42908b91dd', 'b2c3d4e5f6g7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
