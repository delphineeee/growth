"""Growth AI Studio — FastAPI backend
Serves teammate's static frontend + exposes LangGraph AI agents as REST API.
"""

import sys, os, json, asyncio, time
from pathlib import Path
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

# Project root = growth-unified (self-contained, all modules local)
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

STATIC_DIR = PROJECT_ROOT / "static"

app = FastAPI(title="Growth AI Studio API", version="1.0.0")

# ═══════════════════════════════════════════════════════
# API Request Audit Logging
# ═══════════════════════════════════════════════════════
AUDIT_FILE = PROJECT_ROOT / "data" / "api_audit.jsonl"
RATE_LIMIT = {}  # IP -> [timestamps]

@app.middleware("http")
async def audit_and_rate_limit(request: Request, call_next):
    """记录所有 API 请求的时间、IP、端点、UA，并对 AI 端点限流"""
    # Railway 前面有反向代理，真实 IP 在 X-Forwarded-For 或 X-Real-IP 头里
    ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if not ip:
        ip = request.headers.get("X-Real-IP", "")
    if not ip:
        ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")[:200]
    path = request.url.path
    method = request.method
    t0 = time.time()

    # Rate limit: max 10 AI requests per minute per IP
    if path.startswith("/api/") and path not in ["/api/health", "/api/feedbacks"]:
        now = time.time()
        RATE_LIMIT.setdefault(ip, []).append(now)
        RATE_LIMIT[ip] = [t for t in RATE_LIMIT[ip] if now - t < 60]
        if len(RATE_LIMIT[ip]) > 30:  # 30 AI calls per minute max
            return JSONResponse({"error": "请求过于频繁，请稍后再试", "code": 429}, status_code=429)

    response = await call_next(request)
    elapsed_ms = round((time.time() - t0) * 1000)

    # Log to file
    try:
        AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "ip": ip,
            "method": method,
            "path": path,
            "status": response.status_code,
            "elapsed_ms": elapsed_ms,
            "ua_short": ua[:80],
        }
        with open(AUDIT_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except:
        pass

    return response

from fastapi.responses import JSONResponse

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════
# Request / Response models
# ═══════════════════════════════════════════════════════

class ProfileRequest(BaseModel):
    resume_text: str = ""
    schedule_text: str = ""
    user_id: str = "demo"

class GapAnalysisRequest(BaseModel):
    profile: dict
    position_name: str
    jd_text: str = ""

class PlanRequest(BaseModel):
    profile: dict
    gap_report: List[dict]
    position_name: str
    target_date: str = "6个月后"

class ChatRequest(BaseModel):
    message: str
    profile: Optional[dict] = None
    gap_report: Optional[List[dict]] = None

# ═══════════════════════════════════════════════════════
# Health check
# ═══════════════════════════════════════════════════════

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.4.4"}

# ═══════════════════════════════════════════════════════
# API Audit & Usage Stats
# ═══════════════════════════════════════════════════════

@app.get("/api/admin/audit")
async def get_audit_log(limit: int = 200, today_only: bool = True):
    """查看最近的 API 请求日志（带具体时刻）"""
    try:
        if not AUDIT_FILE.exists():
            return {"requests": [], "total": 0}
        requests = []
        today = datetime.now().strftime("%Y-%m-%d")
        with open(AUDIT_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    r = json.loads(line.strip())
                    if today_only and not r.get("time", "").startswith(today):
                        continue
                    requests.append(r)
        requests.reverse()
        total = len(requests)
        return {"requests": requests[:limit], "total": total}
    except Exception as e:
        return {"requests": [], "total": 0, "error": str(e)}

@app.get("/api/admin/usage-stats")
async def usage_stats(geo: bool = False):
    """API 使用统计，支持 IP 地理位置查询"""
    try:
        if not AUDIT_FILE.exists():
            return {"total_requests": 0, "ai_requests": 0, "by_ip": {}, "by_endpoint": {}, "today_requests": 0}
        requests = []
        with open(AUDIT_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    requests.append(json.loads(line.strip()))

        today = datetime.now().strftime("%Y-%m-%d")
        today_reqs = [r for r in requests if r.get("time", "").startswith(today)]

        ai_paths = ["/api/profile/build", "/api/analyze", "/api/plan/generate", "/api/chat"]
        ai_reqs = [r for r in requests if r.get("path") in ai_paths]
        today_ai = [r for r in today_reqs if r.get("path") in ai_paths]

        by_ip = {}
        for r in today_reqs:
            ip = r.get("ip", "?")
            by_ip[ip] = by_ip.get(ip, 0) + 1

        # IP geolocation (free ip-api.com, 45/min limit)
        ip_geo = {}
        if geo:
            import urllib.request
            LOCAL_PREFIXES = ("127.", "10.", "192.168.", "172.16.", "172.17.", "172.18.",
                              "172.19.", "172.20.", "172.21.", "172.22.", "172.23.",
                              "172.24.", "172.25.", "172.26.", "172.27.", "172.28.",
                              "172.29.", "172.30.", "172.31.", "0.", "localhost")
            unique_ips = list(set(r.get("ip", "") for r in today_reqs
                                  if r.get("ip") and r["ip"] not in ("unknown", "127.0.0.1")))
            for ip in unique_ips[:20]:
                # Skip local/private IPs
                if any(ip.startswith(p) for p in LOCAL_PREFIXES):
                    ip_geo[ip] = "内部网络"
                    continue
                # CGNAT / Railway internal (RFC 6598: 100.64.0.0/10 = 100.64.x.x - 100.127.x.x)
                if ip.startswith("100."):
                    parts = ip.split(".")
                    if len(parts) >= 2 and parts[1].isdigit():
                        second = int(parts[1])
                        if 64 <= second <= 127:
                            ip_geo[ip] = "内部网络"
                            continue
                # Railway Docker / internal
                if ip.startswith("172.") or "internal" in ip or ip == "127.0.0.1":
                    ip_geo[ip] = "内部网络"
                    continue
                try:
                    resp = urllib.request.urlopen(f"http://ip-api.com/json/{ip}?lang=zh-CN&fields=country,regionName,city,isp", timeout=3)
                    data = json.loads(resp.read())
                    if data.get("country"):
                        ip_geo[ip] = f"{data.get('country','')} {data.get('regionName','')} {data.get('city','')} · {data.get('isp','')}"
                    else:
                        ip_geo[ip] = "无法定位（可能是代理/VPN）"
                except:
                    ip_geo[ip] = "查询超时（免费API限流）"

        by_endpoint = {}
        for r in today_ai:
            ep = r.get("path", "?")
            by_endpoint[ep] = by_endpoint.get(ep, 0) + 1

        light_count = sum(1 for r in today_ai if r.get("path") in ["/api/chat"])
        heavy_count = len(today_ai) - light_count
        est_cost = round(light_count * 0.002 + heavy_count * 0.015, 2)

        # Per-IP endpoint breakdown (what is each IP actually calling?)
        ip_endpoints = {}
        for r in today_reqs:
            ip = r.get("ip", "?")
            ep = r.get("path", "?")
            ip_endpoints.setdefault(ip, {})
            ip_endpoints[ip][ep] = ip_endpoints[ip].get(ep, 0) + 1

        # Group IPs by UA pattern to identify same user
        ip_ua_map = {}
        for r in today_reqs:
            ip = r.get("ip", "?")
            ua = r.get("ua_short", "")[:60]
            key = (ip, ua)
            ip_ua_map[key] = ip_ua_map.get(key, 0) + 1

        return {
            "total_requests": len(requests),
            "today_requests": len(today_reqs),
            "today_ai_requests": len(today_ai),
            "today_est_cost_rmb": est_cost,
            "by_ip_today": dict(sorted(by_ip.items(), key=lambda x: -x[1])[:10]),
            "by_endpoint_today": by_endpoint,
            "ip_endpoints": {ip: dict(sorted(eps.items(), key=lambda x: -x[1])) for ip, eps in ip_endpoints.items() if ip in by_ip},
            "ip_geo": ip_geo,
            "note": "Railway内部IP(100.64.x.x)的请求来自平台自身健康检查或UptimeRobot。同一IP+相同UA大概率是同一人。",
        }
    except Exception as e:
        return {"error": str(e)}

# ═══════════════════════════════════════════════════════
# Feedback
# ═══════════════════════════════════════════════════════

@app.post("/api/feedback")
async def save_feedback(data: dict):
    """保存用户反馈"""
    try:
        from pathlib import Path
        from datetime import datetime
        fb_file = PROJECT_ROOT / "data" / "feedbacks.jsonl"
        fb_file.parent.mkdir(parents=True, exist_ok=True)
        import json as _json
        entry = {
            "text": data.get("text", ""),
            "user": data.get("user", "匿名"),
            "time": datetime.now().strftime("%Y-%m-%d %H:%M"),
        }
        with open(fb_file, "a", encoding="utf-8") as f:
            f.write(_json.dumps(entry, ensure_ascii=False) + "\n")
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@app.get("/api/feedbacks")
async def list_feedbacks():
    """列出所有反馈"""
    try:
        fb_file = PROJECT_ROOT / "data" / "feedbacks.jsonl"
        if not fb_file.exists():
            return {"feedbacks": [], "count": 0}
        import json as _json
        feedbacks = []
        with open(fb_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    feedbacks.append(_json.loads(line))
        feedbacks.reverse()
        return {"feedbacks": feedbacks, "count": len(feedbacks)}
    except Exception as e:
        return {"feedbacks": [], "count": 0, "error": str(e)}

@app.delete("/api/feedbacks")
async def clear_feedbacks():
    """清空反馈"""
    fb_file = PROJECT_ROOT / "data" / "feedbacks.jsonl"
    if fb_file.exists():
        fb_file.unlink()
    return {"ok": True}

@app.get("/admin")
async def admin_page():
    """管理页面"""
    from fastapi.responses import FileResponse
    admin_file = PROJECT_ROOT / "static" / "admin.html"
    if admin_file.exists():
        return FileResponse(admin_file)
    return {"error": "admin.html not found"}

@app.post("/api/admin/email-summary")
async def email_summary(data: dict):
    """发送反馈摘要到指定邮箱（QQ SMTP）"""
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        to_email = data.get("email", "1729126784@qq.com")
        smtp_user = os.environ.get("SMTP_USER", "1729126784@qq.com")
        smtp_pass = os.environ.get("SMTP_PASS", "")

        if not smtp_pass:
            return {"ok": False, "error": "未配置 SMTP_PASS 环境变量。请在 QQ邮箱设置中生成授权码，添加到 Railway Variables"}

        # Gather feedbacks
        fb_file = PROJECT_ROOT / "data" / "feedbacks.jsonl"
        import json as _json
        feedbacks = []
        if fb_file.exists():
            with open(fb_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        feedbacks.append(_json.loads(line.strip()))
        feedbacks.reverse()

        # Build email body
        body = f"Growth AI Studio 反馈摘要\n{'='*40}\n总计 {len(feedbacks)} 条反馈\n\n"
        for fb in feedbacks[-20:]:  # Latest 20
            body += f"[{fb.get('time','?')}] {fb.get('user','匿名')}:\n{fb.get('text','')}\n---\n"

        msg = MIMEMultipart()
        msg["From"] = smtp_user
        msg["To"] = to_email
        msg["Subject"] = f"[Growth] 用户反馈摘要 ({len(feedbacks)} 条)"
        msg.attach(MIMEText(body, "plain", "utf-8"))

        with smtplib.SMTP_SSL("smtp.qq.com", 465) as server:
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())

        return {"ok": True, "msg": f"已发送 {len(feedbacks)} 条反馈摘要到 {to_email}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# ═══════════════════════════════════════════════════════
# Auth (simple — in-memory + SQLite)
# ═══════════════════════════════════════════════════════

_auth_users = {"demo": "demo123"}  # fallback in-memory store

@app.post("/api/auth/login")
async def auth_login(data: dict):
    u = data.get("username", "").strip()
    p = data.get("password", "").strip()
    try:
        from services.auth_service import login_user
        ok, msg, user = login_user(u, p)
        if ok: return {"ok": True, "user": user}
        # fallback to in-memory
        if _auth_users.get(u) == p:
            return {"ok": True, "user": {"id": "1", "username": u, "email": u + "@demo.ai"}}
        return {"ok": False, "msg": msg}
    except Exception:
        if _auth_users.get(u) == p:
            return {"ok": True, "user": {"id": "1", "username": u, "email": u + "@demo.ai"}}
        return {"ok": False, "msg": "用户名或密码错误"}

@app.post("/api/auth/register")
async def auth_register(data: dict):
    u = data.get("username", "").strip()
    p = data.get("password", "").strip()
    e = data.get("email", (u + "@growth.ai").strip())
    try:
        from services.auth_service import register_user
        ok, msg = register_user(u, e, p)
        if ok:
            return {"ok": True, "user": {"id": "1", "username": u, "email": e}}
        return {"ok": False, "msg": msg}
    except Exception:
        _auth_users[u] = p
        return {"ok": True, "user": {"id": "1", "username": u, "email": e}}

# ═══════════════════════════════════════════════════════
# Profile Builder
# ═══════════════════════════════════════════════════════

@app.post("/api/profile/build")
async def build_profile(data: dict):
    """解析简历 → 追问对话 → 生成画像"""
    try:
        from graphs.profile_graph import create_profile_graph

        graph = create_profile_graph()
        state = {
            "user_id": data.get("user_id", "demo"),
            "resume_text": data.get("resume_text", ""),
            "schedule_text": data.get("schedule_text", ""),
            "parsed_resume": None, "parsed_schedule": None,
            "conversation_history": [], "current_question": "",
            "user_answer": "", "profile_json": None, "missing_info": [],
            "round_count": 0, "is_complete": False, "messages": [],
            "next_step": "parse_input", "error": None,
        }
        result = graph.invoke(state)

        return {
            "success": True,
            "profile": result.get("profile_json", {}),
            "questions": [m.content for m in result.get("messages", []) if hasattr(m, "content")],
            "is_complete": result.get("is_complete", False),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# ═══════════════════════════════════════════════════════
# Gap Analysis
# ═══════════════════════════════════════════════════════

@app.post("/api/analyze")
async def analyze_gaps(data: dict):
    """目标岗位技能树 + 差距分析"""
    try:
        from agents.target_analyst import TargetAnalystAgent

        agent = TargetAnalystAgent()
        skill_tree = agent.build_skill_tree(data.get("position_name", ""), data.get("jd_text", ""))
        gap_result = agent.analyze_gaps(data.get("profile", {}), skill_tree)

        return {
            "success": True,
            "skill_tree": skill_tree,
            "gaps": gap_result.get("gaps", []),
            "overall_match": gap_result.get("overall_match_score", 0),
            "summary": gap_result.get("summary", ""),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# ═══════════════════════════════════════════════════════
# Learning Path Generator
# ═══════════════════════════════════════════════════════

@app.post("/api/plan/generate")
async def generate_plan(data: dict):
    """生成年/月/周三层学习路径"""
    try:
        from graphs.growth_plan_graph import create_growth_plan_graph

        graph = create_growth_plan_graph()
        state = {
            "user_id": "api_user",
            "profile": data.get("profile", {}),
            "target_position": data.get("position_name", ""),
            "target_jd": "",
            "target_completion_date": data.get("target_date", "6个月后"),
            "gap_report": None, "growth_plan": None, "milestones": None,
            "plan_valid": False, "validation_feedback": "",
            "messages": [], "next_step": "parse_input", "error": None,
        }

        result = None
        for event in graph.stream(state):
            node_name = list(event.keys())[0] if event else ""
            if "format_output" in node_name:
                result = event.get(node_name, {})

        return {
            "success": True,
            "growth_plan": result.get("growth_plan", {}) if result else {},
            "milestones": result.get("milestones", []) if result else [],
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# ═══════════════════════════════════════════════════════
# General Chat (Orchestrator)
# ═══════════════════════════════════════════════════════

@app.post("/api/chat")
async def chat(data: dict):
    """通用 AI 对话"""
    try:
        from utils.llm import get_llm
        llm = get_llm()

        context = f"用户画像: {json.dumps(data.get('profile', {}) or {}, ensure_ascii=False)}\n"
        context += f"技能差距: {json.dumps(data.get('gap_report', []) or [], ensure_ascii=False)}"

        response = llm.chat(
            system_prompt="你是 Growth AI Studio 的职业成长助手。用友好、鼓励的语气回复学生的问题。",
            user_content=f"上下文：{context}\n\n用户消息：{data.get('message', '')}",
            temperature=0.7,
            max_tokens=1024,
        )

        return {"success": True, "reply": response}
    except Exception as e:
        return {"success": False, "error": str(e), "reply": "抱歉，AI 服务暂时不可用，请稍后重试。"}

# ═══════════════════════════════════════════════════════
# Static files (must be last — serves frontend)
# ═══════════════════════════════════════════════════════

@app.get("/")
async def root():
    from fastapi.responses import FileResponse
    return FileResponse(STATIC_DIR / "index.html")

app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

# ═══════════════════════════════════════════════════════
# Startup
# ═══════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn, traceback
    print("=== Growth AI Studio starting ===", flush=True)
    print(f"Python: {sys.version}", flush=True)
    # Check critical deps
    for mod in ["fastapi", "uvicorn", "langgraph", "openai", "chromadb"]:
        try: __import__(mod); print(f"  [{mod}] OK", flush=True)
        except Exception as e: print(f"  [{mod}] MISSING: {e}", flush=True)
    print(f"PORT env: {os.environ.get('PORT', 'not set')}", flush=True)
    port = int(os.environ.get("PORT", 8000))
    print(f"Listening on 0.0.0.0:{port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)
