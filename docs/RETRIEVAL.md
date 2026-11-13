# Stage 4: local similar-problem retrieval

Stage 4 adds information retrieval over original practice examples. It retrieves existing catalog records; it does not generate solutions, call Groq for search, fetch contest statements, or certify algorithmic equivalence. Both retrievers are CPU-compatible, and TF-IDF remains the default. The optional MiniLM model was explicitly downloaded and verified in this workspace; normal runtime only loads local files.

## Data, provenance, and representation

`backend/app/data/practice_problems.json` contains 36 concise, original practice tasks spanning 17 main techniques. Each has a unique ID, title, narrative description, normalized task description, main/secondary technique tags, difficulty, nullable constraints summary, `source_type=original_practice`, and null external URL. They are not copies of named contest tasks and have no invented contest identifiers or links. Pydantic validates required nonblank fields, normalized tags, difficulty, and provenance. The catalog loader rejects duplicate IDs. Current original-only records reject all external URLs; adding real hosted sources later requires a separate verified-source contract, not just filling in a URL.

The searchable corpus representation is `Task: {normalized_description}`. It includes the input structure, objective, permitted operations, and important conditions where relevant, but no solution. Titles, technique labels, IDs, difficulty, and relevance labels do not enter either retriever's vector representation. For example, `capacity_manifest` describes ordered positive weights, at most D contiguous groups, and minimizing capacity; its `binary_search_answer` metadata remains outside retrieval text.

`backend/app/data/retrieval_queries.json` is a separate 14-query evaluation set. It includes three story-variation pairs, vocabulary/algorithm mismatches, related extensions, multiple relevant records, a broad six-relevant-record practice request, and an unsupported geometry task. Each record includes raw and normalized queries, relevant IDs, a rationale, category, optional pair identifier, and label status.

The user explicitly chose to keep labels **provisional for later review**. They are author-curated judgments, not independently human-reviewed ground truth. Some broader matches are subjective: envelope nesting is treated as related to increasing subsequences; prerequisite layering is treated as related to valid prerequisite ordering. Do not present these provisional metrics as a validated ML benchmark. Before changing labels, read the notes, check each candidate's conditions and objective, record a review status, and regenerate the report. Do not tune labels merely to improve a score.

## Retrieval implementations

`TFIDFRetriever` fits scikit-learn's TfidfVectorizer once per cached catalog representation, using English stop words, unigrams/bigrams, and sublinear term frequency. At query time it transforms with the fitted vocabulary and computes cosine similarity against the document matrix. It does not fit a vectorizer per search. Shared nonzero feature names provide observable lexical explanations.

`SemanticRetriever` receives a locally loaded SentenceTransformer. It uses `encode_document()` for the corpus and `encode_query()` for queries when available, with a compatible `encode()` fallback. The configured model is `sentence-transformers/all-MiniLM-L6-v2`, an English general-purpose encoder producing 384-dimensional vectors. It is not a competitive-programming algorithm classifier. Its default context is 256 word pieces, so long raw statements can lose important later conditions. No chunking/reranking is claimed in this stage.

Both implementations use the same catalog text and cosine ranking. Only positive-score candidates are returned; this is a mathematical positivity filter, **not** a calibrated relevance threshold. Ties break by ascending problem ID; K above corpus size returns fewer records. A TF-IDF query outside the vocabulary returns no matches. Semantic search can return positive yet irrelevant matches for unrelated text. The UI and API explicitly state this limitation.

Cosine similarity is `(q · d) / (||q|| ||d||)`: direction agreement between vectors. It is independent of vector length and is not an 82% algorithm-match probability when its value is 0.82. Scores are finite and bounded to [-1, 1]; invalid encoder outputs fail safely.

## Configuration, model setup, and resources

The retrieval configuration is independent of LLM settings. Invalid Groq credentials or provider selection do not disable `/similar`. It reads these backend settings using the established root .env/process precedence:

