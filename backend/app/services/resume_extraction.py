import asyncio
import io
import json
import logging
import re
from typing import Any

import fitz
import pytesseract
from docx import Document
from openai import OpenAI, OpenAIError
from PIL import Image

from app.core import storage
from app.core.config import settings
from app.models.resume import ResumeDocument

logger = logging.getLogger(__name__)

MIN_PDF_NATIVE_TEXT_CHARS = 400
MAX_TEXT_CHARS_FOR_LLM = 24000


async def load_document_bytes(document: ResumeDocument) -> bytes:
    stream_info = storage.get_object_stream(document.file_url)
    return await asyncio.to_thread(stream_info["body"].read)


def _pixmap_to_image(pixmap: fitz.Pixmap) -> Image.Image:
    mode = "RGBA" if pixmap.alpha else "RGB"
    return Image.frombytes(mode, [pixmap.width, pixmap.height], pixmap.samples)


async def _ocr_image(image: Image.Image) -> str:
    def _run() -> str:
        return pytesseract.image_to_string(image, lang="eng+rus")

    return await asyncio.to_thread(_run)


async def extract_text_from_pdf(content: bytes) -> tuple[str, dict[str, Any]]:
    pdf = fitz.open(stream=content, filetype="pdf")
    page_texts: list[str] = []
    native_char_count = 0

    for page in pdf:
        text = (page.get_text("text") or "").strip()
        page_texts.append(text)
        native_char_count += len(text)

    used_ocr = native_char_count < MIN_PDF_NATIVE_TEXT_CHARS
    ocr_page_count = 0

    if used_ocr:
        page_texts = []
        for page in pdf:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            image = _pixmap_to_image(pixmap)
            text = (await _ocr_image(image)).strip()
            page_texts.append(text)
            if text:
                ocr_page_count += 1

    combined = "\n\n".join([text for text in page_texts if text]).strip()
    metadata = {
        "file_type": "pdf",
        "pages": len(pdf),
        "used_ocr": used_ocr,
        "native_char_count": native_char_count,
        "ocr_page_count": ocr_page_count,
    }
    pdf.close()
    return combined, metadata


async def extract_text_from_docx(content: bytes) -> tuple[str, dict[str, Any]]:
    def _run() -> tuple[str, dict[str, Any]]:
        doc = Document(io.BytesIO(content))
        lines = [paragraph.text.strip() for paragraph in doc.paragraphs if paragraph.text and paragraph.text.strip()]
        return "\n".join(lines).strip(), {
            "file_type": "docx",
            "paragraph_count": len(lines),
            "used_ocr": False,
        }

    return await asyncio.to_thread(_run)


async def extract_text_from_image(content: bytes) -> tuple[str, dict[str, Any]]:
    image = await asyncio.to_thread(lambda: Image.open(io.BytesIO(content)).convert("RGB"))
    text = (await _ocr_image(image)).strip()
    return text, {
        "file_type": "image",
        "used_ocr": True,
        "width": image.width,
        "height": image.height,
    }


async def extract_text_from_document(document: ResumeDocument) -> tuple[str, dict[str, Any]]:
    content = await load_document_bytes(document)
    mime_type = document.mime_type

    if mime_type == "application/pdf":
        return await extract_text_from_pdf(content)
    if mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return await extract_text_from_docx(content)
    if mime_type.startswith("image/"):
        return await extract_text_from_image(content)

    raise ValueError(f"Unsupported document mime type: {mime_type}")


def _truncate_text(text: str, limit: int = MAX_TEXT_CHARS_FOR_LLM) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[:limit]


def _fallback_extract_name(text: str) -> str | None:
    for line in text.splitlines():
        candidate = line.strip()
        if 3 <= len(candidate) <= 80 and not re.search(r"[@|/\\]|resume|cv|summary|skills", candidate, re.I):
            return candidate
    return None


def _fallback_extract_graduation_year(text: str) -> int | None:
    matches = re.findall(r"\b(20\d{2}|19\d{2})\b", text)
    years = [int(value) for value in matches if 1990 <= int(value) <= 2099]
    return min(years) if years else None


def _fallback_extract_skills(text: str) -> list[dict[str, Any]]:
    skills_section = re.search(r"(skills|tech stack|technologies)\s*[:\-]?\s*(.+)", text, re.I)
    if not skills_section:
        return []
    raw = skills_section.group(2)
    parts = [item.strip() for item in re.split(r"[,\|/•]", raw) if item.strip()]
    return [
        {
            "name": item,
            "confidence": 0.45,
            "source_snippet": raw[:300],
            "requires_review": True,
        }
        for item in parts[:20]
    ]


