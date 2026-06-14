// Growth AI Studio — Client App v1.3
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
  _pendingRequest: null, // AbortController for cancellation
};

const API = '/api';
const API_TIMEOUT = 120000; // 2 min timeout for AI calls

// ── Error / Retry helper ──────────────────────────────
function showError(el, msg, retryFn) {
  const msgs = {
    'SERVER_COLD': '服务器正在冷启动（免费版约30-60秒），请稍后点击重试。',
    'TIMEOUT': '请求超时（AI 生成需要时间，最长等待2分钟）。移动端请勿切出浏览器。',
  };
  el.innerHTML = '<div style="padding:16px;background:var(--warm-soft);border-radius:12px;">'
    + '<p style="color:var(--warm);margin:0 0 8px 0;">' + (msgs[msg] || msg) + '</p>'
    + (retryFn ? '<button class="small-btn" onclick="(' + retryFn.toString() + ')()">重试</button>' : '')
    + '<p style="margin:12px 0 0 0;font-size:0.78rem;color:var(--muted);">提示：使用演示账号（demo/demo2026）可跳过 AI 等待，秒出结果。</p>'
    + '</div>';
}

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

async function api(path, body, timeoutMs = API_TIMEOUT) {
  // Cancel any previous pending request
  if (S._pendingRequest) { S._pendingRequest.abort(); }
  const controller = new AbortController();
  S._pendingRequest = controller;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    S._pendingRequest = null;
    if (r.status === 502 || r.status === 503) throw new Error('SERVER_COLD');
    if (!r.ok) throw new Error(await r.text().then(t => t.slice(0, 200)));
    return r.json();
  } catch (e) {
    clearTimeout(timer);
    S._pendingRequest = null;
    if (e.name === 'AbortError') throw new Error('TIMEOUT');
    throw e;
  }
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
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'txt' || ext === 'csv') {
      text = await file.text();
    } else if (ext === 'xlsx' || ext === 'xls') {
      text = parseExcel(await file.arrayBuffer());
    } else if (ext === 'pdf' || ext === 'docx') {
      const buf = await file.arrayBuffer();
      text = new TextDecoder().decode(buf.slice(0, 5000)).replace(/[^\x20-\x7E一-鿿　-〿＀-￯\n]/g, ' ');
    } else if (['png','jpg','jpeg'].includes(ext)) {
      text = '[图片已上传，服务器将使用 OCR 识别]';
    }
    const clean = text.slice(0, 3000);
    document.getElementById('resumeInput').value = clean;
    preview.innerHTML = '<span style="color:var(--accent);">文件解析完成</span>（已自动填入下方文本框，可手动修改）';
  } catch (e) {
    preview.innerHTML = '<span style="color:var(--warm);">解析失败，请直接将内容粘贴到下方文本框</span>';
  }
}

async function handleScheduleUpload() {
  const file = document.getElementById('scheduleFile').files[0];
  if (!file) return;
  const preview = document.getElementById('schedulePreview');
  preview.style.display = '';
  preview.innerHTML = '<div class="spinner"></div> 正在解析课表...';

  try {
    let text = '';
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      text = parseExcel(await file.arrayBuffer());
    } else if (ext === 'csv' || ext === 'txt') {
      text = await file.text();
    } else if (['png','jpg','jpeg'].includes(ext)) {
      text = '[课表截图已上传，服务器将使用 OCR 识别]';
    }
    const clean = text.slice(0, 2000);
    document.getElementById('scheduleInput').value = clean;
    preview.innerHTML = '<span style="color:var(--accent);">课表解析完成</span>（已自动填入，可手动修改）';
  } catch (e) {
    preview.innerHTML = '<span style="color:var(--warm);">解析失败，请直接输入课程表内容</span>';
  }
}

function parseExcel(buffer) {
  if (typeof XLSX === 'undefined') return '[Excel 解析库未加载，请直接粘贴内容]';
  const wb = XLSX.read(buffer, { type: 'array' });
  const texts = [];
  wb.SheetNames.forEach(name => {
    const sheet = wb.Sheets[name];
    texts.push('【' + name + '】');
    texts.push(XLSX.utils.sheet_to_csv(sheet));
  });
  return texts.join('\n');
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

  // Fill in demo input fields
  setTimeout(() => {
    const ri = document.getElementById('resumeInput');
    if (ri) ri.value = DEMO_DATA.resumeText || '';
    const ti = document.getElementById('targetPosition');
    if (ti) ti.value = '字节跳动 后端开发工程师（校招）';
    const td = document.getElementById('targetJD');
    if (td) td.value = DEMO_DATA.jdText || '';
    const si = document.getElementById('scheduleInput');
    if (si) si.value = DEMO_DATA.scheduleText || '';
  }, 200);

  // Render demo data instantly on all pages
  renderProfileResult();
  renderTargetResult();
  renderPathResult();
  setTimeout(() => renderCheckinHistory(), 500);
  // Switch to profile page to show results
  switchPage('profile');
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
  // Demo user: always restore data on login
  if (S.user && S.user.username === '李明') {
    restoreDemoData();
    setTimeout(() => { renderProfileResult(); renderTargetResult(); renderPathResult(); renderCheckinHistory(); }, 300);
    return;
  }
  if (S.profile) renderProfileResult();
  if (S.gapReport) renderTargetResult();
  if (S.plan) renderPathResult();
}

// ── About Modal ────────────────────────────────────────
function toggleAbout() {
  const m = document.getElementById('aboutModal');
  m.style.display = m.style.display === 'flex' ? 'none' : 'flex';
}

// ── Navigation ──────────────────────────────────────────
function switchPage(targetPage) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const targetBtn = document.querySelector('.nav-btn[data-page="' + targetPage + '"]');
  if (targetBtn) targetBtn.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + targetPage);
  if (pageEl) pageEl.classList.add('active');
  // Trigger check-in render when switching to checkin page
  if (targetPage === 'checkin') setTimeout(() => renderCheckinHistory(), 100);
}

document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.page === 'resources' ? 'path' : btn.dataset.page;
    switchPage(target);
  });
});