| Setting | Default |
| --- | --- |
| RETRIEVAL_METHOD | tfidf |
| RETRIEVAL_TOP_K | 5, allowed 1–20 |
| EMBEDDING_MODEL | sentence-transformers/all-MiniLM-L6-v2 |
| EMBEDDING_CACHE_DIR | .cache/models/all-MiniLM-L6-v2 relative to repository root |

TF-IDF needs the standard `pip install -e './backend[dev]'`. Optional semantic setup from the repository root is:

```powershell
backend/.venv/Scripts/python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
backend/.venv/Scripts/python.exe -m pip install -e './backend[semantic]'
backend/.venv/Scripts/python.exe -m app.retrieval.setup_model --download
```

Before running that command on another machine: expect about 90 MB of selected model/tokenizer/configuration files, several GB of optional dependency disk space, and roughly 1–2 GB of RAM as a planning estimate. Actual memory depends on library versions, process count, and inputs; this is not a measured memory requirement. The observed model cache here is **87.3 MiB**. CPU PyTorch's wheel downloaded here was 126.6 MB; installed packages occupy more space. No GPU or paid account is required. The full upstream repository contains additional export/weight formats; setup downloads only the required safetensors/tokenizer/configuration files.

`setup_model.py --download` is the sole network download path. Without the flag it exits before importing download libraries. It resolves an upstream commit, downloads the selected files at that revision, loads them locally, verifies an embedding, and writes a local identity marker containing model ID, revision, and dimensions. The verified revision here is `1110a243fdf4706b3f48f1d95db1a4f5529b4d41`.

Runtime reads only a model directory with the expected identity marker, calls SentenceTransformer with CPU, `local_files_only=True`, and `trust_remote_code=False`, and makes no hosted embedding requests. A missing/corrupt model, missing optional dependencies, or encoding failure causes a visible TF-IDF fallback. `requested_method=semantic` and `retrieval_method=tfidf` record the distinction; individual matches use the actual method. No weights or cache files are committed; `.cache/` is ignored.

After setup, select `RETRIEVAL_METHOD=semantic` in backend configuration and restart. The implementation leaves existing real .env files unchanged. To enforce offline operation additionally, set `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1` in the backend process. The setup command intentionally requires internet; search and evaluation do not.

## Caching and concurrency

The loader hashes catalog bytes together with the retrieval representation version. Changes to any catalog field safely invalidate the index, even if the search text happens to be unchanged. Bump `REPRESENTATION_VERSION` when changing text preparation/vectorizer policy. The process retains at most two indexes and one local encoder. Catalog changes regenerate corpus vectors while reusing an unchanged loaded model.

The model cache key includes model ID, resolved local directory, and file names, sizes, and modification timestamps. Model changes produce a new encoder/index key; weights are stat'ed rather than rehashed on every query. This lightweight invalidation assumes ordinary filesystem timestamp behavior. There is no persistent embedding matrix, Redis, database, or vector store. Restarting regenerates a small corpus index. Multiple backend workers each have their own memory cache.

A lock guards initialization and neural search. `/similar` is synchronous and FastAPI executes it in a worker thread. Combined analysis offloads search with `run_in_threadpool`, so heavy loading/encoding does not occupy the event loop. Optional integrated retrieval has a three-second waiting budget: on timeout, the successful analysis and hints return with a safe warning. A worker already loading a model may finish and warm the cache after the response. A first standalone search has the existing browser deadline of 45 seconds. This is a small single-process design, not distributed search or a throughput claim.

## API and frontend

`POST /api/v1/similar` accepts `{"statement":"...","k":5}`. It shares the existing 20–20,000 trimmed Unicode-character input contract; malformed JSON, blank/invalid statements, and noninteger/out-of-range K return 422. The service handles an empty catalog/query explicitly. The endpoint returns a safe 503 for configuration/catalog failures without exposing raw exceptions.

