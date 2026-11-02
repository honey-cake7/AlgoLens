"""Server-generated offline analysis; never part of the LLM generation schema."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Scope = Literal["global", "per_test_case", "sum_over_test_cases", "unknown"]
Role = Literal["array_length", "sequence_length", "size", "vertices", "edges", "queries", "test_cases", "element_value", "unknown"]
Reliability = Literal["explicit", "contextual", "ambiguous", "conflicting"]
Feasibility = Literal["promising", "possibly_feasible", "likely_infeasible", "insufficient_information"]


class AlgorithmicModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class ParsedConstraint(AlgorithmicModel):
    variable: str
    lower_bound: int | None
    upper_bound: int | None
    source_text: str
    normalized_expression: str
    scope: Scope
    role: Role
    reliability: Reliability
    meaning_evidence: str | None


class SizeParameter(AlgorithmicModel):
    variable: str
    role: Role
    lower_bound: int | None
    upper_bound: int | None
    scope: Scope
    reliability: Reliability
    meaning_evidence: str


class TestCases(AlgorithmicModel):
    present: bool = False
    variable: str | None = None
    lower_bound: int | None = None
    upper_bound: int | None = None
    reliability: Reliability = "ambiguous"


class ResourceLimit(AlgorithmicModel):
    kind: Literal["time", "memory"]
    amount: float
    unit: Literal["seconds", "MB", "MiB", "GB", "GiB", "KB", "KiB"]
    source_text: str


class ConstraintExtraction(AlgorithmicModel):
    constraints: list[ParsedConstraint] = Field(default_factory=list)
    size_parameters: list[SizeParameter] = Field(default_factory=list)
    test_cases: TestCases = Field(default_factory=TestCases)
    resource_limits: list[ResourceLimit] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)


class ComplexityAssessment(AlgorithmicModel):
    complexity: str
    parameter: str | None
    scope: Literal["per_instance", "all_test_cases"]
    assessment: Feasibility
    estimated_work: float | None
    log10_work: float | None
    work_display: str | None
    work_kind: Literal["growth_at_bound", "total_upper_bound", "unavailable"]
    explanation: str
    caveats: list[str] = Field(default_factory=list)


class AlgorithmicAssessment(AlgorithmicModel):
    source: Literal["deterministic"] = "deterministic"
    extraction: ConstraintExtraction
    selected_parameter: str | None
    assessments: list[ComplexityAssessment]
    uncertainties: list[str] = Field(default_factory=list)
    discrepancies: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)