// ═══ Page 1: Profile ═══════════════════════════════════
async function buildProfile() {
  // Demo account: just show pre-loaded data, don't call API
  if (S.user && S.user.username === '李明') {
    restoreDemoData();
    renderProfileResult();
    document.getElementById('profileChat').style.display = '';
    document.getElementById('chatMessages').innerHTML = DEMO_DATA.profile.strength_tags.map(t =>
      '<p style="background:rgba(15,133,118,0.06);padding:10px 14px;border-radius:12px;margin:6px 0;">AI：根据你的简历，我识别到以下优势：' + t + '</p>'
    ).join('');
    return;
  }

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
    showError(el, e.message, buildProfile);
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
  // Demo account: just show pre-loaded data
  if (S.user && S.user.username === '李明') {
    restoreDemoData();
    renderTargetResult();
    document.getElementById('targetResult').innerHTML = '<p style="font-size:1.5rem;font-weight:700;color:var(--accent-strong);">匹配度：38%</p>' + document.getElementById('targetResult').innerHTML;
    return;
  }
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
    showError(el, e.message, analyzeTarget);
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
    html += '当前 <input class="inline-edit" type="number" value="' + g.current_level + '" onchange="updateGap(' + i + ',\'current_level\',this.value)">% → ';
    html += '目标 <input class="inline-edit" type="number" value="' + g.target_level + '" onchange="updateGap(' + i + ',\'target_level\',this.value)">% · ';
    html += '重要性 <input class="inline-edit" type="number" value="' + g.importance + '" step="0.1" onchange="updateGap(' + i + ',\'importance\',this.value)">';
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
  // Demo account: just show pre-loaded data
  if (S.user && S.user.username === '李明') {
    restoreDemoData();
    renderPathResult();
    return;
  }
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
    showError(el, e.message, generatePath);
  }
}

function renderPathResult() {
  if (!S.plan) return;
  const el = document.getElementById('pathResult');
  const yp = (S.plan.yearly_plan || S.plan);
  el.innerHTML = '<p style="font-weight:700;color:var(--accent-strong);">学习路径已生成</p>';
  el.innerHTML += '<p>总时长：<strong>' + (yp.total_weeks || '?') + ' 周</strong> · ' + (yp.phases || []).length + ' 个阶段</p>';

  // ── Phases ──
  (yp.phases || []).forEach(p => {
    el.innerHTML += '<div style="margin:10px 0;padding:14px 18px;background:linear-gradient(135deg,rgba(15,133,118,0.06),rgba(255,255,255,0.8));border-radius:14px;border:1px solid rgba(15,133,118,0.12);">'
      + '<strong style="font-size:0.95rem;">Phase ' + (p.phase_number || '') + ' — ' + (p.title || '') + '</strong>'
      + '<span style="color:var(--muted);font-size:0.82rem;margin-left:8px;">第' + (p.start_week || '') + '-' + (p.end_week || '') + '周</span><br>'
      + '<span style="font-size:0.88rem;color:var(--muted);">' + (p.description || '') + '</span></div>';
  });

  // ── Weekly Plans ──
  const weekPlans = yp.weekly_plans || [];
  if (weekPlans.length > 0) {
    el.innerHTML += '<p style="margin-top:16px;font-weight:700;color:var(--accent-strong);">周计划示例（第1-4周）</p>';
    weekPlans.slice(0, 4).forEach(wp => {
      el.innerHTML += '<details style="margin:8px 0;background:rgba(255,255,255,0.7);border:1px solid var(--line);border-radius:12px;padding:12px 16px;">'
        + '<summary style="font-weight:600;cursor:pointer;font-size:0.92rem;">第' + wp.week_number + '周：' + (wp.theme || '') + '（' + (wp.total_minutes || 0) + '分钟）</summary>';
      (wp.slots || []).forEach(s => {
        el.innerHTML += '<div style="margin:6px 0;padding:8px 12px;background:rgba(255,255,255,0.4);border-radius:8px;font-size:0.84rem;">'
          + '<span style="font-weight:600;">' + s.day + ' ' + s.start_time + '</span>'
          + ' · <span style="color:var(--accent-strong);">' + s.task_description + '</span>'
          + ' <span style="color:var(--muted);font-size:0.78rem;">(' + s.duration_minutes + '分钟)</span></div>';
      });
      if (wp.milestone_this_week) {
        el.innerHTML += '<p style="margin:8px 0 0 0;font-size:0.82rem;color:var(--accent);">本周里程碑：' + wp.milestone_this_week + '</p>';
      }
      el.innerHTML += '</details>';
    });
  }

  // ── Milestones ──
  if ((yp.key_milestones || []).length) {
    el.innerHTML += '<p style="margin-top:14px;font-weight:700;">关键里程碑</p>';
    (yp.key_milestones || []).forEach(m => {
      el.innerHTML += '<div style="padding:5px 0;border-bottom:1px solid var(--line);font-size:0.85rem;">Week ' + m.week + '：' + m.title + '</div>';
    });
  }

  // Inline resources
  if (S.gapReport && S.gapReport.length) {
    renderResourcesInline(el, S.gapReport.map(g => g.skill_name));
  }
}

// ═══ Page 4: Resources (integrated into Path) ═════════
async function getResources() {
  // Redirect to path page - resources are now integrated
  document.querySelector('.nav-btn[data-page="path"]').click();
  if (!S.plan) {
    alert('请先生成学习路径（Step 3），资源推荐已整合到学习路径中。');
  }
}

