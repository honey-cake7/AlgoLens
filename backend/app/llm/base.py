from typing import Literal, Protocol

from app.schemas.analysis import AnalysisContent


class LLMProvider(Protocol):
    name: Literal["fake", "groq"]
    model: str | None

    async def analyze(self, statement: str) -> AnalysisContent: ...
