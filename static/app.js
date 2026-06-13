// Growth AI Studio — Client App v1.2
const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem('growth_' + k)); } catch { return null; } },
  set(k, v) { localStorage.setItem('growth_' + k, JSON.stringify(v)); },
  del(k) { localStorage.removeItem('growth_' + k); }
};

const S = {
  user: LS.get('user') || null,
  mode: 'login',
  profile: LS.get('profile') || null,
  gapReport: LS.get('gapReport') || null,
  plan: LS.get('plan') || null,
  profileState: null,
};

const API = '/api';

// ── Markdown strip ────────────────────────────────────
function stripMD(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/###?\s+/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '• ')
    .replace(/^\s*\d+\.\s/gm, '')
    .trim();
}

// ── Week calculator ────────────────────────────────────
function calcWeeks(targetDateStr) {
  const now = new Date();
  // Parse Chinese date patterns
  let m = targetDateStr.match(/(\d{4})\s*年/);
  const year = m ? parseInt(m[1]) : now.getFullYear() + 1;
  const isSpring = /春|3月/.test(targetDateStr);
  const isAutumn = /秋|9月/.test(targetDateStr);
  const isSummer = /夏|6月/.test(targetDateStr);
  const targetMonth = isSpring ? 3 : (isAutumn ? 9 : (isSummer ? 6 : 6));
  const target = new Date(year, targetMonth - 1, 1);
  if (target < now) target.setFullYear(target.getFullYear() + 1);
  const weeks = Math.max(4, Math.round((target - now) / (7 * 24 * 60 * 60 * 1000)));
  return { weeks, year: target.getFullYear(), month: targetMonth, dateStr: target.getFullYear() + '年' + targetMonth + '月' };
}

async function api(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.status === 502 || r.status === 503) throw new Error('SERVER_COLD');
  if (!r.ok) throw new Error(await r.text().then(t => t.slice(0, 200)));
  return r.json();
}

// ── File upload ────────────────────────────────────────
async function handleFileUpload() {
  const file = document.getElementById('resumeFile').files[0];
  if (!file) return;
  const preview = document.getElementById('filePreview');
  preview.style.display = '';
  preview.innerHTML = '<div class="spinner"></div> 正在解析文件...';

  try {
    let text = '';
    if (file.name.endsWith('.txt')) {
      text = await file.text();
    } else if (file.name.endsWith('.pdf') || file.name.endsWith('.docx')) {
      // Client-side: use FileReader, server will parse on submit
      const buf = await file.arrayBuffer();
      text = new TextDecoder().decode(buf.slice(0, 5000)).replace(/[^\x20-\x7E一-鿿　-〿＀-￯\n]/g, ' ');
    } else if (file.name.match(/\.(png|jpg|jpeg)$/i)) {
      text = '[图片已上传，服务器将使用 OCR 识别]';
    }
    const clean = text.slice(0, 3000);
    document.getElementById('resumeInput').value = clean;
    preview.innerHTML = '<span style="color:var(--accent);">文件解析完成</span>（已自动填入下方文本框，可手动修改）';
  } catch (e) {
    preview.innerHTML = '<span style="color:var(--warm);">解析失败，请直接将内容粘贴到下方文本框</span>';
  }
}

// ── Auto-login ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (S.user) {
    api('/auth/login', { username: S.user.username, password: LS.get('pass') || '' })
      .then(r => { if (r.ok) { S.user = r.user; LS.set('user', r.user); } })
      .catch(() => {})
      .finally(() => showApp());
  }
});

// ── Auth ────────────────────────────────────────────────
function switchAuthTab(mode) {
  S.mode = mode;
  document.getElementById('tabLogin').classList.toggle('is-active', mode === 'login');
  document.getElementById('tabRegister').classList.toggle('is-active', mode === 'register');
  document.getElementById('displayNameField').hidden = (mode === 'login');
  document.getElementById('authBtn').textContent = mode === 'login' ? '登录' : '注册';
}

