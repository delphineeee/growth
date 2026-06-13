"""Growth 设计系统 —— 暖调纸质感 + 玻璃拟态 + 衬线标题
    配色参考 yunshukk.github.io 的暖调奶油色系与青绿点缀
"""

# ── Color Palette ─────────────────────────────────────
# 暖调奶油基底 · 青绿点缀 · 珊瑚暖色

COLORS = {
    # Backgrounds
    "bg":            "#f4ecde",   # 暖调奶油
    "bg_alt":        "#ece0ce",   # 略深暖调
    "surface":       "rgba(255,252,246,0.88)",  # 玻璃面板
    "surface_strong": "rgba(255,249,239,0.96)",

    # Text
    "text_primary":  "#16322f",   # 深绿黑
    "text_secondary":"#61756f",   # 鼠尾草灰
    "text_muted":    "#8a9b96",

    # Accent
    "accent":        "#0f8576",   # 青绿
    "accent_strong": "#0b5c53",   # 深青绿
    "accent_soft":   "#dff5ef",   # 浅青背景
    "accent_warm":   "#d76e4d",   # 珊瑚暖

    # Semantic
    "success":       "#0f8576",
    "warning":       "#d76e4d",
    "error":         "#a63f31",

    # Borders
    "border":        "rgba(22,50,47,0.12)",
    "border_light":  "rgba(22,50,47,0.06)",
    "divider":       "rgba(22,50,47,0.08)",

    # Shadow
    "shadow":        "0 24px 60px rgba(30,48,44,0.12)",
    "shadow_sm":     "0 8px 24px rgba(30,48,44,0.08)",
}

# ── Typography ─────────────────────────────────────────
FONTS = {
    "body": "'Avenir Next', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    "heading": "Georgia, 'Noto Serif SC', 'Songti SC', 'KaiTi', serif",
}

