"""技能树 & 差距分析模型"""

from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class SkillNode(BaseModel):
    id: str
    name: str
    category: str = ""
    importance: float = 0.5
    difficulty: float = 0.5
    estimated_hours: int = 40
    prerequisites: List[str] = Field(default_factory=list)
    current_level: float = 0.0
    target_level: float = 80.0
    gap_score: float = 0.0
    status: Literal["mastered", "in_progress", "not_started"] = "not_started"


class SkillTree(BaseModel):
    position_name: str
    nodes: List[SkillNode] = Field(default_factory=list)

    @property
    def unmastered_sorted(self) -> List[SkillNode]:
        return sorted(
            [n for n in self.nodes if n.status != "mastered"],
            key=lambda n: n.gap_score, reverse=True
        )


class GapItem(BaseModel):
    skill_id: str
    skill_name: str
    category: str = ""
    current_level: float = 0
    target_level: float = 80
    importance: float = 0.5
    gap_score: float = 0.0
    severity: Literal["critical", "moderate", "minor"] = "moderate"
    evidence: str = ""
    recommended_action: str = ""


class GapAnalysis(BaseModel):
    gaps: List[GapItem] = Field(default_factory=list)
    overall_match_score: float = 0
    summary: str = ""