async function handleAuth(e) {
  e.preventDefault();
  const u = document.getElementById('authUser').value.trim();
  const p = document.getElementById('authPass').value.trim();
  if (!u || !p) return alert('请填写用户名和密码');

  if (S.mode === 'register') {
    const dn = document.getElementById('displayName').value.trim() || u;
    try {
      const r = await api('/auth/register', { username: u, password: p, email: dn + '@growth.ai' });
      if (r.ok) { S.user = r.user; LS.set('user', r.user); LS.set('pass', p); showApp(); }
      else alert(r.msg || '注册失败');
    } catch (err) {
      S.user = { id: 'local', username: u, email: u + '@growth.ai' };
      LS.set('user', S.user); LS.set('pass', p);
      LS.set('registered_users', (LS.get('registered_users') || []).concat([{ u, p }]));
      showApp();
    }
  } else {
    try {
      const r = await api('/auth/login', { username: u, password: p });
      if (r.ok) { S.user = r.user; LS.set('user', r.user); LS.set('pass', p); showApp(); }
      else { const locals = LS.get('registered_users') || []; const f = locals.find(x => x.u === u && x.p === p);
        if (f) { S.user = { id: 'local', username: u }; LS.set('user', S.user); LS.set('pass', p); showApp(); }
        else alert(r.msg || '登录失败'); }
    } catch (err) {
      const locals = LS.get('registered_users') || [];
      if (locals.find(x => x.u === u && x.p === p)) {
        S.user = { id: 'local', username: u }; LS.set('user', S.user); LS.set('pass', p); showApp();
      } else alert('服务器冷启动中（约30秒），请稍后重试。或检查用户名密码。');
    }
  }
}

async function demoLogin() {
  document.getElementById('authUser').value = 'demo';
  document.getElementById('authPass').value = 'demo2026';
  // Pre-load perfect demo data
  S.user = { id: 'demo', username: '李明', email: 'liming@demo.ai' };
  S.profile = DEMO_DATA.profile;
  S.gapReport = DEMO_DATA.gapReport;
  S.plan = DEMO_DATA.plan;
  LS.set('user', S.user); LS.set('pass', 'demo2026');
  LS.set('profile', S.profile); LS.set('gapReport', S.gapReport); LS.set('plan', S.plan);
  LS.set('registered_users', (LS.get('registered_users') || []).concat([{ u: 'demo', p: 'demo2026' }]));
  showApp();

  // Render demo data instantly on all pages
  renderProfileResult();
  renderTargetResult();
  renderPathResult();
  // Switch to profile page to show results
  document.querySelectorAll('.nav-btn[data-page="profile"]')[0].click();
}

function logout() {
  ['user','pass','profile','gapReport','plan'].forEach(k => LS.del(k));
  S.user = null; S.profile = null; S.gapReport = null; S.plan = null;
  document.getElementById('authGate').style.display = '';
  document.getElementById('appRoot').style.display = 'none';
}

function showApp() {
  document.getElementById('authGate').style.display = 'none';
  document.getElementById('appRoot').style.display = 'flex';
  document.getElementById('sidebarUser').textContent = (S.user || {}).username || '用户';
  if (S.profile) renderProfileResult();
  if (S.gapReport) renderTargetResult();
  if (S.plan) renderPathResult();
}

// ── Navigation ──────────────────────────────────────────
document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
  });
});

