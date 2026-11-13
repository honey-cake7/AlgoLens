"""Small in-memory cosine searches. Neither constructor downloads a model."""

import weakref
from dataclasses import dataclass
from typing import Protocol

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.retrieval import cues
from app.retrieval.catalog import retrieval_text
from app.schemas.retrieval import PracticeProblem


@dataclass(frozen=True)
class RankedMatch:
    problem: PracticeProblem
    score: float
    signals: tuple[str, ...] = ()
    cues: tuple[str, ...] = ()


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

    def scores(self, query: str):
        if not query.strip() or self.matrix is None:
            return None
        return cosine_similarity(self.vectorizer.transform([query]), self.matrix)[0]

    def signals(self, query: str, problem: PracticeProblem) -> tuple[str, ...]:
        """Shared vocabulary terms, used to explain a match without a model."""
        if self.matrix is None:
            return ()
        names = self.vectorizer.get_feature_names_out()
        shared = set(self.vectorizer.transform([query]).indices) & set(self.matrix[self.records.index(problem)].indices)
        return tuple(names[index] for index in sorted(shared)[:6])

    def search(self, query: str, k: int = 5) -> list[RankedMatch]:
        scores = self.scores(query)
        if scores is None:
            return []
        return [RankedMatch(item.problem, item.score, self.signals(query, item.problem)) for item in rank(self.records, scores, k)]


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

    def scores(self, query: str):
        if not query.strip() or self.matrix is None:
            return None
        encode = getattr(self.encoder, "encode_query", None) or self.encoder.encode
        vector = self._vectors(encode([query], normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False))
        return cosine_similarity(vector, self.matrix)[0]

    def search(self, query: str, k: int = 5) -> list[RankedMatch]:
        scores = self.scores(query)
        return [] if scores is None else rank(self.records, scores, k)


# Cue vectors per cached base index; entries vanish when the index is evicted.
_cue_matrices: "weakref.WeakKeyDictionary" = weakref.WeakKeyDictionary()


class CueReranker:
    """Blend a base retriever's cosine with task-cue cosine: (1 - w) * text + w * cue.

    The weight was chosen on the dev query split only (see RETRIEVAL.md). Cue
    vectors come from the same solution-free task text as the base index.
    """

    def __init__(self, base, weight: float):
        if not 0 <= weight <= 1:
            raise ValueError("Cue weight must be between 0 and 1")
        self.base, self.records, self.weight = base, base.records, weight
        self.texts = [retrieval_text(item) for item in self.records]
        if base not in _cue_matrices:
            _cue_matrices[base] = np.array([cues.vector(text) for text in self.texts]) if self.records else None
        self.matrix = _cue_matrices[base]

    def scores(self, query: str):
        text_scores = self.base.scores(query)
        if text_scores is None:
            return None
        query_vector = cues.vector(query)
        norms = np.linalg.norm(self.matrix, axis=1) * np.linalg.norm(query_vector)
        cue_scores = np.divide(self.matrix @ query_vector, norms, out=np.zeros(len(self.records)), where=norms > 0)
        return (1 - self.weight) * np.asarray(text_scores, dtype=np.float64) + self.weight * cue_scores

    def search(self, query: str, k: int = 5) -> list[RankedMatch]:
        scores = self.scores(query)
        if scores is None:
            return []
        signals = getattr(self.base, "signals", lambda *_: ())
        return [RankedMatch(item.problem, item.score, signals(query, item.problem), cues.shared_labels(query, self.texts[self.records.index(item.problem)]))
                for item in rank(self.records, scores, k)]
