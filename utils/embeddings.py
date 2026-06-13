"""DeepSeek Embedding 封装（用于 Chroma 向量化）"""

from typing import List, Optional
from openai import OpenAI
from config.settings import get_settings


class DeepSeekEmbeddings:
    def __init__(self):
        cfg = get_settings()
        self.client = OpenAI(
            api_key=cfg.DEEPSEEK_API_KEY,
            base_url=cfg.DEEPSEEK_BASE_URL,
        )
        self.model = cfg.EMBEDDING_MODEL

    def embed(self, texts: List[str]) -> List[List[float]]:
        """批量文本嵌入 —— 使用简单的 LLM-based embedding 策略"""
        # DeepSeek 专用 embedding model 可用时替换此处
        embeddings = []
        for text in texts:
            resp = self.client.embeddings.create(
                model=self.model,
                input=text,
            )
            embeddings.append(resp.data[0].embedding)
        return embeddings

    def embed_query(self, text: str) -> List[float]:
        return self.embed([text])[0]


_embeddings: Optional[DeepSeekEmbeddings] = None


def get_embeddings() -> DeepSeekEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = DeepSeekEmbeddings()
    return _embeddings
