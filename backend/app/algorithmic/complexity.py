"""Relative growth at stated bounds, with explicit aggregation assumptions."""

import math
from dataclasses import dataclass

from app.algorithmic.numbers import MAX_INTEGER
from app.schemas.algorithmic import AlgorithmicAssessment, ComplexityAssessment, ConstraintExtraction

CLASSES = ("O(1)", "O(log n)", "O(sqrt n)", "O(n)", "O(n log n)", "O(n^2)", "O(n^3)", "O(2^n)", "O(n!)")
CAVEATS = [
    "These are abstract relative-growth units, not measured operations or runtime seconds; constants, language and implementation matter.",
    "Heuristic bands: up to 10^6 units is promising, up to 10^8 is possibly feasible, above that is likely infeasible at the stated maximum. These are not AC/TLE guarantees or operations-per-second rates.",
    "Time and memory limits are retained as context. No memory-fit assessment is possible without space complexity and representation details.",
]


@dataclass(frozen=True)
class Growth:
    value: float | None
    log10: float | None

    @classmethod
    def from_value(cls, value: float) -> "Growth":
        return cls(value, math.log10(value) if value > 0 else None)

    @classmethod
    def from_log(cls, logarithm: float) -> "Growth":
        return cls(10**logarithm if logarithm <= 300 else None, logarithm)

    def scale(self, factor: int) -> "Growth":
        if factor == 0 or self.value == 0:
            return Growth.from_value(0)
        return Growth.from_log(self.log10 + math.log10(factor))


def growth(complexity: str, n: int) -> Growth:
    """Evaluate in constant time; never materialize giant powers/factorials."""
    if isinstance(n, bool) or not isinstance(n, int) or not 0 <= n <= MAX_INTEGER:
        raise ValueError("Size must be a nonnegative safe integer")
    logarithm = max(1.0, math.log2(max(1, n)))
    values = {
        "O(1)": 1.0, "O(log n)": logarithm, "O(sqrt n)": math.sqrt(n),
        "O(n)": float(n), "O(n log n)": n * logarithm,
        "O(n^2)": float(n) ** 2, "O(n^3)": float(n) ** 3,
    }
    if complexity in values:
        return Growth.from_value(values[complexity])
    if complexity == "O(2^n)":
        return Growth.from_log(n * math.log10(2))
    if complexity == "O(n!)":
        return Growth.from_log(math.lgamma(n + 1) / math.log(10))
    raise ValueError("Unsupported complexity class")


def _row(complexity: str, parameter: str | None, scope: str, work: Growth | None, explanation: str, caveats: list[str] | None = None) -> ComplexityAssessment:
    if work is None:
        category, display = "insufficient_information", None
    else:
        magnitude = work.log10 if work.log10 is not None else float("-inf")
        category = "promising" if magnitude <= 6 else "possibly_feasible" if magnitude <= 8 else "likely_infeasible"
        if work.value is None:
            display = "> 10^300"
        elif work.value <= 1e12:
            display = f"{work.value:,.0f}" if work.value >= 100 else f"{work.value:.3g}"
        else:
            display = f"{work.value:.3g}"
    return ComplexityAssessment(
        complexity=complexity, parameter=parameter, scope=scope, assessment=category,
        estimated_work=work.value if work else None, log10_work=work.log10 if work else None,
        work_display=display,
        work_kind="unavailable" if work is None else "total_upper_bound" if scope == "all_test_cases" else "growth_at_bound",
        explanation=explanation, caveats=caveats or [],
    )