function renderResourcesInline(container, skillNames) {
  const directMap = {
    'Redis': [
      { name: 'Redis入门教程（黑马程序员）', url: 'https://www.bilibili.com/video/BV1Rv41177Af', platform: 'B站', note: '136集，从零到实战' },
      { name: 'Redis核心数据结构详解（小林coding）', url: 'https://xiaolincoding.com/redis/', platform: '小林coding', note: '图解Redis底层原理' },
      { name: 'Redisson分布式锁实战', url: 'https://github.com/redisson/redisson', platform: 'GitHub', note: '17.4k Star，企业级分布式锁' },
    ],
    '分布式系统': [
      { name: 'Spring Cloud微服务教程（尚硅谷）', url: 'https://www.bilibili.com/video/BV1LQ4y127n4', platform: 'B站', note: '2024最新版，含Nacos+Gateway+Sentinel' },
      { name: 'Spring Cloud Alibaba 实战', url: 'https://github.com/alibaba/spring-cloud-alibaba', platform: 'GitHub', note: '28.6k Star，阿里微服务全家桶' },
      { name: '分布式系统原理（MIT 6.824中文版）', url: 'https://github.com/chaozh/awesome-distributed-systems', platform: 'GitHub', note: '含Raft/Paxos论文与实现' },
    ],
    'Spring Boot 进阶': [
      { name: 'Spring Security + JWT认证实战', url: 'https://www.bilibili.com/video/BV1mm4y1X7Hc', platform: 'B站', note: '企业级认证鉴权方案' },
      { name: 'Spring Boot 官方文档中文版', url: 'https://springdoc.cn/spring-boot/', platform: '官方文档', note: '最权威的参考' },
      { name: 'mall电商项目（Spring Boot版）', url: 'https://github.com/macrozheng/mall', platform: 'GitHub', note: '66k Star，完整电商系统' },
    ],
    '算法与数据结构': [
      { name: 'LeetCode Hot 100', url: 'https://leetcode.cn/problem-list/2cktkvj/', platform: 'LeetCode', note: '面试必刷100题' },
      { name: '代码随想录', url: 'https://github.com/youngyangyang04/leetcode-master', platform: 'GitHub', note: '每道题有视频讲解+文字题解' },
      { name: 'hello-algo 图解数据结构', url: 'https://github.com/krahets/hello-algo', platform: 'GitHub', note: '73k Star，动画图解' },
    ],
    '操作系统': [
      { name: '王道计算机考研 操作系统', url: 'https://www.bilibili.com/video/BV1YE411D7nH', platform: 'B站', note: '经典考研课，面试够用' },
      { name: '《深入理解计算机系统》CSAPP', url: 'https://github.com/huangrt01/CSAPP', platform: 'GitHub', note: '程序员必读经典，含中文笔记' },
      { name: '操作系统面试突击（JavaGuide）', url: 'https://javaguide.cn/cs-basics/operating-system/operating-system-basic-questions-01.html', platform: 'JavaGuide', note: '高频面试题系统总结' },
    ],
    'MySQL 进阶': [
      { name: 'MySQL实战45讲（丁奇）', url: 'https://time.geekbang.org/column/intro/100020801', platform: '极客时间', note: '阿里P9的MySQL心法' },
      { name: 'MySQL索引优化实战（尚硅谷）', url: 'https://www.bilibili.com/video/BV1Kr4y1i7ru', platform: 'B站', note: 'Explain执行计划全解析' },
      { name: 'LeetCode SQL题库', url: 'https://leetcode.cn/problemset/database/', platform: 'LeetCode', note: '面试SQL真题练习' },
      { name: 'ShardingSphere分库分表', url: 'https://shardingsphere.apache.org/', platform: '官网', note: '企业级分库分表方案' },
    ],
    '项目经验': [
      { name: '秒杀系统设计（Java版）', url: 'https://github.com/qiurunze123/miaosha', platform: 'GitHub', note: '26k Star，高并发秒杀' },
      { name: 'RuoYi-Vue 若依后台管理系统', url: 'https://github.com/yangzongzhuan/RuoYi-Vue', platform: 'GitHub', note: 'Spring Boot + Vue，快速上手' },
      { name: 'Java开源项目推荐合集', url: 'https://github.com/akullpp/awesome-java', platform: 'GitHub', note: '40k Star，Java资源大全' },
    ],
    'Java': [
      { name: 'JavaGuide 面试指南', url: 'https://github.com/Snailclimb/JavaGuide', platform: 'GitHub', note: '145k Star，Java面试必备' },
      { name: 'CS-Notes 技术面试必备', url: 'https://github.com/CyC2018/CS-Notes', platform: 'GitHub', note: '174k Star，系统学习' },
    ],
  };

  let html = '<p style="font-weight:700;color:var(--accent-strong);margin-top:16px;">推荐学习资源（可点击直达）</p>';
  let count = 0;
  skillNames.forEach(name => {
    const resources = directMap[name] || [];
    if (resources.length) {
      html += '<p style="margin:10px 0 4px 0;font-weight:600;font-size:0.92rem;">' + name + '</p>';
      resources.forEach(r => {
        count++;
        html += '<div style="margin:3px 0;padding:10px 14px;background:rgba(255,255,255,0.5);border-radius:8px;font-size:0.85rem;display:flex;align-items:center;gap:8px;">'
          + '<span style="background:var(--accent-soft);color:var(--accent-strong);padding:2px 8px;border-radius:10px;font-size:0.72rem;font-weight:700;white-space:nowrap;">' + r.platform + '</span>'
          + '<a href="' + r.url + '" target="_blank" rel="noopener" style="color:var(--ink);text-decoration:none;font-weight:600;flex:1;">' + r.name + '</a>'
          + '<span style="color:var(--muted);font-size:0.78rem;">' + r.note + '</span></div>';
      });
    }
  });
  if (count === 0) html += '<p style="color:var(--muted);">AI 将根据你的技能差距生成个性化资源推荐。</p>';
  else html += '<p style="font-size:0.8rem;color:var(--muted);margin-top:8px;">共 ' + count + ' 个资源链接</p>';
  container.innerHTML += html;
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
    showError(el, e.message, doCheckin);
  }
}

function renderCheckinHistory() {
  const data = S._checkinHistory || DEMO_CHECKIN;
  if (!data || !data.length) return;
  const el = document.getElementById('checkinTimeline');
  const container = document.getElementById('checkinHistory');
  if (!el || !container) return;
  container.style.display = '';
  document.getElementById('checkinStatus').textContent = '已回访 ' + data.length + ' 次';
  document.getElementById('checkinStatus').className = 'badge badge-ok';

  el.innerHTML = data.map((entry, i) => `
    <div style="margin:16px 0;padding:16px;background:rgba(255,255,255,0.6);border-radius:14px;border:1px solid var(--line);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-weight:700;color:var(--accent-strong);">第 ${entry.week} 周回访（${entry.date}）</span>
        <span class="badge ${entry.onTrack ? 'badge-ok' : 'badge-warn'}">${entry.onTrack ? '按计划进行' : '需要调整'}</span>
      </div>
      <div style="background:rgba(15,133,118,0.03);padding:10px 14px;border-radius:10px;margin:8px 0;">
        <span style="font-size:0.8rem;color:var(--muted);">李明：</span>
        <span style="font-size:0.88rem;">${entry.student}</span>
      </div>
      <div style="background:rgba(215,110,77,0.03);padding:10px 14px;border-radius:10px;margin:8px 0;">
        <span style="font-size:0.8rem;color:var(--warm);">Growth AI：</span>
        <span style="font-size:0.88rem;">${entry.coach}</span>
      </div>
    </div>
  `).join('');
}

