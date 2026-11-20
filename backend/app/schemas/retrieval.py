"""Catalog provenance and server-owned retrieval results; never LLM fields."""

import re
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

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
    # Stage 6: "external_curated" records are allowed only with full provenance
    # checked against source/license evidence (assistant review is allowed).
    # Record the review in license_note. Never generate or guess URLs.
    source_type: Literal["original_practice", "external_curated"] = "original_practice"
    source_url: str | None = None
    source_name: Text | None = None
    license_note: Text | None = None
    verified_on: date | None = None
    # Credit line shown with the match (title, author, source, license) and the
    # license deed linked from the source page; required by CC BY / BY-SA.
    attribution: Text | None = None
    license_url: str | None = None

    @model_validator(mode="after")
    def provenance_matches_source_type(self):
        provenance = (self.source_url, self.source_name, self.license_note, self.verified_on, self.attribution, self.license_url)
        if self.source_type == "original_practice":
            if any(value is not None for value in provenance):
                raise ValueError("Original practice records must not claim external URLs or provenance")
        else:
            if any(value is None for value in provenance):
                raise ValueError("External records need source_url, source_name, license_note, verified_on, attribution and license_url")
            for url in (self.source_url, self.license_url):
                if not re.fullmatch(r"https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:/[^\s<>\"']*)?", url):
                    raise ValueError("External source and license URLs must be plain https links")
        return self

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
    source_type: Literal["original_practice", "external_curated"] = "original_practice"
    source_url: str | None = None
    source_name: str | None = None
    attribution: str | None = None
    license_url: str | None = None

    @model_validator(mode="after")
    def link_only_for_external(self):
        original = self.source_type == "original_practice"
        if any(original != (value is None) for value in (self.source_url, self.attribution, self.license_url)):
            raise ValueError("Only external curated matches carry a source URL, attribution and license URL")
        return self


class SimilarResponse(RetrievalModel):
    query: str
    query_source: Literal["raw_statement", "ai_simplification"] = "raw_statement"
    requested_method: Method
    retrieval_method: Method
    catalog_revision: Text
    reranking: Literal["none", "task_cues"] = "none"
    # Query topics with no catalog coverage (from task cues); empty means none detected,
    # which is not proof that a strong match exists.
    uncovered_topics: list[Text] = Field(default_factory=list)
    matches: list[SimilarMatch] = Field(default_factory=list)
    warnings: list[Text] = Field(default_factory=list)
