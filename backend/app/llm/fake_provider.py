"""No credentials, inference, keyword rules or network access."""

from typing import Literal

from app.schemas.analysis import AnalysisContent

DEMO_NOTICE = (
    "Demo Mode: This fixed array-and-range-query example is unrelated to your submission. "
    "FakeLLMProvider runs offline; it does not analyze the entered statement."
)


class FakeLLMProvider:
    name: Literal["fake"] = "fake"
    model: str | None = None

    async def analyze(self, _statement: str) -> AnalysisContent:
        return AnalysisContent.model_validate({
            "simplified_problem": "Example only: Given an unchanged integer array and inclusive contiguous-range queries, report the sum of the elements in each queried range.",
            "objective": "For every demo query, calculate its range sum.",
            "input_summary": "Demo input: N array elements, Q queries, and the left and right endpoints of each query.",
            "output_summary": "Demo output: one integer sum for each query, in input order.",
            "constraints": [
                {"variable": "N", "expression": "1 ≤ N ≤ 100,000", "description": "Demo assumption: array size."},
                {"variable": "Q", "expression": "1 ≤ Q ≤ 100,000", "description": "Demo assumption: number of queries."},
                {"variable": "Array", "expression": None, "description": "Demo assumption: values do not change between queries; value bounds were not supplied."},
            ],
            "complexity_guidance": [
                {"complexity": "O(N × Q)", "assessment": "Illustrative baseline to examine", "explanation": "Under the demo assumptions, a full scan per query could visit up to 10 billion elements. This rough count is not an AC or TLE prediction."},
                {"complexity": "O(N + Q)", "assessment": "Illustrative target to investigate", "explanation": "Reusing work across these static range-sum queries may reduce repeated processing. Actual feasibility depends on the operation, implementation and resource limits."},
            ],
            "possible_techniques": [
                {"name": "Preprocessing", "explanation": "Demo concept: consider information that can be computed once for an unchanged array."},
                {"name": "Prefix summaries", "explanation": "Demo concept: investigate whether information about prefixes can help with contiguous ranges. This is not a prediction for your input."},
            ],
            "important_observations": ["Demo observation: the array is unchanged across queries.", "Demo observation: query order must be preserved in the output."],
            "hints": [
                {"level": 1, "text": "Demo observation: the queries change, but the array stays the same."},
                {"level": 2, "text": "Demo direction: which pieces of work would be repeated if each query were processed independently?"},
                {"level": 3, "text": "Demo exploration: investigate reusable summaries and the properties of addition. Leave the exact representation and implementation to your own reasoning."},
            ],
            "uncertainties": ["This fixed example is unrelated to the submitted problem.", "The demo provides no time limit, memory limit, or array-value bounds."],
        })
