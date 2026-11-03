"""Offline defaults even when the developer has real Groq settings locally."""

import socket

import pytest

from app.core import config


@pytest.fixture(autouse=True)
def offline_environment(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "dotenv_values", lambda *_args, **_kwargs: {})
    for name, value in {
        "LLM_PROVIDER": "fake", "GROQ_API_KEY": "",
        "GROQ_MODEL": "openai/gpt-oss-120b", "GROQ_MAX_OUTPUT_TOKENS": "3072",
        "GROQ_TIMEOUT_SECONDS": "30",
        "CORS_ORIGINS": "http://localhost:5173,http://127.0.0.1:5173",
        "RETRIEVAL_METHOD": "tfidf", "RETRIEVAL_TOP_K": "5",
        "EMBEDDING_MODEL": "sentence-transformers/all-MiniLM-L6-v2",
        "EMBEDDING_CACHE_DIR": str(tmp_path / "absent-model"),
        "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1",
    }.items():
        monkeypatch.setenv(name, value)

    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex
    original_getaddrinfo = socket.getaddrinfo

    def local_address(address):
        return isinstance(address, tuple) and address[0] in {"127.0.0.1", "::1", "localhost"}

    def connect(sock, address):
        if not local_address(address):
            raise AssertionError("External network access is forbidden in tests")
        return original_connect(sock, address)

    def connect_ex(sock, address):
        if not local_address(address):
            raise AssertionError("External network access is forbidden in tests")
        return original_connect_ex(sock, address)

    def getaddrinfo(host, *args, **kwargs):
        if host not in {None, "localhost", "127.0.0.1", "::1"}:
            raise AssertionError("External DNS access is forbidden in tests")
        return original_getaddrinfo(host, *args, **kwargs)

    # Local sockets may be required internally by an asyncio event loop.
    monkeypatch.setattr(socket.socket, "connect", connect)
    monkeypatch.setattr(socket.socket, "connect_ex", connect_ex)
    monkeypatch.setattr(socket, "getaddrinfo", getaddrinfo)
