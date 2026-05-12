"""Refine roles and add mentor capability fields.

Revision ID: 5b9f7f4c2cbf
Revises: dad61c1fd886
Create Date: 2025-12-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = '5b9f7f4c2cbf'
down_revision: Union[str, None] = 'dad61c1fd886'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Add capability flags
    op.add_column('users', sa.Column('is_mentor', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), server_default=sa.false(), nullable=False))

    # Normalize existing role data before shrinking enum
    conn.execute(text("UPDATE users SET is_mentor = TRUE WHERE role = 'MENTOR'"))
    conn.execute(text("UPDATE users SET is_admin = TRUE WHERE role = 'ADMIN'"))
    conn.execute(text("UPDATE users SET role = 'ALUMNI' WHERE role IN ('MENTOR', 'ADMIN', 'COMPANY_REP')"))
    conn.execute(text("UPDATE users SET is_mentor = FALSE WHERE role = 'STUDENT'"))

    # Replace userrole enum with reduced set (STUDENT, ALUMNI)
    old_enum = postgresql.ENUM('STUDENT', 'ALUMNI', 'MENTOR', 'ADMIN', 'COMPANY_REP', name='userrole')
    new_enum = postgresql.ENUM('STUDENT', 'ALUMNI', name='userrole_new')
    new_enum.create(conn)
    op.alter_column('users', 'role', type_=new_enum, existing_type=old_enum, postgresql_using="role::text::userrole_new")
    old_enum.drop(conn, checkfirst=False)
    op.execute("ALTER TYPE userrole_new RENAME TO userrole")

    # Remove defaults now that data is migrated
    op.alter_column('users', 'is_mentor', server_default=None)
    op.alter_column('users', 'is_admin', server_default=None)

    # Mentor profile metadata
    op.add_column('user_profiles', sa.Column('mentor_headline', sa.String(length=255), nullable=True))
    op.add_column('user_profiles', sa.Column('mentor_areas_of_help', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('user_profiles', sa.Column('mentor_industries', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('user_profiles', sa.Column('mentor_max_mentees', sa.Integer(), nullable=True))
    op.add_column('user_profiles', sa.Column('mentor_availability_note', sa.Text(), nullable=True))
    op.add_column('user_profiles', sa.Column('mentor_consent', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.alter_column('user_profiles', 'mentor_consent', server_default=None)


def downgrade() -> None:
    conn = op.get_bind()

    # Restore broader enum
    expanded_enum = postgresql.ENUM('STUDENT', 'ALUMNI', 'MENTOR', 'ADMIN', 'COMPANY_REP', name='userrole_old')
    expanded_enum.create(conn)

    # Map capability flags back to roles where possible
    conn.execute(text("UPDATE users SET role = 'ADMIN' WHERE is_admin = TRUE"))
    conn.execute(text("UPDATE users SET role = 'MENTOR' WHERE is_admin = FALSE AND is_mentor = TRUE"))

    op.alter_column('users', 'role', type_=expanded_enum, existing_type=postgresql.ENUM('STUDENT', 'ALUMNI', name='userrole'), postgresql_using="role::text::userrole_old")
    op.execute("ALTER TYPE userrole_old RENAME TO userrole")

    # Drop added columns
    op.drop_column('user_profiles', 'mentor_consent')
    op.drop_column('user_profiles', 'mentor_availability_note')
    op.drop_column('user_profiles', 'mentor_max_mentees')
    op.drop_column('user_profiles', 'mentor_industries')
    op.drop_column('user_profiles', 'mentor_areas_of_help')
    op.drop_column('user_profiles', 'mentor_headline')

    op.drop_column('users', 'is_admin')
    op.drop_column('users', 'is_mentor')
