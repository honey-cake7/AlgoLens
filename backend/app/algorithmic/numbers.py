"""A deliberately small numeric grammar, not a Python expression evaluator."""

import re
from decimal import Decimal, InvalidOperation, localcontext

# Exact integers must survive JSON -> JavaScript without silent rounding.
MAX_INTEGER = 2**53 - 1
SUPERSCRIPTS = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺", "0123456789-+")
LITERAL = re.compile(r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:[eE][+-]?\d+)?")


class UnsupportedNumber(ValueError):
    pass


def normalize_with_offsets(text: str) -> tuple[str, list[int]]:
    """Retain a map back to original characters while expanding notation."""
    output: list[str] = []
    offsets: list[int] = []
    i = 0
    while i < len(text):
        character = text[i]
        if character in "⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺":
            start = i
            while i < len(text) and text[i] in "⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺":
                i += 1
            expansion = "^" + text[start:i].translate(SUPERSCRIPTS)
            output.extend(expansion)
            offsets.extend([start] + list(range(start, i)))
            continue
        expansion = {"≤": "<=", "≥": ">=", "×": "*", "⋅": "*", "·": "*", "−": "-"}.get(character, character)
        output.extend(expansion)
        offsets.extend([i] * len(expansion))
        i += 1
    normalized = "".join(output)
    # Competitive-programming shorthand: a period immediately before 10^k
    # (or 10**k) means multiplication. Keep other decimal points untouched.
    # A one-character replacement keeps original source offsets intact.
    for match in re.finditer(r"(?<=\d)\s*\.(?=\s*10\s*(?:\^|\*\*))", normalized):
        output[normalized.index(".", match.start(), match.end())] = "*"
    return "".join(output), offsets


def normalize_math(text: str) -> str:
    return normalize_with_offsets(text)[0]


def parse_number(expression: str) -> Decimal:
    """Accept signed literals/scientific notation, powers and short products.

    No addition, division, names, functions, parentheses or arbitrary execution.
    Length, exponent, factor and magnitude guards bound memory and CPU work.
    """
    if len(expression) > 80:
        raise UnsupportedNumber("Numeric expression exceeds the supported length")
    normalized = normalize_math(expression)
    if re.search(r"\d\s+\d", normalized):
        raise UnsupportedNumber("Whitespace-separated digits are ambiguous")
    text = re.sub(r"\s+", "", normalized)
    factors = re.split(r"(?<!\*)\*(?!\*)", text)
    if not 1 <= len(factors) <= 4:
        raise UnsupportedNumber("Only short products are supported")
    try:
        with localcontext() as context:
            context.prec = 64
            result = Decimal(1)
            for factor in factors:
                sign = -1 if factor.startswith("-") else 1
                unsigned = factor.lstrip("+-")
                if factor.startswith(("--", "++", "-+", "+-")):
                    raise UnsupportedNumber("Invalid sign")
                power = re.split(r"\*\*|\^", unsigned)
                if len(power) not in (1, 2) or not LITERAL.fullmatch(power[0]):
                    raise UnsupportedNumber("Unsupported numeric notation")
                scientific = re.search(r"[eE]([+-]?\d+)$", power[0])
                if scientific and (len(scientific[1]) > 3 or abs(int(scientific[1])) > 18):
                    raise UnsupportedNumber("Scientific exponent is too large")
                base = Decimal(power[0].replace(",", ""))
                if abs(base) > MAX_INTEGER:
                    raise UnsupportedNumber("Numeric magnitude is too large")
                value = base
                if len(power) == 2:
                    if not re.fullmatch(r"\d{1,2}", power[1]) or int(power[1]) > 18:
                        raise UnsupportedNumber("Power exponent is unsupported")
                    value = base ** int(power[1])
                if not value.is_finite() or abs(value) > MAX_INTEGER:
                    raise UnsupportedNumber("Numeric magnitude is too large")
                result *= sign * value
                if not result.is_finite() or abs(result) > MAX_INTEGER:
                    raise UnsupportedNumber("Numeric magnitude is too large")
            return result
    except (InvalidOperation, OverflowError):
        raise UnsupportedNumber("Invalid numeric expression") from None


def parse_integer(expression: str) -> int:
    number = parse_number(expression)
    if number != number.to_integral_value():
        raise UnsupportedNumber("Only integer bounds are supported")
    return int(number)
