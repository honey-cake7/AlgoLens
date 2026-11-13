"""Stage 6 catalog quality report: duplicates, coverage, provenance, leakage.

Run before adding or editing records:

    python -m app.retrieval.catalog_check            # human-readable report
    python -m app.retrieval.catalog_check --strict   # exit 1 on any problem

Checks
- Schema/provenance: every record validates (original records have no URL;
  external records need https URL, source name, license note, verified date).
- Near duplicates: TF-IDF cosine between task descriptions at or above a
  threshold usually means one record repeats another.
- Coverage: records per main technique; techniques with a single record make
  hard-negative and recall evaluation weak.
- Leakage: an evaluation query nearly identical to a catalog description
  would inflate metrics, because the query is no longer an independent test.
"""

import argparse
import sys
from collections import Counter
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.retrieval.catalog import CATALOG_PATH, load_catalog, retrieval_text
from app.retrieval.evaluate import EVALUATION_PATH, load_queries

DUPLICATE_THRESHOLD = 0.8
LEAKAGE_THRESHOLD = 0.9


def _pairs_above(matrix, threshold):
    scores = cosine_similarity(matrix)
    return [(i, j, float(scores[i, j])) for i in range(len(scores)) for j in range(i + 1, len(scores)) if scores[i, j] >= threshold]


def check(catalog_path: Path = CATALOG_PATH, queries_path: Path = EVALUATION_PATH) -> dict:
    records, revision = load_catalog(catalog_path)  # raises on schema/provenance errors
    texts = [retrieval_text(item) for item in records]
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
    matrix = vectorizer.fit_transform(texts)
    duplicates = [{"left": records[i].id, "right": records[j].id, "cosine": round(score, 3)} for i, j, score in _pairs_above(matrix, DUPLICATE_THRESHOLD)]

    coverage = Counter(item.main_technique for item in records)
    single = sorted(name for name, count in coverage.items() if count < 2)

    queries = load_queries(queries_path)
    valid_ids = {item.id for item in records}
    unknown = sorted({rid for query in queries for rid in query.relevant_ids} - valid_ids)
    leakage = []
    for query in queries:
        for text in (query.query, query.normalized_query):
            scores = cosine_similarity(vectorizer.transform([text]), matrix)[0]
            best = int(scores.argmax())
            if scores[best] >= LEAKAGE_THRESHOLD:
                leakage.append({"query": query.id, "record": records[best].id, "cosine": round(float(scores[best]), 3)})

    sources = Counter(item.source_type for item in records)
    problems = len(duplicates) + len(unknown) + len(leakage)
    return {"catalog_revision": revision, "records": len(records), "sources": dict(sources),
            "techniques": dict(sorted(coverage.items())), "single_record_techniques": single,
            "near_duplicates": duplicates, "unknown_relevance_ids": unknown, "query_leakage": leakage,
            "problems": problems}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Check catalog quality without any network access.")
    parser.add_argument("--strict", action="store_true", help="exit with status 1 if duplicates, unknown labels, or leakage are found")
    args = parser.parse_args(argv)
    report = check()
    print(f"Catalog {report['catalog_revision']}: {report['records']} records, sources {report['sources']}")
    print(f"Techniques ({len(report['techniques'])}): " + ", ".join(f"{name}={count}" for name, count in report["techniques"].items()))
    if report["single_record_techniques"]:
        print("Single-record techniques (add a second example or hard negative): " + ", ".join(report["single_record_techniques"]))
    for item in report["near_duplicates"]:
        print(f"NEAR DUPLICATE: {item['left']} ~ {item['right']} (cosine {item['cosine']})")
    for rid in report["unknown_relevance_ids"]:
        print(f"UNKNOWN RELEVANCE ID: {rid}")
    for item in report["query_leakage"]:
        print(f"QUERY LEAKAGE: {item['query']} ~ {item['record']} (cosine {item['cosine']})")
    print("OK: no blocking problems." if not report["problems"] else f"{report['problems']} blocking problem(s).")
    return 1 if args.strict and report["problems"] else 0


if __name__ == "__main__":
    sys.exit(main())
