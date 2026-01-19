"""Extend events with full feature set

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-17 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create new enums
    eventtype_enum = postgresql.ENUM('career', 'educational', 'networking', 'recruiting', 'invite-only', name='eventtype', create_type=False)
    eventformat_enum = postgresql.ENUM('online', 'offline', 'hybrid', name='eventformat', create_type=False)
    eventstatus_enum = postgresql.ENUM('draft', 'pending', 'approved', 'cancelled', 'completed', name='eventstatus', create_type=False)
    materialtype_enum = postgresql.ENUM('agenda', 'presentation', 'document', 'other', name='materialtype', create_type=False)
    
    # Create the enum types
    # Create the enum types safely
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE eventtype AS ENUM ('career', 'educational', 'networking', 'recruiting', 'invite-only');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE eventformat AS ENUM ('online', 'offline', 'hybrid');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE eventstatus AS ENUM ('draft', 'pending', 'approved', 'cancelled', 'completed');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE materialtype AS ENUM ('agenda', 'presentation', 'document', 'other');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Add WAITLISTED to registrationstatus enum
    op.execute("ALTER TYPE registrationstatus ADD VALUE IF NOT EXISTS 'WAITLISTED'")
    
    # Add new columns to events table
    op.add_column('events', sa.Column('topic', sa.String(length=200), nullable=True))
    op.add_column('events', sa.Column('type', eventtype_enum, nullable=True))
    op.add_column('events', sa.Column('format', eventformat_enum, nullable=True))
    op.add_column('events', sa.Column('status', eventstatus_enum, nullable=True))
    op.add_column('events', sa.Column('start_time', sa.DateTime(), nullable=True))
    op.add_column('events', sa.Column('end_time', sa.DateTime(), nullable=True))
    op.add_column('events', sa.Column('online_link', sa.String(length=500), nullable=True))
    op.add_column('events', sa.Column('capacity', sa.Integer(), nullable=True))
    op.add_column('events', sa.Column('company_name', sa.String(length=200), nullable=True))
    op.add_column('events', sa.Column('approved_by', sa.UUID(), nullable=True))
    op.add_column('events', sa.Column('approved_at', sa.DateTime(), nullable=True))
    
    # Migrate data: copy date_time to start_time
    op.execute("UPDATE events SET start_time = date_time")
    
    # Set defaults for new columns
    op.execute("UPDATE events SET topic = '' WHERE topic IS NULL")
    op.execute("UPDATE events SET type = 'networking' WHERE type IS NULL")
    op.execute("UPDATE events SET format = 'offline' WHERE format IS NULL")
    op.execute("UPDATE events SET status = 'approved' WHERE status IS NULL")  # Existing events are approved
    
    # Copy max_attendees to capacity
    op.execute("UPDATE events SET capacity = max_attendees")
    
    # Make columns non-nullable where needed
    op.alter_column('events', 'topic', nullable=False, server_default='')
    op.alter_column('events', 'type', nullable=False)
    op.alter_column('events', 'format', nullable=False)
    op.alter_column('events', 'status', nullable=False)
    op.alter_column('events', 'start_time', nullable=False)
    
    # Add foreign key for approved_by
    op.create_foreign_key('fk_events_approved_by', 'events', 'users', ['approved_by'], ['id'])
    
    # Add waitlist_position to event_registrations
    op.add_column('event_registrations', sa.Column('waitlist_position', sa.Integer(), nullable=True))
    
    # Create event_speakers table
    op.create_table('event_speakers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('event_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('link', sa.String(length=500), nullable=True),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create event_materials table
    op.create_table('event_materials',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('event_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('url', sa.String(length=500), nullable=False),
        sa.Column('type', materialtype_enum, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create event_reviews table
    op.create_table('event_reviews',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('event_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create event_messages table
    op.create_table('event_messages',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('event_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Add event notification types
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'EVENT_REGISTRATION'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'EVENT_WAITLIST'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'EVENT_WAITLIST_PROMOTED'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'EVENT_REMINDER'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'EVENT_CANCELLED'")
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'EVENT_APPROVED'")


def downgrade() -> None:
    # Drop new tables
    op.drop_table('event_messages')
    op.drop_table('event_reviews')
    op.drop_table('event_materials')
    op.drop_table('event_speakers')
    
    # Drop new columns from event_registrations
    op.drop_column('event_registrations', 'waitlist_position')
    
    # Drop foreign key and new columns from events
    op.drop_constraint('fk_events_approved_by', 'events', type_='foreignkey')
    op.drop_column('events', 'approved_at')
    op.drop_column('events', 'approved_by')
    op.drop_column('events', 'company_name')
    op.drop_column('events', 'capacity')
    op.drop_column('events', 'online_link')
    op.drop_column('events', 'end_time')
    op.drop_column('events', 'start_time')
    op.drop_column('events', 'status')
    op.drop_column('events', 'format')
    op.drop_column('events', 'type')
    op.drop_column('events', 'topic')
    
    # Drop enums (note: can't remove values from enums in PostgreSQL)
    op.execute("DROP TYPE IF EXISTS materialtype")
    op.execute("DROP TYPE IF EXISTS eventstatus")
    op.execute("DROP TYPE IF EXISTS eventformat")
    op.execute("DROP TYPE IF EXISTS eventtype")
