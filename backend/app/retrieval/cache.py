"""Two revision-aware indexes and one local encoder per model fingerprint."""

import json
from collections import OrderedDict
from pathlib import Path
from threading import RLock

from app.retrieval.config import RetrievalSettings, RetrievalUnavailable

_lock = RLock()
_indexes = OrderedDict()
_encoders = OrderedDict()


def model_fingerprint(path: Path, model: str) -> tuple:
    if not path.is_dir():
        return (model, str(path.resolve()), "missing")
    # Small flat snapshot; weights are stat'ed, not rehashed on each search.
    files = tuple((str(file.relative_to(path)), file.stat().st_size, file.stat().st_mtime_ns) for file in sorted(path.rglob("*")) if file.is_file())
    return model, str(path.resolve()), files


def load_local_encoder(path: Path, model: str):
    try:
        marker = json.loads((path / "algolens_model.json").read_text(encoding="utf-8"))
        if marker["model"] != model or not marker.get("revision"):
            raise ValueError("Model identity mismatch")
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer(str(path), device="cpu", local_files_only=True, trust_remote_code=False)
    except Exception:
        raise RetrievalUnavailable("Local embedding model is unavailable; run the explicit setup command") from None


def get_index(method: str, records, revision: str, settings: RetrievalSettings):
    from app.retrieval.retrievers import SemanticRetriever, TFIDFRetriever
    fingerprint = model_fingerprint(settings.model_dir, settings.model) if method == "semantic" else None
    key = method, revision, fingerprint
    with _lock:
        if key not in _indexes:
            if method == "tfidf":
                index = TFIDFRetriever(records)
            else:
                if fingerprint not in _encoders:
                    _encoders[fingerprint] = load_local_encoder(settings.model_dir, settings.model)
                    while len(_encoders) > 1:
                        _encoders.popitem(last=False)
                index = SemanticRetriever(records, _encoders[fingerprint])
            _indexes[key] = index
            while len(_indexes) > 2:
                _indexes.popitem(last=False)
        _indexes.move_to_end(key)
        return _indexes[key]


def search_index(index, query: str, k: int):
    # Serializes local neural inference/index replacement; HTTP routes offload
    # this bounded CPU work so health/provider requests keep their event loop.
    with _lock:
        return index.search(query, k)


def clear_cache():
    with _lock:
        _indexes.clear()
        _encoders.clear()
