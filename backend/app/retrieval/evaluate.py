"""Offline benchmark. Semantic unavailability is reported, never hidden by fallback."""

import argparse
import hashlib
import json
from importlib.metadata import version
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator

from app.retrieval.cache import get_index, search_index
from app.retrieval.catalog import REPRESENTATION_VERSION, load_catalog
from app.retrieval.config import RetrievalSettings, get_retrieval_settings

EVALUATION_PATH = Path(__file__).resolve().parents[1] / "data" / "retrieval_queries.json"


class EvaluationQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1)
    query: str = Field(min_length=1)
    normalized_query: str = Field(min_length=1)
    relevant_ids: list[str]
    category: str
    notes: str = Field(min_length=1)
    story_pair: str | None = None
    label_status: str = "provisional_author_judgment"

    @model_validator(mode="after")
    def unique_relevance(self):
        if len(self.relevant_ids) != len(set(self.relevant_ids)):
            raise ValueError("Duplicate relevance IDs")
        return self


def metrics(ranked_ids: list[str], relevant_ids: set[str], k: int = 5) -> dict:
    if k <= 0 or len(ranked_ids) != len(set(ranked_ids)):
        raise ValueError("Positive K and unique ranked IDs required")
    hits = len(set(ranked_ids[:k]) & relevant_ids)
    first = next((index for index, item in enumerate(ranked_ids, 1) if item in relevant_ids), None)
    return {f"precision_at_{k}": hits / k, f"recall_at_{k}": hits / len(relevant_ids) if relevant_ids else None,
            "reciprocal_rank": 1 / first if first else None if not relevant_ids else 0.0}


def evaluate(method: str, settings: RetrievalSettings, representation="raw", path: Path = EVALUATION_PATH) -> dict:
    records, revision = load_catalog()
    queries = TypeAdapter(list[EvaluationQuery]).validate_python(json.loads(path.read_text(encoding="utf-8")))
    valid = {item.id for item in records}
    if len({item.id for item in queries}) != len(queries) or any(set(item.relevant_ids) - valid for item in queries):
        raise ValueError("Invalid benchmark identifiers")
    index = get_index(method, records, revision, settings)
    rows = []
    for query in queries:
        text = query.query if representation == "raw" else query.normalized_query
        # API K stays capped at 20. Evaluation requests all positive-score
        # candidates so MRR is not truncated at K=5 or at the API limit.
        ranked = search_index(index, text, max(1, len(records)))
        ids = [item.problem.id for item in ranked]
        rows.append({"id": query.id, "category": query.category, "story_pair": query.story_pair,
                     "relevant_ids": query.relevant_ids, "top_5": ids[:5], **metrics(ids, set(query.relevant_ids))})
    labeled = [row for row in rows if row["recall_at_5"] is not None]
    mean = lambda key, subset: sum(row[key] for row in subset) / len(subset) if subset else None
    pairs = {}
    for name in sorted({row["story_pair"] for row in rows if row["story_pair"]}):
        members = [row for row in rows if row["story_pair"] == name]
        if len(members) == 2:
            left, right = map(lambda row: set(row["top_5"]), members)
            pairs[name] = len(left & right) / len(left | right) if left | right else 1.0
    provenance = {"scikit_learn_version": version("scikit-learn"), "representation_version": REPRESENTATION_VERSION}
    if method == "semantic":
        marker = json.loads((settings.model_dir / "algolens_model.json").read_text(encoding="utf-8"))
        provenance.update({"model": settings.model, "model_revision": marker["revision"], "sentence_transformers_version": version("sentence-transformers"), "torch_version": version("torch")})
    return {"method": method, "representation": representation, "catalog_revision": revision,
        "evaluation_revision": hashlib.sha256(path.read_bytes()).hexdigest()[:16], "provenance": provenance,
        "query_count": len(rows), "positive_query_count": len(labeled), "label_status": sorted({q.label_status for q in queries}),
        "precision_at_5": mean("precision_at_5", rows), "recall_at_5": mean("recall_at_5", labeled),
        "mrr": mean("reciprocal_rank", labeled), "story_pair_top5_jaccard": pairs, "queries": rows,
        "policy": "P@5 uses denominator 5 even for short lists. No-relevance queries contribute P@5=0 and are excluded from recall/MRR. MRR uses every returned positive-score candidate, with missing relevant results scored zero. Labels are subjective and provisional pending user review."}


def main():
    parser = argparse.ArgumentParser(description="Evaluate TF-IDF and local-only MiniLM without any model downloads.")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    settings = get_retrieval_settings()
    results = []
    for representation in ("raw", "normalized"):
        for method in ("tfidf", "semantic"):
            try:
                results.append(evaluate(method, settings, representation))
            except Exception:
                if method != "semantic":
                    raise
                results.append({"method": method, "representation": representation, "status": "not_evaluated", "reason": "Local model/dependencies unavailable or invalid; no fallback scores substituted."})
    report = json.dumps({"experiments": results}, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report + "\n", encoding="utf-8")
    for result in results:
        print(json.dumps({key: value for key, value in result.items() if key != "queries"}))


if __name__ == "__main__":
    main()