const DEMO_CHECKIN = [
  {
    week: 1, date: "10月13日（周日）", onTrack: true,
    student: "这周Redis入门进度不错！五种数据结构（String/Hash/List/Set/ZSet）的基本操作都掌握了，分布式锁也动手实现了库存扣减Demo。操作系统的进程管理章节看完了。但是Redis的Stream消息队列那块还没看，明天补上。总体感觉Redis挺有意思的，比MySQL好玩。",
    coach: "进度非常好！第一周完成率约85%，超出了预期。Redis的动手能力明显提升。Stream消息队列不用急，属于进阶内容，可以在下周碎片时间补。这周的亮点是分布式锁Demo——这个在面试里是高频考点，建议把实现思路整理成笔记。下周重点：Redis进阶场景（BitMap/HyperLogLog/GEO）+ 操作系统内存管理。保持节奏！"
  },
  {
    week: 2, date: "10月20日（周日）", onTrack: true,
    student: "第二周完成了Redis的BitMap签到统计、HyperLogLog UV统计和GEO附近的人，这三个功能都写了Demo。操作系统的内存管理（虚拟内存/页表/TLB）看完了CSAPP第9章。但是文件系统那块有点难，inode和硬链接软链接的关系绕来绕去。MySQL的索引优化还在看B+树的部分。LeetCode刷了8题。",
    coach: "连续两周按计划推进，非常棒！操作系统文件系统确实是难点——建议换个学习方式：不要死磕理论，去GitHub找一个ext4文件系统的源码分析笔记，对照着inode结构体看会更直观。MySQL索引可以加快节奏，重点放在Explain执行计划分析上，这个面试必考。Redis的三个进阶场景Demo做得很好，建议截图放在简历里作为技能证明。"
  },
  {
    week: 3, date: "10月27日（周日）", onTrack: false,
    student: "这周遇到了瓶颈。Spring Security和AOP比我想象的复杂——JDK动态代理和CGLIB的区别搞了半天，自定义注解也卡住了。微服务概念那一节看完视频感觉云里雾里的，Nacos和Gateway到底怎么配合还是没搞明白。唯一的好消息是操作系统IO模型（epoll/select）看懂了，小林coding的文章讲得很清楚。LeetCode刷了6题，DP还是不会。",
    coach: "第三周出现瓶颈很正常，别着急。Spring Security和AOP是Spring生态里最难啃的两块骨头——建议暂停微服务章节，先把Security+JWT的认证流程彻底搞懂（看视频+跟着敲代码）。微服务下周我会重新安排节奏，先从Nacos单机部署开始，再逐步引入Gateway。DP是算法的分水岭，建议先背5道经典DP题的模板（爬楼梯、背包、最长子序列），不求多求理解。本周完成度约65%，我把下周计划做了微调：减少2小时微服务理论，增加3小时Security实操。"
  },
  {
    week: 4, date: "11月3日（周日）", onTrack: true,
    student: "调整后的计划执行得很好！Spring Security的JWT认证流程搞懂了，搭了一个带登录鉴权的Spring Boot项目。AOP的自定义日志注解也做出来了——拦截Controller请求自动打印入参出参，感觉很有成就感。操作系统期末考试式复习用思维导图梳理完了，做了10道经典面试题。MySQL的MVCC原理（undo log + ReadView）也理解了。Phase 1的积分系统综合项目周六一口气写了5个小时，Redis BitMap签到 + ZSet排行榜 + MySQL明细持久化全通了！",
    coach: "Phase 1收尾非常漂亮！四周从Redis零基础到能独立写出积分系统，从操作系统45%提升到接近70%——这个进步速度如果保持下去，春招大有希望。综合项目建议：把积分系统部署到云服务器，写一篇技术博客（知乎/掘金），这比简历上写「熟悉Redis」有说服力100倍。下周进入Phase 2：Spring Cloud微服务 + 分布式理论 + 算法加速刷题。我会把算法任务量稍微降低（每天1题而非2题），把更多精力留给微服务项目搭建——项目才是面试的硬通货。"
  }
];

function restoreDemoData() {
  S.profile = DEMO_DATA.profile;
  S.gapReport = DEMO_DATA.gapReport;
  S.plan = DEMO_DATA.plan;
  LS.set('profile', S.profile); LS.set('gapReport', S.gapReport); LS.set('plan', S.plan);
  // Re-fill input fields
  const ri = document.getElementById('resumeInput'); if (ri && !ri.value) ri.value = DEMO_DATA.resumeText || '';
  const ti = document.getElementById('targetPosition'); if (ti && !ti.value) ti.value = '字节跳动 后端开发工程师（校招）';
  const td = document.getElementById('targetJD'); if (td && !td.value) td.value = DEMO_DATA.jdText || '';
  const si = document.getElementById('scheduleInput'); if (si && !si.value) si.value = DEMO_DATA.scheduleText || '';
  const td2 = document.getElementById('targetDate'); if (td2 && !td2.value) td2.value = '2026年春招';
}

