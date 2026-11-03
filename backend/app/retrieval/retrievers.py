"""Small in-memory cosine searches. Neither constructor downloads a model."""

from dataclasses import dataclass
from typing import Protocol

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.retrieval.catalog import retrieval_text
from app.schemas.retrieval import PracticeProblem


@dataclass(frozen=True)
class RankedMatch:
    problem: PracticeProblem
    score: float
    signals: tuple[str, ...] = ()


class Retriever(Protocol):
    def search(self, query: str, k: int) -> list[RankedMatch]: ...


def rank(records: list[PracticeProblem], scores, k: int) -> list[RankedMatch]:
    if isinstance(k, bool) or not isinstance(k, int) or k < 1:
        raise ValueError("K must be a positive integer")
    if len(scores) != len(records) or not np.isfinite(scores).all():
        raise ValueError("Invalid similarity scores")
    candidates = [RankedMatch(item, float(np.clip(score, -1, 1))) for item, score in zip(records, scores) if score > 0]
    return sorted(candidates, key=lambda item: (-item.score, item.problem.id))[:k]


class TFIDFRetriever:
    def __init__(self, records: list[PracticeProblem]):
        self.records = records
        self.vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
        self.matrix = None
        if records:
            try:
                self.matrix = self.vectorizer.fit_transform([retrieval_text(item) for item in records])
            except ValueError as error:
                if "empty vocabulary" not in str(error):
                    raise

    def search(self, query: str, k: int = 5) -> list[RankedMatch]:
        if not query.strip() or self.matrix is None:
            return []
        vector = self.vectorizer.transform([query])
        ranked = rank(self.records, cosine_similarity(vector, self.matrix)[0], k)
        names = self.vectorizer.get_feature_names_out()
        signals = set(vector.indices)
        return [RankedMatch(item.problem, item.score, tuple(names[index] for index in sorted(signals & set(self.matrix[self.records.index(item.problem)].indices))[:6])) for item in ranked]


class SemanticRetriever:
    def __init__(self, records: list[PracticeProblem], encoder):
        self.records, self.encoder = records, encoder
        # Prefer task-aware methods; older compatible encoders may expose encode only.
        encode = getattr(encoder, "encode_document", None) or encoder.encode
        self.matrix = self._vectors(encode([retrieval_text(item) for item in records], normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)) if records else None
        if self.matrix is not None and self.matrix.shape[0] != len(records):
            raise ValueError("Encoder returned the wrong document count")

    @staticmethod
    def _vectors(values):
        matrix = np.asarray(values, dtype=np.float64)
        if matrix.ndim != 2 or matrix.shape[1] == 0 or not np.isfinite(matrix).all():
            raise ValueError("Invalid encoder vectors")
        return matrix

    def search(self, query: str, k: int = 5) -> list[RankedMatch]:
        if not query.strip() or self.matrix is None:
            return []
        encode = getattr(self.encoder, "encode_query", None) or self.encoder.encode
        vector = self._vectors(encode([query], normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False))
        return rank(self.records, cosine_similarity(vector, self.matrix)[0], k)
