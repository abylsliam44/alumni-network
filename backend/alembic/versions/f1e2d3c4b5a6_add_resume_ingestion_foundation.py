"""add resume ingestion foundation

Revision ID: f1e2d3c4b5a6
Revises: c3d4e5f6a7b8, e4d1f6a9c2b3
Create Date: 2026-03-17 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f1e2d3c4b5a6"
down_revision = ("c3d4e5f6a7b8", "e4d1f6a9c2b3")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


resume_document_status = postgresql.ENUM(
    "UPLOADED",
    "PROCESSING",
    "PARSED",
    "FAILED",
    "DELETED",
    name="resumedocumentstatus",
    create_type=False,
)
resume_processing_status = postgresql.ENUM(
    "QUEUED",
    "RUNNING",
    "COMPLETED",
    "FAILED",
    name="resumeprocessingstatus",
    create_type=False,
)
resume_confirmation_status = postgresql.ENUM(
    "DRAFT",
    "NEEDS_REVIEW",
    "CONFIRMED",
    "ARCHIVED",
    name="resumeconfirmationstatus",
    create_type=False,
)
resume_job_type = postgresql.ENUM(
    "EXTRACT_TEXT",
    "EXTRACT_STRUCTURED_DATA",
    "NORMALIZE_DRAFT",
    "SYNC_PROFILE",
    "BUILD_GRAPH",
    name="resumejobtype",
    create_type=False,
)
resume_job_status = postgresql.ENUM(
    "QUEUED",
    "RUNNING",
    "COMPLETED",
    "FAILED",
    name="resumejobstatus",
    create_type=False,
)
graph_node_type = postgresql.ENUM(
    "ALUMNI",
    "UNIVERSITY",
    "FACULTY",
    "PROGRAM",
    "GRADUATION_YEAR",
    "COMPANY",
    "ROLE",
    "SKILL",
    "PROJECT",
    "INTERNSHIP",
    "CERTIFICATE",
    name="graphnodetype",
    create_type=False,
)
graph_relation_type = postgresql.ENUM(
    "STUDIED_AT",
    "BELONGS_TO",
    "GRADUATED_IN",
    "HAS_SKILL",
    "WORKED_AT",
    "HELD_ROLE",
    "PARTICIPATED_IN",
    "COMPLETED_INTERNSHIP",
    "EARNED_CERTIFICATE",
    "TRANSITIONED_TO",
    name="graphrelationtype",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    resume_document_status.create(bind, checkfirst=True)
    resume_processing_status.create(bind, checkfirst=True)
    resume_confirmation_status.create(bind, checkfirst=True)
    resume_job_type.create(bind, checkfirst=True)
    resume_job_status.create(bind, checkfirst=True)
    graph_node_type.create(bind, checkfirst=True)
    graph_relation_type.create(bind, checkfirst=True)

    op.create_table(
        "canonical_companies",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("aliases", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("normalized_name"),
    )
    op.create_index("ix_canonical_companies_normalized_name", "canonical_companies", ["normalized_name"], unique=False)

    op.create_table(
        "canonical_roles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("aliases", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("normalized_name"),
    )
    op.create_index("ix_canonical_roles_normalized_name", "canonical_roles", ["normalized_name"], unique=False)

    op.create_table(
        "canonical_skills",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("aliases", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("normalized_name"),
    )
    op.create_index("ix_canonical_skills_normalized_name", "canonical_skills", ["normalized_name"], unique=False)

    op.create_table(
        "canonical_faculties",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("aliases", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("normalized_name"),
    )
    op.create_index("ix_canonical_faculties_normalized_name", "canonical_faculties", ["normalized_name"], unique=False)

    op.create_table(
        "canonical_programs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("aliases", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("normalized_name"),
    )
    op.create_index("ix_canonical_programs_normalized_name", "canonical_programs", ["normalized_name"], unique=False)

    op.create_table(
        "resume_documents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("file_url", sa.String(length=500), nullable=False),
        sa.Column("object_name", sa.String(length=500), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=True),
        sa.Column("status", resume_document_status, nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("object_name"),
    )
    op.create_index("ix_resume_documents_user_id", "resume_documents", ["user_id"], unique=False)

    op.create_table(
        "resume_import_sessions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("resume_document_id", sa.UUID(), nullable=False),
        sa.Column("processing_status", resume_processing_status, nullable=False),
        sa.Column("confirmation_status", resume_confirmation_status, nullable=False),
        sa.Column("processing_consent", sa.Boolean(), nullable=False),
        sa.Column("profile_publish_consent", sa.Boolean(), nullable=False),
        sa.Column("graph_analytics_consent", sa.Boolean(), nullable=False),
        sa.Column("last_confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("last_reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["resume_document_id"], ["resume_documents.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resume_import_sessions_resume_document_id", "resume_import_sessions", ["resume_document_id"], unique=False)
    op.create_index("ix_resume_import_sessions_user_id", "resume_import_sessions", ["user_id"], unique=False)

    op.create_table(
        "resume_processing_jobs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("import_session_id", sa.UUID(), nullable=False),
        sa.Column("job_type", resume_job_type, nullable=False),
        sa.Column("status", resume_job_status, nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["import_session_id"], ["resume_import_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resume_processing_jobs_import_session_id", "resume_processing_jobs", ["import_session_id"], unique=False)

    op.create_table(
        "resume_extraction_drafts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("import_session_id", sa.UUID(), nullable=False),
        sa.Column("raw_extracted_text", sa.Text(), nullable=True),
        sa.Column("ocr_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("draft_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("normalized_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("field_confidences", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("extraction_model", sa.String(length=120), nullable=True),
        sa.Column("extraction_version", sa.String(length=40), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["import_session_id"], ["resume_import_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("import_session_id"),
    )

    op.create_table(
        "alumni_career_profiles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("source_import_session_id", sa.UUID(), nullable=True),
        sa.Column("source_document_id", sa.UUID(), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("faculty_raw", sa.String(length=255), nullable=True),
        sa.Column("faculty_id", sa.UUID(), nullable=True),
        sa.Column("program_raw", sa.String(length=255), nullable=True),
        sa.Column("program_id", sa.UUID(), nullable=True),
        sa.Column("graduation_year", sa.Integer(), nullable=True),
        sa.Column("current_company_raw", sa.String(length=255), nullable=True),
        sa.Column("current_company_id", sa.UUID(), nullable=True),
        sa.Column("current_role_raw", sa.String(length=255), nullable=True),
        sa.Column("current_role_id", sa.UUID(), nullable=True),
        sa.Column("profile_summary", sa.Text(), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("last_verified_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["current_company_id"], ["canonical_companies.id"]),
        sa.ForeignKeyConstraint(["current_role_id"], ["canonical_roles.id"]),
        sa.ForeignKeyConstraint(["faculty_id"], ["canonical_faculties.id"]),
        sa.ForeignKeyConstraint(["program_id"], ["canonical_programs.id"]),
        sa.ForeignKeyConstraint(["source_document_id"], ["resume_documents.id"]),
        sa.ForeignKeyConstraint(["source_import_session_id"], ["resume_import_sessions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )

    op.create_table(
        "alumni_education_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("career_profile_id", sa.UUID(), nullable=False),
        sa.Column("school_name", sa.String(length=255), nullable=False),
        sa.Column("degree", sa.String(length=255), nullable=True),
        sa.Column("faculty_raw", sa.String(length=255), nullable=True),
        sa.Column("faculty_id", sa.UUID(), nullable=True),
        sa.Column("program_raw", sa.String(length=255), nullable=True),
        sa.Column("program_id", sa.UUID(), nullable=True),
        sa.Column("field_of_study", sa.String(length=255), nullable=True),
        sa.Column("start_date", sa.String(length=32), nullable=True),
        sa.Column("end_date", sa.String(length=32), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("last_verified_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["career_profile_id"], ["alumni_career_profiles.id"]),
        sa.ForeignKeyConstraint(["faculty_id"], ["canonical_faculties.id"]),
        sa.ForeignKeyConstraint(["program_id"], ["canonical_programs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alumni_education_records_career_profile_id", "alumni_education_records", ["career_profile_id"], unique=False)

    op.create_table(
        "alumni_employment_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("career_profile_id", sa.UUID(), nullable=False),
        sa.Column("company_raw", sa.String(length=255), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=True),
        sa.Column("role_raw", sa.String(length=255), nullable=True),
        sa.Column("role_id", sa.UUID(), nullable=True),
        sa.Column("start_date", sa.String(length=32), nullable=True),
        sa.Column("end_date", sa.String(length=32), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("last_verified_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["career_profile_id"], ["alumni_career_profiles.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["canonical_companies.id"]),
        sa.ForeignKeyConstraint(["role_id"], ["canonical_roles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alumni_employment_records_career_profile_id", "alumni_employment_records", ["career_profile_id"], unique=False)

    op.create_table(
        "alumni_skill_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("career_profile_id", sa.UUID(), nullable=False),
        sa.Column("skill_raw", sa.String(length=255), nullable=False),
        sa.Column("skill_id", sa.UUID(), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("last_verified_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["career_profile_id"], ["alumni_career_profiles.id"]),
        sa.ForeignKeyConstraint(["skill_id"], ["canonical_skills.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("career_profile_id", "skill_raw", name="uq_alumni_skill_record_profile_skill"),
    )
    op.create_index("ix_alumni_skill_records_career_profile_id", "alumni_skill_records", ["career_profile_id"], unique=False)

    op.create_table(
        "career_graph_nodes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_type", graph_node_type, nullable=False),
        sa.Column("entity_key", sa.String(length=255), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_key"),
    )
    op.create_index("ix_career_graph_nodes_entity_key", "career_graph_nodes", ["entity_key"], unique=False)

    op.create_table(
        "career_graph_edges",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("from_node_id", sa.UUID(), nullable=False),
        sa.Column("to_node_id", sa.UUID(), nullable=False),
        sa.Column("relation_type", graph_relation_type, nullable=False),
        sa.Column("alumni_user_id", sa.UUID(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["alumni_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["from_node_id"], ["career_graph_nodes.id"]),
        sa.ForeignKeyConstraint(["to_node_id"], ["career_graph_nodes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_career_graph_edges_alumni_user_id", "career_graph_edges", ["alumni_user_id"], unique=False)
    op.create_index("ix_career_graph_edges_from_node_id", "career_graph_edges", ["from_node_id"], unique=False)
    op.create_index("ix_career_graph_edges_to_node_id", "career_graph_edges", ["to_node_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index("ix_career_graph_edges_to_node_id", table_name="career_graph_edges")
    op.drop_index("ix_career_graph_edges_from_node_id", table_name="career_graph_edges")
    op.drop_index("ix_career_graph_edges_alumni_user_id", table_name="career_graph_edges")
    op.drop_table("career_graph_edges")

    op.drop_index("ix_career_graph_nodes_entity_key", table_name="career_graph_nodes")
    op.drop_table("career_graph_nodes")

    op.drop_index("ix_alumni_skill_records_career_profile_id", table_name="alumni_skill_records")
    op.drop_table("alumni_skill_records")

    op.drop_index("ix_alumni_employment_records_career_profile_id", table_name="alumni_employment_records")
    op.drop_table("alumni_employment_records")

    op.drop_index("ix_alumni_education_records_career_profile_id", table_name="alumni_education_records")
    op.drop_table("alumni_education_records")

    op.drop_table("alumni_career_profiles")
    op.drop_table("resume_extraction_drafts")

    op.drop_index("ix_resume_processing_jobs_import_session_id", table_name="resume_processing_jobs")
    op.drop_table("resume_processing_jobs")

    op.drop_index("ix_resume_import_sessions_user_id", table_name="resume_import_sessions")
    op.drop_index("ix_resume_import_sessions_resume_document_id", table_name="resume_import_sessions")
    op.drop_table("resume_import_sessions")

    op.drop_index("ix_resume_documents_user_id", table_name="resume_documents")
    op.drop_table("resume_documents")

    op.drop_index("ix_canonical_programs_normalized_name", table_name="canonical_programs")
    op.drop_table("canonical_programs")

    op.drop_index("ix_canonical_faculties_normalized_name", table_name="canonical_faculties")
    op.drop_table("canonical_faculties")

    op.drop_index("ix_canonical_skills_normalized_name", table_name="canonical_skills")
    op.drop_table("canonical_skills")

    op.drop_index("ix_canonical_roles_normalized_name", table_name="canonical_roles")
    op.drop_table("canonical_roles")

    op.drop_index("ix_canonical_companies_normalized_name", table_name="canonical_companies")
    op.drop_table("canonical_companies")

    graph_relation_type.drop(bind, checkfirst=True)
    graph_node_type.drop(bind, checkfirst=True)
    resume_job_status.drop(bind, checkfirst=True)
    resume_job_type.drop(bind, checkfirst=True)
    resume_confirmation_status.drop(bind, checkfirst=True)
    resume_processing_status.drop(bind, checkfirst=True)
    resume_document_status.drop(bind, checkfirst=True)
