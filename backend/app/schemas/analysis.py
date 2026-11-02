"""Separate model-generated content from server-owned provider metadata."""

from typing import Annotated, Literal, Self

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints, field_validator, model_validator

MIN_STATEMENT_LENGTH = 20
MAX_STATEMENT_LENGTH = 20_000


class AnalyzeRequest(BaseModel):
    statement: Annotated[str, StringConstraints(
        strict=True, strip_whitespace=True,
        min_length=MIN_STATEMENT_LENGTH, max_length=MAX_STATEMENT_LENGTH,
    )]


def non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("Text must not be blank")
    if "```" in value:
        raise ValueError("Analysis must not contain fenced code blocks")
    return value


# Runtime validators deliberately avoid unsupported JSON Schema string/array
# limits. The generation schema stays simple; Python still checks all invariants.
Text = Annotated[str, AfterValidator(non_blank)]


class ContentModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)


class Constraint(ContentModel):
    variable: Text
    expression: Text | None
    description: Text


class ComplexityGuidance(ContentModel):
    complexity: Text
    assessment: Text
    explanation: Text


class TechniquePrediction(ContentModel):
    name: Text
    explanation: Text
    # Hypotheses only: no fabricated confidence percentages.


class Hint(ContentModel):
    level: Literal[1, 2, 3]
    text: Text


class AnalysisContent(ContentModel):
    simplified_problem: Text
    objective: Text | None
    input_summary: Text | None
    output_summary: Text | None
    constraints: list[Constraint]
    complexity_guidance: list[ComplexityGuidance]
    possible_techniques: list[TechniquePrediction]
    important_observations: list[Text]
    hints: list[Hint]
    uncertainties: list[Text]

    @field_validator("hints")
    @classmethod
    def exactly_three_ordered_hints(cls, hints: list[Hint]) -> list[Hint]:
        if [hint.level for hint in hints] != [1, 2, 3]:
            raise ValueError("Exactly three hints in levels 1, 2, 3 order are required")
        return hints


class AnalyzeResponse(AnalysisContent):
    analysis_type: Literal["ai", "mock"]
    provider: Literal["groq", "fake"]
    model: Text | None
    demo_notice: Text | None

    @model_validator(mode="after")
    def honest_metadata(self) -> Self:
        if self.provider == "fake":
            if self.analysis_type != "mock" or self.model is not None or self.demo_notice is None:
                raise ValueError("Fake output must be labeled as a demo")
        elif self.analysis_type != "ai" or self.model is None or self.demo_notice is not None:
            raise ValueError("Groq output must have AI metadata without a demo notice")
        return self