// ═══ Page 1: Profile ═══════════════════════════════════
async function buildProfile() {
  const resume = document.getElementById('resumeInput').value.trim();
  if (!resume) return alert('请先上传简历或输入简历内容');

  const el = document.getElementById('profileResult');
  el.innerHTML = '<div class="spinner"></div> AI 正在分析...';
  try {
    const r = await api('/profile/build', {
      resume_text: resume,
      schedule_text: document.getElementById('scheduleInput').value.trim(),
      user_id: (S.user || {}).id || 'demo'
    });
    S.profile = r.profile; S.profileState = r; LS.set('profile', r.profile);
    renderProfileResult();

    const questions = (r.questions || []).filter(q => q && q.includes('?'));
    if (questions.length > 0) {
      document.getElementById('profileChat').style.display = '';
      document.getElementById('chatMessages').innerHTML = questions.map(q =>
        '<p style="background:rgba(15,133,118,0.06);padding:10px 14px;border-radius:12px;margin:6px 0;">AI：' + q + '</p>'
      ).join('');
    }
  } catch (e) {
    if (e.message === 'SERVER_COLD') el.innerHTML = '<p style="color:var(--warm);">服务器正在冷启动（免费版约30秒），请稍后点击按钮重试。</p>';
    else el.innerHTML = '<p style="color:var(--danger);">连接失败：' + e.message + '</p>';
  }
}

function renderProfileResult() {
  if (!S.profile) return;
  const el = document.getElementById('profileResult');
  const p = S.profile;
  const skills = (p.hard_skills || []).concat(p.soft_skills || []);
  el.innerHTML = '<p style="color:var(--accent);font-weight:700;">画像构建完成</p>';
  el.innerHTML += '<div style="margin-top:8px;">' + skills.map(s => '<span class="skill-tag">' + (s.name || s) + '</span>').join('') + '</div>';
  el.innerHTML += '<p style="margin-top:12px;"><strong>总结：</strong>' + (p.profile_summary || '') + '</p>';
  el.innerHTML += '<p><strong>优势：</strong>' + (p.strength_tags || []).join('，') + '</p>';
  el.innerHTML += '<p><strong>待提升：</strong>' + (p.weakness_tags || []).join('，') + '</p>';
}

async function sendAnswer() {
  const input = document.getElementById('chatInput');
  const answer = input.value.trim();
  if (!answer) return;
  document.getElementById('chatMessages').innerHTML += '<p style="padding:10px 14px;margin:6px 0;text-align:right;color:var(--accent-strong);">你：' + answer + '</p>';
  input.value = '';
  try {
    const r = await api('/profile/build', {
      resume_text: document.getElementById('resumeInput').value.trim() + '\n用户补充：' + answer,
      schedule_text: document.getElementById('scheduleInput').value.trim(),
      user_id: (S.user || {}).id || 'demo'
    });
    S.profile = r.profile; LS.set('profile', r.profile);
    renderProfileResult();
  } catch (e) {
    document.getElementById('chatMessages').innerHTML += '<p style="color:var(--warm);">连接失败，请重试。</p>';
  }
}

// ═══ Page 2: Target ════════════════════════════════════
async function analyzeTarget() {
  const pos = document.getElementById('targetPosition').value.trim();
  if (!pos) return alert('请输入目标岗位');
  if (!S.profile) return alert('请先在 Step 1 构建画像');

  const el = document.getElementById('targetResult');
  el.innerHTML = '<div class="spinner"></div> AI 正在分析...';
  try {
    const r = await api('/analyze', {
      profile: S.profile,
      position_name: pos,
      jd_text: document.getElementById('targetJD').value.trim(),
    });
    S.gapReport = (r.gaps || []).map(g => ({
      ...g, _editing: false,
      current_level: g.current_level || 0,
      target_level: g.target_level || 80,
      importance: g.importance || 0.5,
      severity: g.severity || 'moderate',
    }));
    LS.set('gapReport', S.gapReport);
    el.innerHTML = '<p style="font-size:1.5rem;font-weight:700;color:var(--accent-strong);">匹配度：' + (r.overall_match || 0) + '%</p>';
    renderTargetResult();
  } catch (e) {
    if (e.message === 'SERVER_COLD') el.innerHTML = '<p style="color:var(--warm);">服务器冷启动中，请稍后重试。</p>';
    else el.innerHTML = '<p style="color:var(--danger);">连接失败：' + e.message + '</p>';
  }
}