SimilarResponse includes actual query, query source, requested/actual method, catalog revision, matches, and warnings. Each match contains ID, title, description, difficulty, technique tags, finite cosine score, actual method, metadata/signal-based explanation, original-practice provenance, and null URL. No model generates recommendation explanations.

`POST /api/v1/analyze` adds optional server-owned `similar_problems` and `retrieval_warning`, outside AnalysisContent. The Groq adapter, prompt, generation schema, and single request remain unchanged. Fake mode always searches the actual user statement. Real AI mode may reuse an existing simplification only when the provider reports no uncertainties. That rule is a heuristic, not a semantic reliability proof; the response and UI disclose AI query provenance. With reported uncertainty, raw text is used. No extra rewrite request occurs.

Retrieval configuration/loading/timeout failures cannot replace a successful analysis with an error. The frontend also discards malformed optional retrieval data while retaining valid analysis/hints. Standalone malformed retrieval responses are rejected safely. **Find similar problems** makes only a `/similar` request. **Assess constraints only** still uses only `/assess`. All actions share input validation, duplicate-submit protection, stale-result clearing, and preserved input on error.

The existing design is preserved. Similar Problems shows up to five original practice cards with difficulty, tags, scores, actual method, explanations, and limitations. It starts collapsed for combined analyses because tags may hint at a technique, and expanded for explicit practice search. No fake external links are rendered. Desktop/mobile browser checks and screenshot inspection cover the flow.

## Measured experiment and metric definitions

Run from the repository root after installing normal dependencies:

```powershell
$env:HF_HUB_OFFLINE = '1'
$env:TRANSFORMERS_OFFLINE = '1'
backend/.venv/Scripts/python.exe -m app.retrieval.evaluate --output docs/retrieval_results.json
```

If the local encoder is unavailable, the script measures TF-IDF and records semantic results as **not evaluated**. It never substitutes fallback TF-IDF numbers into a semantic result. The report records corpus revision, representation version, model commit, dependency versions, per-query IDs, and story-pair overlap.

For query-specific relevant set R and returned top-five set A:

- Precision@5 = |A ∩ R| / 5. Returning fewer than five does not shrink the denominator.
- Recall@5 = |A ∩ R| / |R|. The six-relevant-record query uses denominator six.
- Reciprocal rank = 1 / position of the first relevant result in the full returned positive-score ranking; zero when no relevant result is returned. MRR averages these values, not their ranks. It is not truncated at five or at the public API's K limit.
- For the no-relevant-record query, P@5 is zero; recall/MRR are undefined and excluded from those means. The report states 14 total queries and 13 queries contributing recall/MRR. This query's returned neighbors remain visible as failure evidence.
- For each story pair, top-five Jaccard overlap = intersection size / union size. It measures ranking consistency, not correctness.

Observed with catalog revision `a50a6c0bbe14d476` and **provisional labels**:

| Representation | Method | P@5 | R@5 | MRR |
| --- | --- | --- | --- | --- |
| Raw narrative | TF-IDF | 0.2286 | 0.7308 | 0.6468 |
| Raw narrative | MiniLM | 0.2714 | 0.8077 | 0.7532 |
| Authored normalized task | TF-IDF | 0.3000 | 0.9231 | 0.8846 |
| Authored normalized task | MiniLM | 0.3286 | 0.9744 | 1.0000 |

Normalized queries are a separate authored representation experiment, not a claim that production automatically normalizes raw statements equally well. No hints, predicted tags, ground-truth technique labels, or known solutions are injected into representations. Query descriptions can still share task vocabulary with the catalog; the small curated collection and subjective labels limit generalization. There is no train/test learning, fine-tuning, independent held-out benchmark, or statistical significance claim.

Failures and comparisons to retain:

