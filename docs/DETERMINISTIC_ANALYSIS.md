# Stage 3: deterministic constraints and growth

The local engine runs without a key, internet connection, model, or new dependency. The same input and code produce the same result. It extracts supported evidence and evaluates hypothetical complexity profiles; it does not discover a solution or prove an algorithm will pass.

## Trace the implementation

Read these files in this order:

| File | Responsibility |
| --- | --- |
| `backend/app/schemas/algorithmic.py` | Structured evidence and assessments, explicit nulls, finite JSON |
| `backend/app/algorithmic/numbers.py` | Safe numeric grammar and notation normalization |
| `backend/app/algorithmic/constraints.py` | Pattern extraction, source spans, contextual roles, scopes, conflicts |
| `backend/app/algorithmic/complexity.py` | Growth functions, conservative total bounds, qualitative bands |
| `backend/app/services/algorithmic_service.py` | Pure local orchestration and limited AI comparison |
| `backend/app/services/analysis_service.py` | Combines local output with the existing single provider call |
| `backend/app/api/routes/analyze.py` | Combined endpoint and independent offline endpoint |
| `frontend/src/types/algorithmic.ts` | Matching TypeScript contract |
| `frontend/src/services/algorithmicValidation.ts` | Runtime checks before rendering HTTP data |
| `frontend/src/components/AlgorithmicResult.tsx` | Evidence, bounds, growth tables, uncertainties |
| `backend/tests/test_constraints.py`, `test_complexity.py`, `test_algorithmic_api.py` | Executable examples and negative cases |

## Safe notation, without evaluating code

`normalize_with_offsets` maps Unicode comparisons, multiplication, minus signs, and digit superscripts to ASCII. For example, `1 ≤ n ≤ 2 × 10⁵` becomes `1 <= n <= 2 * 10^5`. Each generated character points back to an original character, so the response still quotes the actual Unicode source rather than a reconstructed approximation.

Copied multiplication dots `⋅` and `·` are also accepted. A period before an explicit power of ten is treated as multiplication: `2.10^5`, `2 . 10^5`, and `2.10⁵` normalize to `2 * 10^5`, giving 200000. The result includes a note about this period convention, and original evidence is preserved. Other decimals stay unchanged: `2.10e5` means 210000 and `2.5 * 10^5` means 250000. Unsupported dotted expressions are not silently shortened to the coefficient. A lost exponent such as `2⋅105` cannot be reconstructed from this normalization; it does not become 200000 automatically.

`parse_number` uses a narrow regular-expression grammar and Decimal arithmetic, not eval, exec, a Python expression evaluator, or arbitrary function calls. It supports signed decimal literals, scientific notation, products, and simple powers. `parse_integer` requires an integer result for a bound. Strict integer comparisons become inclusive bounds: `n < 10` means an upper bound of 9, and `n > 0` means a lower bound of 1.

| Input | Result |
| --- | --- |
| `2 * 10^5`, `2 × 10⁵`, `2e5`, `200,000` | 200000 |
| `2.10^5`, `2 . 10^5`, `2⋅10^5`, `2·10⁵` | 200000; the ASCII period convention is explicitly noted |
| `10**5` | 100000 |
| `-10^2` | -100; the sign applies outside the power |
| `2.5e5` | 250000 |
| `1 <= n, m <= 1000` | Separate bounds for n and m, sharing source evidence |
| `2*m`, `2^n`, `100 + 5`, `1,2`, `1 00` | Unsupported, not partly interpreted as a valid upper bound |
| `__import__(...)`, calls, division, parentheses | Unsupported numeric grammar |

Safety bounds are deliberate: at most 80 characters per numeric expression, four product factors, exponent magnitude at most 18 (nonnegative power exponents), and absolute intermediate/final values at most **2^53−1**. This cap keeps integers exact in browser JSON. Decimal coefficients may normalize to integers; fractional final constraint bounds are rejected. Negative and zero element-value bounds are valid. Sizes are nonnegative counts; a negative size cap is unusable.

Whitespace around operators and between comparison tokens can include tabs/newlines. Whitespace inside a numeric literal is rejected. Grouped thousands commas must have three digits per group. At most 128 numeric constraints are returned per statement; the API also retains its 20–20,000 trimmed Unicode-character limit.

## Evidence, roles, scope, and uncertainty

Each `ParsedConstraint` includes variable, lower/upper bounds or null, original source text, normalized expression, scope, role, categorical reliability, and meaning evidence or null. `SizeParameter` summarizes conjunctive bounds for a context-defined input dimension. `TestCases` separately records whether cases are mentioned and whether a reliable count is known. Time/memory limits have their own list.

An upper bound alone does not establish meaning. `n <= 200000` is quantitative evidence but does not prove n is an array length. Add `Given an array of n integers` and the parser has descriptive evidence. Patterns cover common array/string/sequence descriptions, vertices, edges, queries, test-case counts, and explicit element-value descriptions. Indexed identifiers such as `a_i` and `a[i]` are excluded from size selection. The engine does not infer a graph relationship merely from the letters n and m.

