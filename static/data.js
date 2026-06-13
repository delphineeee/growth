window.GrowthData = (() => {
  const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const PERIODS = [
    { key: "morning", label: "上午", time: "08:30-11:00", hours: 2.5 },
    { key: "afternoon", label: "下午", time: "14:00-17:00", hours: 3 },
    { key: "evening", label: "晚上", time: "19:00-22:00", hours: 3 }
  ];

  const SLOT_STATES = {
    blocked: { label: "忙碌", hours: 0, energy: 0, className: "is-blocked" },
    study: { label: "可学习", hours: 2, energy: 1, className: "is-study" },
    focus: { label: "高专注", hours: 3, energy: 1.35, className: "is-focus" }
  };

  const DISCIPLINES = [
    {
      id: "engineering",
      label: "工学",
      majors: ["计算机科学与技术", "软件工程", "机械工程", "电气工程", "通信工程", "人工智能", "土木工程", "自动化", "材料工程", "工业设计"]
    },
    {
      id: "science",
      label: "理学",
      majors: ["数学", "统计学", "物理学", "化学", "生物科学", "地理信息科学", "数据科学"]
    },
    {
      id: "economics_management",
      label: "经管",
      majors: ["经济学", "金融学", "工商管理", "市场营销", "会计学", "人力资源管理", "国际商务"]
    },
    {
      id: "humanities_social",
      label: "文史社科",
      majors: ["汉语言文学", "新闻传播学", "社会学", "法学", "哲学", "历史学", "政治学", "公共管理"]
    },
    {
      id: "education",
      label: "教育",
      majors: ["教育学", "学前教育", "心理学", "特殊教育", "体育教育"]
    },
    {
      id: "art_media",
      label: "艺术传媒",
      majors: ["数字媒体艺术", "视觉传达设计", "动画", "广播电视编导", "环境设计", "音乐学"]
    },
    {
      id: "medicine",
      label: "医学",
      majors: ["临床医学", "护理学", "预防医学", "药学", "中医学", "口腔医学", "医学信息工程"]
    },
    {
      id: "agriculture",
      label: "农学",
      majors: ["农学", "园艺", "动物医学", "食品科学与工程", "农业资源与环境"]
    }
  ];

  const GRADE_OPTIONS = ["大一", "大二", "大三", "大四", "研一", "研二", "研三", "博士"];

  const CAREER_SUGGESTIONS = [
    "Java 后端开发工程师",
    "AI 产品经理",
    "数据分析师",
    "品牌策划",
    "新媒体运营",
    "选调生",
    "法务",
    "用户研究员",
    "教师 / 教培产品",
    "医药数据分析师",
    "工业设计师",
    "供应链管理",
    "咨询顾问",
    "高校辅导员",
    "产品运营",
    "跨境电商运营"
  ];

  const EXPERIENCE_TAGS = [
    { id: "research", label: "做过科研 / 课题 / 实验", domains: ["analysis", "research", "writing"], bonuses: { analytical: 12, execution: 8, domain: 6 } },
    { id: "competition", label: "参加过比赛 / Hackathon", domains: ["project", "execution"], bonuses: { execution: 12, project: 10, communication: 6 } },
    { id: "student_leader", label: "担任班委 / 学生干部", domains: ["leadership", "communication"], bonuses: { communication: 12, leadership: 12, collaboration: 8 } },
    { id: "internship", label: "有实习经历", domains: ["project", "business"], bonuses: { business: 14, execution: 10, project: 12 } },
    { id: "content_creation", label: "做过自媒体 / 内容输出", domains: ["content", "branding"], bonuses: { communication: 10, creativity: 10, branding: 8 } },
    { id: "coding", label: "会编程 / 自动化", domains: ["technical", "analysis"], bonuses: { technical: 14, analytical: 8, project: 6 } },
    { id: "design_tool", label: "会设计软件 / 原型工具", domains: ["design", "product"], bonuses: { creativity: 12, product: 8, project: 6 } },
    { id: "volunteer", label: "长期志愿 / 公益组织", domains: ["social", "public"], bonuses: { communication: 10, leadership: 6, service: 12 } },
    { id: "english", label: "可以阅读英文资料", domains: ["global"], bonuses: { learning: 10, analytical: 4, technical: 4 } },
    { id: "presentation", label: "做过汇报 / 演讲 / 辩论", domains: ["communication"], bonuses: { communication: 14, leadership: 6, branding: 6 } },
    { id: "teaching", label: "做过家教 / 助教 / 培训", domains: ["education"], bonuses: { teaching: 14, communication: 10, execution: 4 } },
    { id: "organization", label: "做过活动策划 / 组织", domains: ["operation", "management"], bonuses: { execution: 10, collaboration: 10, leadership: 8 } }
  ];

  const PRESETS = {
    java_sprint: {
      label: "秋招技术冲刺",
      subtitle: "计科学生拿后端 offer",
      fields: {
        studentName: "张同学",
        studentGrade: "大三",
        studentDiscipline: "engineering",
        studentMajor: "计算机科学与技术",
        careerTarget: "Java 后端开发工程师",
        careerPrompt: "希望明年春招前拿到至少 2 次面试机会，同时补齐项目表达与工程化能力。",
        goalText: "目标是在 6 个月内形成可讲清楚的后端项目经历，并把技能匹配度提升到 80% 左右。",
        deadlineMonths: 6,
        energyLevel: 4,
        examWeek: false,
        resumeText: "学过 Java、数据结构、数据库原理，做过一个校园论坛项目，能完成基础 CRUD，也参加过程序设计比赛。"
      },
      selectedTags: ["coding", "competition", "internship"],
      schedule: [
        ["blocked", "blocked", "focus"],
        ["blocked", "study", "focus"],
        ["blocked", "blocked", "focus"],
        ["blocked", "study", "focus"],
        ["blocked", "study", "study"],
        ["focus", "focus", "study"],
        ["study", "study", "focus"]
      ]
    },
    pm_transition: {
      label: "文科转产品",
      subtitle: "从社科背景切入产品岗位",
      fields: {
        studentName: "李同学",
        studentGrade: "大三",
        studentDiscipline: "humanities_social",
        studentMajor: "社会学",
        careerTarget: "AI 产品经理",
        careerPrompt: "我想把社会学训练的洞察能力转成产品需求分析和作品集表达能力。",
        goalText: "希望在秋招前完成 2 份作品集和 1 份完整 PRD，并具备基础数据分析能力。",
        deadlineMonths: 5,
        energyLevel: 3,
        examWeek: false,
        resumeText: "负责社团运营和活动策划，做过问卷调研和用户访谈，平时喜欢拆解互联网产品。"
      },
      selectedTags: ["student_leader", "organization", "content_creation"],
      schedule: [
        ["blocked", "study", "study"],
        ["blocked", "blocked", "focus"],
        ["blocked", "study", "study"],
        ["blocked", "blocked", "focus"],
        ["blocked", "study", "study"],
        ["focus", "focus", "study"],
        ["focus", "study", "study"]
      ]
    },
    interdisciplinary: {
      label: "自由职业输入",
      subtitle: "适合任意专业自定义方向",
      fields: {
        studentName: "王同学",
        studentGrade: "研二",
        studentDiscipline: "medicine",
        studentMajor: "临床医学",
        careerTarget: "医药数据分析师",
        careerPrompt: "我不想完全做临床，想转向医药企业里的数据分析与业务研究岗位。",
        goalText: "希望在 4 到 5 个月内完成转型所需的工具能力、行业理解和项目作品。",
        deadlineMonths: 5,
        energyLevel: 4,
        examWeek: true,
        resumeText: "有医学背景，做过临床数据整理和科研统计分析，会一些 Excel 和基础 Python，希望转向医药数据方向。"
      },
      selectedTags: ["research", "internship", "english"],
      schedule: [
        ["blocked", "study", "focus"],
        ["blocked", "blocked", "focus"],
        ["blocked", "study", "study"],
        ["blocked", "blocked", "focus"],
        ["blocked", "study", "study"],
        ["focus", "focus", "study"],
        ["study", "study", "focus"]
      ]
    }
  };

  const AI_KEYWORD_LIBRARY = [
    { pattern: /(后端|java|开发|程序|工程师|算法|测试|前端|运维|ai|数据工程)/i, track: "technical", blueprint: "技术岗位能力蓝图", traits: ["technical", "analytical", "project", "execution", "communication", "business"] },
    { pattern: /(产品|运营|用户研究|品牌|市场|新媒体|增长|策划)/i, track: "product", blueprint: "产品运营能力蓝图", traits: ["research", "communication", "branding", "execution", "analytical", "product"] },
    { pattern: /(数据|分析|咨询|投研|商业分析|bi|行业研究)/i, track: "analysis", blueprint: "分析决策能力蓝图", traits: ["analytical", "technical", "business", "communication", "execution", "research"] },
    { pattern: /(法务|律师|合规|公务员|选调生|事业编|公共管理)/i, track: "public", blueprint: "公共事务与规则型岗位蓝图", traits: ["writing", "communication", "research", "service", "execution", "leadership"] },
    { pattern: /(教师|辅导员|教培|教育|讲师)/i, track: "education", blueprint: "教育与培养岗位蓝图", traits: ["teaching", "communication", "service", "execution", "research", "leadership"] },
    { pattern: /(设计|视觉|工业设计|动画|交互|建筑)/i, track: "design", blueprint: "创意设计能力蓝图", traits: ["creativity", "project", "communication", "execution", "research", "branding"] },
    { pattern: /(医学|医药|护理|药学|健康管理)/i, track: "health", blueprint: "医疗健康职业蓝图", traits: ["domain", "research", "service", "analytical", "communication", "execution"] }
  ];

  const CAREER_TEMPLATE_LIBRARY = {
    technical: {
      strengths: ["系统思维", "问题拆解", "工程实现", "技术表达", "协作开发", "业务理解"],
      skillPool: [
        { id: "technical_foundation", name: "专业基础能力", short: "基础", target: 88, importance: 0.98, difficulty: 3, bucket: "foundation", deps: [], brief: "掌握岗位核心知识、术语和底层逻辑。" },
        { id: "tool_stack", name: "工具与技术栈", short: "工具", target: 84, importance: 0.92, difficulty: 3, bucket: "foundation", deps: [], brief: "熟悉该方向最常用的工具链和工作方式。" },
        { id: "project_execution", name: "项目实战能力", short: "项目", target: 90, importance: 1, difficulty: 4, bucket: "project", deps: ["technical_foundation", "tool_stack"], brief: "能够独立做出完整成果并形成案例。" },
        { id: "problem_solving", name: "问题分析与排障", short: "分析", target: 80, importance: 0.82, difficulty: 4, bucket: "growth", deps: ["technical_foundation"], brief: "遇到问题时能定位原因并提出解决方案。" },
        { id: "team_collaboration", name: "协作与沟通", short: "沟通", target: 76, importance: 0.74, difficulty: 2, bucket: "growth", deps: [], brief: "会汇报进度、对齐需求和解释技术方案。" },
        { id: "portfolio_expression", name: "成果表达", short: "表达", target: 86, importance: 0.9, difficulty: 3, bucket: "project", deps: ["project_execution"], brief: "把项目讲清楚、写清楚、展示清楚。" }
      ]
    },
    product: {
      strengths: ["洞察用户", "场景分析", "方案表达", "执行推进", "跨团队协作", "结果导向"],
      skillPool: [
        { id: "role_cognition", name: "岗位认知与行业理解", short: "认知", target: 82, importance: 0.84, difficulty: 2, bucket: "foundation", deps: [], brief: "理解这个岗位到底在解决什么问题。" },
        { id: "research_analysis", name: "用户 / 市场研究", short: "研究", target: 84, importance: 0.9, difficulty: 3, bucket: "foundation", deps: [], brief: "能够从用户、竞品和行业里提炼有效洞察。" },
        { id: "solution_design", name: "方案设计能力", short: "方案", target: 86, importance: 0.95, difficulty: 3, bucket: "growth", deps: ["research_analysis"], brief: "能把问题拆成可执行策略、PRD、活动或内容方案。" },
        { id: "data_feedback", name: "数据与复盘意识", short: "数据", target: 76, importance: 0.74, difficulty: 3, bucket: "growth", deps: [], brief: "会用指标和反馈修正方案，而不是只凭感觉。" },
        { id: "project_output", name: "项目与作品输出", short: "作品", target: 90, importance: 1, difficulty: 4, bucket: "project", deps: ["solution_design"], brief: "产出作品集、案例、活动结果或完整项目材料。" },
        { id: "stakeholder_communication", name: "表达与推动", short: "推动", target: 82, importance: 0.82, difficulty: 2, bucket: "project", deps: [], brief: "能清楚表达观点，并推动团队行动。" }
      ]
    },
    analysis: {
      strengths: ["数据意识", "研究能力", "逻辑推理", "业务判断", "结构化表达", "项目复盘"],
      skillPool: [
        { id: "analysis_foundation", name: "分析方法基础", short: "方法", target: 86, importance: 0.94, difficulty: 3, bucket: "foundation", deps: [], brief: "掌握基础分析框架、研究方法与判断逻辑。" },
        { id: "tool_use", name: "工具使用能力", short: "工具", target: 84, importance: 0.88, difficulty: 3, bucket: "foundation", deps: [], brief: "熟练使用分析、整理、可视化或研究工具。" },
        { id: "business_understanding", name: "业务 / 行业理解", short: "业务", target: 82, importance: 0.9, difficulty: 3, bucket: "growth", deps: [], brief: "能看懂行业问题，不只会跑数据或写报告。" },
        { id: "insight_output", name: "洞察提炼能力", short: "洞察", target: 88, importance: 0.96, difficulty: 4, bucket: "growth", deps: ["analysis_foundation"], brief: "能够把信息转成真正有价值的判断。" },
        { id: "case_project", name: "案例与项目经历", short: "案例", target: 90, importance: 1, difficulty: 4, bucket: "project", deps: ["tool_use", "business_understanding"], brief: "形成可展示的研究、分析或策略项目。" },
        { id: "reporting", name: "汇报表达", short: "汇报", target: 80, importance: 0.78, difficulty: 2, bucket: "project", deps: [], brief: "把分析结果讲给别人听，并让对方愿意行动。" }
      ]
    },
    public: {
      strengths: ["规则理解", "政策敏感度", "写作能力", "服务意识", "表达能力", "公共协作"],
      skillPool: [
        { id: "policy_foundation", name: "政策与岗位认知", short: "政策", target: 86, importance: 0.94, difficulty: 3, bucket: "foundation", deps: [], brief: "理解岗位规则、职责边界与评价标准。" },
        { id: "writing_expression", name: "写作与文稿表达", short: "写作", target: 88, importance: 0.96, difficulty: 3, bucket: "foundation", deps: [], brief: "具备结构化写作、材料整理和表达能力。" },
        { id: "research_judgment", name: "调研与判断", short: "调研", target: 80, importance: 0.8, difficulty: 3, bucket: "growth", deps: [], brief: "能查政策、做调研、提炼有效结论。" },
        { id: "interview_exam", name: "考试与面试准备", short: "备考", target: 84, importance: 0.88, difficulty: 4, bucket: "growth", deps: [], brief: "笔试、结构化面试、时政和案例表达都要同步准备。" },
        { id: "service_execution", name: "服务与执行", short: "执行", target: 82, importance: 0.82, difficulty: 2, bucket: "project", deps: [], brief: "能把复杂任务稳妥落地并对结果负责。" },
        { id: "public_profile", name: "个人材料与成果沉淀", short: "材料", target: 86, importance: 0.9, difficulty: 3, bucket: "project", deps: ["writing_expression"], brief: "形成简历、材料、案例和个人表达优势。" }
      ]
    },
    education: {
      strengths: ["沟通陪伴", "教学设计", "组织协调", "服务意识", "内容表达", "成长追踪"],
      skillPool: [
        { id: "education_cognition", name: "教育岗位认知", short: "认知", target: 82, importance: 0.84, difficulty: 2, bucket: "foundation", deps: [], brief: "理解岗位职责、对象特征与工作场景。" },
        { id: "teaching_design", name: "教学 / 活动设计", short: "设计", target: 86, importance: 0.92, difficulty: 3, bucket: "foundation", deps: [], brief: "能够设计课程、活动或成长陪伴方案。" },
        { id: "student_support", name: "沟通与陪伴能力", short: "陪伴", target: 84, importance: 0.88, difficulty: 2, bucket: "growth", deps: [], brief: "会倾听、反馈、辅导并建立信任关系。" },
        { id: "assessment_tracking", name: "评估与追踪", short: "评估", target: 76, importance: 0.72, difficulty: 3, bucket: "growth", deps: [], brief: "用结果和反馈调整教学或辅导策略。" },
        { id: "education_project", name: "教育项目产出", short: "项目", target: 88, importance: 1, difficulty: 4, bucket: "project", deps: ["teaching_design"], brief: "形成课程、活动、案例或辅导成果。" },
        { id: "professional_expression", name: "职业表达", short: "表达", target: 80, importance: 0.78, difficulty: 2, bucket: "project", deps: [], brief: "把教育理念、方法和成果讲清楚。" }
      ]
    },
    design: {
      strengths: ["审美表达", "创意构思", "用户理解", "作品打磨", "软件能力", "展示能力"],
      skillPool: [
        { id: "design_basis", name: "设计基础与审美", short: "基础", target: 86, importance: 0.92, difficulty: 3, bucket: "foundation", deps: [], brief: "构图、视觉语言、风格判断和设计逻辑。" },
        { id: "design_tools", name: "设计工具能力", short: "工具", target: 84, importance: 0.88, difficulty: 2, bucket: "foundation", deps: [], brief: "熟悉主流工具并形成稳定输出节奏。" },
        { id: "problem_solution", name: "设计问题解决", short: "方案", target: 82, importance: 0.84, difficulty: 3, bucket: "growth", deps: ["design_basis"], brief: "能从需求出发提出成体系设计方案。" },
        { id: "portfolio_creation", name: "作品集构建", short: "作品", target: 92, importance: 1, difficulty: 4, bucket: "project", deps: ["design_tools", "problem_solution"], brief: "形成高质量作品集与过程说明。" },
        { id: "storytelling", name: "讲述与展示", short: "展示", target: 80, importance: 0.8, difficulty: 2, bucket: "project", deps: [], brief: "把你的设计过程、思考与结果讲给别人听。" },
        { id: "industry_link", name: "行业与岗位适配", short: "行业", target: 78, importance: 0.74, difficulty: 2, bucket: "growth", deps: [], brief: "理解你想进入的细分方向需要什么。 " }
      ]
    },
    health: {
      strengths: ["专业背景", "服务伦理", "分析能力", "执行能力", "沟通能力", "行业理解"],
      skillPool: [
        { id: "health_domain", name: "专业领域认知", short: "领域", target: 90, importance: 0.96, difficulty: 3, bucket: "foundation", deps: [], brief: "基于医学、药学或健康领域形成专业优势。" },
        { id: "cross_tool", name: "跨界工具能力", short: "工具", target: 80, importance: 0.84, difficulty: 3, bucket: "foundation", deps: [], brief: "如果转型，需要补齐数据、运营、产品或研究工具。" },
        { id: "industry_insight", name: "行业理解", short: "行业", target: 82, importance: 0.86, difficulty: 3, bucket: "growth", deps: [], brief: "理解医院、药企、健康平台等不同场景需求。" },
        { id: "health_project", name: "项目与案例输出", short: "案例", target: 90, importance: 1, difficulty: 4, bucket: "project", deps: ["health_domain", "cross_tool"], brief: "形成能证明你跨界价值的案例或项目。" },
        { id: "stakeholder", name: "沟通与协同", short: "协同", target: 78, importance: 0.74, difficulty: 2, bucket: "project", deps: [], brief: "能和医生、患者、产品、数据或业务团队协同工作。" },
        { id: "career_story", name: "职业转型表达", short: "转型", target: 84, importance: 0.82, difficulty: 3, bucket: "project", deps: [], brief: "把“为什么转、凭什么能转成”讲清楚。" }
      ]
    }
  };

  const RESOURCE_LIBRARY = {
    technical: [
      { title: "岗位技能树拆解模板", platform: "Growth 内置", type: "AI 蓝图", fit: "用来理解这个技术岗位真正看重的能力结构" },
      { title: "项目案例仓库检索", platform: "GitHub", type: "开源项目", fit: "用来补齐项目实战和成果表达" },
      { title: "系统课程 / 专题视频", platform: "B站 / MOOC", type: "学习资源", fit: "用来建立专业基础与工具栈" }
    ],
    product: [
      { title: "竞品分析与案例模板", platform: "小红书 / 知乎", type: "案例库", fit: "适合快速建立行业观察与表达框架" },
      { title: "PRD / 原型 / 项目模板", platform: "GitHub / Figma 社区", type: "模板资源", fit: "适合产出作品集和完整方案" },
      { title: "用户研究与增长课程", platform: "B站 / 课程平台", type: "系统课程", fit: "适合建立用户、数据和方案能力" }
    ],
    analysis: [
      { title: "分析报告案例与方法论", platform: "知乎 / 公众号 / 行研平台", type: "案例资源", fit: "适合补齐结构化分析与报告能力" },
      { title: "SQL / Python / BI 工具训练", platform: "B站 / GitHub", type: "工具练习", fit: "适合补齐分析工具与项目实战" },
      { title: "行业洞察资料包", platform: "Growth AI 推荐", type: "行业资料", fit: "适合建立业务理解与判断框架" }
    ],
    public: [
      { title: "政策写作与材料框架", platform: "Growth AI 推荐", type: "写作模板", fit: "适合整理政策岗位材料与写作训练" },
      { title: "结构化面试题库", platform: "公开题库 / 视频平台", type: "面试资源", fit: "适合提升表达与答题逻辑" },
      { title: "公共事务案例拆解", platform: "时政平台 / 经验帖", type: "案例资源", fit: "适合形成现实场景判断能力" }
    ],
    education: [
      { title: "课程与活动设计模板", platform: "Growth 内置", type: "设计模板", fit: "适合建立教育项目产出框架" },
      { title: "教育沟通与案例视频", platform: "B站 / 教研社区", type: "实务资源", fit: "适合补齐陪伴与辅导能力" },
      { title: "学生成长追踪表", platform: "Growth AI 推荐", type: "追踪工具", fit: "适合形成复盘和评估习惯" }
    ],
    design: [
      { title: "作品集拆解样例", platform: "Behance / 小红书 / 站酷", type: "作品参考", fit: "适合对齐行业作品表达标准" },
      { title: "设计工具进阶训练", platform: "B站 / 官方社区", type: "技能课", fit: "适合补齐软件与流程能力" },
      { title: "案例表达模板", platform: "Growth AI 推荐", type: "表达模板", fit: "适合形成完整项目讲述链路" }
    ],
    health: [
      { title: "医药行业岗位地图", platform: "Growth AI 推荐", type: "行业蓝图", fit: "适合看清跨界方向与岗位要求" },
      { title: "数据 / 产品 / 运营跨界课程", platform: "B站 / MOOC", type: "跨界课程", fit: "适合补齐转型工具与方法" },
      { title: "医疗健康案例项目", platform: "GitHub / 公开数据平台", type: "案例项目", fit: "适合建立跨界项目作品" }
    ]
  };

  const ALGORITHM_NOTES = [
    {
      title: "1. 用户登录与独立数据库",
      summary: "每个账号在浏览器本地拥有自己的 IndexedDB 数据空间，保存画像、职业目标、方案历史和回访记录。",
      bullets: [
        "适合 GitHub Pages 纯静态部署。",
        "不同用户不会互相覆盖方案。",
        "后续可平滑替换为 Supabase / Firebase 云端数据库。"
      ]
    },
    {
      title: "2. 自由职业输入识别",
      summary: "Growth AI 不要求用户必须从固定岗位库里选，而是通过职业关键词和说明文本自动识别职业轨道。",
      bullets: [
        "先识别岗位属于技术、产品、分析、公共事务、教育、设计还是健康方向。",
        "再结合用户描述生成专属能力蓝图。",
        "如果是混合方向，会保留跨界特征并强调转型表达。"
      ]
    },
    {
      title: "3. 多学科多专业适配",
      summary: "系统先识别用户来自哪一类学科，再决定基础优势、迁移能力和需要补齐的核心板块。",
      bullets: [
        "工学偏工具与工程实现。",
        "文社科偏研究、写作、沟通与表达。",
        "医学与艺术等专业会保留原专业优势，再叠加目标岗位要求。"
      ]
    },
    {
      title: "4. AI 差距排序",
      summary: "优先级 = 重要性 × 差距程度 × (1 + 难度修正 + 依赖缺口修正 + 转型惩罚修正)。",
      bullets: [
        "用户越跨界，系统越会把“转型解释能力”和“作品 / 案例输出”前置。",
        "高重要性且当前分低的能力会自动升到前排。",
        "计划不是平均分配，而是集中火力补关键短板。"
      ]
    },
    {
      title: "5. 三层计划生成",
      summary: "年层定方向，月层定主题和产出，周层定时间块和任务类型，并插入复习与缓冲节点。",
      bullets: [
        "任何专业、任何职业方向都能用同一套结构生成计划。",
        "课表空档会决定计划密度与任务时长。",
        "考试周自动减负，防止计划理想化。"
      ]
    },
    {
      title: "6. AI 回访动态调整",
      summary: "系统根据完成度、阻力、自信度决定是减负、保持主线还是提前提速。",
      bullets: [
        "低完成度时减少并行技能数。",
        "高完成度时增加项目沉淀与投递准备。",
        "回访不是提示消息，而是直接影响下周计划结构。"
      ]
    }
  ];

  return {
    DAYS,
    PERIODS,
    SLOT_STATES,
    DISCIPLINES,
    GRADE_OPTIONS,
    CAREER_SUGGESTIONS,
    EXPERIENCE_TAGS,
    PRESETS,
    AI_KEYWORD_LIBRARY,
    CAREER_TEMPLATE_LIBRARY,
    RESOURCE_LIBRARY,
    ALGORITHM_NOTES
  };
})();
