"""One async Groq request per explicit analysis; no retries or fallback."""

import asyncio
import json
from typing import Literal

from groq import (
    APIConnectionError, APIResponseValidationError, APIStatusError,
    APITimeoutError, AsyncGroq, RateLimitError,
)
from pydantic import ValidationError

from app.core.config import Settings
from app.core.errors import AnalysisError
from app.llm.prompts import SYSTEM_PROMPT
from app.schemas.analysis import AnalysisContent

SUPPORTED_MODELS = {"openai/gpt-oss-120b", "openai/gpt-oss-20b"}


class GroqProvider:
    name: Literal["groq"] = "groq"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.model = settings.groq_model
        # Deliberately no SDK client, model listing, or request during construction.

    async def analyze(self, statement: str) -> AnalysisContent:
        if self.settings.groq_api_key is None or self.model not in SUPPORTED_MODELS:
            raise AnalysisError("configuration_error")
        try:
            async with asyncio.timeout(self.settings.groq_timeout_seconds):
                async with AsyncGroq(
                    api_key=self.settings.groq_api_key.get_secret_value(),
                    base_url="https://api.groq.com",  # Ignore any GROQ_BASE_URL redirect.
                    max_retries=0,
                    timeout=self.settings.groq_timeout_seconds,
                ) as client:
                    completion = await client.chat.completions.create(
                        model=self.model,
                        messages=[
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": json.dumps({"problem_statement": statement}, ensure_ascii=False)},
                        ],
                        response_format={
                            "type": "json_schema",
                            "json_schema": {
                                "name": "algolens_analysis",
                                "strict": True,
                                "schema": AnalysisContent.model_json_schema(),
                            },
                        },
                        max_completion_tokens=self.settings.groq_max_output_tokens,
                        reasoning_effort="low",
                        stream=False,
                    )
            choice = completion.choices[0]
            if choice.finish_reason != "stop" or not choice.message.content:
                raise AnalysisError("invalid_response")
            return AnalysisContent.model_validate_json(choice.message.content)
        except AnalysisError:
            raise
        except RateLimitError:
            raise AnalysisError("rate_limit") from None
        except (APITimeoutError, TimeoutError):
            raise AnalysisError("provider_timeout") from None
        except APIConnectionError:
            raise AnalysisError("provider_unavailable") from None
        except APIResponseValidationError:
            raise AnalysisError("invalid_response") from None
        except APIStatusError as error:
            code = "provider_unavailable" if error.status_code >= 500 else "configuration_error"
            raise AnalysisError(code) from None
        except (ValidationError, ValueError, IndexError, TypeError, AttributeError):
            # No raw model output, SDK message, or credential is returned/logged.
            raise AnalysisError("invalid_response") from None