- Raw `capacity_timetables`: TF-IDF's first two neighbors were skyline rectangle and coin combinations, with recall@5 = 0. MiniLM retrieved freight capacity first but still reached only recall@5 = 0.5.
- Raw `rainfall_intervals`: MiniLM put interval updates and interval union first and missed the fixed range-sum relevant record in its top five. TF-IDF retrieved the labeled range-sum match. Similar words/meaning do not guarantee the right computational operation.
- Raw `prerequisites`: TF-IDF missed both relevant records in its top five. MiniLM did better on that query.
- `circle_geometry`: neither method has a relevant catalog example; both still return weak textual neighbors. No calibrated out-of-domain rejection is implemented.
- For normalized `stateful_choices`, MiniLM recalls four of six relevant records (0.6667), while MRR is 1 because its first result is relevant. High MRR does not imply complete recall.
- Raw story-pair Jaccard overlap is low: partition 0.111 for both methods; range sums 0.429 TF-IDF versus 0.250 MiniLM; weighted paths 0.250 versus 0.429. Semantic normalization improves two pairs, but does not make narrative invariance universal.

## Verification and file guide

Automated tests force TF-IDF defaults, a temporary absent model directory, offline Hugging Face settings, ignored real dotenv contents, and blocked external DNS/socket access. Semantic unit tests use deterministic mock vectors. A subprocess test refuses neural-library imports during app startup; setup without `--download` is tested; missing-model evaluation never disguises fallback as semantic measurement.

Observed checks: 248 backend tests passed in 13.67s; TypeScript/Vite production build passed (38 modules, Vite 2.81s); the final complete browser run passed 52 desktop/mobile tests in 1.2 minutes. An earlier locator failure and its correction are recorded in LEARNING_LOG.md. Tests ran on 5174/8001 while the user's 5173/8000 servers remained running. Screenshots were inspected at both viewports. Real neural verification is a separately labeled manual offline smoke/evaluation, not part of the automated suite. After the final provenance-only change, all 30 retrieval unit tests also passed.

| File | Study responsibility |
| --- | --- |
| `app/data/practice_problems.json` | Inspect/edit original task descriptions and provenance |
| `app/data/retrieval_queries.json` | Review provisional relevance IDs and rationales |
| `app/schemas/retrieval.py` | Catalog and response validation, bounded K, honest methods |
| `app/schemas/analysis_input.py` | Shared input contract without output-schema cycles |
| `app/retrieval/catalog.py` | Task representation and revision hashing |
| `app/retrieval/retrievers.py` | TF-IDF, task-aware encoding, cosine, deterministic ranking |
| `app/retrieval/cache.py` | Local-only loading, bounded cache, invalidation, locking |
| `app/retrieval/config.py` | Retrieval settings independent of provider validity |
| `app/retrieval/setup_model.py` | Explicit download and local identity verification |
| `app/services/similar_problem_service.py` | Fallback policy, observable explanations, provenance |
| `app/api/routes/similar.py` | Standalone worker-thread endpoint and safe errors |
| `app/retrieval/evaluate.py` | Correct metrics, representation comparison, failure evidence |
| `frontend/src/components/SimilarProblems.tsx` | Cards, method/score caveats, collapsed recommendations |
| `docs/retrieval_results.json` | Actual reproducible per-query results |

Backend file paths in the table are relative to backend/. Existing AnalysisService/App/API types are extended rather than replaced. Tests live in test_retrieval.py, test_similar_api.py, and the existing workflow/provider suites.

