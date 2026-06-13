(function () {
  // ── Growth AI API ──────────────────────────────────
  const API_BASE = window.location.origin + "/api";

  async function apiCall(path, body) {
    try {
      const res = await fetch(API_BASE + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("API " + res.status);
      return await res.json();
    } catch (e) {
      console.warn("API fallback to local:", e.message);
      return null;
    }
  }

  const {
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
  } = window.GrowthData;

  const DB_NAME = "growth-ai-studio-db";
  const DB_VERSION = 1;
  const USER_STORE = "users";
  const PLAN_STORE = "plans";

  const state = {
    db: null,
    authMode: "login",
    currentUser: null,
    activePreset: "java_sprint",
    schedule: clone(PRESETS.java_sprint.schedule),
    selectedTags: new Set(PRESETS.java_sprint.selectedTags),
    profile: null,
    gapReport: [],
    plan: null,
    resources: [],
    coach: null,
    history: [],
    lastAiTrace: []
  };

  const els = {
    authGate: document.getElementById("authGate"),
    appRoot: document.getElementById("appRoot"),
    authForm: document.getElementById("authForm"),
    authTabs: document.querySelectorAll("[data-auth-mode]"),
    authDisplayNameField: document.getElementById("authDisplayNameField"),
    authDisplayName: document.getElementById("authDisplayName"),
    authUsername: document.getElementById("authUsername"),
    authPassword: document.getElementById("authPassword"),
    authSubmitBtn: document.getElementById("authSubmitBtn"),
    demoLoginBtn: document.getElementById("demoLoginBtn"),
    currentUserBadge: document.getElementById("currentUserBadge"),
    logoutBtn: document.getElementById("logoutBtn"),
    saveVersionBtn: document.getElementById("saveVersionBtn"),
    newPlanBtn: document.getElementById("newPlanBtn"),
    workspaceSummary: document.getElementById("workspaceSummary"),
    historyList: document.getElementById("historyList"),
    presetRow: document.getElementById("presetRow"),
    studentGrade: document.getElementById("studentGrade"),
    studentDiscipline: document.getElementById("studentDiscipline"),
    majorSuggestionList: document.getElementById("majorSuggestionList"),
    careerSuggestionGrid: document.getElementById("careerSuggestionGrid"),
    profileForm: document.getElementById("profileForm"),
    deadlineMonths: document.getElementById("deadlineMonths"),
    deadlineValue: document.getElementById("deadlineValue"),
    energyLevel: document.getElementById("energyLevel"),
    energyValue: document.getElementById("energyValue"),
    examWeek: document.getElementById("examWeek"),
    timetableBoard: document.getElementById("timetableBoard"),
    budgetSummary: document.getElementById("budgetSummary"),
    experienceTags: document.getElementById("experienceTags"),
    algorithmList: document.getElementById("algorithmList"),
    dashboardStats: document.getElementById("dashboardStats"),
    radarChart: document.getElementById("radarChart"),
    profileSummary: document.getElementById("profileSummary"),
    strengthTags: document.getElementById("strengthTags"),
    gapOverview: document.getElementById("gapOverview"),
    gapList: document.getElementById("gapList"),
    annualRoadmap: document.getElementById("annualRoadmap"),
    monthlyPlan: document.getElementById("monthlyPlan"),
    weeklySchedule: document.getElementById("weeklySchedule"),
    resourceBoard: document.getElementById("resourceBoard"),
    completionRate: document.getElementById("completionRate"),
    completionValue: document.getElementById("completionValue"),
    difficultyRate: document.getElementById("difficultyRate"),
    difficultyValue: document.getElementById("difficultyValue"),
    confidenceRate: document.getElementById("confidenceRate"),
    confidenceValue: document.getElementById("confidenceValue"),
    coachSummary: document.getElementById("coachSummary"),
    coachTrend: document.getElementById("coachTrend"),
    heroGenerateBtn: document.getElementById("heroGenerateBtn"),
    heroHours: document.getElementById("heroHours"),
    heroFit: document.getElementById("heroFit"),
    heroGaps: document.getElementById("heroGaps"),
    aiConsole: document.getElementById("aiConsole"),
    toast: document.getElementById("toast")
  };

  bootstrap();

  async function bootstrap() {
    renderAlgorithmNotes();
    populateGradeOptions();
    populateDisciplineOptions();
    renderCareerSuggestions();
    renderPresetButtons();
    bindGlobalEvents();
    try {
      state.db = await openDatabase();
      await ensureDemoAccount();
      const rememberedUser = localStorage.getItem("growth-current-user");
      if (rememberedUser) {
        const user = await getUserByUsername(rememberedUser);
        if (user) {
          state.currentUser = user;
          await enterApp();
          return;
        }
      }
      renderAuthMode();
    } catch (error) {
      console.error(error);
      showToast("初始化数据库失败，请刷新页面重试");
    }
  }

  function bindGlobalEvents() {
    els.authTabs.forEach((button) => {
      button.addEventListener("click", () => {
        state.authMode = button.dataset.authMode;
        renderAuthMode();
      });
    });

    els.authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.authMode === "register") {
        await registerUser();
      } else {
        await loginUser();
      }
    });

    els.demoLoginBtn.addEventListener("click", async () => {
      const demoUser = await getUserByUsername("demo");
      if (!demoUser) {
        showToast("演示账号不存在，请刷新后重试");
        return;
      }
      state.currentUser = demoUser;
      await enterApp();
      showToast("已进入演示账号");
    });

    els.logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("growth-current-user");
      state.currentUser = null;
      state.history = [];
      els.appRoot.hidden = true;
      els.authGate.hidden = false;
      renderAuthMode();
    });

    els.saveVersionBtn.addEventListener("click", async () => {
      if (!state.currentUser || !state.plan || !state.profile) {
        showToast("先生成一套方案，再保存版本");
        return;
      }
      await saveCurrentPlan("手动保存");
    });

    els.newPlanBtn.addEventListener("click", () => {
      applyPreset(state.activePreset);
      showToast("已基于当前预设重置为新方案草稿");
    });

    els.profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      refreshPlan();
      await saveDraftPlan();
    });

    els.studentDiscipline.addEventListener("change", () => {
      populateMajorSuggestions();
    });

    els.deadlineMonths.addEventListener("input", () => {
      els.deadlineValue.textContent = `${els.deadlineMonths.value} 个月`;
    });

    els.energyLevel.addEventListener("input", () => {
      els.energyValue.textContent = `${els.energyLevel.value} / 5`;
    });

    els.examWeek.addEventListener("change", () => {
      renderBudgetSummary();
      refreshPlan(false);
    });

    els.completionRate.addEventListener("input", updateCoachFromInputs);
    els.difficultyRate.addEventListener("input", updateCoachFromInputs);
    els.confidenceRate.addEventListener("input", updateCoachFromInputs);

    els.heroGenerateBtn.addEventListener("click", () => {
      document.getElementById("plannerSection").scrollIntoView({ behavior: "smooth", block: "start" });
      refreshPlan();
    });
  }

  function renderAuthMode() {
    els.authTabs.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.authMode === state.authMode);
    });
    const isRegister = state.authMode === "register";
    els.authDisplayNameField.hidden = !isRegister;
    els.authSubmitBtn.textContent = isRegister ? "创建我的 Growth 空间" : "进入我的 Growth 空间";
  }

  async function registerUser() {
    const username = els.authUsername.value.trim().toLowerCase();
    const password = els.authPassword.value.trim();
    const displayName = els.authDisplayName.value.trim() || username;
    if (!username || !password) {
      showToast("请先填写用户名和密码");
      return;
    }
    const existing = await getUserByUsername(username);
    if (existing) {
      showToast("这个用户名已经存在，请换一个");
      return;
    }
    const user = {
      username,
      password,
      displayName,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await putRecord(USER_STORE, user);
    state.currentUser = user;
    await enterApp();
    showToast("注册成功，已进入你的专属空间");
  }

  async function loginUser() {
    const username = els.authUsername.value.trim().toLowerCase();
    const password = els.authPassword.value.trim();
    const user = await getUserByUsername(username);
    if (!user || user.password !== password) {
      showToast("用户名或密码不正确");
      return;
    }
    state.currentUser = user;
    await enterApp();
    showToast("登录成功");
  }

  async function enterApp() {
    localStorage.setItem("growth-current-user", state.currentUser.username);
    els.authGate.hidden = true;
    els.appRoot.hidden = false;
    els.currentUserBadge.textContent = `${state.currentUser.displayName} · 本地数据库已连接`;
    renderPresetButtons();
    renderTimetable();
    renderExperienceTags();
    renderWorkspaceSummary();
    await loadUserHistory();
    await loadLatestDraftOrPreset();
  }

  async function ensureDemoAccount() {
    const demoUser = await getUserByUsername("demo");
    if (demoUser) {
      return;
    }
    await putRecord(USER_STORE, {
      username: "demo",
      password: "demo123",
      displayName: "Growth 演示账号",
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  function populateGradeOptions() {
    els.studentGrade.innerHTML = GRADE_OPTIONS
      .map((grade) => `<option value="${grade}">${grade}</option>`)
      .join("");
  }

  function populateDisciplineOptions() {
    els.studentDiscipline.innerHTML = DISCIPLINES
      .map((discipline) => `<option value="${discipline.id}">${discipline.label}</option>`)
      .join("");
    populateMajorSuggestions();
  }

  function populateMajorSuggestions() {
    const selectedDiscipline = DISCIPLINES.find((item) => item.id === els.studentDiscipline.value) || DISCIPLINES[0];
    els.majorSuggestionList.innerHTML = selectedDiscipline.majors
      .map((major) => `<option value="${major}"></option>`)
      .join("");
  }

  function renderCareerSuggestions() {
    els.careerSuggestionGrid.innerHTML = CAREER_SUGGESTIONS
      .map((career) => `<button type="button" class="tag-chip career-chip" data-career="${career}">${career}</button>`)
      .join("");
    els.careerSuggestionGrid.querySelectorAll("[data-career]").forEach((button) => {
      button.addEventListener("click", () => {
        document.getElementById("careerTarget").value = button.dataset.career;
        refreshPlan(false);
      });
    });
  }

  function renderPresetButtons() {
    els.presetRow.innerHTML = Object.entries(PRESETS)
      .map(([id, preset]) => `
        <button class="preset-btn ${id === state.activePreset ? "is-active" : ""}" type="button" data-preset="${id}">
          <strong>${preset.label}</strong>
          <span>${preset.subtitle}</span>
        </button>
      `)
      .join("");

    els.presetRow.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => applyPreset(button.dataset.preset));
    });
  }

  function applyPreset(presetId) {
    state.activePreset = presetId;
    const preset = PRESETS[presetId];
    Object.entries(preset.fields).forEach(([key, value]) => {
      const input = document.getElementById(key);
      if (!input) return;
      if (input.type === "checkbox") {
        input.checked = Boolean(value);
      } else {
        input.value = value;
      }
    });
    state.schedule = clone(preset.schedule);
    state.selectedTags = new Set(preset.selectedTags);
    populateMajorSuggestions();
    els.deadlineValue.textContent = `${preset.fields.deadlineMonths} 个月`;
    els.energyValue.textContent = `${preset.fields.energyLevel} / 5`;
    renderPresetButtons();
    renderTimetable();
    renderExperienceTags();
    refreshPlan();
  }

  function renderTimetable() {
    const header = `
      <div class="timetable-header">
        <span>时段</span>
        ${DAYS.map((day) => `<span>${day}</span>`).join("")}
      </div>
    `;
    const rows = PERIODS.map((period, periodIndex) => `
      <div class="timetable-row">
        <div class="period-label">${period.label}<br><small>${period.time}</small></div>
        ${DAYS.map((_, dayIndex) => renderSlotButton(dayIndex, periodIndex)).join("")}
      </div>
    `).join("");
    els.timetableBoard.innerHTML = header + rows;
    els.timetableBoard.querySelectorAll("[data-slot]").forEach((button) => {
      button.addEventListener("click", () => {
        const [dayIndex, periodIndex] = button.dataset.slot.split("-").map(Number);
        cycleScheduleState(dayIndex, periodIndex);
        renderTimetable();
        renderBudgetSummary();
        refreshPlan(false);
      });
    });
    renderBudgetSummary();
  }

  function renderSlotButton(dayIndex, periodIndex) {
    const slotState = SLOT_STATES[state.schedule[dayIndex][periodIndex]];
    return `
      <button class="slot-btn ${slotState.className}" type="button" data-slot="${dayIndex}-${periodIndex}">
        ${slotState.label}
        <small>${slotState.hours}h</small>
      </button>
    `;
  }

  function cycleScheduleState(dayIndex, periodIndex) {
    const order = ["blocked", "study", "focus"];
    const current = state.schedule[dayIndex][periodIndex];
    const next = order[(order.indexOf(current) + 1) % order.length];
    state.schedule[dayIndex][periodIndex] = next;
  }

  function renderBudgetSummary() {
    const scheduleStats = computeScheduleStats(state.schedule, els.examWeek.checked);
    els.budgetSummary.innerHTML = `
      <span class="summary-pill">每周可用 ${scheduleStats.weeklyHours.toFixed(1)} h</span>
      <span class="summary-pill">高专注 ${scheduleStats.focusHours.toFixed(1)} h</span>
      <span class="summary-pill">可用时段 ${scheduleStats.availableSlots.length} 个</span>
      <span class="summary-pill">考试周系数 ${scheduleStats.examLoadFactor.toFixed(2)}</span>
    `;
  }

  function renderExperienceTags() {
    els.experienceTags.innerHTML = EXPERIENCE_TAGS.map((tag) => `
      <button class="tag-chip ${state.selectedTags.has(tag.id) ? "is-selected" : ""}" type="button" data-tag="${tag.id}">
        ${tag.label}
      </button>
    `).join("");
    els.experienceTags.querySelectorAll("[data-tag]").forEach((button) => {
      button.addEventListener("click", () => {
        const tagId = button.dataset.tag;
        if (state.selectedTags.has(tagId)) {
          state.selectedTags.delete(tagId);
        } else {
          state.selectedTags.add(tagId);
        }
        renderExperienceTags();
        refreshPlan(false);
      });
    });
  }

  function renderAlgorithmNotes() {
    els.algorithmList.innerHTML = ALGORITHM_NOTES.map((item) => `
      <article>
        <h3>${item.title}</h3>
        <p>${item.summary}</p>
        <ul>${item.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}</ul>
      </article>
    `).join("");
  }

  async function refreshPlan(scrollToDashboard = false) {
    const formData = readFormData();
    showAILoading();

    // ── Try Growth AI API first ──────────────────────
    const apiResult = await callGrowthAI(formData);

    if (apiResult) {
      // Real AI response
      state.profile = apiResult.profile;
      state.gapReport = apiResult.gapReport;
      state.plan = apiResult.plan;
      state.resources = apiResult.resources;
      state.lastAiTrace = apiResult.trace || [];
      renderAIConsole(apiResult.trace || []);
    } else {
      // ── Fallback to local mock AI ──────────────────
      const aiRole = buildDynamicCareerBlueprint(formData);
      const profile = buildProfile(formData, aiRole);
      const gapReport = buildGapReport(profile.skillScores, aiRole);
      const plan = buildLearningPlan(formData, profile, aiRole, gapReport);
      const resources = buildResourcePlan(aiRole, gapReport, plan);
      state.profile = profile;
      state.gapReport = gapReport;
      state.plan = plan;
      state.resources = resources;
      state.lastAiTrace = aiRole.trace;
      renderAIConsole(aiRole.trace);
    }

    renderWorkspaceSummary();
    renderDashboardWithState();
    renderGapAnalysisWithState();
    renderPlanner(state.plan);
    renderResources(state.resources);
    updateCoachFromInputs();
    if (scrollToDashboard) {
      document.getElementById("dashboardSection").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function showAILoading() {
    const el = document.getElementById("aiConsole");
    if (el) el.innerHTML = "<p style='color:var(--muted);'>正在连接 Growth AI 引擎...</p>";
  }

  async function callGrowthAI(formData) {
    // Step 1: Build profile
    const profileRes = await apiCall("/profile/build", {
      resume_text: formData.resumeText || "",
      schedule_text: JSON.stringify(formData.schedule || {}),
      user_id: state.currentUser?.id || "demo"
    });
    if (!profileRes || !profileRes.success) return null;
    const profile = profileRes.profile;

    // Step 2: Analyze gaps
    const gapRes = await apiCall("/analyze", {
      profile: profile,
      position_name: formData.careerTarget || "自定义职业目标",
      jd_text: formData.careerPrompt || ""
    });
    if (!gapRes || !gapRes.success) return null;

    // Step 3: Generate plan
    const planRes = await apiCall("/plan/generate", {
      profile: profile,
      gap_report: gapRes.gaps || [],
      position_name: formData.careerTarget || "自定义职业目标",
      target_date: (formData.deadlineMonths || 6) + "个月后"
    });
    if (!planRes || !planRes.success) return null;

    return {
      profile: {
        scheduleStats: profile,
        skillScores: {},
        roleFit: gapRes.overall_match || 0,
        strengths: [],
        latentStrengths: [],
        disciplineIndex: 75,
        readinessNarrative: gapRes.summary || "",
        availabilityNarrative: "AI 已分析你的时间分配"
      },
      gapReport: (gapRes.gaps || []).map(g => ({
        id: g.skill_id || g.skill_name,
        skillName: g.skill_name,
        category: g.category || "",
        currentLevel: g.current_level || 0,
        targetLevel: g.target_level || 80,
        importance: g.importance || 0.5,
        gapScore: g.gap_score || 0,
        severity: g.severity || "moderate",
        evidence: g.evidence || "",
        recommendedAction: g.recommended_action || ""
      })),
      plan: (planRes.growth_plan || {}).yearly_plan || planRes.growth_plan || {},
      resources: [],
      trace: [
        "AI 画像构建完成",
        "技能差距分析完成 (" + (gapRes.gaps || []).length + " 项)",
        "学习路径生成完成",
        "匹配度: " + (gapRes.overall_match || 0) + "%"
      ]
    };
  }

  function renderDashboardWithState() {
    const formData = readFormData();
    const aiRole = { label: formData.careerTarget || "自定义", skills: [], strengths: [], trace: state.lastAiTrace };
    renderDashboard(formData, aiRole, state.profile, state.gapReport);
  }

  function renderGapAnalysisWithState() {
    const formData = readFormData();
    const aiRole = { label: formData.careerTarget || "自定义", skills: (state.gapReport || []).map(g => ({
      id: g.id || g.skillName, name: g.skillName
    })) };
    renderGapAnalysis(aiRole, state.gapReport);
  }

  function readFormData() {
    return {
      studentName: document.getElementById("studentName").value.trim(),
      studentGrade: els.studentGrade.value,
      studentDiscipline: els.studentDiscipline.value,
      studentMajor: document.getElementById("studentMajor").value.trim(),
      careerTarget: document.getElementById("careerTarget").value.trim(),
      careerPrompt: document.getElementById("careerPrompt").value.trim(),
      goalText: document.getElementById("goalText").value.trim(),
      deadlineMonths: Number(els.deadlineMonths.value),
      energyLevel: Number(els.energyLevel.value),
      examWeek: els.examWeek.checked,
      resumeText: document.getElementById("resumeText").value.trim(),
      selectedTags: Array.from(state.selectedTags),
      schedule: clone(state.schedule)
    };
  }

  function buildDynamicCareerBlueprint(formData) {
    const text = `${formData.careerTarget} ${formData.careerPrompt} ${formData.goalText}`.toLowerCase();
    const discipline = DISCIPLINES.find((item) => item.id === formData.studentDiscipline);
    const matched = AI_KEYWORD_LIBRARY.find((item) => item.pattern.test(text)) || AI_KEYWORD_LIBRARY.find((item) => item.track === "analysis");
    const template = CAREER_TEMPLATE_LIBRARY[matched.track];
    const roleLabel = formData.careerTarget || "自定义职业目标";
    const majorBias = inferMajorBias(formData.studentMajor, formData.studentDiscipline);

    const skills = template.skillPool.map((skill, index) => ({
      ...skill,
      target: clamp(skill.target + majorBias.targetDelta + (index === 0 ? 0 : formData.deadlineMonths < 5 ? 2 : 0), 70, 95)
    }));

    const trace = [
      `识别目标职业：${roleLabel}`,
      `AI 判断职业轨道：${matched.blueprint}`,
      `识别用户学科：${discipline ? discipline.label : "未分类"} · 专业：${formData.studentMajor || "未填写"}`,
      `核心优势推断：${majorBias.summary}`,
      `计划策略：${formData.deadlineMonths <= 5 ? "短周期冲刺型" : "稳步成长型"} · ${formData.examWeek ? "考试周减负已开启" : "常规节奏"}`
    ];

    return {
      id: slugify(roleLabel) || "custom-career",
      label: roleLabel,
      track: matched.track,
      blueprint: matched.blueprint,
      majorBias,
      strengths: template.strengths,
      skills,
      trace
    };
  }

  function inferMajorBias(major, disciplineId) {
    const text = `${major} ${disciplineId}`.toLowerCase();
    if (/(计算机|软件|人工智能|数据|统计|数学)/.test(text)) {
      return { targetDelta: 0, scoreBoosts: { technical: 14, analytical: 12, project: 6 }, summary: "理工与数据基础较强，适合快速建立工具能力和结构化分析能力" };
    }
    if (/(法学|新闻|汉语言|社会|政治|历史|哲学|公共管理)/.test(text)) {
      return { targetDelta: 1, scoreBoosts: { communication: 14, research: 12, writing: 12 }, summary: "写作、调研与表达优势明显，适合走研究、产品、公共事务与教育方向" };
    }
    if (/(市场|管理|金融|经济|会计|商务)/.test(text)) {
      return { targetDelta: 0, scoreBoosts: { business: 14, analytical: 8, execution: 10 }, summary: "商业理解和执行意识较强，适合运营、品牌、咨询与分析方向" };
    }
    if (/(艺术|设计|动画|视觉|数字媒体)/.test(text)) {
      return { targetDelta: 2, scoreBoosts: { creativity: 16, branding: 10, project: 6 }, summary: "创意表达和视觉能力有天然优势，适合设计、品牌、内容与产品方向" };
    }
    if (/(医学|护理|药学|临床|健康)/.test(text)) {
      return { targetDelta: 2, scoreBoosts: { domain: 16, service: 12, research: 8 }, summary: "专业领域认知深，适合医疗、健康、医药与跨界分析方向" };
    }
    return { targetDelta: 0, scoreBoosts: { learning: 8, communication: 6, execution: 6 }, summary: "具备可迁移潜力，适合通过项目和作品把能力显性化" };
  }

  function buildProfile(formData, aiRole) {
    const scheduleStats = computeScheduleStats(formData.schedule, formData.examWeek);
    const skillScores = inferSkillScores(formData, aiRole, scheduleStats);
    const roleFit = computeRoleFit(skillScores, aiRole.skills);
    const strengths = sortEntries(skillScores)
      .slice(0, 4)
      .map(([skillId, score]) => ({
        skillId,
        score,
        label: aiRole.skills.find((skill) => skill.id === skillId).name
      }));
    const latentStrengths = deriveLatentStrengths(formData, aiRole);
    const disciplineIndex = clamp(Math.round(scheduleStats.focusHours * 3 + scheduleStats.availableSlots.length * 1.5 + formData.energyLevel * 8), 30, 96);
    return {
      scheduleStats,
      skillScores,
      roleFit,
      strengths,
      latentStrengths,
      disciplineIndex,
      readinessNarrative: roleFit >= 76
        ? "你已经有比较清晰的职业迁移基础，接下来最重要的是把能力沉淀成可展示成果。"
        : roleFit >= 58
          ? "你处在“有潜力但缺闭环”的阶段，Growth AI 更建议你先集中补齐 2 到 3 个关键能力。"
          : "你当前更适合走系统补齐路线，不求学得多，而要优先学得准、学得能落地。",
      availabilityNarrative: `系统识别到你每周约有 ${scheduleStats.weeklyHours.toFixed(1)} 小时可支配学习时间，其中 ${scheduleStats.focusHours.toFixed(1)} 小时属于高专注时段，非常适合安排关键能力与项目任务。`
    };
  }

  function computeScheduleStats(schedule, examWeek) {
    const availableSlots = [];
    let weeklyHours = 0;
    let focusHours = 0;
    const examLoadFactor = examWeek ? 0.82 : 1;
    schedule.forEach((periods, dayIndex) => {
      periods.forEach((stateKey, periodIndex) => {
        const slotState = SLOT_STATES[stateKey];
        const hours = slotState.hours * examLoadFactor;
        weeklyHours += hours;
        if (stateKey === "focus") {
          focusHours += hours;
        }
        if (stateKey !== "blocked") {
          availableSlots.push({
            id: `${dayIndex}-${periodIndex}`,
            dayIndex,
            day: DAYS[dayIndex],
            periodIndex,
            periodLabel: `${DAYS[dayIndex]} ${PERIODS[periodIndex].label}`,
            time: PERIODS[periodIndex].time,
            stateKey,
            hours,
            energy: slotState.energy
          });
        }
      });
    });
    return { weeklyHours, focusHours, availableSlots, examLoadFactor };
  }

  function inferSkillScores(formData, aiRole, scheduleStats) {
    const scores = {};
    aiRole.skills.forEach((skill) => {
      scores[skill.id] = 26;
    });

    const resume = normalizeText(formData.resumeText);
    const prompt = normalizeText(formData.careerPrompt);
    const gradeBoost = {
      "大一": 0,
      "大二": 4,
      "大三": 8,
      "大四": 10,
      "研一": 10,
      "研二": 12,
      "研三": 14,
      "博士": 16
    }[formData.studentGrade] || 6;

    Object.entries(aiRole.majorBias.scoreBoosts).forEach(([trait, bonus]) => {
      aiRole.skills.forEach((skill) => {
        if (skill.id.includes(trait) || skill.brief.includes(trait)) {
          scores[skill.id] += bonus;
        }
      });
    });

    EXPERIENCE_TAGS.forEach((tag) => {
      if (!state.selectedTags.has(tag.id)) return;
      Object.entries(tag.bonuses).forEach(([trait, bonus]) => {
        aiRole.skills.forEach((skill) => {
          if (skill.id.includes(trait) || skill.brief.includes(trait) || skill.name.includes(mapTraitToName(trait))) {
            scores[skill.id] += bonus;
          }
        });
      });
    });

    const keywordTable = [
      { pattern: /(项目|案例|作品集|作品)/, target: ["project", "case", "portfolio"], bonus: 12 },
      { pattern: /(沟通|汇报|表达|演讲|主持)/, target: ["communication", "reporting", "stakeholder", "expression"], bonus: 10 },
      { pattern: /(研究|调研|论文|问卷|访谈)/, target: ["research", "analysis"], bonus: 10 },
      { pattern: /(数据|python|sql|excel|tableau|统计)/, target: ["analysis", "tool", "technical"], bonus: 10 },
      { pattern: /(社团|组织|策划|运营)/, target: ["execution", "leadership", "solution", "communication"], bonus: 8 },
      { pattern: /(实习|公司|业务)/, target: ["business", "project", "industry"], bonus: 10 },
      { pattern: /(设计|原型|视觉|审美)/, target: ["design", "creativity", "portfolio"], bonus: 10 },
      { pattern: /(教学|助教|辅导|培训)/, target: ["teaching", "service", "communication"], bonus: 10 }
    ];

    keywordTable.forEach((rule) => {
      if (!rule.pattern.test(`${resume} ${prompt}`)) return;
      aiRole.skills.forEach((skill) => {
        if (rule.target.some((token) => skill.id.includes(token) || skill.name.includes(mapTraitToName(token)) || skill.brief.includes(mapTraitToName(token)))) {
          scores[skill.id] += rule.bonus;
        }
      });
    });

    aiRole.skills.forEach((skill) => {
      scores[skill.id] += skill.bucket === "project" ? Math.round(scheduleStats.weeklyHours * 0.3) : Math.round(scheduleStats.focusHours * 0.25);
      scores[skill.id] += Math.round(gradeBoost * (skill.bucket === "foundation" ? 0.8 : 0.65));
      scores[skill.id] = clamp(scores[skill.id], 18, 92);
    });

    return scores;
  }

  function mapTraitToName(trait) {
    const table = {
      analytical: "分析",
      technical: "工具",
      project: "项目",
      communication: "沟通",
      business: "业务",
      research: "研究",
      writing: "写作",
      service: "服务",
      leadership: "领导",
      creativity: "创意",
      branding: "品牌",
      teaching: "教学",
      solution: "方案",
      reporting: "汇报",
      design: "设计",
      portfolio: "作品"
    };
    return table[trait] || trait;
  }

  function buildGapReport(skillScores, aiRole) {
    return aiRole.skills.map((skill) => {
      const current = skillScores[skill.id] || 0;
      const gap = Math.max(skill.target - current, 0);
      const gapRatio = gap / 100;
      const missingDeps = skill.deps.filter((depId) => (skillScores[depId] || 0) < 60).length;
      const transitionPenalty = /(project|portfolio|story|profile|career|public|health)/.test(skill.id) ? 0.08 : 0;
      const priorityScore = Math.round(
        skill.importance * gapRatio * (1 + skill.difficulty * 0.08 + missingDeps * 0.06 + transitionPenalty) * 100
      );
      return {
        ...skill,
        current,
        gap,
        gapRatio,
        missingDeps,
        priorityScore
      };
    }).sort((left, right) => right.priorityScore - left.priorityScore);
  }

  function computeRoleFit(skillScores, skills) {
    const totalWeight = skills.reduce((sum, skill) => sum + skill.importance, 0);
    const weighted = skills.reduce((sum, skill) => sum + Math.min((skillScores[skill.id] || 0) / skill.target, 1) * skill.importance, 0);
    return Math.round((weighted / totalWeight) * 100);
  }

  function deriveLatentStrengths(formData, aiRole) {
    const values = [];
    const resume = normalizeText(formData.resumeText);
    if (/(比赛|竞赛|hackathon)/.test(resume)) values.push("高压情境下的目标推进能力");
    if (/(调研|论文|科研)/.test(resume)) values.push("研究和结构化分析能力");
    if (/(运营|策划|社团)/.test(resume)) values.push("组织协作与执行推进能力");
    if (/(项目|作品|案例)/.test(resume)) values.push("成果导向和项目表达意识");
    if (!values.length) values.push(`在 ${aiRole.label} 方向具有可迁移成长潜力`);
    return values.slice(0, 4);
  }

  function buildLearningPlan(formData, profile, aiRole, gapReport) {
    const phases = allocatePhases(formData.deadlineMonths, aiRole);
    const monthlyPlan = buildMonthlyPlan(formData, aiRole, gapReport, phases);
    const weeklyPlan = buildWeeklyPlan(formData, gapReport, monthlyPlan[0], profile.scheduleStats);
    return {
      annualPhases: phases,
      monthlyPlan,
      weeklyPlan,
      highlights: {
        plannedHours: weeklyPlan.assignedTasks.reduce((sum, task) => sum + task.hours, 0),
        reviewCount: weeklyPlan.assignedTasks.filter((task) => task.mode === "复习").length
      }
    };
  }

  function allocatePhases(totalMonths, aiRole) {
    const phaseOne = Math.max(1, Math.round(totalMonths * 0.35));
    const phaseTwo = Math.max(1, Math.round(totalMonths * 0.4));
    const phaseThree = Math.max(1, totalMonths - phaseOne - phaseTwo);
    return [
      {
        title: "Phase 1 · 能力底座搭建",
        months: phaseOne,
        milestone: `先理解 ${aiRole.label} 的能力结构，并补齐最核心的基础能力`,
        outcome: "完成基础技能梳理、关键概念清单和第一份小成果",
        focuses: aiRole.skills.slice(0, 2).map((item) => item.name)
      },
      {
        title: "Phase 2 · 项目 / 案例沉淀",
        months: phaseTwo,
        milestone: "把能力变成可展示的案例、作品或实战经历",
        outcome: "完成至少 1 个完整项目、作品集或案例报告",
        focuses: aiRole.skills.filter((item) => item.bucket !== "foundation").slice(0, 3).map((item) => item.name)
      },
      {
        title: "Phase 3 · 投递与转化",
        months: phaseThree,
        milestone: "提升面试表达、岗位匹配度和投递成功率",
        outcome: "完成简历打磨、面试话术和定向投递准备",
        focuses: aiRole.skills.filter((item) => item.bucket === "project").slice(0, 2).map((item) => item.name)
      }
    ];
  }

  function buildMonthlyPlan(formData, aiRole, gapReport, phases) {
    const plans = [];
    let phaseIndex = 0;
    let phaseProgress = 0;
    for (let monthIndex = 0; monthIndex < formData.deadlineMonths; monthIndex += 1) {
      if (phaseProgress >= phases[phaseIndex].months && phaseIndex < phases.length - 1) {
        phaseIndex += 1;
        phaseProgress = 0;
      }
      const phase = phases[phaseIndex];
      const focus = gapReport.slice(monthIndex % 2, monthIndex % 2 + 2).map((item) => item.name);
      plans.push({
        monthIndex: monthIndex + 1,
        title: `第 ${monthIndex + 1} 月`,
        phase: phase.title,
        load: formData.examWeek && monthIndex === 0 ? "减负模式" : monthIndex === formData.deadlineMonths - 1 ? "冲刺模式" : "稳步推进",
        focus,
        output: monthIndex < 2 ? "输出学习地图 / 知识结构图" : monthIndex < formData.deadlineMonths - 1 ? "完成项目案例或作品雏形" : "完成简历、话术与投递包",
        note: phase.milestone
      });
      phaseProgress += 1;
    }
    return plans;
  }

  function buildWeeklyPlan(formData, gapReport, currentMonth, scheduleStats) {
    const taskQueue = [];
    gapReport.slice(0, 3).forEach((item, index) => {
      taskQueue.push({
        title: `${item.name} 核心学习`,
        mode: "新知",
        skillId: item.id,
        hours: index === 0 ? 3 : 2,
        deliverable: `形成 1 份关于 ${item.short} 的结构化笔记`
      });
      taskQueue.push({
        title: `${item.name} 实操 / 小练习`,
        mode: "实操",
        skillId: item.id,
        hours: 2,
        deliverable: `完成 1 个与 ${item.name} 相关的小任务`
      });
    });
    taskQueue.push({
      title: "项目 / 案例推进",
      mode: "项目",
      skillId: gapReport[0].id,
      hours: 3,
      deliverable: currentMonth.output
    });
    taskQueue.push({
      title: "周回访与复盘",
      mode: "复盘",
      skillId: "",
      hours: 2,
      deliverable: "总结收获、记录阻力并调整下周重点"
    });

    const assignments = assignTasksToSlots(scheduleStats.availableSlots, taskQueue, formData.examWeek);
    return {
      assignedTasks: assignments,
      grid: buildScheduleGrid(assignments, formData.schedule)
    };
  }

  function assignTasksToSlots(availableSlots, taskQueue, examWeek) {
    const slotPool = availableSlots.map((slot) => ({ ...slot, assigned: false }));
    const assignments = [];
    taskQueue.forEach((task) => {
      const candidate = slotPool
        .filter((slot) => !slot.assigned)
        .sort((left, right) => right.energy - left.energy || left.dayIndex - right.dayIndex || left.periodIndex - right.periodIndex)[0];
      if (!candidate) return;
      candidate.assigned = true;
      assignments.push({
        ...candidate,
        title: task.title,
        mode: task.mode,
        skillId: task.skillId,
        hours: candidate.hours,
        deliverable: task.deliverable,
        stateClass: task.mode === "复习" ? "is-review" : candidate.stateKey === "focus" ? "is-focus" : ""
      });
      if (task.mode === "新知") {
        const reviewSlot = slotPool.find((slot) => !slot.assigned && slot.dayIndex >= candidate.dayIndex + 1);
        if (reviewSlot) {
          reviewSlot.assigned = true;
          assignments.push({
            ...reviewSlot,
            title: `${task.title} 复习回看`,
            mode: "复习",
            skillId: task.skillId,
            hours: reviewSlot.hours,
            deliverable: "回顾重点并修正理解偏差",
            stateClass: "is-review"
          });
        }
      }
    });

    slotPool.filter((slot) => !slot.assigned).forEach((slot, index) => {
      assignments.push({
        ...slot,
        title: examWeek && index === 0 ? "考试周缓冲" : slot.stateKey === "focus" ? "弹性强化时间" : "轻量整理 / 休息",
        mode: examWeek && index === 0 ? "缓冲" : slot.stateKey === "focus" ? "强化" : "整理",
        skillId: "",
        hours: slot.hours,
        deliverable: examWeek && index === 0 ? "保留给不确定任务与减负" : slot.stateKey === "focus" ? "补齐拖延任务或加深练习" : "整理笔记、回收精力",
        stateClass: slot.stateKey === "focus" ? "is-focus" : ""
      });
    });
    return assignments.sort((left, right) => left.dayIndex - right.dayIndex || left.periodIndex - right.periodIndex);
  }

  function buildScheduleGrid(assignments, schedule) {
    return DAYS.map((day, dayIndex) => ({
      day,
      slots: PERIODS.map((period, periodIndex) => {
        const slotState = schedule[dayIndex][periodIndex];
        const assignment = assignments.find((item) => item.dayIndex === dayIndex && item.periodIndex === periodIndex);
        return {
          periodLabel: `${period.label} ${period.time}`,
          slotState,
          assignment: assignment || {
            title: "课程 / 已占用",
            mode: "锁定",
            deliverable: "不安排学习任务",
            stateClass: "is-blocked"
          }
        };
      })
    }));
  }

  function buildResourcePlan(aiRole, gapReport, plan) {
    const baseResources = RESOURCE_LIBRARY[aiRole.track] || RESOURCE_LIBRARY.analysis;
    return gapReport.slice(0, 4).map((gap, index) => ({
      skillName: gap.name,
      brief: gap.brief,
      resources: baseResources.map((item, resourceIndex) => ({
        title: `${item.title} · ${gap.short}`,
        platform: item.platform,
        type: item.type,
        difficulty: clamp(2 + index + resourceIndex, 1, 5),
        duration: 45 + index * 25 + resourceIndex * 15,
        score: clamp(92 - index * 6 - resourceIndex * 4, 70, 98),
        highlight: item.fit,
        reason: `Growth AI 判断你当前最需要补的是「${gap.name}」，所以优先推荐更适合当前阶段的 ${item.type} 资源，用来支撑本周与本月的关键目标。`,
        url: "#"
      })).slice(0, 2)
    }));
  }

  function updateCoachFromInputs() {
    els.completionValue.textContent = `${els.completionRate.value}%`;
    els.difficultyValue.textContent = `${els.difficultyRate.value} / 100`;
    els.confidenceValue.textContent = `${els.confidenceRate.value} / 100`;
    if (!state.plan || !state.profile) return;
    const completion = Number(els.completionRate.value);
    const difficulty = Number(els.difficultyRate.value);
    const confidence = Number(els.confidenceRate.value);
    state.coach = buildCoachOutput(state.profile, state.gapReport, completion, difficulty, confidence);
    renderCoach(state.coach);
  }

  function buildCoachOutput(profile, gapReport, completion, difficulty, confidence) {
    let strategy = "保持主线";
    let loadDelta = "下周维持当前学习负荷";
    let actionList = [];

    if (completion < 60 || difficulty > 72) {
      strategy = "减负稳住";
      loadDelta = "减少并行目标，优先保住前 2 个高优先级差距";
      actionList = [
        "将并行学习重点从 3 个缩减为 2 个",
        "提高复习时段比重，避免学了就忘",
        "将项目任务拆成更小里程碑，优先完成可见成果"
      ];
    } else if (completion > 85 && confidence > 72) {
      strategy = "提前提速";
      loadDelta = "增加 1 个项目深化时段和 1 个职业表达任务";
      actionList = [
        "把更多时间投入到案例沉淀与简历表达",
        "提前加入模拟面试 / 作品讲述训练",
        "提高中高难资源权重，加快进入投递准备阶段"
      ];
    } else {
      actionList = [
        "维持当前主线，优先完成第一个关键成果",
        "保留周日复盘，动态检查差距排序是否变化",
        "对核心技能保持“新知 + 实操 + 复习”节奏"
      ];
    }

    const nextFit = clamp(Math.round(profile.roleFit + completion * 0.08 - difficulty * 0.03 + confidence * 0.02), 35, 96);
    const trend = [0, 1, 2, 3].map((index) => clamp(Math.round(profile.roleFit + index * (completion > 80 ? 4 : 2.8) - index * (difficulty > 70 ? 1.2 : 0.5)), 28, 98));

    return {
      strategy,
      loadDelta,
      actionList,
      morale: completion >= 70 ? "你已经建立起稳定节奏，接下来更重要的是把成果做得更像真正可投递的材料。" : "这周不用追求完美，先守住最关键任务，连续性比一次爆发更重要。",
      topWatch: gapReport[0].name,
      nextFit,
      trend
    };
  }

  function renderWorkspaceSummary() {
    if (!state.currentUser) return;
    const latestPlanTime = state.history[0] ? formatTime(state.history[0].updatedAt || state.history[0].createdAt) : "暂无";
    els.workspaceSummary.innerHTML = `
      <article class="summary-card">
        <div class="card-title-row">
          <h3>${state.currentUser.displayName}</h3>
          <span class="mini-note">@${state.currentUser.username}</span>
        </div>
        <div class="summary-list">
          <article>
            <strong>数据库状态</strong>
            <p>已连接本地 IndexedDB，每个账号独立保存方案。</p>
          </article>
          <article>
            <strong>历史方案数</strong>
            <p>${state.history.length} 条 · 最近更新：${latestPlanTime}</p>
          </article>
        </div>
      </article>
    `;
  }

  function renderHistory() {
    if (!state.history.length) {
      els.historyList.innerHTML = `<article class="history-item empty-state">还没有历史版本，先生成一套方案并点击“保存版本”。</article>`;
      return;
    }
    els.historyList.innerHTML = state.history.map((item) => `
      <button type="button" class="history-item" data-plan-id="${item.id}">
        <strong>${item.title}</strong>
        <span>${item.careerTarget || "未命名职业目标"} · ${formatTime(item.updatedAt || item.createdAt)}</span>
      </button>
    `).join("");
    els.historyList.querySelectorAll("[data-plan-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        const record = await getRecord(PLAN_STORE, button.dataset.planId);
        if (record) {
          restorePlanRecord(record);
          showToast("已回载历史版本");
        }
      });
    });
  }

  function renderAIConsole(trace) {
    els.aiConsole.innerHTML = trace.map((line, index) => `
      <article class="console-line">
        <span class="console-index">0${index + 1}</span>
        <p>${line}</p>
      </article>
    `).join("");
  }

  function renderDashboard(formData, aiRole, profile, gapReport) {
    const topGap = gapReport[0];
    const stats = [
      { value: `${profile.scheduleStats.weeklyHours.toFixed(1)}h`, label: "每周真实学习预算" },
      { value: `${profile.roleFit}%`, label: "目标匹配度" },
      { value: `${profile.disciplineIndex}`, label: "执行稳定度指数" },
      { value: topGap ? topGap.name : "-", label: "当前第一优先级" }
    ];
    els.dashboardStats.innerHTML = stats.map((item) => `
      <article class="stat-card">
        <strong>${item.value}</strong>
        <span>${item.label}</span>
      </article>
    `).join("");

    els.profileSummary.innerHTML = `
      <article>
        <strong>${formData.studentName || "该用户"} 的 Growth 画像</strong>
        <p>${profile.readinessNarrative}</p>
      </article>
      <article>
        <strong>AI 职业识别</strong>
        <p>系统将「${aiRole.label}」识别为：${aiRole.blueprint}</p>
      </article>
      <article>
        <strong>时间画像</strong>
        <p>${profile.availabilityNarrative}</p>
      </article>
      <article>
        <strong>关键缺口提示</strong>
        <p>当前最应优先补齐的是「${gapReport[0].name}」和「${gapReport[1].name}」，它们直接决定你后续项目和投递表达的质量。</p>
      </article>
    `;

    els.strengthTags.innerHTML = [...profile.strengths.map((item) => item.label), ...profile.latentStrengths]
      .slice(0, 6)
      .map((label) => `<span>${label}</span>`)
      .join("");

    els.heroHours.textContent = `${profile.scheduleStats.weeklyHours.toFixed(1)}h`;
    els.heroFit.textContent = `${profile.roleFit}%`;
    els.heroGaps.textContent = `${gapReport.filter((item) => item.priorityScore >= 18).length}`;

    renderRadar(profile.skillScores, aiRole.skills);
  }

  function renderRadar(skillScores, skills) {
    const radarSkills = skills.slice(0, 6);
    const size = 340;
    const center = size / 2;
    const radius = 114;
    const angleStep = (Math.PI * 2) / radarSkills.length;
    const levels = [20, 40, 60, 80, 100];
    const gridPolygons = levels.map((level) => {
      const points = radarSkills.map((_, index) => {
        const angle = -Math.PI / 2 + index * angleStep;
        const r = radius * (level / 100);
        return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
      }).join(" ");
      return `<polygon points="${points}" fill="none" stroke="rgba(23,50,47,0.12)" stroke-width="1"></polygon>`;
    }).join("");
    const axes = radarSkills.map((skill, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      const labelX = center + Math.cos(angle) * (radius + 22);
      const labelY = center + Math.sin(angle) * (radius + 22);
      return `
        <line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="rgba(23,50,47,0.12)"></line>
        <text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="12">${skill.short}</text>
      `;
    }).join("");

    const currentPoints = radarSkills.map((skill, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      const r = radius * ((skillScores[skill.id] || 0) / 100);
      return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
    }).join(" ");

    const targetPoints = radarSkills.map((skill, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      const r = radius * (skill.target / 100);
      return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
    }).join(" ");

    els.radarChart.innerHTML = `
      <svg class="radar-svg" viewBox="0 0 ${size} ${size}" width="100%" height="320" aria-label="能力雷达图">
        ${gridPolygons}
        ${axes}
        <polygon points="${targetPoints}" fill="rgba(216,108,72,0.14)" stroke="rgba(216,108,72,0.85)" stroke-width="2"></polygon>
        <polygon points="${currentPoints}" fill="rgba(14,133,117,0.18)" stroke="rgba(14,133,117,0.95)" stroke-width="2.5"></polygon>
        <circle cx="${center}" cy="${center}" r="4" fill="var(--accent-strong)"></circle>
      </svg>
    `;
  }

  function renderGapAnalysis(aiRole, gapReport) {
    const highPriority = gapReport.filter((item) => item.priorityScore >= 20).length;
    const mediumPriority = gapReport.filter((item) => item.priorityScore >= 10 && item.priorityScore < 20).length;
    const lowPriority = gapReport.length - highPriority - mediumPriority;
    els.gapOverview.innerHTML = `
      <span class="summary-pill">职业蓝图：${aiRole.blueprint}</span>
      <span class="summary-pill">高优先级差距 ${highPriority} 个</span>
      <span class="summary-pill">中优先级差距 ${mediumPriority} 个</span>
      <span class="summary-pill">基础较稳 ${lowPriority} 个</span>
    `;
    els.gapList.innerHTML = gapReport.map((item) => `
      <article class="gap-item">
        <div class="gap-head">
          <h3>${item.name}</h3>
          <span class="gap-score">P${item.priorityScore}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${Math.min(item.current, item.target)}%"></div>
        </div>
        <div class="gap-meta">
          <span>当前 ${item.current}</span>
          <span>目标 ${item.target}</span>
          <span>差距 ${item.gap}</span>
          <span>难度 ${item.difficulty}/5</span>
        </div>
        <p>${item.brief}</p>
        <div class="dependency-row">
          ${item.deps.length ? item.deps.map((depId) => {
            const dep = aiRole.skills.find((skill) => skill.id === depId);
            return `<span class="dependency-chip">依赖：${dep ? dep.short : depId}</span>`;
          }).join("") : `<span class="dependency-chip">可直接启动</span>`}
        </div>
      </article>
    `).join("");
  }

  function renderPlanner(plan) {
    els.annualRoadmap.innerHTML = plan.annualPhases.map((phase) => `
      <article class="phase-card">
        <header>
          <h3>${phase.title}</h3>
          <span class="phase-badge">${phase.months} 个月</span>
        </header>
        <p><strong>阶段里程碑：</strong>${phase.milestone}</p>
        <p><strong>核心产出：</strong>${phase.outcome}</p>
        <div class="focus-list">${phase.focuses.map((focus) => `<span class="focus-chip">${focus}</span>`).join("")}</div>
      </article>
    `).join("");

    els.monthlyPlan.innerHTML = plan.monthlyPlan.map((month) => `
      <article class="month-card">
        <header>
          <h3>${month.title}</h3>
          <span class="month-badge">${month.load}</span>
        </header>
        <p><strong>所属阶段：</strong>${month.phase}</p>
        <p><strong>本月输出：</strong>${month.output}</p>
        <p><strong>推进备注：</strong>${month.note}</p>
        <div class="focus-list">${month.focus.map((focus) => `<span class="focus-chip">${focus}</span>`).join("")}</div>
      </article>
    `).join("");

    els.weeklySchedule.innerHTML = plan.weeklyPlan.grid.map((day) => `
      <div class="day-column">
        <div class="day-card">
          <h4>${day.day}</h4>
          ${day.slots.map((slot) => `
            <div class="slot-card ${SLOT_STATES[slot.slotState].className} ${slot.assignment.stateClass || ""}">
              <div class="slot-title">${slot.periodLabel}</div>
              <div class="slot-task">${slot.assignment.title}</div>
              <div class="slot-meta">${slot.assignment.mode} · ${slot.assignment.deliverable}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");
  }

  function renderResources(resourceGroups) {
    els.resourceBoard.innerHTML = resourceGroups.map((group) => `
      <section class="resource-group">
        <header>
          <div>
            <h3>${group.skillName}</h3>
            <p>${group.brief}</p>
          </div>
        </header>
        <div class="resource-group-grid">
          ${group.resources.map((resource) => `
            <article class="resource-card">
              <h4>${resource.title}</h4>
              <div class="resource-meta">
                <span class="resource-badge">${resource.platform}</span>
                <span class="resource-badge">${resource.type}</span>
                <span class="resource-badge">难度 ${resource.difficulty}/5</span>
                <span class="resource-badge">${resource.duration} min</span>
                <span class="resource-badge">推荐分 ${resource.score}</span>
              </div>
              <p class="resource-reason">${resource.reason}</p>
              <div class="resource-actions">
                <span class="mini-note">${resource.highlight}</span>
                <a class="resource-link" href="${resource.url}" target="_blank" rel="noreferrer">查看思路</a>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `).join("");
  }

  function renderCoach(coach) {
    els.coachSummary.innerHTML = `
      <article>
        <strong>本周策略：${coach.strategy}</strong>
        <p>${coach.loadDelta}</p>
      </article>
      <article>
        <strong>重点盯防能力</strong>
        <p>${coach.topWatch} 仍是当前最可能拉开差距的关键能力节点。</p>
      </article>
      <article>
        <strong>回访结论</strong>
        <p>${coach.morale}</p>
      </article>
      <article>
        <strong>下周动作</strong>
        <p>${coach.actionList.join("；")}</p>
      </article>
    `;
    renderTrend(coach.trend, coach.nextFit);
  }

  function renderTrend(trend, nextFit) {
    const width = 480;
    const height = 240;
    const padding = 32;
    const maxValue = 100;
    const points = trend.map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / (trend.length - 1);
      const y = height - padding - (value / maxValue) * (height - padding * 2);
      return { x, y, value };
    });
    const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
    const pointDots = points.map((point, index) => `
      <circle cx="${point.x}" cy="${point.y}" r="5" fill="var(--accent)"></circle>
      <text x="${point.x}" y="${point.y - 12}" text-anchor="middle" font-size="12">${point.value}%</text>
      <text x="${point.x}" y="${height - 10}" text-anchor="middle" font-size="12">W${index + 1}</text>
    `).join("");
    els.coachTrend.innerHTML = `
      <svg class="trend-svg" viewBox="0 0 ${width} ${height}" width="100%" height="260" aria-label="成长趋势预测">
        <rect x="0" y="0" width="${width}" height="${height}" rx="20" fill="rgba(255,255,255,0.35)"></rect>
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(23,50,47,0.12)"></line>
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="rgba(23,50,47,0.12)"></line>
        <polyline points="${polyline}" fill="none" stroke="rgba(14,133,117,0.9)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
        ${pointDots}
      </svg>
      <span class="trend-note">若保持当前策略，4 周后目标匹配度预计可达 <strong>${nextFit}%</strong> 左右。</span>
    `;
  }

  async function saveCurrentPlan(reason) {
    const formData = readFormData();
    const record = {
      id: `${state.currentUser.username}-${Date.now()}`,
      userId: state.currentUser.username,
      title: `${formData.studentName || state.currentUser.displayName} · ${formData.careerTarget || "职业目标"} · ${reason}`,
      careerTarget: formData.careerTarget,
      formData,
      schedule: clone(state.schedule),
      selectedTags: Array.from(state.selectedTags),
      profile: state.profile,
      gapReport: state.gapReport,
      plan: state.plan,
      resources: state.resources,
      aiTrace: state.lastAiTrace,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDraft: false
    };
    await putRecord(PLAN_STORE, record);
    await loadUserHistory();
    showToast("当前方案已保存到你的数据库");
  }

  async function saveDraftPlan() {
    if (!state.currentUser || !state.plan) return;
    const formData = readFormData();
    const record = {
      id: `${state.currentUser.username}-draft`,
      userId: state.currentUser.username,
      title: `${formData.studentName || state.currentUser.displayName} · 当前草稿`,
      careerTarget: formData.careerTarget,
      formData,
      schedule: clone(state.schedule),
      selectedTags: Array.from(state.selectedTags),
      profile: state.profile,
      gapReport: state.gapReport,
      plan: state.plan,
      resources: state.resources,
      aiTrace: state.lastAiTrace,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDraft: true
    };
    await putRecord(PLAN_STORE, record);
    await loadUserHistory();
  }

  async function loadUserHistory() {
    if (!state.currentUser) return;
    const records = await getPlansByUser(state.currentUser.username);
    state.history = records.sort((left, right) => (right.updatedAt || right.createdAt) - (left.updatedAt || left.createdAt));
    renderWorkspaceSummary();
    renderHistory();
  }

  async function loadLatestDraftOrPreset() {
    const draft = await getRecord(PLAN_STORE, `${state.currentUser.username}-draft`);
    if (draft) {
      restorePlanRecord(draft);
      return;
    }
    applyPreset(state.activePreset);
  }

  function restorePlanRecord(record) {
    const formData = record.formData;
    Object.entries(formData).forEach(([key, value]) => {
      const input = document.getElementById(key);
      if (!input) return;
      if (input.type === "checkbox") {
        input.checked = Boolean(value);
      } else if (typeof value !== "object") {
        input.value = value;
      }
    });
    state.schedule = clone(record.schedule || PRESETS[state.activePreset].schedule);
    state.selectedTags = new Set(record.selectedTags || []);
    renderTimetable();
    renderExperienceTags();
    state.profile = record.profile;
    state.gapReport = record.gapReport;
    state.plan = record.plan;
    state.resources = record.resources;
    state.lastAiTrace = record.aiTrace || [];
    els.deadlineValue.textContent = `${formData.deadlineMonths} 个月`;
    els.energyValue.textContent = `${formData.energyLevel} / 5`;
    renderAIConsole(state.lastAiTrace);
    renderDashboard(formData, buildDynamicCareerBlueprint(formData), state.profile, state.gapReport);
    renderGapAnalysis(buildDynamicCareerBlueprint(formData), state.gapReport);
    renderPlanner(state.plan);
    renderResources(state.resources);
    updateCoachFromInputs();
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(USER_STORE)) {
          db.createObjectStore(USER_STORE, { keyPath: "username" });
        }
        if (!db.objectStoreNames.contains(PLAN_STORE)) {
          const store = db.createObjectStore(PLAN_STORE, { keyPath: "id" });
          store.createIndex("byUser", "userId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getStore(storeName, mode = "readonly") {
    return state.db.transaction(storeName, mode).objectStore(storeName);
  }

  function putRecord(storeName, value) {
    return new Promise((resolve, reject) => {
      const request = getStore(storeName, "readwrite").put(value);
      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
    });
  }

  function getRecord(storeName, key) {
    return new Promise((resolve, reject) => {
      const request = getStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getUserByUsername(username) {
    if (!username) return null;
    return getRecord(USER_STORE, username.toLowerCase());
  }

  function getPlansByUser(userId) {
    return new Promise((resolve, reject) => {
      const store = getStore(PLAN_STORE);
      const index = store.index("byUser");
      const request = index.getAll(userId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  function normalizeText(text) {
    return String(text || "").toLowerCase();
  }

  function slugify(text) {
    return normalizeText(text)
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function sortEntries(record) {
    return Object.entries(record).sort((left, right) => right[1] - left[1]);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function showToast(message) {
    els.toast.hidden = false;
    els.toast.textContent = message;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2600);
  }

  function formatTime(timestamp) {
    if (!timestamp) return "暂无";
    const date = new Date(timestamp);
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hour = `${date.getHours()}`.padStart(2, "0");
    const minute = `${date.getMinutes()}`.padStart(2, "0");
    return `${month}-${day} ${hour}:${minute}`;
  }
})();
