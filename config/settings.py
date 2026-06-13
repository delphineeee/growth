"""全局配置 —— 基于 pydantic-settings，从 .env 和环境变量加载"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # ── DeepSeek API ──
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    LLM_MODEL: str = "deepseek-chat"
    EMBEDDING_MODEL: str = "deepseek-chat"  # DeepSeek 暂用 chat model 做嵌入；正式版用专用 embedding

    # ── LLM 参数 ──
    LLM_TEMPERATURE_LIGHT: float = 0.0    # 意图分类 / 标签提取
    LLM_TEMPERATURE_NORMAL: float = 0.7   # 对话 / 解释
    LLM_TEMPERATURE_STRUCT: float = 0.3   # 结构化输出（JSON Mode）
    LLM_MAX_TOKENS_SHORT: int = 512
    LLM_MAX_TOKENS_NORMAL: int = 4096
    LLM_MAX_TOKENS_LONG: int = 8192

    # ── Chroma ──
    CHROMA_PERSIST_DIR: str = str(PROJECT_ROOT / "data" / "chroma_db")

    # ── Paths ──
    DEMO_DATA_DIR: str = str(PROJECT_ROOT / "data" / "demo")
    UPLOAD_DIR: str = str(PROJECT_ROOT / "data" / "uploads")

    # ── App ──
    APP_TITLE: str = "Growth —— AI 职业成长训练师"
    APP_DEBUG: bool = True
    MAX_CONVERSATION_ROUNDS: int = 6

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