Primary references: [TfidfVectorizer](https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html), [Sentence Transformers semantic search](https://www.sbert.net/examples/sentence_transformer/applications/semantic-search/README.html), [MiniLM model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2), and [local-files-only model loading](https://sbert.net/docs/package_reference/sentence_transformer/model.html).

## Twelve learning concepts

1. **Information retrieval:** search a fixed collection for relevant records. `ledger_ranges` is returned from the catalog rather than invented from a prompt.
2. **TF-IDF:** term frequency captures local repetition; inverse document frequency downweights common corpus terms. The implementation also uses bigrams and English stop words. This is a strong, inspectable baseline.
3. **Vectors:** a fitted vocabulary gives each TF-IDF dimension a known term/phrase; a document becomes a sparse numeric row. No vocabulary is learned from each new query.
4. **Sentence embeddings:** MiniLM maps a task to a learned dense 384-number representation. Unlike a TF-IDF coordinate, one embedding coordinate is not a directly named algorithm feature.
5. **Cosine similarity:** compare vector directions, not probabilities. The mock-encoder test uses [3,0] and [1,0] to verify cosine 1 despite different lengths.
6. **Semantic versus algorithmic similarity:** a rainfall story can resemble interval-update prose while asking static sums. Necessary operations, positivity, contiguity, direction, and update timing can change the algorithm.
7. **Top-K:** return the K highest-ranked eligible candidates, not K guaranteed relevant tasks. Public K is capped at 20, with five cards shown in the UI.
8. **Precision and recall:** precision measures how many shown results are labeled relevant; recall measures how much of the query's relevant set was recovered. A query with six relevant tasks cannot achieve recall 1 from five results.
9. **MRR:** rewards an early first useful result. It can be perfect while recall remains incomplete, as the broad stateful-choice query demonstrates.
10. **Caching:** precompute corpus vectors once per revision; encode only each incoming query. Changing catalog/preparation/model identity invalidates the right cache rather than serving stale vectors.
11. **Baselines and experiments:** using the same queries/representations/labels makes TF-IDF versus MiniLM comparisons meaningful. Keep wins and failures; a larger model is not automatically better on every query.
12. **Future contrastive learning/reranking:** reviewed positive pairs and hard negatives such as static sums versus interval updates could eventually teach algorithm-aware representations. Separate train/validation/test data and compare against this baseline before adopting improvements. Stage 5 might add verified algorithm-aware features or ranking experiments, but no training, reranker, or later-stage implementation starts here.

# Stage 5: task-cue reranking, hard negatives, and a held-out split

Stage 4 showed text similarity confusing tasks that share vocabulary but need different algorithms (static range sums versus interval updates; unrelated neighbors for out-of-catalog queries). Stage 5 measures one small, explainable fix without training, new dependencies, or Groq calls.

## What changed

- **Catalog: 36 → 50 original records.** The 14 additions are mostly *hard negatives* placed next to existing records: range sums with point updates (vs. static `ledger_ranges`), static range minimum, weighted interval selection (vs. maximum-count `meeting_schedule`), grid flood fill (vs. `maze_steps`), 0/1-weight and negative-weight shortest paths (vs. the Dijkstra records), minimum spanning tree, unsorted two-sum (vs. sorted `pair_budget`), longest common subsequence, subset sum, maximize-the-minimum placement, lowest common ancestor, and bipartite checking. Same provenance rules: original text, `source_url: null`, technique labels excluded from retrieval text.
- **Queries: 14 → 36, with an explicit `split`.** The original 14 are the **dev** split. The 22 new **test** queries were written *before* any cue rule existed and were never used to choose rules or weights. They include 8 hard negatives, a static-sum story pair, technique coverage the dev split lacked, and one no-match geometry query. Labels remain `provisional_author_judgment`.
- **Task cues** (`app/retrieval/cues.py`): ~23 regex signals over the solution-free task text, such as fixed data vs. updates, contiguous vs. gaps allowed, directed vs. undirected, nonnegative vs. negative edge weights, weighted vs. unit steps, minimize-max vs. maximize-min, plus binary cues (graph, tree, grid, many queries, index ranges, time intervals, strings, counting, connectivity, cycles, single-use items, exact target, sorted input, geometry, next greater, common ancestor, two-way split). Opposite cues share a **signed axis**, so a conflict lowers similarity. Negated phrases ("never updated", "need not be contiguous") are stripped before the opposite cue is tested. Edge-weight axes only activate when graph vocabulary is present.
- **`CueReranker`** wraps either base retriever: `score = (1 − w) · text_cosine + w · cue_cosine`, still in [−1, 1]. Only positive blended scores are returned, so a strong cue conflict can remove a lexically similar record entirely. `w = 0.2` (`CUE_WEIGHT`) was chosen on the dev split only.
- **API/UI:** `SimilarResponse.reranking` is `"task_cues"` or `"none"`. Explanations add "Shared task cues: …". The UI shows "TF-IDF + task cues" and "Blended score". `RETRIEVAL_RERANK=none` restores the exact Stage 4 ranking. Older responses without the field still render.

## Weight selection (dev split only)

Objective: mean of R@5 and MRR over raw and normalized dev queries, TF-IDF base, 50-record catalog.

| w | none | 0.1 | 0.15 | **0.2** | 0.25 | 0.3 | 0.4 | 0.6 |
|---|---|---|---|---|---|---|---|---|
| objective | 0.728 | 0.853 | 0.856 | **0.864** | 0.857 | 0.852 | 0.841 | 0.831 |

Gains form a broad plateau (0.1–0.35), so the result is not sensitive to the exact weight.

## Measured results (catalog `e00501f992b177b3`, queries `75aed4ad080dd355`)

| Split | Query | Ranking | P@5 | R@5 | MRR |
|---|---|---|---|---|---|
| dev (14) | raw | TF-IDF | 0.200 | 0.654 | 0.574 |
| dev (14) | raw | TF-IDF + cues | 0.257 | 0.808 | 0.904 |
| dev (14) | normalized | TF-IDF | 0.286 | 0.910 | 0.776 |
| dev (14) | normalized | TF-IDF + cues | 0.286 | 0.910 | 0.833 |
| **test (22)** | raw | TF-IDF | 0.145 | 0.714 | 0.467 |
| **test (22)** | raw | TF-IDF + cues | **0.182** | **0.857** | **0.699** |
| **test (22)** | normalized | TF-IDF | 0.200 | 0.952 | 0.909 |
| **test (22)** | normalized | TF-IDF + cues | **0.218** | **1.000** | **0.952** |

Full per-query output: [retrieval_results_stage5.json](retrieval_results_stage5.json). MiniLM was **not evaluated** in Stage 5 because the optional model is not installed on the machine that ran it; the report says so rather than substituting fallback numbers. Stage 4's MiniLM results remain in [retrieval_results.json](retrieval_results.json) for the 36-record catalog. Adding 14 distractors lowered the plain TF-IDF dev baseline (raw R@5 0.731 → 0.654), as expected for a larger catalog.

## Held-out wins and remaining failures (raw test queries)

Improved: `cheapest_day_lookup`, `frozen_price_totals` (static sums now rank `ledger_ranges` first instead of the update record), `token_corridors`, `unique_streak`, `taller_ahead`, `rival_dorms` (no shared TF-IDF terms; found only through cues), `pipeline_layout` (recall 0 → 1), `common_genes`, `exact_parcel`, `dungeon_moves`, `payroll_subtrees`.

Still failing, kept as evidence and not tuned against:

- `mixing_desk_levels` (updates + range sums): "set one channel to a new level" does not trigger the update cue, so the hard negative still wins.
- `archive_page_sums`, `merging_clubs`: story vocabulary ("word counts per page", "clubs merge") shares too little with the task text, and no cue fires strongly enough.
- `lecture_fees`: `paid_bookings` ranks 4th. The weighted/unweighted interval distinction has no cue.
- `polygon_area` (no relevant record): weak neighbors are still returned. No out-of-domain abstention is implemented.

## Limits

The same author wrote the queries, labels, and cue rules. Writing the test split before the rules reduces, but does not remove, that bias: 21 positive test queries is small and the improvement is exploratory evidence, not proof of generalization. Cues are keyword rules: they miss paraphrases, can fire on incidental words, and do not identify algorithms. Semantic + cues is implemented and unit-tested with fake encoders but not measured. Reranking adds about 6 ms per search on the 50-record catalog (cue vectors are cached per index).