function renderTargetResult() {
  if (!S.gapReport || !S.gapReport.length) return;
  const el = document.getElementById('targetResult');
  if (!el.innerHTML.includes('匹配度')) el.innerHTML = '<p style="font-size:1.5rem;font-weight:700;color:var(--accent-strong);">已保存的分析结果</p>';

  let html = '';
  S.gapReport.forEach((g, i) => {
    const sev = g.severity === 'critical' ? 'badge-warn' : (g.severity === 'moderate' ? 'badge' : 'badge-ok');
    html += '<div class="gap-row" id="gap-' + i + '">';
    html += '<div style="flex:1;"><strong>' + g.skill_name + '</strong><br>';
    html += '当前 <input class="inline-edit" type="number" value="' + g.current_level + '" style="width:50px;" onchange="updateGap(' + i + ',\'current_level\',this.value)">% → ';
    html += '目标 <input class="inline-edit" type="number" value="' + g.target_level + '" style="width:50px;" onchange="updateGap(' + i + ',\'target_level\',this.value)">% · ';
    html += '重要性 <input class="inline-edit" type="number" value="' + g.importance + '" style="width:50px;" step="0.1" onchange="updateGap(' + i + ',\'importance\',this.value)">';
    html += '</div>';
    html += '<span class="badge ' + sev + '">' + g.severity + '</span>';
    html += '</div>';
  });
  el.innerHTML += html;
}

function updateGap(index, field, value) {
  const v = parseFloat(value) || 0;
  S.gapReport[index][field] = field === 'importance' ? Math.min(1, Math.max(0, v)) : Math.min(100, Math.max(0, v));
  const g = S.gapReport[index];
  const gapScore = g.importance * Math.max((g.target_level - g.current_level) / 100, 0);
  S.gapReport[index].gap_score = gapScore;
  S.gapReport[index].severity = gapScore > 0.4 ? 'critical' : (gapScore > 0.15 ? 'moderate' : 'minor');
  LS.set('gapReport', S.gapReport);
  renderTargetResult();
}

// ═══ Page 3: Path ══════════════════════════════════════
async function generatePath() {
  if (!S.profile) return alert('请先构建画像');
  if (!S.gapReport || !S.gapReport.length) return alert('请先分析目标岗位');

  const targetDateStr = document.getElementById('targetDate').value.trim() || '6个月后';
  const { weeks, dateStr } = calcWeeks(targetDateStr);

  const el = document.getElementById('pathResult');
  el.innerHTML = '<div class="spinner"></div> AI 正在生成学习路径（目标日期：' + dateStr + '，约 ' + weeks + ' 周）...';
  try {
    const r = await api('/plan/generate', {
      profile: S.profile,
      gap_report: S.gapReport,
      position_name: document.getElementById('targetPosition').value || '自定义岗位',
      target_date: dateStr + '（共' + weeks + '周）',
    });
    S.plan = r.growth_plan || {}; LS.set('plan', S.plan);
    renderPathResult();
  } catch (e) {
    if (e.message === 'SERVER_COLD') el.innerHTML = '<p style="color:var(--warm);">服务器冷启动中，请稍后重试。</p>';
    else el.innerHTML = '<p style="color:var(--danger);">连接失败：' + e.message + '</p>';
  }
}

function renderPathResult() {
  if (!S.plan) return;
  const el = document.getElementById('pathResult');
  const yp = (S.plan.yearly_plan || S.plan);
  el.innerHTML = '<p style="font-weight:700;color:var(--accent-strong);">学习路径已生成</p>';
  el.innerHTML += '<p>总时长：<strong>' + (yp.total_weeks || '?') + ' 周</strong></p>';

  (yp.phases || []).forEach(p => {
    el.innerHTML += '<div style="margin:8px 0;padding:12px 16px;background:rgba(255,255,255,0.6);border-radius:12px;border:1px solid var(--line);">'
      + '<strong>Phase ' + (p.phase_number || '') + ' — ' + (p.title || '') + '</strong>（第' + (p.start_week || '') + '-' + (p.end_week || '') + '周）<br>'
      + (p.description || '') + '</div>';
  });

  if ((yp.key_milestones || []).length) {
    el.innerHTML += '<p style="margin-top:12px;font-weight:700;">关键里程碑：</p>';
    (yp.key_milestones || []).forEach(m => {
      el.innerHTML += '<div style="padding:6px 0;border-bottom:1px solid var(--line);">Week ' + m.week + '：' + m.title + '</div>';
    });
  }
}