class ComplexityEngine:
    def assess(self, extraction: ConstraintExtraction) -> AlgorithmicAssessment:
        result = AlgorithmicAssessment(extraction=extraction, selected_parameter=None, assessments=[],
                                       uncertainties=list(extraction.uncertainties), caveats=list(CAVEATS))

        def unavailable(reason: str) -> AlgorithmicAssessment:
            result.uncertainties.append(reason)
            result.assessments = [_row(item, None, "per_instance", None, reason) for item in CLASSES]
            return result

        primary = [item for item in extraction.size_parameters if item.role in {"array_length", "sequence_length", "size", "vertices"}]
        candidates = primary or extraction.size_parameters
        if len(candidates) != 1:
            return unavailable("No unique, context-defined primary size parameter is available; multiple sizes or missing meanings prevent a univariate assessment.")
        parameter = candidates[0]
        if parameter.reliability in {"ambiguous", "conflicting"}:
            return unavailable(f"The interpretation or bounds of {parameter.variable} are ambiguous/conflicting.")
        aggregate_records = [item for item in extraction.constraints if item.variable == parameter.variable and item.scope == "sum_over_test_cases"]
        aggregate_invalid = any(item.reliability in {"ambiguous", "conflicting"} for item in aggregate_records)
        aggregate_upper = [item.upper_bound for item in aggregate_records if item.upper_bound is not None]
        total_size = min(aggregate_upper) if aggregate_upper and not aggregate_invalid else None
        upper = parameter.upper_bound
        if total_size is not None:
            if total_size < 0:
                return unavailable("An aggregate bound on nonnegative sizes cannot be negative.")
            upper = min(upper, total_size) if upper is not None else total_size
            if parameter.upper_bound is None:
                result.uncertainties.append(f"The per-case cap {parameter.variable} <= {upper} is derived from a sum bound on nonnegative sizes, not an explicit individual upper bound.")
        if upper is None or upper < 0:
            return unavailable(f"No nonnegative numeric upper bound is available for {parameter.variable}.")
        if parameter.lower_bound is not None and upper < parameter.lower_bound:
            return unavailable("Individual and aggregate bounds are inconsistent for any nonempty test case.")
        cases = extraction.test_cases
        case_upper = cases.upper_bound if cases.reliability not in {"ambiguous", "conflicting"} else None
        if case_upper is not None and case_upper < 0:
            case_upper = None
            result.uncertainties.append("A negative test-count cap cannot be used.")
        if total_size is not None and parameter.lower_bound is not None and parameter.lower_bound >= 1:
            derived_count = total_size // parameter.lower_bound
            case_upper = min(case_upper, derived_count) if case_upper is not None else derived_count
            if cases.lower_bound is not None and case_upper < cases.lower_bound:
                return unavailable("The test-count lower bound conflicts with the aggregate size limit.")
        result.selected_parameter = parameter.variable
        for complexity in CLASSES:
            result.assessments.append(_row(
                complexity, parameter.variable, "per_instance", growth(complexity, upper),
                f"Relative growth evaluated at {parameter.variable} = {upper:,}; this is a bound-based scenario, not measured work.",
                [f"The variable is interpreted as {parameter.role.replace('_', ' ')} from explicit descriptive context.", "Other input dimensions and query costs are not included in this univariate profile."],
            ))

        if cases.present:
            for complexity in CLASSES:
                work = None
                explanation = "A total-test estimate needs a reliable test-count or aggregate-size bound."
                caveats = ["Total estimates are conservative upper bounds, not the actual sum of work across tests."]
                if aggregate_invalid:
                    explanation = "Conflicting or conditional aggregate constraints prevent a reliable total bound."
                elif total_size is not None:
                    # For nonnegative n_i <= U and sum n_i <= S:
                    # sum n_i^p <= U^(p-1) S, not S for p > 1.
                    if complexity == "O(n)":
                        work = Growth.from_value(float(total_size))
                        explanation = f"sum({parameter.variable}) <= {total_size:,} bounds total linear growth; do not multiply the test-count cap by the individual maximum."
                    elif complexity == "O(n log n)":
                        work = Growth.from_value(total_size * max(1.0, math.log2(max(1, upper))))
                        explanation = f"Using sum(n_i log2 n_i) <= S log2(max(2,U)), with S={total_size:,}, U={upper:,}."
                    elif complexity in {"O(n^2)", "O(n^3)"}:
                        power = 2 if complexity == "O(n^2)" else 3
                        work = Growth.from_value(float(total_size) * float(upper) ** (power - 1))
                        explanation = f"A sum-size limit does not give the same bound for powers: sum(n_i^{power}) <= S * U^{power - 1}, with S={total_size:,}, U={upper:,}."
                    elif complexity == "O(sqrt n)" and case_upper is not None:
                        work = Growth.from_value(min(math.sqrt(case_upper * total_size), case_upper * math.sqrt(upper)))
                        explanation = f"For at most {case_upper:,} cases, Cauchy-Schwarz gives sum(sqrt(n_i)) <= sqrt(T*S); the per-case cap also applies."
                    elif complexity in {"O(1)", "O(log n)"} and case_upper is not None:
                        work = growth(complexity, upper).scale(case_upper)
                        explanation = f"At most {case_upper:,} cases contribute this per-case growth; count is capped by explicit T and/or S/lower_bound when available."
                    else:
                        explanation = "The aggregate size cap does not determine an informative total for this class without more distribution/count information; no precise total is claimed."
                    caveats.append("All per-case sizes are nonnegative counts. Aggregate bounds constrain sums, not equal-sized cases.")
                elif case_upper is not None:
                    work = growth(complexity, upper).scale(case_upper)
                    explanation = f"Without a known aggregate cap, use the conservative scenario of up to {case_upper:,} cases, each at size {upper:,}."
                result.assessments.append(_row(complexity, parameter.variable, "all_test_cases", work, explanation, caveats))
            if case_upper is None:
                result.uncertainties.append("The number of test cases has no usable numeric upper bound; some total profiles remain unavailable.")
            if aggregate_records:
                result.uncertainties.append("Aggregate bounds do not determine the actual size distribution or exact nonlinear total work.")

        for other in extraction.size_parameters:
            if other.variable == parameter.variable:
                continue
            if other.reliability in {"ambiguous", "conflicting"} or other.upper_bound is None or other.upper_bound < 0:
                result.uncertainties.append(f"No combined growth estimate uses {other.variable}: its bound/meaning is missing or ambiguous.")
                continue
            second = other.upper_bound
            for operation, value, condition in [
                ("+", float(upper) + second, "an algorithm processes both dimensions once"),
                ("*", float(upper) * second, "an algorithm does work proportional to their product"),
            ]:
                result.assessments.append(_row(
                    f"O({parameter.variable} {operation} {other.variable})", f"{parameter.variable}, {other.variable}",
                    "per_instance", Growth.from_value(value),
                    f"Conditional scenario if {condition}, using caps {upper:,} and {second:,}. No algorithm or relationship was inferred from the variable names.",
                    ["This profile does not establish which complexity the problem requires.", "Cross-parameter totals across test cases are not estimated."],
                ))
        result.uncertainties = list(dict.fromkeys(result.uncertainties))
        return result
