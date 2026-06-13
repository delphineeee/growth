"""LangGraph State 定义"""

from typing import TypedDict, List, Optional, Any, Dict
from langchain_core.messages import BaseMessage


class ProfileState(TypedDict):
    user_id: str
    resume_text: str
    schedule_text: str
    parsed_resume: Optional[Dict]
    parsed_schedule: Optional[Dict]
    conversation_history: List[Dict]
    current_question: str
    user_answer: str
    profile_json: Optional[Dict]
    missing_info: List[str]
    round_count: int
    is_complete: bool
    messages: List[BaseMessage]
    next_step: str
    error: Optional[str]


class TargetAnalysisState(TypedDict):
    user_id: str
    profile_json: Optional[Dict]
    position_name: str
    jd_text: str
    skill_tree: Optional[Dict]
    gap_analysis: Optional[Dict]
    messages: List[BaseMessage]
    next_step: str
    error: Optional[str]


class LearningPathState(TypedDict):
    user_id: str
    profile_json: Optional[Dict]
    gap_analysis: Optional[Dict]
    target_date: str
    yearly_plan: Optional[Dict]
    weekly_plans: List[Dict]
    validation_result: Optional[Dict]
    plan_valid: bool
    validation_feedback: str
    messages: List[BaseMessage]
    next_step: str
    error: Optional[str]


class GrowthPlanState(TypedDict):
    """成长规划总状态 —— 从画像到学习路径的完整流程"""
    user_id: str
    profile: Optional[Dict]
    target_position: str
    target_jd: Optional[str]
    gap_report: Optional[List[Dict]]
    growth_plan: Optional[Dict]
    milestones: Optional[List[Dict]]
    messages: List[BaseMessage]
    next_step: str
    error: Optional[str]


class OrchestratorState(TypedDict):
    messages: List[BaseMessage]
    current_intent: str
    user_profile: Optional[Dict]
    active_graph: str
    results: Dict[str, Any]
    error: Optional[str]
