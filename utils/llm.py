"""DeepSeek V4 LLM 客户端（兼容 OpenAI SDK）"""

import json
import time
from typing import List, Dict, Generator, Optional
from openai import OpenAI
from functools import lru_cache

from config.settings import get_settings


class DeepSeekClient:
    def __init__(self):
        cfg = get_settings()
        self.client = OpenAI(
            api_key=cfg.DEEPSEEK_API_KEY,
            base_url=cfg.DEEPSEEK_BASE_URL,
        )
        self.model = cfg.LLM_MODEL
        self.max_retries = 3

    def _build_messages(self, system_prompt: str, user_content: str) -> List[Dict]:
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

    def chat(
        self,
        system_prompt: str,
        user_content: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        use_json_mode: bool = False,
    ) -> str:
        """同步对话，返回文本"""
        messages = self._build_messages(system_prompt, user_content)
        kwargs = dict(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if use_json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        for attempt in range(self.max_retries):
            try:
                resp = self.client.chat.completions.create(**kwargs)
                return resp.choices[0].message.content or ""
            except Exception as e:
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(1.5 ** attempt)
        return ""

    def chat_json(
        self,
        system_prompt: str,
        user_content: str,
        temperature: float = 0.3,
        max_tokens: int = 8192,
    ) -> dict:
        """同步对话，返回解析后的 JSON dict"""
        raw = self.chat(
            system_prompt=system_prompt,
            user_content=user_content,
            temperature=temperature,
            max_tokens=max_tokens,
            use_json_mode=True,
        )
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # Fallback: try to extract JSON from text
            import re
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                return json.loads(match.group())
            raise ValueError(f"Failed to parse JSON from response: {raw[:200]}")

    def chat_stream(
        self,
        system_prompt: str,
        user_content: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> Generator[str, None, None]:
        """流式对话，逐 token 返回"""
        messages = self._build_messages(system_prompt, user_content)
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    def classify_intent(self, user_message: str, context: str = "") -> str:
        """快速意图分类（轻量调用）"""
        cfg = get_settings()
        from config.prompts import OrchestratorPrompts

        system = OrchestratorPrompts.SYSTEM
        user = f"对话上下文：{context}\n用户消息：{user_message}"
        result = self.chat_json(
            system_prompt=system,
            user_content=user,
            temperature=cfg.LLM_TEMPERATURE_LIGHT,
            max_tokens=cfg.LLM_MAX_TOKENS_SHORT,
        )
        return result.get("intent", "general_chat")


_llm: Optional[DeepSeekClient] = None


def get_llm() -> DeepSeekClient:
    global _llm
    if _llm is None:
        _llm = DeepSeekClient()
    return _llm
