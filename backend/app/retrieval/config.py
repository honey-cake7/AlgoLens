"""Independent local retrieval settings; invalid LLM settings do not affect search."""

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.core.config import REPOSITORY_ROOT, _environment

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
DEFAULT_MODEL_DIR = REPOSITORY_ROOT / ".cache" / "models" / "all-MiniLM-L6-v2"
# Task-cue blend weight, selected on the dev split only (docs/RETRIEVAL.md).
CUE_WEIGHT = 0.2


class RetrievalUnavailable(Exception):
    """Internal failure. API exposes fixed messages, never raw library errors."""


class RetrievalSettings(BaseModel):
    model_config = ConfigDict(frozen=True, hide_input_in_errors=True)
    method: Literal["tfidf", "semantic"] = "tfidf"
    top_k: int = Field(default=5, ge=1, le=20)
    model: Literal["sentence-transformers/all-MiniLM-L6-v2"] = MODEL_ID
    model_dir: Path = DEFAULT_MODEL_DIR
    # "cues" blends deterministic task-cue similarity into the base ranking;
    # "none" reproduces the Stage 4 text-only ranking exactly.
    rerank: Literal["cues", "none"] = "cues"


def get_retrieval_settings() -> RetrievalSettings:
    env = _environment()
    names = {"method": "RETRIEVAL_METHOD", "top_k": "RETRIEVAL_TOP_K", "model": "EMBEDDING_MODEL", "model_dir": "EMBEDDING_CACHE_DIR", "rerank": "RETRIEVAL_RERANK"}
    try:
        settings = RetrievalSettings(**{key: env[name] for key, name in names.items() if name in env})
        if not settings.model_dir.is_absolute():
            settings = settings.model_copy(update={"model_dir": REPOSITORY_ROOT / settings.model_dir})
        return settings
    except ValidationError:
        raise RetrievalUnavailable("Invalid local retrieval configuration") from None
