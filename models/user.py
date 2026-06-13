"""用户模型"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class User(BaseModel):
    id: str = Field(default="")
    name: str = Field(default="")
    email: Optional[str] = None
    school: Optional[str] = None
    major: Optional[str] = None
    grade: Optional[str] = None  # 大一/大二/大三/大四/研一/研二/研三
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
