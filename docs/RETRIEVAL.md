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
