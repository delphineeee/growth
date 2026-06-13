"""⭐ 成长规划 LangGraph —— 差距分析 → 年计划 → 周计划 → 校验 → 输出"""

from langgraph.graph import StateGraph, END
from models.state import GrowthPlanState
from langchain_core.messages import AIMessage

def _get_target_agent():
    from agents.target_analyst import TargetAnalystAgent
    return TargetAnalystAgent()

def _get_plan_agent():
    from agents.learning_path_planner import LearningPathPlannerAgent
    return LearningPathPlannerAgent()


# ── 节点 ──────────────────────────────────────────────

def parse_input_node(state: GrowthPlanState) -> GrowthPlanState:
    state["next_step"] = "analyze_gap"
    state["messages"].append(AIMessage(content="开始分析你的目标岗位与当前能力的差距..."))
    return state


def analyze_gap_node(state: GrowthPlanState) -> GrowthPlanState:
    """差距分析"""
    position = state.get("target_position", "")
    jd = state.get("target_jd", "")
    profile = state.get("profile", {})

    skill_tree = _get_target_agent().build_skill_tree(position, jd)
    gap_result = _get_target_agent().analyze_gaps(profile, skill_tree)

    state["gap_report"] = gap_result.get("gaps", [])
    critical = sum(1 for g in state["gap_report"] if g.get("severity") == "critical")

    state["messages"].append(
        AIMessage(content=f"差距分析完成：发现 {len(state['gap_report'])} 个能力差距，"
                   f"其中 {critical} 个为严重差距。总匹配度 {gap_result.get('overall_match_score', 0)}%。")
    )

    state["next_step"] = "generate_yearly" if state["gap_report"] else "no_gaps"
    return state


def generate_yearly_node(state: GrowthPlanState) -> GrowthPlanState:
    """生成年度计划"""
    profile = state.get("profile", {})
    gaps = state.get("gap_report", [])
    target_date = state.get("target_completion_date", "6个月后")
    weekly_minutes = profile.get("weekly_free_time_minutes", 900)

    yearly = _get_plan_agent().generate_yearly_plan(profile, {"gaps": gaps}, target_date, weekly_minutes)
    if state.get("growth_plan") is None:
        state["growth_plan"] = {}
    state["growth_plan"]["yearly_plan"] = yearly
    state["next_step"] = "validate"
    state["messages"].append(
        AIMessage(content=f"年度计划生成完成：共 {len(yearly.get('phases', []))} 个阶段，"
                   f"预计 {yearly.get('total_weeks', 0)} 周。")
    )
    return state


def validate_node(state: GrowthPlanState) -> GrowthPlanState:
    """校验计划合理性"""
    plan = state.get("growth_plan", {}).get("yearly_plan", {})
    profile = state.get("profile", {})
    max_minutes = profile.get("weekly_free_time_minutes", 900)

    result = _get_plan_agent().validate_plan(plan, max_minutes, [])
    state["plan_valid"] = result.get("is_valid", True)
    state["validation_feedback"] = result.get("suggestions", [])

    if not state["plan_valid"]:
        state["next_step"] = "retry"
        state["messages"].append(
            AIMessage(content=f"计划校验不通过：{result.get('issues', [])}，正在重新生成...")
        )
    else:
        state["next_step"] = "format_output"
        state["messages"].append(AIMessage(content="计划校验通过！正在生成最终输出..."))
    return state


def format_output_node(state: GrowthPlanState) -> GrowthPlanState:
    """格式化输出"""
    plan = state.get("growth_plan", {})
    yearly = plan.get("yearly_plan", {})

    state["milestones"] = yearly.get("key_milestones", [])
    improvements = yearly.get("target_match_improvement", {})
    msg = (f"成长路径生成完成！\n"
           f"总时长：{yearly.get('total_weeks', 0)} 周\n"
           f"预期匹配度提升：{improvements.get('from', 0)}% → {improvements.get('to', 0)}%\n"
           f"关键里程碑：{len(state['milestones'])} 个")
    state["messages"].append(AIMessage(content=msg))
    state["next_step"] = "done"
    return state


def no_gaps_node(state: GrowthPlanState) -> GrowthPlanState:
    state["messages"].append(
        AIMessage(content="恭喜！根据分析，你的能力已经非常匹配目标岗位。建议直接开始投递和面试准备！")
    )
    state["next_step"] = "done"
    return state


def route_after_gap(state: GrowthPlanState) -> str:
    return state.get("next_step", "generate_yearly")


def route_after_validate(state: GrowthPlanState) -> str:
    return state.get("next_step", "format_output")


# ── 图构建 ──────────────────────────────────────────

def create_growth_plan_graph():
    builder = StateGraph(GrowthPlanState)

    builder.add_node("parse_input", parse_input_node)
    builder.add_node("analyze_gap", analyze_gap_node)
    builder.add_node("generate_yearly", generate_yearly_node)
    builder.add_node("validate", validate_node)
    builder.add_node("format_output", format_output_node)
    builder.add_node("no_gaps", no_gaps_node)

    builder.set_entry_point("parse_input")
    builder.add_edge("parse_input", "analyze_gap")

    builder.add_conditional_edges("analyze_gap", route_after_gap, {
        "generate_yearly": "generate_yearly",
        "no_gaps": "no_gaps",
    })
    builder.add_edge("generate_yearly", "validate")
    builder.add_conditional_edges("validate", route_after_validate, {
        "format_output": "format_output",
        "retry": "generate_yearly",
    })
    builder.add_edge("format_output", END)
    builder.add_edge("no_gaps", END)

    return builder.compile()


def run_growth_plan(user_id: str, profile: dict, target_position: str,
                     target_jd: str = "", target_date: str = "6个月后"):
    """便捷入口：运行完整成长规划流程"""
    graph = create_growth_plan_graph()
    initial_state: GrowthPlanState = {
        "user_id": user_id,
        "profile": profile,
        "target_position": target_position,
        "target_jd": target_jd,
        "target_completion_date": target_date,
        "gap_report": None,
        "growth_plan": None,
        "milestones": None,
        "plan_valid": False,
        "validation_feedback": "",
        "messages": [],
        "next_step": "parse_input",
        "error": None,
    }
    return graph.stream(initial_state)
