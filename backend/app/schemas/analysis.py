"""Stage 1 HTTP contracts. Mock data makes no claims about the input."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

MIN_STATEMENT_LENGTH = 20
MAX_STATEMENT_LENGTH = 20_000


class AnalyzeRequest(BaseModel):
    statement: Annotated[
        str,
        StringConstraints(
            strict=True,
            strip_whitespace=True,
            min_length=MIN_STATEMENT_LENGTH,
            max_length=MAX_STATEMENT_LENGTH,
        ),
    ]


class Constraint(BaseModel):
    variable: str
    description: str


class ComplexityGuidance(BaseModel):
    complexity: str
    assessment: str
    explanation: str


class TechniquePrediction(BaseModel):
    name: str
    explanation: str
    # No confidence: this is a fixed teaching example, not a prediction.


class Hint(BaseModel):
    level: Literal[1, 2, 3]
    text: str


class AnalyzeResponse(BaseModel):
    analysis_type: Literal["mock"]
    demo_notice: str
    simplified_problem: str
    constraints: list[Constraint]
    complexity_guidance: list[ComplexityGuidance]
    possible_techniques: list[TechniquePrediction]
    hints: list[Hint] = Field(min_length=3, max_length=3)