Named sequence descriptions such as `string s of length n` and `sequence s with length n` bind `n` as the sequence length, including when copied text places identifiers on separate lines. `number of test cases t` binds the count `t` directly. Bounds are still extracted separately, original evidence is preserved, and the string identifier `s` is not treated as an input size.

Length properties such as `nums.length` are supported when the statement declares the container (for example, `an integer array nums`). The size retains that full name; `nums[i]` remains an element value. Distinct containers retain distinct size parameters. Symbolic chains such as `1 <= l <= r <= nums.length` are not fully propagated into bounds for `l` and `r`; unsupported comparisons remain visible as uncertainties.

| Scope | Meaning |
| --- | --- |
| `global` | Test-count bound, or known-role bound without multiple cases |
| `per_test_case` | Ordinary bound when test cases are mentioned |
| `sum_over_test_cases` | Explicit aggregate phrase; distinct from an individual cap |
| `unknown` | Numeric evidence without enough meaning/scope context |

These are syntactic/contextual interpretations, not a full document semantics proof. The current parser assumes ordinary size constraints apply per case once multiple cases are mentioned. It does not resolve mixed batches, nested groups, subtask scopes, or arbitrary global/per-case prose.

Reliability values are `explicit`, `contextual`, `ambiguous`, and `conflicting`. They are categories, not probabilities. Current recognized size meanings are contextual; an explicit inequality still needs context to describe size. Conflicting bounds retain all original sources. Conditional/disjunctive lines containing if/or/either are recorded as ambiguous and excluded from size estimation. Multiple test-count meanings leave the count unknown while preserving other dimensions. Missing bounds stay null.

Example/sample headings exclude that section and subsequent text **until an explicit Constraints heading**. This supports statements with constraints after examples while preventing sample assignments such as `n = 3` from shrinking the maximum. Another example heading suspends extraction again. Excluded spans are masked without changing source offsets, so evidence still quotes the original statement. Without a Constraints heading, text after samples stays excluded. Inline example comparisons are also skipped conservatively. Unconsumed comparison syntax raises an uncertainty; it is not a complete parser-error detector.

## Selecting a growth parameter

The engine requires one unambiguous primary size meaning: array length, sequence length, generic element count, or vertex count. If none exists, it can use one unique secondary dimension such as a query count. Two different arrays are ambiguous even if only one has a convenient bound. Missing meaning, contradictory bounds, or an absent usable cap produce `insufficient_information`, without fabricated work.

With a primary dimension and a second context-defined bounded dimension, conditional O(n + m) and O(n * m) rows illustrate growth **if** an algorithm processes them additively or multiplicatively. They do not identify an actual algorithm or infer the relationship between the dimensions. Other dimensions are excluded from the ordinary univariate profile; cross-parameter totals are not estimated.

## Growth and heuristic bands

The functions are 1, max(1, log2 n), sqrt(n), n, n·max(1, log2 n), n², n³, 2^n, and n!. The log floor avoids undefined/tiny base cases; zero-sized linear/polynomial work remains zero. They are representative relative-growth functions, with multiplicative constants omitted.

For a context-defined upper bound n = 200000:

| Profile | Approximate abstract growth | Category under current bands |
| --- | --- | --- |
| O(n) | 200000 | promising |
| O(n log n) | 3521928 | possibly_feasible |
| O(n²) | 40000000000 | likely_infeasible |

Bands are <=10^6: `promising`; <=10^8: `possibly_feasible`; above that: `likely_infeasible`. `insufficient_information` means no justified profile. These thresholds are transparent teaching heuristics, not benchmarks, AC/TLE guarantees, confidence scores, or operations-per-second conversions. A conservative upper bound can be loose; a large bound does not prove actual work is large.

Exponentials use n·log10(2); factorials use lgamma(n+1)/ln(10). No huge loops or integers are constructed. Above 10^300 the numeric estimate is null, while finite `log10_work` and a `> 10^300` display remain available. JSON never contains infinity or NaN. Each row distinguishes per-instance growth at a bound from an all-test conservative upper bound.

Time limits are retained in seconds, memory limits with their stated units. Neither changes the bands. Runtime requires measured implementation/language costs; memory fit requires space complexity and representation details. The engine has neither, so it does not turn 2 seconds or 256 MB into unsupported feasibility promises.

## Why sum bounds matter

Let each nonnegative case size be n_i <= U, total size sum(n_i) <= S, and test count <= T when known. The aggregate parser recognizes phrases such as `The sum of n across all test cases does not exceed 2e5`.

| Profile | Conservative total upper bound |
| --- | --- |
| Linear | S |
| n log n | S·max(1, log2 U) |
| Quadratic | S·U |
| Cubic | S·U² |
| Square root, with a count cap | min(sqrt(T·S), T·sqrt(U)) |
| Constant / logarithmic, with a count cap | T / T·max(1, log2 U) |

For powers p >= 1, n_i^p <= n_i·U^(p−1), so summing gives S·U^(p−1). A bound on sum(n) is **not** an identical bound on sum(n²). The formulas describe upper bounds, not exact totals or equal-sized tests.

