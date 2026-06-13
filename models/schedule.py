"""课程表模型"""

from pydantic import BaseModel, Field
from typing import List, Optional


class Course(BaseModel):
    name: str
    day_of_week: int  # 1-7
    start_time: str   # "08:00"
    end_time: str     # "09:40"
    location: str = ""
    weeks: List[int] = Field(default_factory=list)
    credits: float = 0


class WeeklySchedule(BaseModel):
    semester: str = ""
    courses: List[Course] = Field(default_factory=list)
    exam_weeks: List[int] = Field(default_factory=list)
    holiday_weeks: List[int] = Field(default_factory=list)


class FreeTimeSlot(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str
    duration_minutes: int
    energy_level: str = "medium"


class WeeklyFreeTime(BaseModel):
    slots: List[FreeTimeSlot] = Field(default_factory=list)
    total_weekly_minutes: int = 0
