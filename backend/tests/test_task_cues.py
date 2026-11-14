"""Stage 5: deterministic task cues, cue reranking, and held-out evaluation splits."""

import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.retrieval import cues
from app.retrieval.catalog import load_catalog, retrieval_text
from app.retrieval.config import CUE_WEIGHT, RetrievalSettings, RetrievalUnavailable, get_retrieval_settings
from app.retrieval.evaluate import EVALUATION_PATH, evaluate, load_queries
from app.retrieval.retrievers import CueReranker, TFIDFRetriever
from app.services.similar_problem_service import SimilarProblemService


@pytest.fixture
def records():
    return load_catalog()[0]


@pytest.mark.parametrize("text,name,sign", [
    ("Answer sums on an array that is never updated.", "mutability", 1),
    ("The immutable list receives many range-sum queries.", "mutability", 1),
    ("Apply point updates and answer range sums.", "mutability", -1),
    ("Find a longest subsequence; positions need not be contiguous.", "contiguity", -1),
    ("Count consecutive segments with sum zero.", "contiguity", 1),
    ("Shortest paths in a graph with nonnegative edge weights.", "edge_sign", 1),
    ("Shortest paths in a graph whose edge weights may be negative.", "edge_sign", -1),
    ("Minimize the maximum group sum.", "extreme", 1),
    ("Place K points to maximize the minimum gap.", "extreme", -1),
])
def test_signed_axes_and_negation(text, name, sign):
    assert cues.extract(text).get(name) == sign


def test_negated_update_is_not_an_update_cue():
    # "never updated" contains "updated" but must read as fixed data.
    assert cues.extract("Corrections are never updated.")["mutability"] == 1


def test_graph_only_axes_require_graph_context():
    # "negative values" in a plain array task says nothing about edge weights.
    assert "edge_sign" not in cues.extract("Count subarrays of an array with negative values.")
    assert cues.extract("A directed graph has negative edge weights.")["edge_sign"] == -1


def test_unrelated_text_has_no_cues():
    assert cues.extract("zzzz qqqq") == {}
    assert not cues.vector("zzzz qqqq").any()


def test_cues_ignore_technique_metadata(records):
    problem = records[0]
    changed = problem.model_copy(update={"title": "Fenwick tree", "main_technique": "bellman_ford", "secondary_tags": ["graph"]})
    assert np.array_equal(cues.vector(retrieval_text(problem)), cues.vector(retrieval_text(changed)))


def test_shared_labels_require_matching_sign():
    assert "fixed data" in cues.shared_labels("a fixed array never updated", "an immutable array")
    assert cues.shared_labels("an immutable array", "apply point updates") == ()


def test_conflicting_cues_separate_static_and_dynamic_range_sums(records):
    reranker = CueReranker(TFIDFRetriever(records), CUE_WEIGHT)
    static = [item.problem.id for item in reranker.search("Range sums are asked many times on an array that never changes.", 50)]
    dynamic = [item.problem.id for item in reranker.search("Range sums are asked many times while single positions receive updates.", 50)]
    assert static.index("ledger_ranges") < static.index("sensor_adjustments")
    # A conflicting cue can push the static record to a nonpositive blended
    # score, which removes it from results entirely; both outcomes rank it lower.
    assert "ledger_ranges" not in dynamic or dynamic.index("sensor_adjustments") < dynamic.index("ledger_ranges")
    assert "sensor_adjustments" in dynamic


def test_zero_weight_reproduces_text_ranking(records):
    base = TFIDFRetriever(records)
    query = "Answer many inclusive interval sums on a fixed signed sequence."
    assert [(m.problem.id, m.score) for m in CueReranker(base, 0).search(query, 10)] == [(m.problem.id, pytest.approx(m.score)) for m in base.search(query, 10)]


@pytest.mark.parametrize("weight", [-0.1, 1.5])
def test_invalid_weight_rejected(records, weight):
    with pytest.raises(ValueError):
        CueReranker(TFIDFRetriever(records), weight)


def test_blended_scores_stay_bounded_and_empty_query_is_empty(records):
    reranker = CueReranker(TFIDFRetriever(records), 1.0)
    assert all(-1 <= item.score <= 1 for item in reranker.search("directed graph with negative edge weights", 50))
    assert reranker.search("   ", 5) == []
    assert reranker.search("zzzzxyz qqqxyz", 5) == []


