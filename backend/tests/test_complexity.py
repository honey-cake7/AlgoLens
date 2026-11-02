import math

import pytest

from app.algorithmic.complexity import CLASSES, ComplexityEngine, growth
from app.algorithmic.constraints import ConstraintParser
from app.algorithmic.numbers import MAX_INTEGER


def assess(statement):
    return ComplexityEngine().assess(ConstraintParser().parse(statement))


def row(result, complexity, scope="per_instance"):
    return next(item for item in result.assessments if item.complexity == complexity and item.scope == scope)


@pytest.mark.parametrize("complexity,expected", [
    ("O(1)", 1), ("O(log n)", math.log2(10)), ("O(sqrt n)", math.sqrt(10)),
    ("O(n)", 10), ("O(n log n)", 10 * math.log2(10)),
    ("O(n^2)", 100), ("O(n^3)", 1000), ("O(2^n)", 1024), ("O(n!)", 3628800),
])
def test_growth_functions(complexity, expected):
    assert growth(complexity, 10).value == pytest.approx(expected)


@pytest.mark.parametrize("n", [0, 1])
def test_small_sizes_are_defined(n):
    assert growth("O(log n)", n).value == 1
    assert growth("O(n)", n).value == n
    assert growth("O(n log n)", n).value == n
    assert growth("O(n!)", n).value == 1


@pytest.mark.parametrize("complexity", ["O(2^n)", "O(n!)"])
def test_huge_exponential_and_factorial_use_log_space(complexity):
    result = growth(complexity, MAX_INTEGER)
    assert result.value is None
    assert math.isfinite(result.log10)
    assert result.log10 > 300


@pytest.mark.parametrize("n", [-1, True, 1.5, MAX_INTEGER + 1, 10**1000])
def test_invalid_or_unbounded_engine_sizes_rejected(n):
    with pytest.raises(ValueError):
        growth("O(n)", n)


def test_expected_work_at_two_hundred_thousand():
    result = assess("Given an array of n integers. 1 <= n <= 200000")
    assert result.selected_parameter == "n"
    assert row(result, "O(n)").estimated_work == 200_000
    assert row(result, "O(n log n)").estimated_work == pytest.approx(3_521_928.09489)
    assert row(result, "O(n^2)").estimated_work == 40_000_000_000
    assert row(result, "O(n)").assessment == "promising"
    assert row(result, "O(n log n)").assessment == "possibly_feasible"
    assert row(result, "O(n^2)").assessment == "likely_infeasible"
    assert row(result, "O(n!)").estimated_work is None
    assert row(result, "O(n!)").work_display == "> 10^300"


@pytest.mark.parametrize("statement", [
    "1 <= n <= 200000", "-100 <= a_i <= 100",
    "Given an array of n integers.",
    "Given an array of n integers. n <= 10^99999",
    "Given an array of n integers. n <= -1",
    "Given an array of n integers.\nn <= 10 or n >= 20",
    "Given an array of n integers.\nn <= 10\nn >= 20",
    "n is the value of an element. n <= 1000000000",
])
def test_missing_ambiguous_value_or_conflicting_sizes_do_not_get_estimates(statement):
    result = assess(statement)
    assert result.selected_parameter is None
    assert len(result.assessments) == len(CLASSES)
    assert all(item.assessment == "insufficient_information" and item.estimated_work is None for item in result.assessments)
    assert result.uncertainties


def test_multiple_arrays_do_not_silently_choose_a_primary():
    result = assess("An array of n integers and another array of m integers.\n1 <= n, m <= 1000")
    assert result.selected_parameter is None
    assert all(item.estimated_work is None for item in result.assessments)


def test_case_count_without_aggregate_uses_explicit_upper_bound_scenario():
    result = assess("There are t test cases, each with an array of n integers.\n1 <= t <= 10\n1 <= n <= 100")
    total = row(result, "O(n)", "all_test_cases")
    assert total.estimated_work == pytest.approx(1000)
    assert total.work_kind == "total_upper_bound"
    assert "Without a known aggregate" in total.explanation
    assert row(result, "O(1)", "all_test_cases").estimated_work == pytest.approx(10)


