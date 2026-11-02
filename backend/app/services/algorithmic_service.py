"""Offline orchestration and limited, explicitly tentative source comparison."""

import re

from app.algorithmic.complexity import ComplexityEngine
from app.algorithmic.constraints import ConstraintParser
from app.algorithmic.numbers import normalize_math
from app.schemas.algorithmic import AlgorithmicAssessment
from app.schemas.analysis import ComplexityGuidance


def assess_statement(statement: str) -> AlgorithmicAssessment:
    return ComplexityEngine().assess(ConstraintParser().parse(statement))


def compare_ai_guidance(result: AlgorithmicAssessment, guidance: list[ComplexityGuidance]) -> AlgorithmicAssessment:
    """Flag a possible disagreement without adjudicating algorithm correctness."""
    if result.selected_parameter is None:
        return result
    discrepancies = list(result.discrepancies)
    normalize = lambda text: re.sub(r"\s+", "", normalize_math(text).replace("**", "^")).lower()
    for suggestion in guidance:
        wording = (suggestion.assessment + " " + suggestion.explanation).lower()
        if re.search(r"infeasible|not feasible|too large|avoid|prohibitive|not recommended|unlikely", wording):
            continue
        if not re.search(r"promising|feasible|suitable|recommended|reasonable|plausible", suggestion.assessment, re.I):
            continue
        for item in result.assessments:
            expected = item.complexity.replace("n", result.selected_parameter)
            if item.scope == "per_instance" and item.assessment == "likely_infeasible" and normalize(expected) == normalize(suggestion.complexity):
                discrepancies.append(
                    f"Potential inconsistency: the AI describes {suggestion.complexity} as {suggestion.assessment}, "
                    f"while deterministic growth at the parsed maximum for {result.selected_parameter} is likely infeasible. "
                    "Review parameter meanings, worst-case assumptions and implementation costs; neither source guarantees a verdict."
                )
    return result.model_copy(update={"discrepancies": list(dict.fromkeys(discrepancies))})
