"""Deterministic task cues: small regex signals about computational structure.

Text similarity alone confuses tasks that share vocabulary but need different
algorithms (a fixed array versus one with updates, contiguous segments versus
subsequences with gaps, nonnegative versus negative edge weights). Cues capture
a few such distinctions from the task text only. They never read technique
labels, titles, tags or difficulty, and they do not identify an algorithm.

Each cue maps to one vector dimension. Mutually exclusive pairs share a signed
axis (+1 / -1), so a conflict lowers cosine similarity instead of being ignored.
Negated phrases ("never updated", "need not be contiguous") are matched first
and removed before the opposite cue is checked.
"""

import re
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Axis:
    name: str
    positive: str  # label for +1
    positive_pattern: str
    negative: str | None = None  # label for -1
    negative_pattern: str | None = None
    negative_first: bool = False  # strip the negative phrase before checking positive
    requires: str | None = None  # only active when another binary cue is present


GRAPH = r"\b(graphs?|vertex|vertices|edges?|nodes?|roads?|routes?|tunnels?|corridors?|networks?|cables?|links?|conversions?|transfers?)\b"

AXES: tuple[Axis, ...] = (
    Axis("mutability", "fixed data", r"\b(immutable|static|unchanged|unmodified|never (?:be )?(?:updated|changed|modified|revised)|(?:will|does|do|is) not (?:be )?(?:change|changed|updated|modified|revised)|never changes?|stays? (?:unchanged|the same)|fixed (?:\w+ ){0,2}(?:array|sequence|log|list|matrix|recording))\b",
         "updates", r"\b(updates?|updated|assignments?|assigns?|overwrites?|increments?|modif(?:y|ies|ied|ication)s?|adding|add \w+ to)\b"),
    Axis("contiguity", "contiguous segments", r"\b(contiguous|consecutive|subarrays?|substrings?|segments?|slices?|runs?|stretch(?:es)?)\b",
         "gaps allowed", r"\b(subsequences?|need not be (?:contiguous|adjacent)|not necessarily (?:adjacent|contiguous)|with gaps|gaps|non-?contiguous|delete any)\b",
         negative_first=True),
    Axis("direction", "directed", r"\b(directed|one-way|prerequisites?|requires? \w+ (?:first|before)|dependenc(?:y|ies))\b",
         "undirected", r"\b(undirected|two-way|bidirectional)\b", requires="graph"),
    Axis("edge_sign", "nonnegative weights", r"\b(non-?negative|positive) (?:edge )?(?:weights?|costs?|fees?|tolls?|lengths?)\b",
         "negative weights", r"\b(negative(?:-weight)? (?:edge )?(?:weights?|edges?|costs?|values?|cycles?)|(?:may|can) be negative|rebates?|earn)\b",
         negative_first=True, requires="graph"),
    Axis("edge_cost", "weighted edges", r"\b(weights?|weighted|costs?|fees?|tolls?|prices?|lengths?|energy|distances?)\b",
         "unit steps", r"\b(unweighted|unit[- ]cost|unit steps?|fewest (?:moves|steps|edges|turns)|minimum number of (?:moves|steps|edges|turns))\b",
         negative_first=True, requires="graph"),
    Axis("extreme", "minimize the maximum", r"\b(minimi[sz](?:e|es|ed|ing) (?:the )?(?:maximum|largest|capacity)|(?:smallest|minimum|least) (?:\w+ )?(?:capacity|allowance)|smallest (?:\w+ )?duration)\b",
         "maximize the minimum", r"\b(maximi[sz](?:e|es|ed|ing) (?:the )?minimum|as far apart as possible)\b"),
)

