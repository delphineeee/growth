"""职业画像构建 LangGraph —— 简历解析 → 追问对话 → 画像生成"""

from langgraph.graph import StateGraph, END
from models.state import ProfileState
from langchain_core.messages import HumanMessage, AIMessage

MAX_ROUNDS = 4

def _get_agent():
    from agents.profile_builder import ProfileBuilderAgent
    return ProfileBuilderAgent()


def parse_input_node(state: ProfileState) -> ProfileState:
    """解析简历和课表"""
    if state.get("resume_text"):
        result = _get_agent().analyze_resume(state["resume_text"])
        state["parsed_resume"] = result
        state["missing_info"] = result.get("missing_info", [])
        state["messages"].append(
            AIMessage(content=f"已解析简历，发现 {len(result.get('extracted_skills', []))} 项技能。")
        )
    else:
        state["parsed_resume"] = {}
        state["missing_info"] = ["无简历信息，需要从头了解"]

    state["round_count"] = 0
    state["next_step"] = "ask_question" if state["missing_info"] else "build_profile"
    return state


def ask_question_node(state: ProfileState) -> ProfileState:
    """生成并返回追问问题"""
    known = {
        "skills": state.get("parsed_resume", {}).get("extracted_skills", []),
        "history": state.get("conversation_history", []),
    }
    questions = _get_agent().generate_followup_questions(known, state.get("missing_info", []))
    q = questions[0] if questions else "你还有什么想补充的吗？"
    state["current_question"] = q
    state["messages"].append(AIMessage(content=q))
    state["next_step"] = "wait_for_answer"
    return state


def process_answer_node(state: ProfileState) -> ProfileState:
    """处理用户回答，更新画像"""
    answer = state.get("user_answer", "")
    state["conversation_history"].append({
        "question": state.get("current_question", ""),
        "answer": answer,
    })
    state["round_count"] += 1

    if state["round_count"] >= MAX_ROUNDS:
        state["next_step"] = "build_profile"
    else:
        state["missing_info"] = [m for m in state.get("missing_info", []) if m not in answer]
        state["next_step"] = "ask_question" if state["missing_info"] else "build_profile"

    state["user_answer"] = ""
    return state


def build_profile_node(state: ProfileState) -> ProfileState:
    """汇总信息，生成最终画像"""
    profile = _get_agent().build_profile(
        conversation_history=state.get("conversation_history", []),
        resume_data=state.get("parsed_resume", {}),
        schedule_data=state.get("parsed_schedule", {}),
    )
    state["profile_json"] = profile
    state["is_complete"] = True
    state["next_step"] = "done"
    state["messages"].append(
        AIMessage(content=f"画像构建完成！你的核心优势是：{', '.join(profile.get('strength_tags', []))}")
    )
    return state


def route_after_parse(state: ProfileState) -> str:
    return state.get("next_step", "ask_question")


def route_after_answer(state: ProfileState) -> str:
    return state.get("next_step", "build_profile")


def create_profile_graph():
    builder = StateGraph(ProfileState)

    builder.add_node("parse_input", parse_input_node)
    builder.add_node("ask_question", ask_question_node)
    builder.add_node("process_answer", process_answer_node)
    builder.add_node("build_profile", build_profile_node)

    builder.set_entry_point("parse_input")

    builder.add_conditional_edges("parse_input", route_after_parse, {
        "ask_question": "ask_question",
        "build_profile": "build_profile",
    })
    builder.add_edge("ask_question", "process_answer")
    builder.add_conditional_edges("process_answer", route_after_answer, {
        "ask_question": "ask_question",
        "build_profile": "build_profile",
    })
    builder.add_edge("build_profile", END)

    return builder.compile()


def run_profile_graph(user_id: str, resume_text: str = "", schedule_text: str = ""):
    """便捷入口：运行画像构建流程"""
    graph = create_profile_graph()
    initial_state: ProfileState = {
        "user_id": user_id,
        "resume_text": resume_text,
        "schedule_text": schedule_text,
        "parsed_resume": None,
        "parsed_schedule": None,
        "conversation_history": [],
        "current_question": "",
        "user_answer": "",
        "profile_json": None,
        "missing_info": [],
        "round_count": 0,
        "is_complete": False,
        "messages": [],
        "next_step": "parse_input",
        "error": None,
    }
    return graph.stream(initial_state)
