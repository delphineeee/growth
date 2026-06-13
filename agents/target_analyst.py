"""Target Analyst Agent —— 目标岗位分析师"""

from agents.base import BaseAgent
from config.prompts import TargetAnalystPrompts


class TargetAnalystAgent(BaseAgent):
    def __init__(self):
        super().__init__("TargetAnalyst")

    def build_skill_tree(self, position_name: str, jd_text: str = "") -> dict:
        """根据岗位名称和 JD 构建技能树"""
        self.log(f"构建技能树: {position_name}")
        return self._call_llm(
            system=TargetAnalystPrompts.SYSTEM,
            user=TargetAnalystPrompts.SKILL_TREE_BUILD.format(
                position_name=position_name,
                jd_text=jd_text or "无具体JD",
            ),
            temperature=self.cfg.LLM_TEMPERATURE_STRUCT,
            json_mode=True,
        )

    def analyze_gaps(self, profile_json: dict, skill_tree_json: dict) -> dict:
        """对比学生画像与目标技能树，输出差距分析"""
        self.log("执行能力差距分析...")
        return self._call_llm(
            system=TargetAnalystPrompts.SYSTEM,
            user=TargetAnalystPrompts.GAP_ANALYSIS.format(
                profile_json=str(profile_json),
                skill_tree_json=str(skill_tree_json),
            ),
            temperature=self.cfg.LLM_TEMPERATURE_STRUCT,
            json_mode=True,
        )