BINARY: tuple[tuple[str, str, str], ...] = (
    ("graph", "graph structure", GRAPH),
    ("tree", "tree structure", r"\b(trees?|rooted|subtrees?|ancestors?|descendants?|hierarch\w*)\b"),
    ("grid", "grid or matrix", r"\b(grids?|matri(?:x|ces)|cells?|rows? and columns?)\b"),
    ("many_queries", "many queries", r"\b(queries|questions|requests|many (?:\w+ )?(?:asks?|lookups))\b"),
    ("ranges", "index ranges", r"\b(index ranges?|range[- ](?:sums?|minimum|queries|totals?)|interval (?:sums?|updates?|totals?)|between (?:two )?(?:\w+ )?(?:positions|indices|dates|days)|inclusive|from (?:position|index|page|day) \w+ to)\b"),
    ("intervals", "time intervals", r"\b(time intervals?|half-open (?:\w+ )?intervals?|closed intervals?|start (?:time|and end)|start/end|reservations?|bookings?|meetings?|time slots?)\b"),
    ("strings", "strings or characters", r"\b(strings?|characters?|substrings?|letters?|text)\b"),
    ("counting", "counting", r"\b(count\w*|how many|number of (?:ways|subarrays|segments|components|pairs|groups))\b"),
    ("connectivity", "connectivity", r"\b(connected|components?|connectivity|linked|connect(?:s|ing)? (?:all|every))\b"),
    ("cycles", "cycles", r"\b(cycles?|circular|loops?)\b"),
    ("single_use_items", "single-use items", r"\b(items?|(?:used|exists?|chosen) (?:at most )?once|at most once|indivisible)\b"),
    ("exact_target", "exact target", r"\b(exact(?:ly)? (?:the )?target|equals? (?:a |the )?target|sums? exactly to|exact total)\b"),
    ("sorted_input", "sorted input", r"\b(sorted|nondecreasing|non-decreasing|ascending)\b"),
    ("geometry", "geometry", r"\b(circles?|radius|polygons?|plane|geometr\w*|convex)\b"),
    ("next_greater", "next greater element", r"\b(next|nearest later|later position|ahead|to (?:its|the) right)\b[^.]{0,60}\b(greater|larger|taller|warmer|higher)\b"),
    ("ancestor", "common ancestor", r"\b(common ancestor|ancestor of both|oversees both|lowest common)\b"),
    ("two_coloring", "two-way split", r"\b(bipartite|two[- ]colou?r\w*|two (?:teams|groups|sets|dormitories))\b"),
)

DIMENSIONS = len(AXES) + len(BINARY)
LABELS = {axis.name: (axis.positive, axis.negative) for axis in AXES} | {name: (label, None) for name, label, _ in BINARY}
_compiled = {}


def _regex(pattern: str) -> re.Pattern:
    if pattern not in _compiled:
        _compiled[pattern] = re.compile(pattern, re.IGNORECASE)
    return _compiled[pattern]


def extract(text: str) -> dict[str, int]:
    """Return active cues as {name: +1 or -1}. Binary cues are always +1."""
    found = {name: 1 for name, _, pattern in BINARY if _regex(pattern).search(text)}
    for axis in AXES:
        if axis.requires and axis.requires not in found:
            continue
        remaining = text
        negative = bool(axis.negative_pattern and _regex(axis.negative_pattern).search(text))
        if axis.negative_first and negative:
            remaining = _regex(axis.negative_pattern).sub(" ", text)
        else:
            # Default order: the positive phrase may itself be a negation of the
            # opposite cue ("never updated"), so strip it before checking negative.
            positive_hit = _regex(axis.positive_pattern).search(text)
            remaining_for_negative = _regex(axis.positive_pattern).sub(" ", text) if positive_hit else text
            negative = bool(axis.negative_pattern and _regex(axis.negative_pattern).search(remaining_for_negative))
        positive = bool(_regex(axis.positive_pattern).search(remaining))
        if positive and not negative:
            found[axis.name] = 1
        elif negative and not positive:
            found[axis.name] = -1
    return found


def vector(text: str) -> np.ndarray:
    cues = extract(text)
    names = [axis.name for axis in AXES] + [name for name, _, _ in BINARY]
    return np.array([cues.get(name, 0) for name in names], dtype=np.float64)


def shared_labels(query: str, document: str) -> tuple[str, ...]:
    """Human-readable cues present with the same sign in both texts."""
    left, right = extract(query), extract(document)
    labels = []
    for name, sign in left.items():
        if right.get(name) == sign:
            positive, negative = LABELS[name]
            labels.append(positive if sign > 0 else negative)
    return tuple(sorted(labels))


NAMES = [axis.name for axis in AXES] + [name for name, _, _ in BINARY]


def label(index: int, sign: int) -> str:
    """Readable label for vector dimension `index` with value +1 or -1."""
    positive, negative = LABELS[NAMES[index]]
    return positive if sign > 0 else negative
