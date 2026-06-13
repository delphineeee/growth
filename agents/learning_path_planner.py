"""Learning Path Planner Agent —— 学习路径规划师"""

from agents.base import BaseAgent
from config.prompts import LearningPathPrompts


class LearningPathPlannerAgent(BaseAgent):
    def __init__(self):
        super().__init__("LearningPathPlanner")

    def generate_yearly_plan(
        self, profile_json: dict, gaps_json: dict,
        target_date: str, weekly_minutes: int,
    ) -> dict:
        """生成年度学习计划（分阶段）"""
        self.log("生成年度学习计划...")
        return self._call_llm(
            system=LearningPathPrompts.SYSTEM,
            user=LearningPathPrompts.YEARLY_PLAN.format(
                profile_json=str(profile_json),
                gaps_json=str(gaps_json),
                target_date=target_date,
                weekly_minutes=weekly_minutes,
            ),
            temperature=self.cfg.LLM_TEMPERATURE_STRUCT,
            json_mode=True,
        )

    def generate_weekly_plan(
        self, week_number: int, monthly_theme: str,
        target_skills: list, free_time_slots: list,
        available_resources: str = "",
    ) -> dict:
        """生成单周详细计划"""
        self.log(f"生成第 {week_number} 周计划...")
        return self._call_llm(
            system=LearningPathPrompts.SYSTEM,
            user=LearningPathPrompts.WEEKLY_PLAN.format(
                week_number=week_number,
                monthly_theme=monthly_theme,
                target_skills=str(target_skills),
                free_time_slots=str(free_time_slots),
                available_resources=available_resources,
            ),
            temperature=self.cfg.LLM_TEMPERATURE_STRUCT,
            json_mode=True,
        )

    def validate_plan(self, plan_json: dict, max_weekly_minutes: int,
                       exam_weeks: list) -> dict:
        """校验学习计划的合理性"""
        self.log("校验学习计划...")
        return self._call_llm(
            system=LearningPathPrompts.SYSTEM,
            user=LearningPathPrompts.PLAN_VALIDATION.format(
                plan_json=str(plan_json),
                max_weekly_minutes=max_weekly_minutes,
                exam_weeks=str(exam_weeks),
            ),
            temperature=self.cfg.LLM_TEMPERATURE_LIGHT,
            json_mode=True,
        )
