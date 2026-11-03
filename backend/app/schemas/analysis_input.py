"""Shared input contract, independent of output schemas and providers."""

from typing import Annotated

from pydantic import BaseModel, StringConstraints

MIN_STATEMENT_LENGTH = 20
MAX_STATEMENT_LENGTH = 20_000


class StatementRequest(BaseModel):
    statement: Annotated[str, StringConstraints(
        strict=True, strip_whitespace=True,
        min_length=MIN_STATEMENT_LENGTH, max_length=MAX_STATEMENT_LENGTH,
    )]