// ═══ Page 4: Resources ════════════════════════════════
async function getResources() {
  const el = document.getElementById('resourcesResult');
  if (!S.gapReport || !S.gapReport.length) { el.innerHTML = '<p style="color:var(--muted);">请先完成前序步骤。</p>'; return; }
  el.innerHTML = '<div class="spinner"></div> AI 正在搜索全网学习资源...';
  try {
    const r = await api('/chat', {
      message: '请以纯文本格式（不要使用markdown符号如**或*或#），推荐以下技能差距对应的B站、GitHub、MOOC学习资源，每条资源一行，格式为「平台 - 资源名称 - 链接关键词」：' + JSON.stringify(S.gapReport.slice(0, 5).map(g => g.skill_name)),
      profile: S.profile, gap_report: S.gapReport,
    });
    el.innerHTML = '<p style="font-weight:700;color:var(--accent-strong);">AI 资源推荐</p>';
    el.innerHTML += '<div style="white-space:pre-wrap;line-height:2;padding:12px;background:rgba(255,255,255,0.5);border-radius:12px;">' + stripMD(r.reply || '') + '</div>';
  } catch (e) {
    if (e.message === 'SERVER_COLD') el.innerHTML = '<p style="color:var(--warm);">服务器冷启动中，请稍后重试。</p>';
    else el.innerHTML = '<p style="color:var(--danger);">连接失败：' + e.message + '</p>';
  }
}

// ═══ Page 5: Check-in ══════════════════════════════════
async function doCheckin() {
  const input = document.getElementById('checkinInput').value.trim();
  if (!input) return alert('请输入你的学习进展');
  const el = document.getElementById('checkinResult');
  el.innerHTML = '<div class="spinner"></div> AI 正在分析...';
  try {
    const r = await api('/chat', {
      message: '请以纯文本格式（不使用markdown符号），作为职业成长教练，对以下学生回访进行分析，给出鼓励和调整建议：' + input,
      profile: S.profile, gap_report: S.gapReport,
    });
    el.innerHTML = '<div style="white-space:pre-wrap;line-height:2;padding:16px;background:rgba(15,133,118,0.04);border-radius:14px;">' + stripMD(r.reply || '') + '</div>';
    document.getElementById('checkinStatus').textContent = '已回访';
    document.getElementById('checkinStatus').className = 'badge badge-ok';
  } catch (e) {
    if (e.message === 'SERVER_COLD') el.innerHTML = '<p style="color:var(--warm);">服务器冷启动中，请稍后重试。</p>';
    else el.innerHTML = '<p style="color:var(--danger);">连接失败：' + e.message + '</p>';
  }
}

