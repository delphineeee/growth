"""技能-岗位映射向量集合"""

import json
from pathlib import Path
from vectordb.client import get_or_create_collection
from utils.embeddings import get_embeddings

COLLECTION_NAME = "skill_position_mapping"


def init_skill_collection(seed_file: str = ""):
    """初始化技能集合，导入种子数据"""
    col = get_or_create_collection(COLLECTION_NAME)
    if col.count() > 0:
        return col

    if not seed_file:
        seed_file = str(Path(__file__).resolve().parent.parent / "data" / "demo" / "skill_tree_seeds.json")

    try:
        with open(seed_file, "r", encoding="utf-8") as f:
            seeds = json.load(f)
    except FileNotFoundError:
        seeds = _default_seeds()

    emb = get_embeddings()
    for item in seeds:
        text = f"{item['position_name']}: {'; '.join(s['name'] for s in item.get('skills', []))}"
        vec = emb.embed_query(text)
        col.add(
            ids=[item.get("id", text[:20])],
            embeddings=[vec],
            metadatas=[item],
            documents=[text],
        )
    return col


def search_skill_tree(position_name: str, k: int = 3):
    """根据岗位名称搜索最匹配的技能树"""
    col = get_or_create_collection(COLLECTION_NAME)
    emb = get_embeddings()
    vec = emb.embed_query(position_name)
    results = col.query(query_embeddings=[vec], n_results=k)
    if results and results["metadatas"] and results["metadatas"][0]:
        return results["metadatas"][0]
    return []


def _default_seeds() -> list:
    return [
        {
            "id": "java_backend",
            "position_name": "Java后端开发工程师（校招）",
            "skills": [
                {"name": "Java 基础", "category": "编程语言", "importance": 0.95, "difficulty": 0.4, "estimated_hours": 80},
                {"name": "Spring Boot", "category": "框架", "importance": 0.9, "difficulty": 0.5, "estimated_hours": 60},
                {"name": "MySQL", "category": "数据库", "importance": 0.85, "difficulty": 0.45, "estimated_hours": 50},
                {"name": "Redis", "category": "数据库", "importance": 0.75, "difficulty": 0.4, "estimated_hours": 30},
                {"name": "计算机网络", "category": "计算机基础", "importance": 0.7, "difficulty": 0.6, "estimated_hours": 40},
                {"name": "操作系统", "category": "计算机基础", "importance": 0.65, "difficulty": 0.7, "estimated_hours": 40},
                {"name": "算法与数据结构", "category": "计算机基础", "importance": 0.8, "difficulty": 0.7, "estimated_hours": 100},
                {"name": "MyBatis", "category": "框架", "importance": 0.7, "difficulty": 0.3, "estimated_hours": 20},
                {"name": "项目经验", "category": "项目经验", "importance": 0.9, "difficulty": 0.8, "estimated_hours": 120},
            ]
        },
        {
            "id": "data_analyst",
            "position_name": "数据分析师（校招）",
            "skills": [
                {"name": "SQL", "category": "数据库", "importance": 0.95, "difficulty": 0.35, "estimated_hours": 60},
                {"name": "Python 数据分析", "category": "编程语言", "importance": 0.9, "difficulty": 0.45, "estimated_hours": 70},
                {"name": "数据可视化", "category": "工具", "importance": 0.8, "difficulty": 0.3, "estimated_hours": 30},
                {"name": "A/B 测试", "category": "方法论", "importance": 0.75, "difficulty": 0.5, "estimated_hours": 35},
                {"name": "统计学", "category": "数学基础", "importance": 0.7, "difficulty": 0.6, "estimated_hours": 50},
                {"name": "数据分析项目", "category": "项目经验", "importance": 0.85, "difficulty": 0.7, "estimated_hours": 100},
            ]
        },
        {
            "id": "product_manager",
            "position_name": "产品经理（校招）",
            "skills": [
                {"name": "需求分析", "category": "核心能力", "importance": 0.95, "difficulty": 0.6, "estimated_hours": 60},
                {"name": "竞品分析", "category": "核心能力", "importance": 0.85, "difficulty": 0.5, "estimated_hours": 40},
                {"name": "PRD 撰写", "category": "硬技能", "importance": 0.9, "difficulty": 0.35, "estimated_hours": 30},
                {"name": "数据分析", "category": "硬技能", "importance": 0.8, "difficulty": 0.5, "estimated_hours": 50},
                {"name": "原型设计", "category": "工具", "importance": 0.7, "difficulty": 0.3, "estimated_hours": 25},
                {"name": "产品思维", "category": "软技能", "importance": 0.85, "difficulty": 0.8, "estimated_hours": 80},
            ]
        },
    ]
