import pytest

from app.algorithmic.constraints import ConstraintParser
from decimal import Decimal

from app.algorithmic.numbers import MAX_INTEGER, UnsupportedNumber, parse_integer, parse_number


@pytest.mark.parametrize("expression,expected", [
    ("1000", 1000), ("1,000,000", 1_000_000), ("1e6", 1_000_000),
    ("2e5", 200_000), ("10^5", 100_000), ("10**5", 100_000),
    ("2 * 10^5", 200_000), ("2 × 10⁵", 200_000),
    (" 2\t*\n10 ** 5 ", 200_000), ("2.5e5", 250_000),
    ("-10^2", -100), ("−2 * 10^3", -2000), ("0", 0),
    (str(MAX_INTEGER), MAX_INTEGER),
])
def test_safe_numeric_notation(expression, expected):
    assert parse_integer(expression) == expected


@pytest.mark.parametrize("expression", [
    "__import__('os').system('anything')", "2+3", "2/3", "(10^5)",
    "10^999999999", "1e999999999", "9" * 1000, "1,2", "1 00",
    "2*m", "2^n", "3.5", "--5", "10^-2", "2***3", "", str(MAX_INTEGER + 1),
])
def test_unsupported_or_unsafe_numbers(expression):
    with pytest.raises(UnsupportedNumber):
        parse_integer(expression)


@pytest.mark.parametrize("expression,variable,lower,upper", [
    ("1 <= n <= 10^5", "n", 1, 100_000),
    ("1 ≤ n ≤ 2 * 10^5", "n", 1, 200_000),
    ("2 ≤ N ≤ 10⁵", "N", 2, 100_000),
    ("n <= 1e6", "n", None, 1_000_000),
    ("0 <= n <= 1000", "n", 0, 1000),
    ("-100 <= a_i <= 0", "a_i", -100, 0),
    ("−100 ≤ a[i] ≤ 0", "a[i]", -100, 0),
    ("1\t<=\n n  <=\t2 × 10**5", "n", 1, 200_000),
    ("1000 >= n >= 1", "n", 1, 1000),
    ("n > 0", "n", 1, None), ("n < 10", "n", None, 9),
    ("n = 42", "n", 42, 42),
])
def test_comparisons_and_original_evidence(expression, variable, lower, upper):
    parsed = ConstraintParser().parse(expression)
    assert len(parsed.constraints) == 1
    bound = parsed.constraints[0]
    assert (bound.variable, bound.lower_bound, bound.upper_bound) == (variable, lower, upper)
    assert bound.source_text == expression


def test_shared_bounds_and_large_number_commas():
    parsed = ConstraintParser().parse("1 <= n, m <= 1,000,000")
    assert {item.variable: (item.lower_bound, item.upper_bound) for item in parsed.constraints} == {"n": (1, 1_000_000), "m": (1, 1_000_000)}


def test_array_size_requires_context_not_a_name():
    bare = ConstraintParser().parse("1 <= n <= 200000")
    assert bare.constraints[0].role == "unknown"
    assert bare.size_parameters == []
    parsed = ConstraintParser().parse("Given an array of n integers. 1 <= n <= 200000")
    assert parsed.size_parameters[0].role == "array_length"
    assert parsed.size_parameters[0].upper_bound == 200000
    assert "array of n integers" in parsed.size_parameters[0].meaning_evidence


@pytest.mark.parametrize("aggregate", [
    "sum of n over all test cases <= 2 * 10^5",
    "The sum of n across all test cases does not exceed 2e5",
    "The sum of n for all test cases is at most 200,000",
])
def test_case_count_per_case_and_aggregate_are_separate(aggregate):
    parsed = ConstraintParser().parse(
        "There are t test cases. Each case gives an array of n integers.\n"
        "1 <= t <= 10^4\n1 <= n <= 2 * 10^5\n" + aggregate
    )
    assert parsed.test_cases.variable == "t"
    assert parsed.test_cases.upper_bound == 10_000
    assert parsed.test_cases.present is True
    assert next(item for item in parsed.constraints if item.variable == "t").scope == "global"
    n = [item for item in parsed.constraints if item.variable == "n"]
    assert {item.scope for item in n} == {"per_test_case", "sum_over_test_cases"}
    assert next(item for item in n if item.scope == "sum_over_test_cases").upper_bound == 200_000