An aggregate cap also implies an individual cap U <= S for nonnegative counts. If a positive individual lower bound L is explicit, T <= floor(S/L); this can tighten or supply the count cap. If L is zero or absent, no count cap is invented: even zero-sized cases can contribute constant work. Contradictory aggregate/individual/test-count bounds produce uncertainty. Conditional/conflicting aggregate evidence is not silently ignored in favor of a naive T·U total.

Without an aggregate cap, known T allows T·g(U) as a conservative scenario. With an aggregate cap, exponential/factorial total profiles deliberately stay unavailable rather than constructing an uninformative distribution assumption. More elaborate bounds could be added later with proofs and tests; the current limitation does not mean no mathematical bound can exist.

## How deterministic logic and Groq complement each other

`AnalysisService` computes local evidence from the original statement, then performs the existing single provider call and combines validated results. `AnalysisContent`, the schema sent to Groq, is unchanged: deterministic data and provider metadata are server-owned response fields. Fake content remains an unrelated fixed teaching example; its deterministic section uses the student's actual statement.

The UI labels local output `Extracted from statement · Deterministic heuristic`, real provider comments `AI suggestion`, and fake comments `Demo example`. Both are retained. A small comparison helper flags an explicit positive AI recommendation for a matching complexity that the per-instance engine labels likely infeasible. It skips obvious negative advice, records a **potential** inconsistency, and does not declare either source correct. It is wording-based, not a semantic verifier; paraphrases, total-work disagreements, and nuanced qualifications can be missed. Fake fixtures are not compared to unrelated real input.

`POST /api/v1/assess` uses the same AnalyzeRequest validation and returns only AlgorithmicAssessment. It has no provider or settings dependency. Thus even invalid Groq configuration, exhausted quota, and provider outages leave local analysis available. `/analyze` still reports safe provider failures; the user explicitly chooses **Assess constraints only**. There is no extra model request, automatic retry, or mislabelled fallback.

## Extend patterns and verify offline

1. Add a small self-authored positive example and a nearby negative/ambiguous example to `test_constraints.py` before extending a pattern. Include intended role, scope, bounds, and source evidence.
2. Use the narrow NUMBER/VAR grammar and source-offset helper. Do not broaden parsing by evaluating arbitrary text or assigning size from variable names.
3. Add meaning evidence separately from numeric extraction. Preserve unsupported input as uncertainty; do not silently replace conflicts.
4. If adding a growth/aggregate rule, state its mathematical assumptions and add `test_complexity.py` checks for zero, missing, contradictory, and large values.
5. Extend Pydantic/TypeScript/runtime checks together only when the public schema changes. Keep server-owned data out of the generation schema.
6. Run from the repository root: `backend/.venv/Scripts/python.exe -m pytest backend/tests -q`. Then from frontend: `npm.cmd run build` and `npm.cmd test` with ports 5173/8000 free.

Backend fixtures ignore real .env, force fake defaults, block external DNS/socket connections, and mock the Groq SDK transport. Browser servers force fake mode and an empty key; AI branches use synthetic responses. No real key or live request is needed. Stage 3 observed results: 171 backend tests, 40 desktop/mobile browser tests, and a passing production build. Screenshots were inspected for the offline aggregate flow; browser checks also verify the existing progressive hints.

## Ten concepts to study

1. **Numerical reliability:** an LLM can produce plausible but incorrect arithmetic or copy a cap incorrectly. The engine independently computes 200000² = 40000000000; this still depends on interpreting the right size.
2. **Regular expressions:** named groups locate variables, operators, and bounded numeric tokens; CHAIN recognizes `1 <= n, m <= 1000`. Regex matching is a limited grammar, not full language understanding.
3. **Normalization:** Unicode-to-ASCII conversion lets one parser handle ≤ and <=; source offsets preserve traceability back to `2 × 10⁵`.
4. **Pydantic contracts:** nullable bounds distinguish unknown from zero, Literal categories constrain labels, and finite-number validation protects JSON. Valid structure does not prove true meaning.
5. **Growth functions:** evaluate g(U) for a hypothetical class. Linear, n-log-n, and quadratic scale very differently at 200000; logarithms keep huge exponential/factorial comparisons bounded.
6. **Growth versus runtime:** loops, allocations, cache behavior, constants, Python/C++ differences, and hardware change runtime. Relative units cannot predict seconds without measurements.
7. **Aggregates:** S controls total linear input; S·U controls a conservative quadratic total. Test-count and per-case caps are different information.
8. **Hybrid engineering:** Groq supplies language-oriented simplification, hypotheses, and hints; local code supplies repeatable extraction/calculation. Provenance prevents one source from appearing verified by the other.
9. **Abstention and limits:** missing meanings, multi-array ambiguity, unsupported expressions, multilingual prose, sum(n²), nested scopes, and arbitrary LaTeX remain limited or unsupported. No arbitrary semantic classifier, algorithm proof, or memory model exists.
10. **Preparing for NLP/retrieval:** structured roles, source evidence, and self-authored labeled tests provide features and evaluation cases for later classifiers. Constraints could later help filter retrieval candidates, but they neither establish algorithmic relevance nor replace provenance, curated data, and retrieval benchmarks. None of that later-stage work is implemented here.