# ── Spacing Scale (px) ─────────────────────────────────
SPACE = {"xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32, "2xl": 48, "3xl": 64}

# ── Radius (px) ────────────────────────────────────────
RADIUS = {"sm": 8, "md": 14, "lg": 20, "xl": 28, "pill": 999}

# ── Icons (Unicode) ────────────────────────────────────
ICONS = {
    "home":    "&#9679;",
    "profile": "&#9671;",
    "skills":  "&#9632;",
    "path":    "&#9654;",
    "user":    "&#9672;",
    "check":   "&#10003;",
    "cross":   "&#10005;",
    "arrow":   "&#8594;",
    "dot":     "&#183;",
    "bullet":  "&#8212;",
}

# ── Global CSS ─────────────────────────────────────────
GLOBAL_CSS = f"""
<style>
    /* ---- Base ---- */
    .stApp {{
        background:
            radial-gradient(circle at top left, rgba(215,110,77,0.10), transparent 34%),
            radial-gradient(circle at top right, rgba(15,133,118,0.09), transparent 28%),
            linear-gradient(180deg, {COLORS["bg"]} 0%, {COLORS["bg_alt"]} 100%);
    }}

    /* ---- Typography ---- */
    html, body, [class*="css"] {{
        font-family: {FONTS["body"]};
        color: {COLORS["text_primary"]};
        -webkit-font-smoothing: antialiased;
    }}

    h1, h2, h3, h4 {{
        font-family: {FONTS["heading"]} !important;
        font-weight: 700 !important;
        color: {COLORS["text_primary"]} !important;
        letter-spacing: -0.01em !important;
    }}

    h1 {{ font-size: clamp(1.8rem, 3.5vw, 2.6rem) !important; line-height: 1.05 !important; }}
    h2 {{ font-size: 1.25rem !important; }}
    h3 {{ font-size: 1.05rem !important; }}

    /* ---- Buttons (primary) ---- */
    .stButton > button {{
        background: linear-gradient(135deg, {COLORS["accent"]}, {COLORS["accent_strong"]}) !important;
        color: white !important;
        border: none !important;
        border-radius: {RADIUS["pill"]}px !important;
        padding: 14px 24px !important;
        font-size: 0.95rem !important;
        font-weight: 700 !important;
        font-family: {FONTS["body"]} !important;
        letter-spacing: 0.01em !important;
        box-shadow: 0 14px 28px rgba(11,92,83,0.26) !important;
        transition: transform 180ms ease, background 180ms ease !important;
    }}
    .stButton > button:hover {{
        transform: translateY(-2px);
    }}
    .stButton > button:active {{
        transform: translateY(0);
    }}

    /* Secondary button */
    .stButton > button[kind="secondary"] {{
        background: rgba(255,255,255,0.68) !important;
        color: {COLORS["text_primary"]} !important;
        border: 1px solid {COLORS["border"]} !important;
        box-shadow: none !important;
        font-weight: 600 !important;
    }}
    .stButton > button[kind="secondary"]:hover {{
        background: rgba(255,255,255,0.92) !important;
        border-color: rgba(15,133,118,0.3) !important;
    }}

    /* ---- Inputs ---- */
    .stTextInput > div > div > input,
    .stTextArea > div > div > textarea {{
        border: 1px solid {COLORS["border"]} !important;
        border-radius: {RADIUS["md"]}px !important;
        padding: 12px 14px !important;
        background: rgba(255,255,255,0.9) !important;
        font-family: {FONTS["body"]} !important;
        font-size: 0.93rem !important;
        color: {COLORS["text_primary"]} !important;
        transition: border-color 180ms ease !important;
    }}
    .stTextInput > div > div > input:focus,
    .stTextArea > div > div > textarea:focus {{
        border-color: rgba(15,133,118,0.5) !important;
        box-shadow: 0 0 0 3px rgba(15,133,118,0.08) !important;
    }}

    /* ---- Expander ---- */
    .streamlit-expanderHeader {{
        background: rgba(255,255,255,0.68) !important;
        border: 1px solid {COLORS["border"]} !important;
        border-radius: {RADIUS["md"]}px !important;
        font-weight: 700 !important;
        padding: 14px 18px !important;
        font-family: {FONTS["body"]} !important;
        color: {COLORS["text_primary"]} !important;
        transition: transform 180ms ease !important;
    }}
    .streamlit-expanderHeader:hover {{
        background: rgba(255,255,255,0.92) !important;
        transform: translateY(-1px);
    }}

    /* ---- Metrics ---- */
    [data-testid="stMetricValue"] {{
        font-family: {FONTS["heading"]} !important;
        font-weight: 700 !important;
        font-size: 1.6rem !important;
        color: {COLORS["text_primary"]} !important;
    }}
    [data-testid="stMetricLabel"] {{
        font-size: 0.78rem !important;
        color: {COLORS["text_secondary"]} !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.08em !important;
    }}

    /* ---- Chat ---- */
    .stChatMessage {{
        background: rgba(255,255,255,0.78) !important;
        border: 1px solid {COLORS["border"]} !important;
        border-radius: {RADIUS["lg"]}px !important;
        padding: 16px 20px !important;
    }}

    /* ---- File Uploader ---- */
    [data-testid="stFileUploader"] {{
        border: 2px dashed {COLORS["border"]} !important;
        border-radius: {RADIUS["lg"]}px !important;
        padding: 28px !important;
        background: rgba(255,255,255,0.6) !important;
        transition: border-color 180ms ease !important;
    }}
    [data-testid="stFileUploader"]:hover {{
        border-color: rgba(15,133,118,0.4) !important;
    }}

    /* ---- Sidebar ---- */
    [data-testid="stSidebar"] {{
        background: rgba(255,252,246,0.92) !important;
        border-right: 1px solid {COLORS["border"]} !important;
        backdrop-filter: blur(16px) !important;
    }}

    /* ---- Alerts ---- */
    .stAlert {{
        border-radius: {RADIUS["md"]}px !important;
        border: 1px solid {COLORS["border"]} !important;
        background: rgba(255,255,255,0.78) !important;
    }}

    /* ---- Divider ---- */
    hr {{
        border-color: {COLORS["divider"]} !important;
        margin: 24px 0 !important;
    }}

    /* ---- Hide Streamlit chrome ---- */
    #MainMenu {{ visibility: hidden; }}
    footer {{ visibility: hidden; }}
    header {{ visibility: hidden; }}

    /* ---- Responsive ---- */
    @media (max-width: 768px) {{
        h1 {{ font-size: 1.5rem !important; }}
        h2 {{ font-size: 1.1rem !important; }}
        .stButton > button {{ padding: 12px 18px !important; font-size: 0.88rem !important; }}
    }}
</style>
"""


def inject_theme():
    import streamlit as st
    st.markdown(GLOBAL_CSS, unsafe_allow_html=True)
