"""Catalog provenance and server-owned retrieval results; never LLM fields."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.schemas.analysis_input import StatementRequest

Text = Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=1)]
Tag = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_]*$")]
Method = Literal["tfidf", "semantic"]


class RetrievalModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class PracticeProblem(RetrievalModel):
    id: Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_]*$")]
    title: Text
    short_description: Text
    normalized_description: Text
    main_technique: Tag
    secondary_tags: list[Tag]
    difficulty: Literal["easy", "medium", "hard"]
    constraints_summary: Text | None = None
    source_type: Literal["original_practice"] = "original_practice"
    source_url: str | None = None

    @field_validator("source_url")
    @classmethod
    def original_records_have_no_external_url(cls, value):
        # All records in this stage are ours, not verified hosted contest tasks.
        if value is not None:
            raise ValueError("Original practice records must not claim external URLs")
        return value

    @field_validator("secondary_tags")
    @classmethod
    def unique_tags(cls, tags):
        if len(tags) != len(set(tags)):
            raise ValueError("Duplicate technique tags")
        return tags


class SimilarRequest(StatementRequest):
    k: int | None = Field(default=None, ge=1, le=20, strict=True)


class SimilarMatch(RetrievalModel):
    problem_id: Text
    title: Text
    short_description: Text
    difficulty: Literal["easy", "medium", "hard"]
    technique_tags: list[Tag]
    similarity_score: float = Field(ge=-1, le=1)
    retrieval_method: Method
    explanation: Text
    source_type: Literal["original_practice"] = "original_practice"
    source_url: None = None


class SimilarResponse(RetrievalModel):
    query: str
    query_source: Literal["raw_statement", "ai_simplification"] = "raw_statement"
    requested_method: Method
    retrieval_method: Method
    catalog_revision: Text
    matches: list[SimilarMatch] = Field(default_factory=list)
    warnings: list[Text] = Field(default_factory=list)
