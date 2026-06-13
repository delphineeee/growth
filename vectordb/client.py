"""Chroma 客户端（单例）"""

import chromadb
from chromadb.config import Settings as ChromaSettings
from config.settings import get_settings


_client = None


def get_chroma_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        cfg = get_settings()
        _client = chromadb.PersistentClient(
            path=cfg.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _client


def get_or_create_collection(name: str):
    client = get_chroma_client()
    return client.get_or_create_collection(name=name)
