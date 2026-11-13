import json
import subprocess
import sys

import numpy as np
import pytest
from pydantic import ValidationError

from app.retrieval import cache
from app.retrieval.catalog import load_catalog, retrieval_text
from app.retrieval.config import RetrievalSettings, RetrievalUnavailable
from app.retrieval.evaluate import EVALUATION_PATH, EvaluationQuery, evaluate, metrics
from app.retrieval.retrievers import SemanticRetriever, TFIDFRetriever, rank
from app.schemas.retrieval import PracticeProblem
from app.services.similar_problem_service import SimilarProblemService


@pytest.fixture
def records():
    return load_catalog()[0]


def write_catalog(tmp_path, data):
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def test_catalog_is_original_diverse_valid_and_has_no_fake_links(records):
    assert len(records) == 50
    assert len({record.id for record in records}) == 50
    assert len({record.main_technique for record in records}) >= 23
    assert all(record.source_type == "original_practice" and record.source_url is None for record in records)


@pytest.mark.parametrize("field,value", [("title", " "), ("difficulty", "legendary"), ("main_technique", "Binary Search"), ("source_url", "https://codeforces.com/problemset/problem/999999/A"), ("secondary_tags", ["bfs", "bfs"])])
def test_invalid_catalog_fields_fail(records, field, value):
    data = records[0].model_dump()
    data[field] = value
    with pytest.raises(ValidationError):
        PracticeProblem.model_validate(data)


def test_missing_fields_and_duplicate_ids_fail(records, tmp_path):
    data = records[0].model_dump()
    del data["short_description"]
    with pytest.raises(ValidationError):
        load_catalog(write_catalog(tmp_path, [data]))
    with pytest.raises(ValueError, match="unique"):
        load_catalog(write_catalog(tmp_path, [records[0].model_dump()] * 2))


def test_representation_omits_technique_metadata(records):
    problem = records[0]
    changed = problem.model_copy(update={"title": "Leaked answer", "main_technique": "invented_label", "secondary_tags": ["secret_tag"], "difficulty": "hard"})
    assert retrieval_text(problem) == retrieval_text(changed)
    assert "invented_label" not in retrieval_text(changed)


def test_tfidf_ranking_cosine_and_no_refit(records, monkeypatch):
    retriever = TFIDFRetriever(records)
    monkeypatch.setattr(retriever.vectorizer, "fit_transform", lambda *_: pytest.fail("Do not refit per query"))
    query = next(record.normalized_description for record in records if record.id == "ledger_ranges")
    result = retriever.search(query, 5)
    assert result[0].problem.id == "ledger_ranges"
    assert result[0].score > 0.9
    assert result[0].signals
    assert retriever.search(query, 5) == result
    assert retriever.search("zzzzxyz qqqxyz", 5) == []


def test_stable_ties_large_k_and_empty_corpus(records):
    two = [records[0].model_copy(update={"id": "z"}), records[0].model_copy(update={"id": "a"})]
    results = TFIDFRetriever(two).search(records[0].normalized_description, 20)
    assert [row.problem.id for row in results] == ["a", "z"]
    assert TFIDFRetriever([]).search("anything", 5) == []
    assert TFIDFRetriever(records).search("  ", 5) == []


class Encoder:
    def __init__(self):
        self.document_calls = 0
        self.query_calls = 0

    def encode_document(self, sentences, **kwargs):
        self.document_calls += 1
        return [[3, 0] if index == 0 else [0, 2] for index in range(len(sentences))]

    def encode_query(self, sentences, **kwargs):
        self.query_calls += 1
        return [[1, 0] for _ in sentences]


def test_semantic_mock_encoder_cosine_and_cached_documents(records):
    encoder = Encoder()
    retriever = SemanticRetriever(records[:2], encoder)
    for _ in range(2):
        result = retriever.search("unrelated wording", 5)
        assert result[0].problem == records[0]
        assert result[0].score == pytest.approx(1)
    assert encoder.document_calls == 1 and encoder.query_calls == 2
    assert SemanticRetriever([], encoder).search("anything", 5) == []


def test_legacy_encoder_encode_fallback(records):
    class Legacy:
        def encode(self, sentences, **kwargs):
            return [[1, 2] for _ in sentences]
    assert len(SemanticRetriever(records[:2], Legacy()).search("test", 5)) == 2


@pytest.mark.parametrize("scores", [[float("nan")], [float("inf")], [1, 2]])
def test_nonfinite_or_wrong_score_count_rejected(records, scores):
    with pytest.raises(ValueError):
        rank(records[:1], np.array(scores), 5)


def test_bad_encoder_dimensions_rejected(records):
    class Invalid:
        def encode_document(self, sentences, **kwargs):
            return [[float("nan")]]
    with pytest.raises(ValueError):
        SemanticRetriever(records[:1], Invalid())


def test_missing_model_never_attempts_a_download_and_falls_back(tmp_path):
    settings = RetrievalSettings(method="semantic", model_dir=tmp_path / "missing")
    with pytest.raises(RetrievalUnavailable):
        cache.load_local_encoder(settings.model_dir, settings.model)
    result = SimilarProblemService(settings).search("An immutable array needs many inclusive interval sums")
    assert result.requested_method == "semantic" and result.retrieval_method == "tfidf"
    assert result.matches and all(item.retrieval_method == "tfidf" for item in result.matches)
    assert any("No model was downloaded" in note for note in result.warnings)


