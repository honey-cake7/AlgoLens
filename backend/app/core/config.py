"""Backend-only settings. Reading configuration never calls a provider."""

import os
from pathlib import Path
from typing import Literal

from dotenv import dotenv_values
from pydantic import BaseModel, ConfigDict, Field, SecretStr, ValidationError, field_validator

from app.core.errors import AnalysisError

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseModel):
    model_config = ConfigDict(frozen=True, hide_input_in_errors=True)

    llm_provider: Literal["fake", "groq"] = "fake"
    groq_api_key: SecretStr | None = Field(default=None, repr=False)
    groq_model: str = "openai/gpt-oss-120b"
    groq_max_output_tokens: int = Field(default=3072, ge=512, le=4096)
    groq_timeout_seconds: float = Field(default=30, gt=0, le=40)
    # Local safeguard on live provider calls per minute (fake mode is unlimited).
    groq_requests_per_minute: int = Field(default=10, ge=1, le=60)

    @field_validator("groq_api_key", mode="before")
    @classmethod
    def empty_key_is_missing(cls, value):
        return None if isinstance(value, str) and not value.strip() else value


def _environment() -> dict[str, str | None]:
    # Do not mutate os.environ: process settings take precedence over root .env.
    return {**dotenv_values(REPOSITORY_ROOT / ".env"), **os.environ}


def get_settings() -> Settings:
    values = _environment()
    names = {
        "llm_provider": "LLM_PROVIDER",
        "groq_api_key": "GROQ_API_KEY",
        "groq_model": "GROQ_MODEL",
        "groq_max_output_tokens": "GROQ_MAX_OUTPUT_TOKENS",
        "groq_timeout_seconds": "GROQ_TIMEOUT_SECONDS",
        "groq_requests_per_minute": "GROQ_REQUESTS_PER_MINUTE",
    }
    try:
        return Settings(**{field: values[name] for field, name in names.items() if name in values})
    except ValidationError:
        # Never include a validation error containing environment input values.
        raise AnalysisError("configuration_error") from None


def get_cors_origins() -> list[str]:
    value = _environment().get("CORS_ORIGINS") or "http://localhost:5173,http://127.0.0.1:5173"
    return [origin.strip() for origin in value.split(",") if origin.strip()]