// ═══ Demo pre-loaded data ═════════════════════════════
const DEMO_DATA = {
  profile: {
    hard_skills: [
      { name: "Java", level: 75, category: "编程语言" },
      { name: "Python", level: 60, category: "编程语言" },
      { name: "MySQL", level: 55, category: "数据库" },
      { name: "Spring Boot", level: 40, category: "框架" },
      { name: "数据结构", level: 65, category: "计算机基础" },
    ],
    soft_skills: [
      { name: "团队协作", level: 70 },
      { name: "问题解决", level: 65 },
    ],
    experiences: [
      { type: "项目", title: "校园二手交易小程序", description: "独立开发后端API，使用Spring Boot + MySQL，日活200+用户", skills_demonstrated: ["Java", "Spring Boot", "MySQL"], impact: "日活200+" },
      { type: "竞赛", title: "蓝桥杯程序设计竞赛", description: "省级二等奖", skills_demonstrated: ["Java", "数据结构"], impact: "省级二等奖" },
    ],
    strength_tags: ["Java基础扎实", "有完整项目经验", "竞赛经历加分"],
    weakness_tags: ["Redis未接触", "分布式系统概念薄弱", "算法题量不足"],
    career_preference: { industries: ["互联网"], roles: ["后端开发"], cities: ["北京", "杭州"] },
    weekly_free_time_minutes: 1200,
    profile_summary: "计算机专业大三学生，Java基础扎实，有独立完成小程序后端的项目经验，竞赛获奖。主要短板在Redis、分布式系统和算法题量，适合冲刺大厂后端开发岗位。"
  },
  gapReport: [
    { skill_name: "Redis", current_level: 5, target_level: 80, importance: 0.85, gap_score: 0.638, severity: "critical", category: "数据库", evidence: "简历和项目经验中未涉及Redis", recommended_action: "完成Redis入门课程，动手实现缓存、排行榜等常见场景" },
    { skill_name: "Spring Boot 进阶", current_level: 40, target_level: 85, importance: 0.9, gap_score: 0.405, severity: "critical", category: "框架", evidence: "仅基础CRUD，未涉及微服务、安全、监控", recommended_action: "学习Spring Cloud微服务架构，完成一个分布式项目" },
    { skill_name: "算法与数据结构", current_level: 65, target_level: 90, importance: 0.8, gap_score: 0.2, severity: "moderate", category: "计算机基础", evidence: "竞赛有一定基础，但LeetCode刷题量不足（<50题）", recommended_action: "每日刷LeetCode 2-3题，重点攻克动态规划和图论" },
    { skill_name: "MySQL 进阶", current_level: 55, target_level: 80, importance: 0.75, gap_score: 0.188, severity: "moderate", category: "数据库", evidence: "基础查询OK，索引优化和SQL调优不足", recommended_action: "学习索引原理、慢查询优化，刷LeetCode SQL 50题" },
    { skill_name: "项目经验", current_level: 50, target_level: 85, importance: 0.85, gap_score: 0.298, severity: "moderate", category: "项目经验", evidence: "仅一个独立项目，缺少团队协作和大型项目经验", recommended_action: "参与开源项目或组队完成一个分布式系统项目" },
  ],
  plan: {
    yearly_plan: {
      year_label: "2026-2027春招冲刺",
      big_goal: "2027年春招拿到大厂后端开发Offer",
      total_weeks: 36,
      phases: [
        { phase_number: 1, title: "基础强化", start_week: 1, end_week: 8, theme: "Redis入门 + MySQL进阶 + Spring Boot微服务", description: "系统学习Redis五种数据结构与常见应用场景，掌握MySQL索引优化与慢查询分析，完成Spring Cloud微服务项目搭建。" },
        { phase_number: 2, title: "项目实战", start_week: 9, end_week: 20, theme: "两个完整项目 + 算法刷题", description: "组队完成一个分布式电商项目，独立完成一个高并发秒杀Demo。每日刷LeetCode 2题，12周完成150题。" },
        { phase_number: 3, title: "面试冲刺", start_week: 21, end_week: 36, theme: "八股文 + 项目复盘 + 模拟面试", description: "系统复习Java基础、JVM、并发、MySQL、Redis、Spring全家桶面试题。深度复盘项目亮点。用Growth AI面试教练模拟10次面试。" },
      ],
      key_milestones: [
        { week: 4, title: "完成Redis入门课程，动手实现缓存Demo" },
        { week: 8, title: "Spring Cloud项目Deploy到服务器" },
        { week: 14, title: "LeetCode刷题100+，完成秒杀项目" },
        { week: 20, title: "LeetCode刷题150+，两个完整项目上线GitHub" },
        { week: 28, title: "完成一轮面试题系统复习" },
        { week: 36, title: "春招投递，目标5+面试邀请" },
      ],
      target_match_improvement: { from: 42, to: 78 }
    }
  }
};
