# Growth AI Studio

> AI 大学生个性化职业成长训练师 —— 从「我想做什么」到「我每天该学什么」

[![Deploy](https://img.shields.io/badge/demo-online-0f8576)](https://growth-production-1acf.up.railway.app)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## 产品简介

Growth 是一款面向大学生的 AI 职业成长训练师。用户上传简历和课程表，设定目标岗位，AI 自动：

1. 构建个人能力画像（多轮对话确认）
2. 拆解目标岗位技能树并对比差距
3. 生成年/月/周/日四层个性化学习路径
4. 推荐全网学习资源（B站/小红书/GitHub/LeetCode/MOOC）
5. 定时回访追踪进度并动态调整计划

**演示账号：** `demo` / `demo2026`（预置完整数据，秒开体验）

## 技术架构

```
浏览器（静态前端）→ FastAPI 后端 → LangGraph Multi-Agent → DeepSeek V4
                         ↓
                    Chroma 向量数据库
```

### AI Agent 架构

| Agent | 职责 | 核心能力 |
|-------|------|----------|
| Profile Builder | 简历解析 + 多轮对话 + 画像生成 | OCR、自适应追问、技能标签提取 |
| Target Analyst | 岗位技能树拆解 + 差距分析 | JD 语义解析、加权差距排序 |
| Learning Path Planner | 年/月/周/日学习路径生成 | 时间约束求解、艾宾浩斯复习插入 |
| Resource Curator | 全网学习资源筛选 | 多平台并行搜索、多维度排序 |
| Progress Coach | 定时回访 + 动态调整 | 进度评估、计划自适应调整 |

### 技术栈

- **后端：** Python 3.12 + FastAPI + LangGraph
- **AI 模型：** DeepSeek V4（主力推理）
- **向量数据库：** Chroma
- **前端：** 原生 HTML/CSS/JS（暖调纸质感设计）
- **部署：** Railway（Docker + Nixpacks）

## 项目结构

```
├── server.py              # FastAPI 服务器（API + 静态文件）
├── static/                # 前端文件
│   ├── index.html         # 主页面（侧栏布局 + 5 个功能页）
│   ├── app.js             # 前端逻辑（API 调用 + localStorage 持久化）
│   ├── styles.css         # 设计系统（暖调奶油色 + 玻璃拟态 + 衬线标题）
│   └── data.js            # 预设数据
├── agents/                # AI Agent 定义
│   ├── profile_builder.py
│   ├── target_analyst.py
│   └── learning_path_planner.py
├── graphs/                # LangGraph 状态图
│   ├── orchestrator.py    # 总调度
│   ├── profile_graph.py   # 画像构建图
│   └── growth_plan_graph.py  # 成长规划图
├── config/                # 配置 + Prompt 模板
├── models/                # Pydantic 数据模型
├── tools/                 # Agent 工具（文件解析、差距分析等）
├── vectordb/              # Chroma 向量数据库
└── services/              # 业务逻辑（认证等）
```

## 本地运行

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 配置 API Key
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY

# 3. 启动服务
python server.py

# 4. 打开浏览器
# http://localhost:8000
```

## 算法有效性

详见 [docs/validation_report.md](docs/validation_report.md)

核心指标：
- 简历解析准确率：92%（技能标签提取 + 经历结构化）
- 技能差距分析覆盖度：覆盖 8 大岗位类别 × 50+ 技能节点
- 学习路径可行性：时间约束校验通过率 100%（LangGraph validate → retry 闭环）
- 用户画像一致性：多轮对话修正后画像稳定度 > 90%

## 设计参考

前端 UI 参考 [yunshukk.github.io](https://yunshukk.github.io) 的暖调配色与玻璃拟态风格，在此基础上增加了侧栏导航、文件上传、可编辑分析结果等功能。

## 团队

- 产品 + 前端：yunshukk
- AI + 后端：delphineeee

## License

MIT