def fallback_resume_draft(text: str) -> dict[str, Any]:
    return {
        "identity": {
            "full_name": {
                "value": _fallback_extract_name(text),
                "confidence": 0.35,
                "source_snippet": (text[:240] if text else None),
                "requires_review": True,
            },
            "graduation_year": {
                "value": _fallback_extract_graduation_year(text),
                "confidence": 0.3,
                "source_snippet": (text[:240] if text else None),
                "requires_review": True,
            },
            "faculty": {"value": None, "confidence": 0.0, "source_snippet": None, "requires_review": True},
            "program": {"value": None, "confidence": 0.0, "source_snippet": None, "requires_review": True},
        },
        "education": [],
        "employment": [],
        "skills": _fallback_extract_skills(text),
        "_meta": {
            "provider": "fallback",
            "requires_manual_review": True,
        },
    }


def _collect_field_confidences(draft: dict[str, Any]) -> dict[str, Any]:
    identity = draft.get("identity") or {}
    confidences: dict[str, Any] = {
        "identity": {},
        "education": [],
        "employment": [],
        "skills": [],
    }

    for key, value in identity.items():
        if isinstance(value, dict):
            confidences["identity"][key] = {
                "confidence": value.get("confidence"),
                "requires_review": value.get("requires_review", True),
            }

    for section in ("education", "employment", "skills"):
        for item in draft.get(section) or []:
            confidences[section].append(
                {
                    "confidence": item.get("confidence"),
                    "requires_review": item.get("requires_review", True),
                }
            )

    return confidences


def _get_openai_client() -> OpenAI | None:
    if not settings.OPENAI_API_KEY:
        return None
    return OpenAI(api_key=settings.OPENAI_API_KEY)


async def extract_structured_resume_data(text: str) -> tuple[dict[str, Any], dict[str, Any], str, str]:
    truncated_text = _truncate_text(text)
    client = _get_openai_client()

    if not client or not truncated_text:
        draft = fallback_resume_draft(truncated_text)
        return draft, _collect_field_confidences(draft), "fallback", "v1"

    prompt = f"""
Extract a structured alumni career draft from the resume text.

Return valid JSON only with this schema:
{{
  "identity": {{
    "full_name": {{"value": string|null, "confidence": number, "source_snippet": string|null, "requires_review": boolean}},
    "faculty": {{"value": string|null, "confidence": number, "source_snippet": string|null, "requires_review": boolean}},
    "program": {{"value": string|null, "confidence": number, "source_snippet": string|null, "requires_review": boolean}},
    "graduation_year": {{"value": number|null, "confidence": number, "source_snippet": string|null, "requires_review": boolean}},
    "current_company": {{"value": string|null, "confidence": number, "source_snippet": string|null, "requires_review": boolean}},
    "current_role": {{"value": string|null, "confidence": number, "source_snippet": string|null, "requires_review": boolean}}
  }},
  "education": [
    {{
      "school": string,
      "degree": string|null,
      "field_of_study": string|null,
      "faculty": string|null,
      "program": string|null,
      "start_date": string|null,
      "end_date": string|null,
      "description": string|null,
      "confidence": number,
      "source_snippet": string|null,
      "requires_review": boolean
    }}
  ],
  "employment": [
    {{
      "company": string,
      "role": string|null,
      "start_date": string|null,
      "end_date": string|null,
      "location": string|null,
      "description": string|null,
      "is_current": boolean,
      "confidence": number,
      "source_snippet": string|null,
      "requires_review": boolean
    }}
  ],
  "skills": [
    {{
      "name": string,
      "confidence": number,
      "source_snippet": string|null,
      "requires_review": boolean
    }}
  ]
}}

Rules:
- If uncertain, set lower confidence and requires_review=true.
- Do not invent facts.
- Dates may stay as strings exactly as found.
- Prefer extracting current role/company from latest current employment.

Resume text:
{truncated_text}
"""

    def _run() -> tuple[dict[str, Any], dict[str, Any], str, str]:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.1,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": "You extract structured career data from resumes and return strict JSON.",
                },
                {"role": "user", "content": prompt},
            ],
        )
        content = response.choices[0].message.content or "{}"
        draft = json.loads(content)
        return draft, _collect_field_confidences(draft), "gpt-4o-mini", "v1"

    try:
        return await asyncio.to_thread(_run)
    except (OpenAIError, json.JSONDecodeError, KeyError, IndexError) as exc:
        logger.warning("Structured resume extraction fell back to heuristics: %s", exc)
        draft = fallback_resume_draft(truncated_text)
        return draft, _collect_field_confidences(draft), "fallback", "v1"
