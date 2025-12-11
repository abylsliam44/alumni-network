"""add notifications table

Revision ID: a1b2c3d4e5f6
Revises: 9c1f0d9e0b1a
Create Date: 2025-12-11 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '9c1f0d9e0b1a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    
    # Check if table already exists
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications'"
    ))
    if result.fetchone():
        return  # Table already exists, skip creation

    # Create enum type if it doesn't exist and create table using raw SQL
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE notificationtype AS ENUM (
                'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'MENTORSHIP_REQUEST', 
                'MENTORSHIP_ACCEPTED', 'NEW_MESSAGE'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))
    
    conn.execute(sa.text("""
        CREATE TABLE notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            type notificationtype NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            reference_id UUID,
            actor_id UUID REFERENCES users(id),
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            read_at TIMESTAMP
        );
    """))
    
    # Create indexes for efficient queries
    conn.execute(sa.text("CREATE INDEX ix_notifications_user_id ON notifications(user_id);"))
    conn.execute(sa.text("CREATE INDEX ix_notifications_created_at ON notifications(created_at);"))
    conn.execute(sa.text("CREATE INDEX ix_notifications_is_read ON notifications(is_read);"))
    conn.execute(sa.text("CREATE INDEX ix_notifications_user_unread ON notifications(user_id, is_read);"))


def downgrade() -> None:
    op.drop_index('ix_notifications_user_unread', table_name='notifications')
    op.drop_index('ix_notifications_is_read', table_name='notifications')
    op.drop_index('ix_notifications_created_at', table_name='notifications')
    op.drop_index('ix_notifications_user_id', table_name='notifications')
    op.drop_table('notifications')
    
    # Drop the enum type
    op.execute(sa.text("DROP TYPE IF EXISTS notificationtype;"))
