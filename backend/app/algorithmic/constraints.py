"""Conservative English/inequality patterns with traceable original evidence."""

import bisect
import re
from collections import defaultdict

from app.algorithmic.numbers import MAX_INTEGER, UnsupportedNumber, normalize_with_offsets, parse_integer, parse_number
from app.schemas.algorithmic import (
    ConstraintExtraction, ParsedConstraint, ResourceLimit, SizeParameter, TestCases,
)

VAR = r"[A-Za-z][A-Za-z0-9_]{0,15}(?:\[[A-Za-z0-9_]{1,8}\])?"
VARS = rf"{VAR}(?:\s*,\s*{VAR}){{0,7}}"
LITERAL = r"[+-]?(?:\d{1,3}(?:,\d{3}){1,5}|\d{1,16})(?:\.\d{1,12})?(?:[eE][+-]?\d{1,5})?"
NUMBER = rf"{LITERAL}(?:\s*(?:\*\*|\^|\*)\s*{LITERAL}){{0,3}}"
CMP = r"(?:<=|>=|<|>|=)"
SIZE_ROLES = {"array_length", "sequence_length", "size", "vertices", "edges", "queries"}
RESERVED = {"the", "and", "or", "of", "all", "in", "cases", "case", "limit", "time", "memory", "exceed", "most", "than", "its", "their", "these", "those", "some", "any", "many", "several", "each", "every", "both", "one", "two", "three", "an", "a", "positive", "negative", "signed", "nonnegative"}
MAX_CONSTRAINTS = 128
# Compiled once and matched at an offset, so no per-match string copies are needed.
_CONTINUATION = re.compile(r"[ \t]*(?:[+*/^]|-(?=[ \t]*\d)|,\d|\.(?=[ \t]*[\d.+*/^]))")
_EXAMPLE_WORD = re.compile(r"\b(?:example|sample)\b|e\.g\.", re.I)

CHAIN = re.compile(rf"(?<![\w.])(?P<left>{NUMBER})\s*(?P<op1>{CMP})\s*(?P<vars>{VARS})\s*(?P<op2>{CMP})\s*(?P<right>{NUMBER})")
FORWARD = re.compile(rf"(?<![\w.])(?P<vars>{VARS})\s*(?P<op>{CMP})\s*(?P<number>{NUMBER})")
REVERSE = re.compile(rf"(?<![\w.])(?P<number>{NUMBER})\s*(?P<op>{CMP})\s*(?P<vars>{VARS})(?![\w\[])")
AGGREGATE = re.compile(
    rf"\b(?:the\s+)?sum\s+of\s+(?P<vars>{VAR})\s+(?:over|across|for)\s+(?:all\s+)?(?:the\s+)?test\s+cases\s*"
    rf"(?P<op>does\s+not\s+exceed|is\s+at\s+most|<=|<|=)\s*(?P<number>{NUMBER})", re.I,
)


def _bounds(operator: str, number: int, variable_on_left: bool = True) -> tuple[int | None, int | None]:
    if not variable_on_left:
        operator = {"<=": ">=", "<": ">", ">=": "<=", ">": "<", "=": "="}[operator]
    if operator == "=":
        return number, number
    if operator in {">=", ">"}:
        return number + (operator == ">"), None
    return None, number - (operator == "<")


def _merge(bounds: list[tuple[int | None, int | None]]) -> tuple[int | None, int | None]:
    lower = [item[0] for item in bounds if item[0] is not None]
    upper = [item[1] for item in bounds if item[1] is not None]
    return max(lower) if lower else None, min(upper) if upper else None


def _expression(variable: str, lower: int | None, upper: int | None) -> str:
    if lower is not None and upper is not None:
        return f"{lower} <= {variable} <= {upper}"
    return f"{variable} <= {upper}" if upper is not None else f"{variable} >= {lower}"


