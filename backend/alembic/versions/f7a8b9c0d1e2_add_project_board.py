"""add_project_board

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-05-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    project_category = postgresql.ENUM(
        "STARTUP",
        "PET_PROJECT",
        "AI_ML",
        "MOBILE_APP",
        "WEB_PLATFORM",
        "SAAS",
        "UNIVERSITY_PROJECT",
        "HACKATHON",
        "RESEARCH",
        "OPEN_SOURCE",
        name="projectcategory",
    )
    project_stage = postgresql.ENUM(
        "IDEA",
        "VALIDATION",
        "MVP",
        "IN_PROGRESS",
        "SCALING",
        name="projectstage",
    )
    project_application_status = postgresql.ENUM(
        "SUBMITTED",
        "REVIEWED",
        "ACCEPTED",
        "REJECTED",
        name="projectapplicationstatus",
    )
    project_category.create(op.get_bind(), checkfirst=True)
    project_stage.create(op.get_bind(), checkfirst=True)
    project_application_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "projects",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("short_description", sa.String(length=320), nullable=False),
        sa.Column("full_description", sa.Text(), nullable=False),
        sa.Column("category", postgresql.ENUM(name="projectcategory", create_type=False), nullable=False),
        sa.Column("required_roles", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("required_skills", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("project_stage", postgresql.ENUM(name="projectstage", create_type=False), nullable=False),
        sa.Column("team_size", sa.Integer(), nullable=True),
        sa.Column("is_remote", sa.Boolean(), nullable=False),
        sa.Column("contact_preference", sa.String(length=120), nullable=True),
        sa.Column("github_link", sa.String(length=500), nullable=True),
        sa.Column("demo_link", sa.String(length=500), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("university_related", sa.Boolean(), nullable=False),
        sa.Column("startup_idea", sa.Boolean(), nullable=False),
        sa.Column("looking_for_cofounder", sa.Boolean(), nullable=False),
        sa.Column("created_by_user_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_projects_category", "projects", ["category"], unique=False)
    op.create_index("ix_projects_created_at", "projects", ["created_at"], unique=False)
    op.create_index("ix_projects_creator", "projects", ["created_by_user_id"], unique=False)
    op.create_index("ix_projects_stage", "projects", ["project_stage"], unique=False)
    op.create_index("ix_projects_required_roles_gin", "projects", ["required_roles"], unique=False, postgresql_using="gin")
    op.create_index("ix_projects_required_skills_gin", "projects", ["required_skills"], unique=False, postgresql_using="gin")
    op.create_index("ix_projects_tags_gin", "projects", ["tags"], unique=False, postgresql_using="gin")

    op.create_table(
        "project_applications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("applicant_id", sa.UUID(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("skills", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("fit_reason", sa.Text(), nullable=True),
        sa.Column("status", postgresql.ENUM(name="projectapplicationstatus", create_type=False), nullable=False),
        sa.Column("applied_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["applicant_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "applicant_id", name="uq_project_applications_project_applicant"),
    )
    op.create_index("ix_project_applications_applicant", "project_applications", ["applicant_id"], unique=False)
    op.create_index("ix_project_applications_project", "project_applications", ["project_id"], unique=False)
    op.create_index("ix_project_applications_skills_gin", "project_applications", ["skills"], unique=False, postgresql_using="gin")


def downgrade() -> None:
    op.drop_index("ix_project_applications_skills_gin", table_name="project_applications")
    op.drop_index("ix_project_applications_project", table_name="project_applications")
    op.drop_index("ix_project_applications_applicant", table_name="project_applications")
    op.drop_table("project_applications")
    op.drop_index("ix_projects_tags_gin", table_name="projects")
    op.drop_index("ix_projects_required_skills_gin", table_name="projects")
    op.drop_index("ix_projects_required_roles_gin", table_name="projects")
    op.drop_index("ix_projects_stage", table_name="projects")
    op.drop_index("ix_projects_creator", table_name="projects")
    op.drop_index("ix_projects_created_at", table_name="projects")
    op.drop_index("ix_projects_category", table_name="projects")
    op.drop_table("projects")
    sa.Enum(name="projectapplicationstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="projectstage").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="projectcategory").drop(op.get_bind(), checkfirst=True)
