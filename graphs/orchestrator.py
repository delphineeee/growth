"""Orchestrator —— 总调度 Agent，意图识别 → 子图路由"""

from langgraph.graph import StateGraph, END
from models.state import OrchestratorState
from langchain_core.messages import HumanMessage, AIMessage

def _get_llm():
    from utils.llm import get_llm
    return get_llm()


def classify_intent_node(state: OrchestratorState) -> OrchestratorState:
    """LLM 意图分类"""
    last_msg = state["messages"][-1].content if state["messages"] else ""
    context = str([m.content[:100] for m in state["messages"][-3:]])
    intent = _get_llm().classify_intent(last_msg, context)
    state["current_intent"] = intent
    state["next_step"] = intent
    return state


def build_profile_entry(state: OrchestratorState) -> OrchestratorState:
    state["active_graph"] = "profile"
    state["messages"].append(AIMessage(content="我来帮你构建职业画像。请先上传你的简历或课程表，也可以直接告诉我你的情况。"))
    return state


def analyze_target_entry(state: OrchestratorState) -> OrchestratorState:
    state["active_graph"] = "target_analysis"
    state["messages"].append(AIMessage(content="好的！你想了解哪个目标岗位的技能要求？请告诉我岗位名称，或者直接粘贴 JD。"))
    return state


def generate_plan_entry(state: OrchestratorState) -> OrchestratorState:
    state["active_graph"] = "growth_plan"
    state["messages"].append(AIMessage(content="生成学习路径需要先完成画像构建和目标分析。如果已经完成，请确认你的目标岗位。"))
    return state


def general_chat_entry(state: OrchestratorState) -> OrchestratorState:
    state["active_graph"] = "general"
    state["messages"].append(AIMessage(content="你好！我是 Growth，你的 AI 职业成长训练师。我可以帮你：\n1. 构建职业画像（上传简历/课表）\n2. 分析目标岗位的技能要求\n3. 生成个性化学习路径\n\n你想从哪里开始？"))
    return state


def route_by_intent(state: OrchestratorState) -> str:
    intent = state.get("current_intent", "general_chat")
    routing = {
        "build_profile": "build_profile_entry",
        "analyze_target": "analyze_target_entry",
        "generate_plan": "generate_plan_entry",
        "general_chat": "general_chat_entry",
    }
    return routing.get(intent, "general_chat_entry")


def create_orchestrator_graph():
    builder = StateGraph(OrchestratorState)

    builder.add_node("classify_intent", classify_intent_node)
    builder.add_node("build_profile_entry", build_profile_entry)
    builder.add_node("analyze_target_entry", analyze_target_entry)
    builder.add_node("generate_plan_entry", generate_plan_entry)
    builder.add_node("general_chat_entry", general_chat_entry)

    builder.set_entry_point("classify_intent")

    builder.add_conditional_edges("classify_intent", route_by_intent, {
        "build_profile_entry": "build_profile_entry",
        "analyze_target_entry": "analyze_target_entry",
        "generate_plan_entry": "generate_plan_entry",
        "general_chat_entry": "general_chat_entry",
    })

    for node in ["build_profile_entry", "analyze_target_entry", "generate_plan_entry", "general_chat_entry"]:
        builder.add_edge(node, END)

    return builder.compile()


def run_orchestrator(messages: list) -> dict:
    """便捷入口"""
    graph = create_orchestrator_graph()
    initial_state: OrchestratorState = {
        "messages": messages,
        "current_intent": "",
        "active_graph": "",
        "results": {},
        "error": None,
    }
    result = graph.invoke(initial_state)
    return result