class ConstraintParser:
    def parse(self, statement: str) -> ConstraintExtraction:
        result = ConstraintExtraction()
        # Example blocks often contain valid-looking numbers that are not bounds.
        example = re.search(r"(?im)^[ \t]*(?:examples?|sample[ \t]+(?:input|output))(?:[ \t]+\d+)?[ \t]*(?::[^\n]*|$)", statement)
        original = statement[:example.start()] if example else statement
        if example:
            result.uncertainties.append("Example/sample section and subsequent text were excluded from constraint extraction.")
        text, offsets = normalize_with_offsets(original)
        if any(character == "*" and original[offset] == "." for character, offset in zip(text, offsets)):
            result.uncertainties.append("A period before an explicit power of ten was interpreted as multiplication (2.10^5 means 2 * 10^5); check this notation against the original statement.")

        def raw(start: int, end: int) -> str:
            return original[offsets[start]:offsets[end - 1] + 1]

        meanings: dict[str, dict[str, str]] = defaultdict(dict)
        has_math_evidence: dict[str, bool] = {}

        def record(variable: str, role: str, start: int, end: int):
            # English modifiers such as 'its elements' are not variable bindings.
            # Long alphabetic identifiers need mathematical evidence as well.
            # Memoized: a repeated word would otherwise rescan the whole text each time.
            if len(variable) > 1 and variable.isalpha():
                if variable not in has_math_evidence:
                    has_math_evidence[variable] = bool(re.search(rf"(?<!\w){re.escape(variable)}\s*{CMP}|{CMP}\s*{re.escape(variable)}(?!\w)", text))
                if not has_math_evidence[variable]:
                    return
            if variable.lower() not in RESERVED:
                meanings[variable][role] = raw(start, end)

        # Every role requires descriptive evidence; n/N is never a size by name.
        patterns = [
            ("array_length", rf"\barray\s+(?:{VAR}\s+)?(?:of|with|containing|has)\s+(?P<v>{VAR})\s+(?:(?:signed|positive|negative|nonnegative|non-negative)\s+)?(?:integers|elements|numbers|values)\b"),
            ("sequence_length", rf"\b(?:sequence|string)\s+(?:{VAR}\s+)?(?:of|with|containing|has|length)\s+(?P<v>{VAR})\s*(?:integers|elements|characters|numbers)?\b"),
        ]
        descriptions = {
            "array_length": r"(?:length|size)\s+of\s+(?:the\s+|an?\s+)?array|number\s+of\s+(?:array\s+)?elements",
            "sequence_length": r"(?:length|size)\s+of\s+(?:the\s+|an?\s+)?(?:string|sequence)",
            "vertices": r"number\s+of\s+(?:vertices|nodes)",
            "edges": r"number\s+of\s+edges",
            "queries": r"number\s+of\s+queries",
            "test_cases": r"number\s+of\s+test\s+cases",
            "element_value": r"(?:value\s+of\s+(?:an?\s+|the\s+)?(?:array\s+)?element|element\s+value)",
        }
        for role, description in descriptions.items():
            patterns.append((role, rf"\b(?P<v>{VAR})\s*(?:\([^()\n]{{0,160}}\))?\s*(?:is\s+|denotes\s+|represents\s+|[-—–:]\s*)(?:the\s+)?(?:{description})\b"))
            patterns.append((role, rf"\b(?:{description})\s*(?:is\s+|=\s*|:\s*|denoted\s+by\s+)(?P<v>{VAR})\b"))
        for role, noun in [("vertices", "vertices|nodes"), ("edges", "edges"), ("queries", "queries"), ("test_cases", r"test\s+cases"), ("size", "elements|integers|numbers")]:
            patterns.append((role, rf"\b(?P<v>{VAR})\s+(?:{noun})\b"))
        for role, pattern in patterns:
            for match in re.finditer(pattern, text, re.I):
                record(match["v"], role, match.start(), match.end())
        # Common input description: n and m — numbers of vertices and edges.
        pair = rf"\b(?P<n>{VAR})\s*(?:,|and)\s*(?P<m>{VAR})\s*(?:\([^()\n]{{0,160}}\))?\s*[-—–:]\s*(?:the\s+)?numbers?\s+of\s+(?:vertices|nodes)\s+and\s+edges\b"
        for match in re.finditer(pair, text, re.I):
            record(match["n"], "vertices", match.start(), match.end())
            record(match["m"], "edges", match.start(), match.end())

        multiple = bool(re.search(r"\btest\s+cases\b|\b(?:each|every)\s+(?:test\s+)?case\b", text, re.I))
        result.test_cases.present = multiple
        used: list[tuple[int, int]] = []
        used_sorted: list[tuple[int, int]] = []  # same spans, ordered for bisect overlap checks
        example_spans = [(hit.start(), hit.end()) for hit in _EXAMPLE_WORD.finditer(text)]
        conditional_lines: dict[tuple[int, int], bool] = {}  # context span -> contains or/either/if
        disjunctive_variables: set[str] = set()

        def meaning(variable: str) -> tuple[str, str | None, str]:
            roles = dict(meanings.get(variable, {}))
            # A specific array/sequence meaning supersedes the generic count rule.
            if {"array_length", "sequence_length"} & roles.keys():
                roles.pop("size", None)
            if len(roles) == 1:
                role, evidence = next(iter(roles.items()))
                return role, evidence, "contextual"
            if roles:
                return "unknown", " / ".join(roles.values())[:400], "ambiguous"
            if "_" in variable or "[" in variable:
                return "element_value", "Indexed-variable syntax; excluded from size selection.", "contextual"
            return "unknown", None, "ambiguous"

        def overlaps_used(start: int, end: int) -> bool:
            # Accepted spans never overlap each other, so only the neighbours
            # around the insertion point can overlap a new span.
            index = bisect.bisect_left(used_sorted, (start, end))
            return any(left < end and right > start for left, right in used_sorted[max(0, index - 1):index + 1])

        def valid_fragment(match: re.Match) -> bool:
            # Every check looks only near the match, without copying the line
            # prefix or text suffix, so long one-line inputs stay linear.
            start, end = match.span()
            if overlaps_used(start, end):
                return False
            line_start = text.rfind("\n", 0, start) + 1
            last = start - 1  # last non-space/tab character of the line prefix
            while last >= line_start and text[last] in " \t":
                last -= 1
            if last >= line_start:
                if text[last] in "+-*/^" and text[line_start:last + 1].strip() not in {"-", "*"}:
                    return False
                # Same rule as before: a digit followed by ',' or by optional whitespace and '.'.
                if text[last] == "," and last - 1 >= line_start and text[last - 1].isdigit():
                    return False
                if text[last] == ".":
                    before = last - 1
                    while before >= line_start and text[before].isspace():
                        before -= 1
                    if before >= line_start and text[before].isdigit():
                        return False
            if end < len(text) and (text[end].isalnum() or text[end] == "_"):
                return False
            # A numeric/operator continuation cannot be silently discarded.
            # A terminal sentence period ("n <= 2. Process...") is allowed.
            if _CONTINUATION.match(text, end):
                return False
            # Do not use a comparison from a local example sentence (same line, up to the match end).
            index = bisect.bisect_left(example_spans, (line_start, line_start))
            if index < len(example_spans) and example_spans[index][0] < end and example_spans[index][1] <= end:
                return False
            return True

        def add(match: re.Match, bounds: list[tuple[int | None, int | None]], aggregate: bool = False):
            if not valid_fragment(match):
                return
            lower, upper = _merge(bounds)
            if any(value is not None and abs(value) > MAX_INTEGER for value in (lower, upper)):
                return
            source = raw(match.start(), match.end())
            line_start = text.rfind("\n", 0, match.start()) + 1
            line_end = text.find("\n", match.end())
            span = (line_start, line_end if line_end >= 0 else len(text))
            if span not in conditional_lines:
                conditional_lines[span] = bool(re.search(r"\b(?:or|either|if)\b", text[span[0]:span[1]], re.I))
            conditional = conditional_lines[span]
            for variable in re.split(r"\s*,\s*", match["vars"]):
                if variable.lower() in RESERVED:
                    continue
                if len(result.constraints) >= MAX_CONSTRAINTS:
                    result.uncertainties.append("Extraction stopped at 128 numeric constraints.")
                    break
                role, evidence, reliability = meaning(variable)
                scope = "sum_over_test_cases" if aggregate else "global" if role == "test_cases" or (role != "unknown" and not multiple) else "per_test_case" if multiple else "unknown"
                if conditional:
                    reliability = "ambiguous"
                    disjunctive_variables.add(variable)
                    result.uncertainties.append("Conditional/disjunctive constraints are recorded but not used for size estimates.")
                result.constraints.append(ParsedConstraint(
                    variable=variable, lower_bound=lower, upper_bound=upper,
                    source_text=source, normalized_expression=_expression(f"sum({variable})" if aggregate else variable, lower, upper),
                    scope=scope, role=role, reliability=reliability, meaning_evidence=evidence,
                ))
            used.append(match.span())
            bisect.insort(used_sorted, match.span())

        for match in AGGREGATE.finditer(text):
            try:
                op = "<=" if match["op"].lower().startswith(("does", "is")) else match["op"]
                add(match, [_bounds(op, parse_integer(match["number"]))], aggregate=True)
            except UnsupportedNumber:
                pass
        for match in CHAIN.finditer(text):
            try:
                add(match, [_bounds(match["op1"], parse_integer(match["left"]), False), _bounds(match["op2"], parse_integer(match["right"]))])
            except UnsupportedNumber:
                pass
        for pattern, forward in [(FORWARD, True), (REVERSE, False)]:
            for match in pattern.finditer(text):
                try:
                    add(match, [_bounds(match["op"], parse_integer(match["number"]), forward)])
                except UnsupportedNumber:
                    pass

        # Conflicts are retained as evidence; no last-match-wins replacement.
        groups: dict[tuple[str, str], list[ParsedConstraint]] = defaultdict(list)
        for constraint in result.constraints:
            groups[(constraint.variable, constraint.scope)].append(constraint)
        for (variable, scope), constraints in groups.items():
            lower, upper = _merge([(item.lower_bound, item.upper_bound) for item in constraints])
            conflicting = variable not in disjunctive_variables and lower is not None and upper is not None and lower > upper
            if conflicting:
                for constraint in constraints:
                    constraint.reliability = "conflicting"
                result.uncertainties.append(f"Conflicting numeric bounds for {variable} ({scope}); no size estimate should use them.")

        test_count_variables: list[str] = []
        for variable in sorted(set(meanings) | {item.variable for item in result.constraints}):
            role, evidence, reliability = meaning(variable)
            own = [item for item in result.constraints if item.variable == variable and item.scope != "sum_over_test_cases"]
            if any(item.reliability == "conflicting" for item in own):
                reliability = "conflicting"
            elif any(item.reliability == "ambiguous" for item in own):
                reliability = "ambiguous"
            lower, upper = _merge([(item.lower_bound, item.upper_bound) for item in own])
            if variable in disjunctive_variables:
                lower, upper = None, None
            scopes = {item.scope for item in own}
            if len(scopes) > 1:
                reliability = "ambiguous"
            if role in SIZE_ROLES:
                result.size_parameters.append(SizeParameter(
                    variable=variable, role=role, lower_bound=lower, upper_bound=upper,
                    scope=next(iter(scopes)) if len(scopes) == 1 else "per_test_case" if multiple else "global",
                    reliability=reliability, meaning_evidence=evidence or "No descriptive evidence available.",
                ))
            elif role == "test_cases":
                test_count_variables.append(variable)
                if len(test_count_variables) > 1:
                    result.test_cases = TestCases(present=True)
                    result.uncertainties.append("Multiple test-count variables were described; count interpretation is ambiguous.")
                else:
                    result.test_cases = TestCases(present=True, variable=variable, lower_bound=lower, upper_bound=upper, reliability=reliability)
            elif own and role == "unknown":
                result.uncertainties.append(f"The meaning of {variable} is unclear; a variable name alone is not an input-size definition.")

        # Resource limits are independent evidence, not operation-rate converters.
        resource_patterns = [
            ("time", rf"\btime\s+limit(?:\s+per\s+(?:test|case))?\s*[:=]?\s*(?P<number>{NUMBER})\s*(?P<unit>milliseconds?|ms|seconds?|s)\b"),
            ("memory", rf"\bmemory\s+limit(?:\s+per\s+(?:test|case))?\s*[:=]?\s*(?P<number>{NUMBER})\s*(?P<unit>megabytes?|gigabytes?|kilobytes?|MiB|GiB|KiB|MB|GB|KB)\b"),
        ]
        for kind, pattern in resource_patterns:
            for match in re.finditer(pattern, text, re.I):
                try:
                    amount = float(parse_number(match["number"]))
                    if amount <= 0:
                        continue
                    unit = match["unit"].lower()
                    if kind == "time":
                        amount /= 1000 if unit.startswith("m") else 1
                        unit = "seconds"
                    else:
                        unit = {"megabyte": "MB", "megabytes": "MB", "gigabyte": "GB", "gigabytes": "GB", "kilobyte": "KB", "kilobytes": "KB", "mb": "MB", "gb": "GB", "kb": "KB", "mib": "MiB", "gib": "GiB", "kib": "KiB"}[unit]
                    result.resource_limits.append(ResourceLimit(kind=kind, amount=amount, unit=unit, source_text=raw(match.start(), match.end())))
                except UnsupportedNumber:
                    pass

        remaining = list(text)
        for start, end in used:
            remaining[start:end] = " " * (end - start)
        if re.search(r"<=|>=|(?<![<>=])[<>](?![<>=])", "".join(remaining)):
            result.uncertainties.append("Some comparisons are unsupported or malformed and were not interpreted; check the original statement.")
        if not result.constraints:
            result.uncertainties.append("No supported numeric constraints were found.")
        if not result.size_parameters:
            result.uncertainties.append("No input-size variable was linked to an explicit descriptive context.")
        result.uncertainties = list(dict.fromkeys(result.uncertainties))[:20]
        return result