def test_value_bounds_are_not_input_size():
    parsed = ConstraintParser().parse("An array contains signed values. -10^9 <= a_i <= 10^9")
    assert parsed.constraints[0].role == "element_value"
    assert parsed.size_parameters == []


def test_explicit_value_definition_and_graph_query_counts():
    parsed = ConstraintParser().parse("n vertices, m edges, and q queries. x is the value of an element.\n1 <= n, m <= 1000\nq <= 20\n-10 <= x <= 10")
    roles = {item.variable: item.role for item in parsed.constraints}
    assert roles == {"n": "vertices", "m": "edges", "q": "queries", "x": "element_value"}


def test_paired_input_descriptions():
    parsed = ConstraintParser().parse("n and m — numbers of vertices and edges, respectively.\n1 <= n, m <= 1000")
    assert {item.variable: item.role for item in parsed.size_parameters} == {"n": "vertices", "m": "edges"}


def test_missing_bounds_remain_unknown():
    parsed = ConstraintParser().parse("Given an array of n integers and q queries.")
    assert all(item.upper_bound is None for item in parsed.size_parameters)
    assert parsed.constraints == []


def test_conflicting_bounds_preserve_both_sources():
    parsed = ConstraintParser().parse("Given an array of n integers.\n1 <= n <= 10\nn >= 20")
    assert len(parsed.constraints) == 2
    assert all(item.reliability == "conflicting" for item in parsed.constraints)
    assert parsed.size_parameters[0].reliability == "conflicting"
    assert any("Conflicting" in text for text in parsed.uncertainties)


def test_disjunctions_and_conflicting_meanings_are_ambiguous():
    parsed = ConstraintParser().parse("Given an array of n integers.\nn <= 10 or n >= 20")
    assert all(item.reliability == "ambiguous" for item in parsed.constraints)
    assert parsed.size_parameters[0].reliability == "ambiguous"
    ambiguous = ConstraintParser().parse("n vertices and n queries. n <= 100")
    assert ambiguous.size_parameters == []


@pytest.mark.parametrize("suffix", ["2*m", "2e999999", "10^99999", "__import__('os')", "100 + 5", "1,2"])
def test_malformed_upper_bounds_are_not_partially_used(suffix):
    parsed = ConstraintParser().parse("Given an array of n integers. n <= " + suffix)
    assert all(item.upper_bound is None for item in parsed.constraints)
    assert any("unsupported" in text.lower() or "no supported" in text.lower() for text in parsed.uncertainties)


def test_example_and_irrelevant_numbers_are_excluded():
    parsed = ConstraintParser().parse("Given an array of n integers.\n1 <= n <= 1000\nThere are 42 stories and 7 players.\nExample\nInput\nn = 3\nOutput\n999")
    assert len(parsed.constraints) == 1
    assert parsed.size_parameters[0].upper_bound == 1000
    inline = ConstraintParser().parse("For example, n = 3. The game has 8 rounds.")
    assert inline.constraints == []


def test_resource_limits_are_separate_from_size_and_values():
    parsed = ConstraintParser().parse("Time limit: 1500 ms\nMemory limit: 256 MiB\nGiven an array of n integers. n <= 1000")
    assert [(item.kind, item.amount, item.unit) for item in parsed.resource_limits] == [("time", 1.5, "seconds"), ("memory", 256, "MiB")]
    assert len(parsed.size_parameters) == 1


def test_large_input_is_bounded_and_unsupported():
    parsed = ConstraintParser().parse("Given an array of n integers. n <= " + "9" * 19000)
    assert all(item.upper_bound is None for item in parsed.constraints)
    assert any("unsupported" in text.lower() for text in parsed.uncertainties)


