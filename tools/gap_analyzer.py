"""能力差距分析工具 —— 规则层 + 向量层混合分析"""

from typing import List, Dict


class GapAnalyzer:
    """混合差距分析器：规则判断 + LLM 语义分析"""

    @staticmethod
    def analyze_hard_requirements(profile: dict, jd_requirements: dict) -> list:
        """规则层：硬性条件直接判断"""
        gaps = []
        required_degree = jd_requirements.get("degree", "")
        user_degree = profile.get("education", {}).get("degree", "")
        if required_degree and user_degree:
            degree_levels = {"大专": 1, "本科": 2, "硕士": 3, "博士": 4}
            if degree_levels.get(user_degree, 0) < degree_levels.get(required_degree, 0):
                gaps.append({
                    "skill_name": "学历要求",
                    "current_level": 0, "target_level": 100,
                    "severity": "critical",
                    "evidence": f"要求{required_degree}，当前{user_degree}",
                })
        return gaps

    @staticmethod
    def merge_and_rank(gaps: list) -> list:
        """合并多源差距并排序"""
        seen = set()
        merged = []
        for g in gaps:
            key = g.get("skill_name", "")
            if key not in seen:
                seen.add(key)
                g["gap_score"] = g.get("importance", 0.5) * max(
                    (g.get("target_level", 80) - g.get("current_level", 0)) / 100, 0
                )
                merged.append(g)
        return sorted(merged, key=lambda g: g.get("gap_score", 0), reverse=True)
