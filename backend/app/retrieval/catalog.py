"""Inspectable original records, validated on load and content-addressed."""

import hashlib
import json
from pathlib import Path

from pydantic import TypeAdapter

from app.schemas.retrieval import PracticeProblem

CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "practice_problems.json"
REPRESENTATION_VERSION = "task-only-v1"


def load_catalog(path: Path = CATALOG_PATH) -> tuple[list[PracticeProblem], str]:
    data = path.read_bytes()
    records = TypeAdapter(list[PracticeProblem]).validate_python(json.loads(data))
    if len({item.id for item in records}) != len(records):
        raise ValueError("Catalog IDs must be unique")
    revision = hashlib.sha256(data + REPRESENTATION_VERSION.encode()).hexdigest()[:16]
    return sorted(records, key=lambda item: item.id), revision


def retrieval_text(problem: PracticeProblem) -> str:
    # Ground-truth technique metadata, difficulty, IDs and titles are excluded.
    return "Task: " + problem.normalized_description
