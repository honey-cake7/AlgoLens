"""Stage 6: provenance rules for future external records and the catalog checker."""

import json

import pytest
from pydantic import ValidationError

from app.retrieval import catalog_check
from app.retrieval.catalog import load_catalog
from app.schemas.retrieval import PracticeProblem, SimilarMatch

EXTERNAL = {"source_type": "external_curated", "source_url": "https://example.org/fixture-problem",
            "source_name": "Example fixture archive", "license_note": "Fixture only; not a real record", "verified_on": "2026-11-14"}


@pytest.fixture
def base():
    return load_catalog()[0][0].model_dump()


def test_shipped_catalog_is_all_original(base):
    records = load_catalog()[0]
    assert {item.source_type for item in records} == {"original_practice"}
    assert all(item.source_url is None and item.source_name is None for item in records)


def test_external_record_with_full_provenance_validates(base):
    record = PracticeProblem.model_validate({**base, **EXTERNAL})
    assert record.source_type == "external_curated" and str(record.verified_on) == "2026-11-14"


@pytest.mark.parametrize("missing", ["source_url", "source_name", "license_note", "verified_on"])
def test_external_record_requires_every_provenance_field(base, missing):
    with pytest.raises(ValidationError):
        PracticeProblem.model_validate({**base, **EXTERNAL, missing: None})


@pytest.mark.parametrize("url", ["http://example.org/x", "javascript:alert(1)", "https://example.org/a b", "data:text/html,x", "https://localhost/x"])
def test_external_urls_must_be_plain_https(base, url):
    with pytest.raises(ValidationError):
        PracticeProblem.model_validate({**base, **EXTERNAL, "source_url": url})


@pytest.mark.parametrize("field", ["source_url", "source_name", "license_note", "verified_on"])
def test_original_records_cannot_claim_provenance(base, field):
    with pytest.raises(ValidationError):
        PracticeProblem.model_validate({**base, field: EXTERNAL[field]})


def test_match_links_only_for_external():
    common = {"problem_id": "x", "title": "T", "short_description": "D", "difficulty": "easy", "technique_tags": ["bfs"],
              "similarity_score": 0.5, "retrieval_method": "tfidf", "explanation": "E"}
    assert SimilarMatch.model_validate(common).source_url is None
    with pytest.raises(ValidationError):
        SimilarMatch.model_validate({**common, "source_url": "https://example.org/x"})
    with pytest.raises(ValidationError):
        SimilarMatch.model_validate({**common, "source_type": "external_curated"})


def test_checker_passes_on_shipped_data():
    report = catalog_check.check()
    assert report["records"] == 58 and report["problems"] == 0
    assert report["near_duplicates"] == [] and report["query_leakage"] == [] and report["unknown_relevance_ids"] == []
    assert report["single_record_techniques"] == []  # every technique has at least two records


def test_checker_flags_duplicates_leakage_and_unknown_ids(tmp_path, base):
    records = [record.model_dump(mode="json") for record in load_catalog()[0]]
    records.append({**records[0], "id": "copied_record", "title": "Copy"})
    catalog = tmp_path / "catalog.json"
    catalog.write_text(json.dumps(records), encoding="utf-8")
    queries = [{"id": "leaky", "query": records[0]["normalized_description"], "normalized_query": "unrelated words entirely",
                "relevant_ids": ["missing_record"], "category": "test", "notes": "fixture"}]
    queries_path = tmp_path / "queries.json"
    queries_path.write_text(json.dumps(queries), encoding="utf-8")
    report = catalog_check.check(catalog, queries_path)
    assert {(item["left"], item["right"]) for item in report["near_duplicates"]} >= {tuple(sorted([records[0]["id"], "copied_record"]))}
    assert report["unknown_relevance_ids"] == ["missing_record"]
    assert report["query_leakage"] and report["problems"] >= 3


def test_strict_mode_exit_code(monkeypatch, capsys):
    monkeypatch.setattr(catalog_check, "check", lambda: {"catalog_revision": "r", "records": 1, "sources": {}, "techniques": {}, "single_record_techniques": [],
                                                       "near_duplicates": [{"left": "a", "right": "b", "cosine": 0.9}], "unknown_relevance_ids": [], "query_leakage": [], "problems": 1})
    assert catalog_check.main(["--strict"]) == 1
    assert catalog_check.main([]) == 0
    assert "NEAR DUPLICATE" in capsys.readouterr().out