def test_prose_modifiers_do_not_create_extra_size_parameters():
    parsed = ConstraintParser().parse("Given an array of n positive integers, process its elements. 1 <= n <= 200000")
    assert [item.variable for item in parsed.size_parameters] == ["n"]
    assert parsed.size_parameters[0].role == "array_length"


def test_singular_each_test_case_is_recognized():
    parsed = ConstraintParser().parse("Each test case gives an array of n integers. n <= 100")
    assert parsed.test_cases.present is True
    assert parsed.size_parameters[0].scope == "per_test_case"


def test_multiple_test_counts_do_not_hide_later_size_parameters():
    parsed = ConstraintParser().parse(
        "There are t test cases, u test cases, and v test cases.\n"
        "Each case has an array of z integers.\n"
        "1 <= t, u, v <= 10\n1 <= z <= 100"
    )
    assert parsed.test_cases.present is True
    assert parsed.test_cases.variable is None
    assert parsed.test_cases.upper_bound is None
    assert parsed.test_cases.reliability == "ambiguous"
    assert [item.variable for item in parsed.size_parameters] == ["z"]
    assert parsed.size_parameters[0].upper_bound == 100


@pytest.mark.parametrize("expression", [
    "2.10^5", "2 . 10^5", "2.10**5", "2.10⁵", "2\t.\t10 ^ 5",
    "2⋅10^5", "2·10^5", "2 ⋅ 10⁵", "2 · 10**5",
])
def test_copied_dot_multiplication_uses_the_entire_bound(expression):
    assert parse_integer(expression) == 200_000
    source = "1 <= n <= " + expression
    parsed = ConstraintParser().parse("Given an array of n integers.\n" + source)
    assert len(parsed.constraints) == 1
    assert parsed.constraints[0].source_text == source
    assert parsed.constraints[0].upper_bound == 200_000
    assert parsed.size_parameters[0].upper_bound == 200_000
    if "." in expression:
        assert any("period" in note.lower() and "multiplication" in note.lower() for note in parsed.uncertainties)


@pytest.mark.parametrize("expression,expected", [
    ("2.10", "2.10"), ("2.10e5", "210000"), ("2.5 * 10^5", "250000"),
    ("1.5^2", "2.25"), ("2.5.10^5", "250000"),
])
def test_decimal_notation_is_preserved_outside_dot_before_ten_power(expression, expected):
    assert parse_number(expression) == Decimal(expected)


@pytest.mark.parametrize("expression", [
    "2 . 10^x", "2⋅10^x", "2·10^99999", "2 . 100000", "2..10^5", "2 . 10^5 + 1",
])
def test_unsupported_dot_expressions_never_become_a_coefficient_only_bound(expression):
    parsed = ConstraintParser().parse("Given an array of n integers.\n1 <= n <= " + expression)
    assert all(item.upper_bound is None for item in parsed.constraints)
    assert parsed.size_parameters[0].upper_bound is None


def test_dot_normalization_in_reverse_shared_and_aggregate_bounds():
    parsed = ConstraintParser().parse(
        "There are t test cases, each with an array of n integers and q queries.\n"
        "2.10^5 >= n >= 1\n1 <= q, t <= 2·10^3\n"
        "The sum of n over all test cases does not exceed 2⋅10⁵"
    )
    assert parsed.test_cases.upper_bound == 2000
    assert {item.variable: item.upper_bound for item in parsed.size_parameters} == {"n": 200_000, "q": 2000}
    aggregate = next(item for item in parsed.constraints if item.scope == "sum_over_test_cases")
    assert aggregate.upper_bound == 200_000
    assert aggregate.source_text.endswith("2⋅10⁵")


def test_sentence_period_after_a_complete_bound_is_not_multiplication():
    parsed = ConstraintParser().parse("Given an array of n integers. n <= 2. Process the array.")
    assert parsed.size_parameters[0].upper_bound == 2
