from __future__ import annotations

from typing import Iterable


def normalize_skill(value: str) -> str:
    return " ".join(str(value).lower().replace(".", "").split())


def normalize_skills(values: Iterable[str] | None) -> set[str]:
    return {normalized for normalized in (normalize_skill(item) for item in values or []) if normalized}


def calculate_match_score(user_skills: Iterable[str] | None, required_skills: Iterable[str] | None) -> int:
    required = normalize_skills(required_skills)
    if not required:
        return 0
    user = normalize_skills(user_skills)
    matches = len(required & user)
    return round((matches / len(required)) * 100)


def matched_skills(user_skills: Iterable[str] | None, required_skills: Iterable[str] | None) -> list[str]:
    user = normalize_skills(user_skills)
    result: list[str] = []
    for skill in required_skills or []:
        if normalize_skill(skill) in user:
            result.append(skill)
    return result