def test_service_labels_cue_reranking_and_none_restores_text_only():
    query = "Many range-sum queries on an array that is never updated."
    cued = SimilarProblemService(RetrievalSettings(rerank="cues")).search(query)
    assert cued.reranking == "task_cues" and cued.matches[0].problem_id == "ledger_ranges"
    assert any("task cues" in note for note in cued.warnings)
    assert "Shared task cues: " in cued.matches[0].explanation
    plain = SimilarProblemService(RetrievalSettings(rerank="none")).search(query)
    assert plain.reranking == "none" and all("task cues" not in m.explanation for m in plain.matches)


def test_semantic_fallback_keeps_cue_reranking(tmp_path):
    result = SimilarProblemService(RetrievalSettings(method="semantic", model_dir=tmp_path / "missing")).search("Many range sums on an immutable array.")
    assert result.retrieval_method == "tfidf" and result.reranking == "task_cues"


def test_invalid_rerank_setting_is_safe(monkeypatch):
    monkeypatch.setenv("RETRIEVAL_RERANK", "magic")
    with pytest.raises(RetrievalUnavailable):
        get_retrieval_settings()
    response = TestClient(create_app()).post("/api/v1/similar", json={"statement": "Answer many range sums on a fixed array."})
    assert response.status_code == 503 and "magic" not in response.text


def test_api_reports_reranking():
    body = TestClient(create_app()).post("/api/v1/similar", json={"statement": "Answer many range sums on a fixed array."}).json()
    assert body["reranking"] == "task_cues"


def test_test_split_is_held_out_and_labels_reference_catalog(records):
    queries = load_queries()
    ids = {record.id for record in records}
    test = [query for query in queries if query.split == "test"]
    assert test and all(set(query.relevant_ids) <= ids for query in test)
    assert any(query.category == "hard_negative" for query in test)
    assert any(not query.relevant_ids for query in test)
    descriptions = {record.short_description for record in records} | {record.normalized_description for record in records}
    assert not any(query.query in descriptions or query.normalized_query in descriptions for query in queries)


def test_split_filter_and_cue_weight_are_recorded():
    result = evaluate("tfidf", RetrievalSettings(), split="test", cue_weight=CUE_WEIGHT)
    assert result["split"] == "test" and result["cue_weight"] == CUE_WEIGHT
    assert result["query_count"] == 28 and result["positive_query_count"] == 21


def test_old_split_field_defaults_to_dev(tmp_path):
    data = json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))
    for item in data:
        item.pop("split")
    path = tmp_path / "queries.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    assert all(query.split == "dev" for query in load_queries(path))


def test_uncovered_topic_notice_for_out_of_catalog_geometry():
    result = SimilarProblemService(RetrievalSettings()).search("Find the smallest circle radius enclosing planar points with real coordinates.")
    assert result.uncovered_topics == ["geometry"]
    assert any("no problem in this practice catalog covers" in note for note in result.warnings)
    assert result.matches  # weak neighbours stay visible; nothing is hidden


def test_covered_topics_produce_no_notice():
    for statement in ("Answer many range sums on an array that is never updated.",
                      "Place K towers on a line maximizing the minimum distance between them."):
        assert SimilarProblemService(RetrievalSettings()).search(statement).uncovered_topics == []


def test_notice_requires_cue_reranking():
    result = SimilarProblemService(RetrievalSettings(rerank="none")).search("Find the smallest circle radius enclosing planar points.")
    assert result.uncovered_topics == []


def test_cue_inflections_for_min_max_objectives():
    assert cues.extract("maximizing the minimum gap")["extreme"] == -1
    assert cues.extract("minimizing the maximum load")["extreme"] == 1


def test_evaluation_reports_out_of_catalog_rates():
    rates = evaluate("tfidf", RetrievalSettings(), split="test", cue_weight=CUE_WEIGHT)["out_of_catalog"]
    assert rates["no_match_queries"] == 7 and rates["real_match_queries"] == 21
    assert 0 <= rates["flagged_no_match_rate"] <= 1 and 0 <= rates["false_flag_rate"] <= 1
    assert evaluate("tfidf", RetrievalSettings(), split="test")["out_of_catalog"] is None


def test_labels_are_marked_assistant_reviewed_not_human_reviewed():
    assert {query.label_status for query in load_queries()} == {"assistant_reviewed_pending_user"}
