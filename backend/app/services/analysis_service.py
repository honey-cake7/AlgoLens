"""Provider selection and server-owned response metadata."""

import asyncio

from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.errors import AnalysisError
from app.llm.base import LLMProvider
from app.llm.fake_provider import DEMO_NOTICE, FakeLLMProvider
from app.llm.groq_provider import GroqProvider
from app.schemas.analysis import AnalysisContent, AnalyzeRequest, AnalyzeResponse
from app.services.algorithmic_service import assess_statement, compare_ai_guidance
from app.services.similar_problem_service import get_similar_service


class AnalysisService:
    def __init__(self, provider: LLMProvider):
        self.provider = provider

    async def analyze(self, request: AnalyzeRequest) -> AnalyzeResponse:
        try:
            deterministic = assess_statement(request.statement)
            content = AnalysisContent.model_validate(await self.provider.analyze(request.statement))
            is_fake = self.provider.name == "fake"
            if not is_fake:
                deterministic = compare_ai_guidance(deterministic, content.complexity_guidance)
            similar_problems, retrieval_warning = None, None
            try:
                # AI text is not independently verified. Use it only when there
                # are no reported uncertainties; fake content never rewrites input.
                use_simplification = not is_fake and not content.uncertainties
                query = content.simplified_problem if use_simplification else request.statement
                source = "ai_simplification" if use_simplification else "raw_statement"
                similar_problems = await asyncio.wait_for(
                    run_in_threadpool(get_similar_service().search, query, None, source), timeout=3,
                )
            except Exception:
                retrieval_warning = "Similar problems are unavailable; the analysis and hints are still available."
            return AnalyzeResponse(
                **content.model_dump(),
                deterministic=deterministic,
                similar_problems=similar_problems,
                retrieval_warning=retrieval_warning,
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
