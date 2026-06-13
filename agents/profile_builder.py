"""Profile Builder Agent —— 画像构建师"""

from agents.base import BaseAgent
from config.prompts import ProfileBuilderPrompts


class ProfileBuilderAgent(BaseAgent):
    def __init__(self):
        super().__init__("ProfileBuilder")

    def analyze_resume(self, resume_text: str) -> dict:
        """解析简历，提取结构化信息"""
        self.log("开始分析简历...")
        return self._call_llm(
            system=ProfileBuilderPrompts.SYSTEM,
            user=ProfileBuilderPrompts.RESUME_ANALYSIS.format(resume_text=resume_text),
            temperature=self.cfg.LLM_TEMPERATURE_STRUCT,
            json_mode=True,
        )

    def generate_followup_questions(self, known_info: dict, missing_info: list) -> list[str]:
        """基于已知信息和缺失点，生成追问问题"""
        self.log("生成追问问题...")
        result = self._call_llm(
            system=ProfileBuilderPrompts.SYSTEM,
            user=ProfileBuilderPrompts.FOLLOWUP_GENERATION.format(
                known_info=str(known_info),
                missing_info=str(missing_info),
            ),
            temperature=self.cfg.LLM_TEMPERATURE_NORMAL,
            json_mode=True,
        )
        return result.get("questions", [])

    def build_profile(
        self,
        conversation_history: list[dict],
        resume_data: dict,
        schedule_data: dict,
    ) -> dict:
        """汇总对话记录和简历数据，生成最终画像"""
        self.log("生成最终职业画像...")
        return self._call_llm(
            system=ProfileBuilderPrompts.SYSTEM,
            user=ProfileBuilderPrompts.PROFILE_BUILD.format(
                conversation_history=str(conversation_history),
                resume_data=str(resume_data),
                schedule_data=str(schedule_data),
            ),
            temperature=self.cfg.LLM_TEMPERATURE_STRUCT,
            json_mode=True,
        )
