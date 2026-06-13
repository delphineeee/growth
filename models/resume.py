"""简历模型"""

from pydantic import BaseModel, Field
from typing import List, Optional


class Experience(BaseModel):
    type: str = Field(description="项目/实习/竞赛/社团/其他")
    title: str
    description: str
    skills_demonstrated: List[str] = Field(default_factory=list)
    impact: Optional[str] = None
    duration: Optional[str] = None


class ParsedResume(BaseModel):
    name: str = ""
    school: str = ""
    major: str = ""
    degree: str = ""
    graduation_year: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    experiences: List[Experience] = Field(default_factory=list)
    education: dict = Field(default_factory=dict)
    raw_text: str = ""
