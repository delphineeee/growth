"""Agent 基类"""

from typing import Optional
from config.settings import get_settings


class BaseAgent:
    def __init__(self, name: str = "base"):
        self.name = name
        self._llm = None  # 懒加载
        self.cfg = get_settings()

    @property
    def llm(self):
        if self._llm is None:
            from utils.llm import get_llm
            self._llm = get_llm()
        return self._llm

    def _call_llm(self, system: str, user: str, temperature: float = 0.7, json_mode: bool = False):
        if json_mode:
            return self.llm.chat_json(system, user, temperature=temperature)
        return self.llm.chat(system, user, temperature=temperature)

    def log(self, msg: str):
        from utils.logger import get_logger
        get_logger().info(f"[{self.name}] {msg}")