def test_aggregate_linear_and_nonlinear_bounds_are_different():
    result = assess(
        "There are t test cases, each with an array of n integers.\n"
        "1 <= t <= 10000\n1 <= n <= 1000\n"
        "The sum of n across all test cases does not exceed 2000"
    )
    assert row(result, "O(n)", "all_test_cases").estimated_work == 2000
    assert row(result, "O(n^2)", "all_test_cases").estimated_work == 2_000_000
    assert row(result, "O(n^3)", "all_test_cases").estimated_work == 2_000_000_000
    assert "sum(n_i^2)" in row(result, "O(n^2)", "all_test_cases").explanation
    assert row(result, "O(n!)", "all_test_cases").assessment == "insufficient_information"
    assert row(result, "O(2^n)", "all_test_cases").estimated_work is None


def test_aggregate_can_derive_per_case_cap_from_nonnegative_sizes():
    result = assess("Each test case gives an array of n integers. n >= 1\nThe sum of n over all test cases <= 2000")
    assert row(result, "O(n)").estimated_work == 2000
    assert row(result, "O(n)", "all_test_cases").estimated_work == 2000
    assert any("derived" in item for item in result.uncertainties)


def test_unknown_case_count_is_not_fabricated_when_zero_sizes_allowed():
    result = assess("Each test case gives an array of n integers. 0 <= n <= 100\nThe sum of n over all test cases <= 1000")
    assert row(result, "O(n)", "all_test_cases").estimated_work == 1000
    assert row(result, "O(1)", "all_test_cases").estimated_work is None
    assert row(result, "O(log n)", "all_test_cases").assessment == "insufficient_information"


def test_unknown_case_count_without_aggregate_has_no_total_estimate():
    result = assess("Each of the test cases gives an array of n integers. 1 <= n <= 100")
    assert row(result, "O(n)").estimated_work == 100
    assert row(result, "O(n)", "all_test_cases").estimated_work is None


def test_aggregate_smaller_than_individual_cap_restricts_upper_bound():
    result = assess("Each test case gives an array of n integers. 1 <= n <= 1000\nSum of n over all test cases <= 100")
    assert row(result, "O(n)").estimated_work == 100
    assert row(result, "O(n^2)", "all_test_cases").estimated_work == 10_000


def test_aggregate_incompatible_with_lower_bounds_is_uncertain():
    result = assess("There are t test cases, each with an array of n integers.\nt >= 3\n2 <= n <= 100\nSum of n over all test cases <= 5")
    assert all(item.assessment == "insufficient_information" for item in result.assessments)


def test_resources_do_not_create_seconds_or_memory_fit_predictions():
    result = assess("Time limit: 2 seconds\nMemory limit: 256 MB\nGiven an array of n integers. n <= 1000")
    assert len(result.extraction.resource_limits) == 2
    assert any("not measured" in caveat for caveat in result.caveats)
    assert any("No memory-fit" in caveat for caveat in result.caveats)


def test_combined_graph_growth_requires_both_known_dimensions():
    result = assess("Given n vertices and m edges.\nn <= 100\nm <= 1000")
    assert result.selected_parameter == "n"
    assert row(result, "O(n + m)").estimated_work == 1100
    assert row(result, "O(n * m)").estimated_work == 100000
    missing = assess("Given n vertices and m edges. n <= 100")
    assert all("m" not in item.complexity for item in missing.assessments)


def test_zero_and_large_results_serialize_without_infinity():
    empty = assess("Given an array of n integers. n = 0")
    assert row(empty, "O(n^2)").estimated_work == 0
    huge = assess(f"Given an array of n integers. n <= {MAX_INTEGER}")
    encoded = huge.model_dump_json()
    assert "Infinity" not in encoded and "NaN" not in encoded