// ═══ Demo pre-loaded data ═════════════════════════════
const DEMO_DATA = {
  // Pre-filled input field values
  resumeText: "姓名：李明\n学校：XX大学 计算机科学与技术专业 大三\nGPA：3.6/4.0\n\n【项目经历】\n1. 校园二手交易平台 2024.09-2024.12\n   后端开发，独立使用Spring Boot + MySQL + Redis开发，实现用户认证、商品发布、订单管理、消息通知等模块。日活用户200+，累计交易量500+单。\n   技术栈：Java, Spring Boot, MyBatis, MySQL, Redis, Docker\n\n2. 智能课表助手 2024.03-2024.06\n   使用Python Flask + Vue.js开发，支持课程导入、冲突检测、自习室推荐。获校级优秀项目奖。\n   技术栈：Python, Flask, Vue.js, SQLite\n\n【实习经历】\nXX科技有限公司 Java开发实习生 2024.07-2024.08\n  参与内部OA系统开发，负责审批流程模块，使用Spring Boot + MyBatis。编写单元测试30+个，代码覆盖率85%以上。\n\n【竞赛获奖】\n· 蓝桥杯程序设计竞赛 省级二等奖\n· 全国大学生数学建模竞赛 省级三等奖\n\n【技能】\n编程语言：Java（熟练）, Python（熟练）, C/C++（了解）\n框架：Spring Boot, MyBatis, Flask\n数据库：MySQL, Redis, SQLite\n工具：Git, Docker, Linux, Postman\n英语：CET-6 520分",

  jdText: "【字节跳动】后端开发工程师 - 2026届校招\n\n岗位职责：\n1. 负责公司核心业务系统的后端设计与开发，支撑亿级用户量\n2. 参与系统架构设计，解决高并发、高可用、数据一致性等挑战\n3. 编写高质量代码，保证系统的稳定性和可扩展性\n4. 参与技术方案评审、代码Review、性能优化\n\n任职要求：\n1. 2026届本科及以上学历，计算机相关专业\n2. 扎实的计算机基础：数据结构、算法、操作系统、计算机网络\n3. 熟练掌握至少一门编程语言（Java/Go/C++），熟悉常用框架\n4. 熟悉MySQL、Redis等数据库，了解分布式系统基本原理\n5. 有实际项目经验，GitHub有开源贡献者优先\n6. 良好的沟通能力和团队协作精神\n\n加分项：\n· 熟悉微服务架构（Spring Cloud / Dubbo）\n· 了解消息队列（Kafka / RocketMQ）\n· 有高并发系统设计经验\n· ACM/ICPC等编程竞赛获奖经历",

  scheduleText: "【2025-2026学年第一学期课程表】\n周一：计算机网络（8:00-9:40），操作系统（10:00-11:40），软件工程（14:00-15:40）\n周二：数据库原理（8:00-9:40），编译原理（10:00-11:40）\n周三：计算机网络（8:00-9:40），操作系统（10:00-11:40）\n周四：数据库原理（8:00-9:40），软件工程（14:00-15:40）\n周五：体育（10:00-11:40）\n\n课余时间：周一至周五 19:00-22:30，周二/周四/周五下午，周六日全天\n考试周：第17-18周",

  profile: {
    hard_skills: [
      { name: "Java", level: 78, category: "编程语言" },
      { name: "Python", level: 65, category: "编程语言" },
      { name: "Spring Boot", level: 55, category: "框架" },
      { name: "MySQL", level: 60, category: "数据库" },
      { name: "Redis", level: 25, category: "数据库" },
      { name: "数据结构", level: 70, category: "计算机基础" },
      { name: "计算机网络", level: 50, category: "计算机基础" },
      { name: "操作系统", level: 45, category: "计算机基础" },
      { name: "Git/Docker", level: 55, category: "工具" },
    ],
    soft_skills: [
      { name: "团队协作", level: 75 },
      { name: "问题解决", level: 70 },
      { name: "沟通表达", level: 65 },
    ],
    experiences: [
      { type: "实习", title: "XX科技 Java开发实习生", description: "参与OA系统审批流程模块开发，Spring Boot + MyBatis，编写30+单元测试", skills_demonstrated: ["Java","Spring Boot","MyBatis"], impact: "代码覆盖率85%+" },
      { type: "项目", title: "校园二手交易平台", description: "独立开发后端，Spring Boot + MySQL + Redis，实现用户认证、商品发布、订单管理、消息通知", skills_demonstrated: ["Java","Spring Boot","MySQL","Redis"], impact: "日活200+用户，累计500+交易" },
      { type: "项目", title: "智能课表助手", description: "Python Flask + Vue.js，支持课程导入、冲突检测、自习室推荐", skills_demonstrated: ["Python","Flask","Vue.js"], impact: "校级优秀项目奖" },
      { type: "竞赛", title: "蓝桥杯程序设计竞赛", description: "算法与数据结构竞赛", skills_demonstrated: ["Java","数据结构"], impact: "省级二等奖" },
    ],
    strength_tags: ["Java基础扎实", "有实习+项目完整经历", "竞赛获奖", "英语能力强"],
    weakness_tags: ["Redis仅入门", "分布式系统概念薄弱", "微服务经验不足", "操作系统底层知识欠缺"],
    career_preference: { industries: ["互联网"], roles: ["后端开发"], cities: ["北京","杭州","深圳"] },
    weekly_free_time_minutes: 1320,
    profile_summary: "计算机专业大三学生，Java基础扎实（78分），有科技公司实习经历和独立项目经验，蓝桥杯省级二等奖，英语CET-6 520分。主要短板：Redis仅入门水平、缺乏分布式系统实战、微服务架构经验不足。课余时间充裕（每周22小时），适合系统冲刺大厂后端开发岗位。"
  },

  gapReport: [
    { skill_name: "Redis", current_level: 25, target_level: 80, importance: 0.88, gap_score: 0.484, severity: "critical", category: "数据库", evidence: "二手交易平台中仅使用Redis做简单缓存（Set/Get），未涉及分布式锁、消息队列、持久化策略", recommended_action: "系统学习Redis五种数据结构深入用法、分布式锁Redisson、缓存击穿/穿透/雪崩解决方案、RDB/AOF持久化" },
    { skill_name: "分布式系统", current_level: 10, target_level: 75, importance: 0.85, gap_score: 0.553, severity: "critical", category: "系统设计", evidence: "简历中无任何分布式系统相关经验，未接触CAP理论、一致性协议、RPC框架", recommended_action: "学习CAP理论、Raft协议、Spring Cloud微服务架构，动手实现一个分布式项目" },
    { skill_name: "Spring Boot 进阶", current_level: 55, target_level: 85, importance: 0.9, gap_score: 0.27, severity: "moderate", category: "框架", evidence: "仅基础CRUD开发，未涉及Spring Security、AOP切面、自定义Starter、监控Actuator", recommended_action: "学习Spring Security认证鉴权、AOP日志、自定义注解、Spring Boot Actuator + Prometheus监控" },
    { skill_name: "算法与数据结构", current_level: 70, target_level: 90, importance: 0.82, gap_score: 0.164, severity: "moderate", category: "计算机基础", evidence: "竞赛有一定基础，但LeetCode刷题量仅约40题，动态规划和图论薄弱", recommended_action: "每日刷LeetCode 2-3题，30天内完成Hot 100 + 剑指Offer，重点攻克DP、DFS/BFS、二叉树" },
    { skill_name: "操作系统", current_level: 45, target_level: 75, importance: 0.7, gap_score: 0.21, severity: "moderate", category: "计算机基础", evidence: "课程学过但仅理论知识，未深入理解进程调度、内存管理、文件系统实现", recommended_action: "阅读《深入理解计算机系统》关键章节，结合Linux源码理解进程/线程/内存管理" },
    { skill_name: "MySQL 进阶", current_level: 60, target_level: 85, importance: 0.78, gap_score: 0.195, severity: "moderate", category: "数据库", evidence: "基础CRUD和简单索引OK，但SQL优化、分库分表、MVCC原理不熟", recommended_action: "学习索引原理（B+树）、Explain执行计划分析、MVCC与事务隔离级别、分库分表策略" },
    { skill_name: "项目经验", current_level: 60, target_level: 90, importance: 0.9, gap_score: 0.27, severity: "moderate", category: "项目经验", evidence: "1个实习+2个项目，但缺乏高并发、分布式项目经验", recommended_action: "完成一个微服务架构项目（Spring Cloud全家桶），一个高并发秒杀项目（Redis+MQ）" },
  ],

  plan: {
    yearly_plan: {
      year_label: "2025-2026春招冲刺",
      big_goal: "2026年春招拿到大厂后端开发Offer",
      total_weeks: 28,
      phases: [
        { phase_number: 1, title: "基础强化月", start_week: 1, end_week: 4, theme: "Redis精通 + 操作系统深入 + MySQL优化", description: "第1-4周集中攻克Redis底层原理与实战，同步复习操作系统核心概念（进程/内存/文件系统），学习MySQL索引优化与SQL调优。目标：Redis水平从25%提升至65%，操作系统从45%提升至65%。" },
        { phase_number: 2, title: "框架进阶与分布式入门", start_week: 5, end_week: 10, theme: "Spring Cloud微服务 + 分布式理论 + 算法刷题", description: "第5-10周系统学习Spring Cloud全家桶（Nacos/Gateway/Feign/Sentinel），掌握CAP理论与Raft协议，启动每日2题算法刷题计划（重点DP/DFS/二叉树）。目标：完成一个微服务项目，LeetCode刷题70+。" },
        { phase_number: 3, title: "项目实战双月", start_week: 11, end_week: 18, theme: "高并发秒杀项目 + 微服务项目收尾 + LeetCode 150", description: "第11-18周独立完成高并发秒杀系统（Redis + RocketMQ + 分布式锁），收尾微服务电商项目并部署上线，算法刷题冲刺至150题。目标：简历上新增2个高质量项目，项目经验从60%提升至85%。" },
        { phase_number: 4, title: "面试冲刺", start_week: 19, end_week: 28, theme: "八股文系统复习 + 项目深度复盘 + 模拟面试", description: "第19-28周系统复习Java/JVM/并发/MySQL/Redis/Spring/分布式面试高频题，深度复盘3个项目亮点形成面经，用Growth AI进行10+次模拟面试。目标：面试通过率80%+，拿到3+offer。" },
      ],
      key_milestones: [
        { week: 2, title: "Redis五种数据结构+分布式锁动手实战完成" },
        { week: 4, title: "操作系统核心章节复习完毕，LeetCode SQL 20题完成" },
        { week: 7, title: "Spring Cloud微服务项目框架搭建完成，Nacos+Gateway联调成功" },
        { week: 10, title: "LeetCode刷题70+，动态规划专题攻克（20题），微服务项目v1.0上线" },
        { week: 14, title: "高并发秒杀项目完成（Redis+MQ+分布式锁），LeetCode 120题" },
        { week: 18, title: "两个项目全部部署上线GitHub，README+压测报告完善，LeetCode 150题" },
        { week: 22, title: "Java/JVM/并发面试题三轮复习完成，模拟面试5次" },
        { week: 28, title: "春招投递30+，目标拿到字节/阿里/腾讯至少一个Offer" },
      ],
      weekly_plans: [
        {
          week_number: 1, theme: "Redis数据结构与缓存实战",
          slots: [
            { day: "周一", start_time: "19:00", duration_minutes: 90, skill_name: "Redis String/Hash", task_description: "看B站Redis教程P1-P8，掌握String和Hash的底层编码（SDS/ziplist/hashtable）及20+常用命令", resource_type: "video", resource_id: "redis_basic_1" },
            { day: "周二", start_time: "19:00", duration_minutes: 90, skill_name: "Redis List/Set/ZSet", task_description: "学习List/Set/ZSet的底层实现（quicklist/skiplist），动手实现一个简易排行榜Demo", resource_type: "video+project", resource_id: "redis_basic_2" },
            { day: "周三", start_time: "14:00", duration_minutes: 120, skill_name: "Redis 分布式锁", task_description: "学习Redisson分布式锁原理（watchdog/可重入/公平锁），实现一个防止超卖的库存扣减Demo", resource_type: "project", resource_id: "redis_lock" },
            { day: "周四", start_time: "19:00", duration_minutes: 60, skill_name: "Redis 持久化", task_description: "学习RDB快照vs AOF日志的优缺点、混合持久化配置、数据恢复实战", resource_type: "article", resource_id: "redis_persist" },
            { day: "周五", start_time: "19:00", duration_minutes: 90, skill_name: "操作系统", task_description: "复习进程管理：PCB、五状态模型、fork()、孤儿进程与僵尸进程、waitpid", resource_type: "book+video", resource_id: "os_process" },
            { day: "周六", start_time: "09:00", duration_minutes: 180, skill_name: "Redis综合实战", task_description: "完成本周Redis学习总结，动手实现：缓存穿透布隆过滤器方案、缓存击穿互斥锁方案、缓存雪崩随机过期方案", resource_type: "project", resource_id: "redis_project_1" },
            { day: "周日", start_time: "14:00", duration_minutes: 120, skill_name: "周复习", task_description: "艾宾浩斯复习：回顾Redis五种数据结构命令、分布式锁实现、持久化配置。做LeetCode SQL 5题", resource_type: "practice", resource_id: "review_w1" },
          ],
          total_minutes: 750, milestone_this_week: "Redis五种数据结构全部动手实现Demo，分布式锁库存扣减Demo完成"
        },
        {
          week_number: 2, theme: "Redis进阶场景 + 操作系统内存管理",
          slots: [
            { day: "周一", start_time: "19:00", duration_minutes: 90, skill_name: "Redis BitMap/HyperLogLog", task_description: "学习BitMap签到统计、HyperLogLog UV统计、GEO附近的人，每个场景写一个Demo", resource_type: "video", resource_id: "redis_adv_1" },
            { day: "周二", start_time: "14:00", duration_minutes: 120, skill_name: "Redis Stream/消息队列", task_description: "学习Redis Stream消息队列，对比Kafka/RocketMQ，实现一个简单的异步任务处理系统", resource_type: "project", resource_id: "redis_stream" },
            { day: "周三", start_time: "19:00", duration_minutes: 90, skill_name: "操作系统内存管理", task_description: "学习虚拟内存、页表、TLB、缺页中断、LRU页面置换算法。读《CSAPP》第9章", resource_type: "book", resource_id: "os_memory" },
            { day: "周四", start_time: "19:00", duration_minutes: 60, skill_name: "MySQL 索引优化", task_description: "学习B+树索引原理、聚簇索引vs非聚簇索引、覆盖索引、最左前缀原则，Explain分析实战5个SQL", resource_type: "video", resource_id: "mysql_index" },
            { day: "周五", start_time: "19:00", duration_minutes: 90, skill_name: "操作系统进程调度", task_description: "学习CFS完全公平调度、O(1)调度、实时调度。对比Linux与Windows。做5道LeetCode", resource_type: "book+practice", resource_id: "os_schedule" },
            { day: "周六", start_time: "09:00", duration_minutes: 240, skill_name: "Redis综合项目", task_description: "整合本周知识，实现一个基于Redis的点赞系统（Set）、排行榜（ZSet）、签到（BitMap）的综合Demo", resource_type: "project", resource_id: "redis_project_2" },
            { day: "周日", start_time: "14:00", duration_minutes: 120, skill_name: "周复习+算法", task_description: "回顾Redis进阶场景、操作系统内存/调度。刷LeetCode Hot 100 10题，SQL 5题", resource_type: "practice", resource_id: "review_w2" },
          ],
          total_minutes: 810, milestone_this_week: "Redis进阶场景全部实现Demo，操作系统内存管理章节掌握，LeetCode累计20题"
        },
        {
          week_number: 3, theme: "操作系统收尾 + Spring Boot进阶 + 微服务入门",
          slots: [
            { day: "周一", start_time: "19:00", duration_minutes: 90, skill_name: "操作系统文件系统", task_description: "学习inode、硬链接vs软链接、ext4文件系统结构、VFS虚拟文件系统", resource_type: "book+video", resource_id: "os_fs" },
            { day: "周二", start_time: "19:00", duration_minutes: 90, skill_name: "操作系统IO模型", task_description: "学习同步/异步/阻塞/非阻塞IO、epoll原理、零拷贝sendfile。做5道LeetCode", resource_type: "video+practice", resource_id: "os_io" },
            { day: "周三", start_time: "14:00", duration_minutes: 150, skill_name: "Spring Security", task_description: "学习认证（JWT/OAuth2）与授权（RBAC）原理，实现一个带登录鉴权的Spring Boot项目", resource_type: "project", resource_id: "spring_security" },
            { day: "周四", start_time: "19:00", duration_minutes: 90, skill_name: "Spring AOP", task_description: "学习AOP原理（JDK动态代理/CGLIB），实现自定义日志注解、接口耗时统计、全局异常处理", resource_type: "video+project", resource_id: "spring_aop" },
            { day: "周五", start_time: "19:00", duration_minutes: 90, skill_name: "微服务概念", task_description: "学习微服务架构概述：服务注册/发现、配置中心、API网关、负载均衡。对比Dubbo vs Spring Cloud", resource_type: "video", resource_id: "microservice_intro" },
            { day: "周六", start_time: "09:00", duration_minutes: 240, skill_name: "Spring Boot综合实战", task_description: "搭建一个整合Security + AOP + MyBatis + Redis的完整Spring Boot项目骨架，作为后续微服务项目的基础", resource_type: "project", resource_id: "spring_project" },
            { day: "周日", start_time: "14:00", duration_minutes: 120, skill_name: "周复习", task_description: "回顾操作系统IO模型和文件系统、Spring Security/AOP。刷LeetCode 8题（重点DP入门5题）", resource_type: "practice", resource_id: "review_w3" },
          ],
          total_minutes: 870, milestone_this_week: "Spring Boot项目骨架搭建完成（整合Security+AOP+Redis），LeetCode累计28题"
        },
        {
          week_number: 4, theme: "操作系统收尾 + MySQL优化 + 阶段总结",
          slots: [
            { day: "周一", start_time: "19:00", duration_minutes: 90, skill_name: "操作系统期末考试式复习", task_description: "用思维导图梳理操作系统全部章节：进程/内存/文件/IO/调度。刷题巩固10道经典面试题", resource_type: "practice", resource_id: "os_review" },
            { day: "周二", start_time: "19:00", duration_minutes: 90, skill_name: "MySQL MVCC与事务", task_description: "学习MVCC实现原理（undo log + ReadView）、四种隔离级别的实现差异、幻读解决", resource_type: "video+article", resource_id: "mysql_mvcc" },
            { day: "周三", start_time: "14:00", duration_minutes: 120, skill_name: "MySQL 分库分表", task_description: "学习水平分库分表策略（range/hash/mod）、ShardingSphere实战、分布式ID生成（雪花算法）", resource_type: "project", resource_id: "mysql_shard" },
            { day: "周四", start_time: "19:00", duration_minutes: 60, skill_name: "MySQL 慢查询优化", task_description: "使用慢查询日志+Explain+Tracing分析5条实际慢SQL，写出优化方案并验证", resource_type: "practice", resource_id: "mysql_slow" },
            { day: "周五", start_time: "19:00", duration_minutes: 90, skill_name: "Phase 1 阶段总结", task_description: "用思维导图总结前4周所有学习内容：Redis全部/操作系统核心/MySQL优化/Spring Boot进阶。标记薄弱环节", resource_type: "practice", resource_id: "phase1_review" },
            { day: "周六", start_time: "09:00", duration_minutes: 180, skill_name: "Phase 1 收尾项目", task_description: "用Spring Boot + Redis + MySQL完成一个「用户积分系统」：签到送积分(BitMap)、积分排行榜(ZSet)、积分明细持久化、接口鉴权", resource_type: "project", resource_id: "phase1_project" },
            { day: "周日", start_time: "14:00", duration_minutes: 120, skill_name: "总复习", task_description: "系统回顾Phase 1全部内容。刷LeetCode 10题（重点栈/队列/哈希）。为Phase 2做准备", resource_type: "practice", resource_id: "review_w4" },
          ],
          total_minutes: 750, milestone_this_week: "Phase 1全面完成：Redis从25%→65%，操作系统从45%→65%，MySQL从60%→72%，LeetCode累计38题，Spring Boot综合项目骨架完成"
        },
      ],
      target_match_improvement: { from: 38, to: 80 }
    }
  }
};

