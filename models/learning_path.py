"""学习路径模型"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date


class Milestone(BaseModel):
    week: int
    title: str
    description: str = ""


class WeeklySlot(BaseModel):
    day: str
    start_time: str
    duration_minutes: int
    skill_name: str = ""
    task_description: str = ""
    resource_type: str = ""
    is_review: bool = False


class WeeklyPlan(BaseModel):
    week_number: int
    start_date: Optional[str] = None
    theme: str = ""
    slots: List[WeeklySlot] = Field(default_factory=list)
    total_minutes: int = 0
    milestone_this_week: Optional[str] = None


class PlanPhase(BaseModel):
    phase_number: int
    title: str
    start_week: int
    end_week: int
    theme: str = ""
    description: str = ""


class YearlyPlan(BaseModel):
    year_label: str = ""
    big_goal: str = ""
    total_weeks: int = 20
    phases: List[PlanPhase] = Field(default_factory=list)
    key_milestones: List[Milestone] = Field(default_factory=list)
    weekly_plans: List[WeeklyPlan] = Field(default_factory=list)
    target_match_improvement: dict = Field(default_factory=dict)


class LearningPath(BaseModel):
    id: str = ""
    user_id: str = ""
    target_position: str = ""
    created_at: str = ""
    target_completion_date: str = ""
    yearly_plan: Optional[YearlyPlan] = None
    available_weekly_minutes: int = 0
    version: int = 1
