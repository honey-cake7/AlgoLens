"""Provider selection and server-owned response metadata."""

from pydantic import ValidationError

from app.core.config import get_settings
from app.core.errors import AnalysisError
from app.llm.base import LLMProvider
from app.llm.fake_provider import DEMO_NOTICE, FakeLLMProvider
from app.llm.groq_provider import GroqProvider
from app.schemas.analysis import AnalysisContent, AnalyzeRequest, AnalyzeResponse


class AnalysisService:
    def __init__(self, provider: LLMProvider):
        self.provider = provider

    async def analyze(self, request: AnalyzeRequest) -> AnalyzeResponse:
        try:
            content = AnalysisContent.model_validate(await self.provider.analyze(request.statement))
            is_fake = self.provider.name == "fake"
            return AnalyzeResponse(
                **content.model_dump(),
                analysis_type="mock" if is_fake else "ai",
                provider=self.provider.name,
                model=self.provider.model,
                demo_notice=DEMO_NOTICE if is_fake else None,
            )
        except AnalysisError:
            raise
        except ValidationError:
            raise AnalysisError("invalid_response") from None
        except Exception:
            # A controlled final boundary; unexpected errors must not reveal SDK
            # internals or environment values through a traceback or response.
            raise AnalysisError("internal_error") from None


def get_analysis_service() -> AnalysisService:
    settings = get_settings()
    provider = FakeLLMProvider() if settings.llm_provider == "fake" else GroqProvider(settings)
    return AnalysisService(provider)