// Resource library with real links
const RESOURCE_LIBRARY = {
  redis_basic_1: { name: "Redis入门教程（黑马程序员）", url: "https://www.bilibili.com/video/BV1Rv41177Af", platform: "B站", type: "video" },
  redis_basic_2: { name: "Redis核心数据结构详解", url: "https://www.bilibili.com/video/BV1CJ411m7Gc", platform: "B站", type: "video" },
  redis_lock: { name: "Redisson分布式锁实战", url: "https://github.com/redisson/redisson", platform: "GitHub", type: "project" },
  redis_persist: { name: "Redis持久化机制详解（小林coding）", url: "https://xiaolincoding.com/redis/storage/rdb.html", platform: "小林coding", type: "article" },
  redis_adv_1: { name: "Redis高级数据类型实战", url: "https://www.bilibili.com/video/BV1S54y1R7SB", platform: "B站", type: "video" },
  redis_stream: { name: "Redis Stream消息队列", url: "https://redis.io/docs/latest/develop/data-types/streams/", platform: "官网", type: "article" },
  redis_project_1: { name: "Redis缓存实战项目", url: "https://github.com/dunwu/db-tutorial", platform: "GitHub", type: "project" },
  redis_project_2: { name: "Redis社交功能Demo", url: "https://github.com/coding-huang/redis-demo", platform: "GitHub", type: "project" },
  os_process: { name: "操作系统进程管理（王道考研）", url: "https://www.bilibili.com/video/BV1YE411D7nH", platform: "B站", type: "video" },
  os_memory: { name: "《深入理解计算机系统》CSAPP", url: "https://github.com/huangrt01/CSAPP", platform: "GitHub", type: "book" },
  os_schedule: { name: "Linux CFS调度器源码分析", url: "https://github.com/torvalds/linux/tree/master/kernel/sched", platform: "GitHub", type: "code" },
  os_fs: { name: "文件系统inode详解", url: "https://www.bilibili.com/video/BV1Ch4y1f7F3", platform: "B站", type: "video" },
  os_io: { name: "Linux IO模型与epoll", url: "https://xiaolincoding.com/os/8_network_system/selete_poll_epoll.html", platform: "小林coding", type: "article" },
  os_review: { name: "操作系统面试突击", url: "https://github.com/CyC2018/CS-Notes", platform: "GitHub", type: "book" },
  mysql_index: { name: "MySQL索引优化实战（尚硅谷）", url: "https://www.bilibili.com/video/BV1Kr4y1i7ru", platform: "B站", type: "video" },
  mysql_mvcc: { name: "MySQL MVCC原理深入", url: "https://xiaolincoding.com/mysql/transaction/mvcc.html", platform: "小林coding", type: "article" },
  mysql_shard: { name: "ShardingSphere分库分表实战", url: "https://shardingsphere.apache.org/", platform: "官网", type: "project" },
  mysql_slow: { name: "MySQL慢查询优化指南", url: "https://github.com/datacharmer/test_db", platform: "GitHub", type: "practice" },
  spring_security: { name: "Spring Security + JWT实战", url: "https://www.bilibili.com/video/BV1mm4y1X7Hc", platform: "B站", type: "video" },
  spring_aop: { name: "Spring AOP原理与实战", url: "https://www.bilibili.com/video/BV1pJ411S7WH", platform: "B站", type: "video" },
  spring_project: { name: "Spring Boot企业级项目骨架", url: "https://github.com/zhoutaoo/SpringCloud", platform: "GitHub", type: "project" },
  microservice_intro: { name: "Spring Cloud微服务入门（尚硅谷）", url: "https://www.bilibili.com/video/BV1LQ4y127n4", platform: "B站", type: "video" },
  phase1_review: { name: "Java后端学习路线思维导图", url: "https://github.com/xingshaocheng/architect-awesome", platform: "GitHub", type: "article" },
  phase1_project: { name: "用户积分系统项目模板", url: "https://github.com/macrozheng/mall", platform: "GitHub", type: "project" },
  review_w1: { name: "LeetCode SQL题库", url: "https://leetcode.cn/problemset/database/", platform: "LeetCode", type: "practice" },
  review_w2: { name: "LeetCode Hot 100", url: "https://leetcode.cn/problem-list/2cktkvj/", platform: "LeetCode", type: "practice" },
  review_w3: { name: "LeetCode动态规划入门", url: "https://leetcode.cn/problem-list/50v4n7dd/", platform: "LeetCode", type: "practice" },
  review_w4: { name: "LeetCode栈和队列", url: "https://leetcode.cn/problem-list/2cktkvj/", platform: "LeetCode", type: "practice" },
};
