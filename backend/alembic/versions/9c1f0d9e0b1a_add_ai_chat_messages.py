"""add ai chat messages

Revision ID: 9c1f0d9e0b1a
Revises: 8b4c1d92f4d0
Create Date: 2025-12-11 06:20:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '9c1f0d9e0b1a'
down_revision = '8b4c1d92f4d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'ai_chat_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('role', sa.String(length=16), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_ai_chat_messages_user_id', 'ai_chat_messages', ['user_id'])
    op.create_index('ix_ai_chat_messages_created_at', 'ai_chat_messages', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_ai_chat_messages_created_at', table_name='ai_chat_messages')
    op.drop_index('ix_ai_chat_messages_user_id', table_name='ai_chat_messages')
    op.drop_table('ai_chat_messages')
