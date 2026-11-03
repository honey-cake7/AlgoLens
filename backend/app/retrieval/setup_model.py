"""The only application command allowed to download an embedding model."""

import argparse
import json
import os

from app.retrieval.config import get_retrieval_settings


def main():
    parser = argparse.ArgumentParser(description="Explicit one-time MiniLM CPU setup (~90 MB weights; dependencies need additional disk/RAM).")
    parser.add_argument("--download", action="store_true", help="Explicitly authorize a Hugging Face model download")
    args = parser.parse_args()
    if not args.download:
        parser.error("Use --download to explicitly download the model; normal inference never downloads it")
    settings = get_retrieval_settings()
    print("Downloading MiniLM weights (~90 MB) plus tokenizer/configuration. Plan several GB for optional dependencies and roughly 1–2 GB RAM for CPU use; actual use varies.")
    from huggingface_hub import HfApi, snapshot_download
    revision = HfApi().model_info(settings.model).sha
    snapshot_download(repo_id=settings.model, revision=revision, local_dir=settings.model_dir,
        allow_patterns=["config.json", "config_sentence_transformers.json", "sentence_bert_config.json", "modules.json", "model.safetensors", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "vocab.txt", "1_Pooling/config.json"])
    os.environ["HF_HUB_OFFLINE"] = "1"
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(str(settings.model_dir), device="cpu", local_files_only=True, trust_remote_code=False)
    shape = model.encode_query(["Check local encoding"], show_progress_bar=False).shape
    marker = {"model": settings.model, "revision": revision, "dimensions": int(shape[1])}
    (settings.model_dir / "algolens_model.json").write_text(json.dumps(marker, indent=2) + "\n", encoding="utf-8")
    print(f"Verified local CPU encoding: {shape}; model revision {revision}. Normal searches now work offline.")


if __name__ == "__main__":
    main()