def test_local_loader_enforces_cpu_local_only_and_identity(tmp_path, monkeypatch):
    import types
    (tmp_path / "algolens_model.json").write_text(json.dumps({"model": "sentence-transformers/all-MiniLM-L6-v2", "revision": "test"}))
    calls = []
    monkeypatch.setitem(sys.modules, "sentence_transformers", types.SimpleNamespace(SentenceTransformer=lambda *a, **kw: calls.append((a, kw)) or Encoder()))
    cache.load_local_encoder(tmp_path, "sentence-transformers/all-MiniLM-L6-v2")
    assert calls[0][1] == {"device": "cpu", "local_files_only": True, "trust_remote_code": False}
    with pytest.raises(RetrievalUnavailable):
        cache.load_local_encoder(tmp_path, "wrong-model")
    assert len(calls) == 1


def test_index_and_model_cache_invalidation(records, tmp_path, monkeypatch):
    cache.clear_cache()
    encoder, loads = Encoder(), []
    monkeypatch.setattr(cache, "load_local_encoder", lambda *args: loads.append(args) or encoder)
    settings = RetrievalSettings(method="semantic", model_dir=tmp_path)
    first = cache.get_index("semantic", records[:2], "v1", settings)
    assert cache.get_index("semantic", records[:2], "v1", settings) is first
    assert encoder.document_calls == 1 and len(loads) == 1
    second = cache.get_index("semantic", records[:2], "v2", settings)
    assert second is not first and encoder.document_calls == 2 and len(loads) == 1
    (tmp_path / "weights.txt").write_text("new weights")
    assert cache.get_index("semantic", records[:2], "v2", settings) is not second
    assert len(loads) == 2
    cache.clear_cache()


def test_catalog_revision_changes_with_content(records, tmp_path):
    path = write_catalog(tmp_path, [records[0].model_dump()])
    _, before = load_catalog(path)
    path.write_text("[]")
    _, after = load_catalog(path)
    assert before != after


@pytest.mark.parametrize("k", [0, 21, True, 2.5])
def test_service_rejects_invalid_k(k):
    with pytest.raises(ValueError):
        SimilarProblemService(RetrievalSettings()).search("query", k)


def test_empty_query_and_catalog_are_explicit(tmp_path):
    assert SimilarProblemService(RetrievalSettings()).search(" ").matches == []
    result = SimilarProblemService(RetrievalSettings(), write_catalog(tmp_path, [])).search("anything")
    assert result.matches == [] and any("empty" in note for note in result.warnings)


def test_metric_definitions_use_query_specific_relevance_and_full_ranking():
    values = metrics(["x", "b", "y", "a", "z", "c"], {"a", "b", "c", "d", "e", "f"})
    assert values == {"precision_at_5": 2 / 5, "recall_at_5": 2 / 6, "reciprocal_rank": 1 / 2}
    assert metrics(["x"] * 1, {"a"})["reciprocal_rank"] == 0
    assert metrics(["a"], set())["recall_at_5"] is None
    assert metrics(["x", "y", "z", "u", "v", "a"], {"a"})["reciprocal_rank"] == 1 / 6
    assert metrics(["a"], {"a"})["precision_at_5"] == 1 / 5
    assert metrics(["a"], {"a", "b"}, k=3)["precision_at_3"] == 1 / 3


def test_evaluation_is_separate_and_labels_are_provisional(records):
    data = json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))
    queries = [EvaluationQuery.model_validate(item) for item in data]
    assert len(queries) == 36
    assert sum(query.split == "dev" for query in queries) == 14
    assert sum(query.split == "test" for query in queries) == 22
    assert all(query.query not in {record.short_description for record in records} for query in queries)
    assert any(len(query.relevant_ids) > 5 for query in queries)
    assert any(not query.relevant_ids for query in queries)
    result = evaluate("tfidf", RetrievalSettings())
    assert result["positive_query_count"] == 34 and len(result["story_pair_top5_jaccard"]) == 4
    dev = evaluate("tfidf", RetrievalSettings(), split="dev")
    assert dev["query_count"] == 14 and dev["positive_query_count"] == 13 and len(dev["story_pair_top5_jaccard"]) == 3
    assert 0 <= result["precision_at_5"] <= 1 and 0 <= result["mrr"] <= 1


def test_import_and_startup_never_import_embedding_libraries():
    script = """
import builtins
original = builtins.__import__
def guard(name, *args, **kwargs):
    if name.split('.')[0] in {'sentence_transformers', 'huggingface_hub', 'torch'}:
        raise AssertionError('Neural import during startup')
    return original(name, *args, **kwargs)
builtins.__import__ = guard
from app.main import create_app
create_app()
"""
    result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr


def test_download_command_requires_an_explicit_flag():
    result = subprocess.run([sys.executable, "-m", "app.retrieval.setup_model"], capture_output=True, text=True, timeout=30)
    assert result.returncode == 2 and "Use --download" in result.stderr


def test_evaluation_does_not_substitute_fallback_scores(tmp_path):
    with pytest.raises(RetrievalUnavailable):
        evaluate("semantic", RetrievalSettings(model_dir=tmp_path / "missing"))
