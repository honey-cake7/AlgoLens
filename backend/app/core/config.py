"""Read local settings independently of the server's working directory."""

import os
from pathlib import Path

from dotenv import load_dotenv

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def get_cors_origins() -> list[str]:
    # Existing process variables take precedence over local .env values.
    load_dotenv(REPOSITORY_ROOT / ".env", override=False)
    value = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    )
    return [origin.strip() for origin in value.split(",") if origin.strip()]
