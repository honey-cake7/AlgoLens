"""Provider-independent retrieval, with explicit and honestly labeled fallback."""

from pathlib import Path

from app.retrieval.cache import get_index, search_index
from app.retrieval.catalog import CATALOG_PATH, load_catalog
from app.retrieval.config import RetrievalSettings, get_retrieval_settings
from app.schemas.retrieval import SimilarMatch, SimilarResponse

LIMITATION = "Ranking scores are cosine similarities, not confidence probabilities or proof of the same algorithm. This small original catalog may have no strong match."


class SimilarProblemService:
    def __init__(self, settings: RetrievalSettings | None = None, catalog_path: Path = CATALOG_PATH):
        self.settings = settings
        self.catalog_path = catalog_path

    def search(self, statement: str, k: int | None = None, query_source="raw_statement") -> SimilarResponse:
        settings = self.settings or get_retrieval_settings()
        k = settings.top_k if k is None else k
        if isinstance(k, bool) or not isinstance(k, int) or not 1 <= k <= 20:
            raise ValueError("K must be between 1 and 20")
        records, revision = load_catalog(self.catalog_path)
        method, warnings = settings.method, [LIMITATION]
        if query_source == "ai_simplification":
            warnings.append("Search reused an existing AI simplification with no reported uncertainties. Its semantic fidelity is not independently verified; compare with a raw-statement search.")
        query = statement.strip()
        if not query or not records:
            warnings.append("The query or practice catalog is empty; no matches are available.")
            return SimilarResponse(query=query, query_source=query_source, requested_method=method, retrieval_method=method, catalog_revision=revision, warnings=warnings)
        if method == "semantic":
            warnings.append("MiniLM is a general-purpose encoder; long statements can be truncated at its 256 word-piece limit.")
            try:
                ranked = search_index(get_index(method, records, revision, settings), query, k)
            except Exception:
                method = "tfidf"
                warnings.append("Semantic retrieval is unavailable locally. Using TF-IDF instead; install optional dependencies and run the explicit model setup command. No model was downloaded.")
                ranked = search_index(get_index(method, records, revision, settings), query, k)
        else:
            ranked = search_index(get_index(method, records, revision, settings), query, k)
        matches = []
        for item in ranked:
            problem = item.problem
            reason = ("Shared TF-IDF terms: " + ", ".join(item.signals) + ".") if method == "tfidf" else "Ranked by cosine similarity between locally encoded task descriptions. No algorithm equivalence was verified."
            matches.append(SimilarMatch(problem_id=problem.id, title=problem.title, short_description=problem.short_description,
                difficulty=problem.difficulty, technique_tags=[problem.main_technique, *problem.secondary_tags],
                similarity_score=item.score, retrieval_method=method, explanation=reason))
        if not matches:
            warnings.append("No positive-similarity candidates were found; try a concise description of the task and its conditions.")
        return SimilarResponse(query=query, query_source=query_source, requested_method=settings.method, retrieval_method=method, catalog_revision=revision, matches=matches, warnings=warnings)


def get_similar_service() -> SimilarProblemService:
    return SimilarProblemService()
