"""Return one illustrative fixture, independently of the submitted statement."""

from app.schemas.analysis import (
    AnalyzeRequest,
    AnalyzeResponse,
    ComplexityGuidance,
    Constraint,
    Hint,
    TechniquePrediction,
)


def analyze_problem(_request: AnalyzeRequest) -> AnalyzeResponse:
    """The argument is intentionally unused: Stage 1 performs no inference."""
    return AnalyzeResponse(
        analysis_type="mock",
        demo_notice=(
            "Demo analysis: This is currently placeholder data. Real LLM-powered "
            "analysis will be added in the next development stage. "
            "This fixed array-and-range-query example is unrelated to your submission."
        ),
        simplified_problem=(
            "Example only: Given a fixed array of integers and several queries, "
            "each asking about a contiguous range, reason about how information "
            "from the unchanged array might be reused between queries."
        ),
        constraints=[
            Constraint(variable="N", description="Demo assumption: 1 ≤ N ≤ 100,000 array elements."),
            Constraint(variable="Q", description="Demo assumption: 1 ≤ Q ≤ 100,000 range queries."),
            Constraint(variable="Array", description="Demo assumption: values do not change between queries."),
        ],
        complexity_guidance=[
            ComplexityGuidance(
                complexity="O(N × Q)",
                assessment="Illustrative baseline to examine",
                explanation=(
                    "Under the demo assumptions, scanning the entire array for every "
                    "query could visit up to 10 billion elements. This is a rough count, "
                    "not an AC or TLE prediction."
                ),
            ),
            ComplexityGuidance(
                complexity="O(N + Q)",
                assessment="Illustrative target to investigate",
                explanation=(
                    "Reusing work may reduce repeated processing for some range queries. "
                    "Whether this target is possible depends on the operation and its properties."
                ),
            ),
        ],
        possible_techniques=[
            TechniquePrediction(
                name="Preprocessing",
                explanation="Demo concept: consider what can be computed once for an unchanged array.",
            ),
            TechniquePrediction(
                name="Prefix summaries",
                explanation=(
                    "Demo concept only: explore whether summaries of prefixes can be combined "
                    "to answer the required range operation. This is not a prediction for your input."
                ),
            ),
        ],
        hints=[
            Hint(level=1, text="Demo observation: the queries change, but the array stays the same."),
            Hint(level=2, text="Demo direction: which pieces of work would be repeated if each query were processed independently?"),
            Hint(level=3, text="Demo exploration: investigate reusable summaries and the properties the queried operation would need. No complete algorithm is provided here."),
        ],
    )
