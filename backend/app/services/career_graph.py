from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.resume import (
    AlumniCareerProfile,
    CareerGraphEdge,
    CareerGraphNode,
    GraphNodeType,
    GraphRelationType,
)

AITU_NODE_KEY = "university:aitu"
AITU_NODE_LABEL = "Astana IT University"


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.split()).strip()
    return normalized or None


async def _get_or_create_node(
    db: AsyncSession,
    entity_type: GraphNodeType,
    entity_key: str,
    label: str,
    metadata: dict[str, Any] | None = None,
) -> CareerGraphNode:
    existing = await db.scalar(
        select(CareerGraphNode).where(CareerGraphNode.entity_key == entity_key)
    )
    if existing:
        existing.label = label
        existing.entity_type = entity_type
        existing.node_metadata = metadata
        db.add(existing)
        await db.flush()
        return existing

    node = CareerGraphNode(
        entity_type=entity_type,
        entity_key=entity_key,
        label=label,
        node_metadata=metadata,
    )
    db.add(node)
    await db.flush()
    return node


async def _create_edge(
    db: AsyncSession,
    from_node_id: UUID,
    to_node_id: UUID,
    relation_type: GraphRelationType,
    alumni_user_id: UUID,
    metadata: dict[str, Any] | None = None,
) -> None:
    edge = CareerGraphEdge(
        from_node_id=from_node_id,
        to_node_id=to_node_id,
        relation_type=relation_type,
        alumni_user_id=alumni_user_id,
        edge_metadata=metadata,
    )
    db.add(edge)
    await db.flush()


async def rebuild_career_graph_for_profile(
    db: AsyncSession,
    career_profile: AlumniCareerProfile,
) -> None:
    await db.execute(
        delete(CareerGraphEdge).where(CareerGraphEdge.alumni_user_id == career_profile.user_id)
    )

    alumni_node = await _get_or_create_node(
        db,
        entity_type=GraphNodeType.ALUMNI,
        entity_key=f"alumni:{career_profile.user_id}",
        label=career_profile.full_name or str(career_profile.user_id),
        metadata={"user_id": str(career_profile.user_id)},
    )
    university_node = await _get_or_create_node(
        db,
        entity_type=GraphNodeType.UNIVERSITY,
        entity_key=AITU_NODE_KEY,
        label=AITU_NODE_LABEL,
        metadata={"country": "Kazakhstan"},
    )
    await _create_edge(
        db,
        alumni_node.id,
        university_node.id,
        GraphRelationType.STUDIED_AT,
        career_profile.user_id,
    )

    if career_profile.faculty_raw:
        faculty_node = await _get_or_create_node(
            db,
            entity_type=GraphNodeType.FACULTY,
            entity_key=f"faculty:{career_profile.faculty_raw.lower()}",
            label=career_profile.faculty_raw,
        )
        await _create_edge(
            db,
            alumni_node.id,
            faculty_node.id,
            GraphRelationType.BELONGS_TO,
            career_profile.user_id,
        )

    if career_profile.program_raw:
        program_node = await _get_or_create_node(
            db,
            entity_type=GraphNodeType.PROGRAM,
            entity_key=f"program:{career_profile.program_raw.lower()}",
            label=career_profile.program_raw,
        )
        await _create_edge(
            db,
            alumni_node.id,
            program_node.id,
            GraphRelationType.BELONGS_TO,
            career_profile.user_id,
        )

    if career_profile.graduation_year:
        year_node = await _get_or_create_node(
            db,
            entity_type=GraphNodeType.GRADUATION_YEAR,
            entity_key=f"graduation_year:{career_profile.graduation_year}",
            label=str(career_profile.graduation_year),
        )
        await _create_edge(
            db,
            alumni_node.id,
            year_node.id,
            GraphRelationType.GRADUATED_IN,
            career_profile.user_id,
        )

    for skill in career_profile.skill_records:
        skill_name = _clean(skill.skill_raw)
        if not skill_name:
            continue
        skill_node = await _get_or_create_node(
            db,
            entity_type=GraphNodeType.SKILL,
            entity_key=f"skill:{skill_name.lower()}",
            label=skill_name,
        )
        await _create_edge(
            db,
            alumni_node.id,
            skill_node.id,
            GraphRelationType.HAS_SKILL,
            career_profile.user_id,
        )

    ordered_employment = sorted(
        career_profile.employment_records,
        key=lambda item: (
            item.start_date or "",
            item.end_date or "",
            item.created_at.isoformat(),
        ),
    )
    previous_company_name: str | None = None
    previous_role_name: str | None = None

    for employment in ordered_employment:
        company_name = _clean(employment.company_raw)
        role_name = _clean(employment.role_raw)

        if company_name:
            company_node = await _get_or_create_node(
                db,
                entity_type=GraphNodeType.COMPANY,
                entity_key=f"company:{company_name.lower()}",
                label=company_name,
            )
            await _create_edge(
                db,
                alumni_node.id,
                company_node.id,
                GraphRelationType.WORKED_AT,
                career_profile.user_id,
                metadata={
                    "start_date": employment.start_date,
                    "end_date": employment.end_date,
                    "is_current": employment.is_current,
                },
            )

            if previous_company_name and previous_company_name != company_name:
                transition_company_node = await _get_or_create_node(
                    db,
                    entity_type=GraphNodeType.COMPANY,
                    entity_key=f"company:{company_name.lower()}",
                    label=company_name,
                )
                await _create_edge(
                    db,
                    alumni_node.id,
                    transition_company_node.id,
                    GraphRelationType.TRANSITIONED_TO,
                    career_profile.user_id,
                    metadata={
                        "from_company": previous_company_name,
                        "to_company": company_name,
                    },
                )
            previous_company_name = company_name

        if role_name:
            role_node = await _get_or_create_node(
                db,
                entity_type=GraphNodeType.ROLE,
                entity_key=f"role:{role_name.lower()}",
                label=role_name,
            )
            await _create_edge(
                db,
                alumni_node.id,
                role_node.id,
                GraphRelationType.HELD_ROLE,
                career_profile.user_id,
                metadata={
                    "company": company_name,
                    "start_date": employment.start_date,
                    "end_date": employment.end_date,
                    "is_current": employment.is_current,
                },
            )

            if previous_role_name and previous_role_name != role_name:
                transition_role_node = await _get_or_create_node(
                    db,
                    entity_type=GraphNodeType.ROLE,
                    entity_key=f"role:{role_name.lower()}",
                    label=role_name,
                )
                await _create_edge(
                    db,
                    alumni_node.id,
                    transition_role_node.id,
                    GraphRelationType.TRANSITIONED_TO,
                    career_profile.user_id,
                    metadata={
                        "from_role": previous_role_name,
                        "to_role": role_name,
                    },
                )
            previous_role_name = role_name

