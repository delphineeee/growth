// ── State ─────────────────────────────────────────────
const S = {
  user: null, mode: 'login', authToken: null,
  profile: null, profileState: null,
  gapReport: null, plan: null,
};

const API = '/api';

async function api(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

// ── Auth ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('growth_user');
  if (saved) { S.user = JSON.parse(saved); showApp(); }
});

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

  try {
    const r = await api('/auth/' + S.mode, { username: u, password: p, email: u + '@growth.ai' });
    if (r.ok) { S.user = r.user; localStorage.setItem('growth_user', JSON.stringify(r.user)); showApp(); }
    else alert(r.msg || '操作失败');
  } catch (err) { alert('服务器连接失败，请稍后重试'); }
}

async function demoLogin() {
  document.getElementById('authUser').value = 'demo';
  document.getElementById('authPass').value = 'demo123';
  document.getElementById('authBtn').click();
}

function logout() {
  localStorage.removeItem('growth_user');
  S.user = null; S.profile = null; S.gapReport = null; S.plan = null;
  document.getElementById('authGate').style.display = '';
  document.getElementById('appRoot').style.display = 'none';
}

function showApp() {
  document.getElementById('authGate').style.display = 'none';
  document.getElementById('appRoot').style.display = 'flex';
  document.getElementById('sidebarUser').textContent = (S.user || {}).username || '用户';
}

// ── Navigation ─────────────────────────────────────────
document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
  });
});

// ── Page 1: Profile Builder ────────────────────────────
async function buildProfile() {
  const resume = document.getElementById('resumeInput').value.trim();
  const schedule = document.getElementById('scheduleInput').value.trim();
  if (!resume) return alert('请先输入简历内容');

  const el = document.getElementById('profileResult');
  el.innerHTML = '<div class="spinner"></div> AI 正在分析...';
  try {
    const r = await api('/profile/build', { resume_text: resume, schedule_text: schedule, user_id: S.user?.id || 'demo' });
    S.profile = r.profile;
    S.profileState = r;
    el.innerHTML = '<p style="color:var(--accent);font-weight:700;">画像构建完成</p>';

    const skills = (r.profile.hard_skills || []).concat(r.profile.soft_skills || []);
    el.innerHTML += '<div style="margin-top:8px;">' + skills.map(s =>
      '<span class="skill-tag">' + (s.name || s) + '</span>'
    ).join('') + '</div>';

    el.innerHTML += '<p style="margin-top:12px;"><strong>AI 总结：</strong>' + (r.profile.profile_summary || '') + '</p>';
    el.innerHTML += '<p style="margin-top:8px;"><strong>核心优势：</strong>' + (r.profile.strength_tags || []).join('，') + '</p>';
    el.innerHTML += '<p><strong>待提升：</strong>' + (r.profile.weakness_tags || []).join('，') + '</p>';

    // Show chat if available
    const questions = (r.questions || []).filter(q => q && q.includes('?'));
    if (questions.length > 0) {
      document.getElementById('profileChat').style.display = '';
      const chatDiv = document.getElementById('chatMessages');
      chatDiv.innerHTML = questions.map(q => '<p style="background:rgba(15,133,118,0.06);padding:10px 14px;border-radius:12px;margin:6px 0;">AI：' + q + '</p>').join('');
      S._lastQuestions = questions;
    }
  } catch (e) { el.innerHTML = '<p style="color:var(--danger);">连接失败：' + e.message + '</p>'; }
}

async function sendAnswer() {
  const input = document.getElementById('chatInput');
  const answer = input.value.trim();
  if (!answer) return;
  const chatDiv = document.getElementById('chatMessages');
  chatDiv.innerHTML += '<p style="padding:10px 14px;margin:6px 0;text-align:right;color:var(--accent-strong);">你：' + answer + '</p>';
  input.value = '';

  // Rebuild with answer context
  document.getElementById('profileResult').innerHTML += '<div class="spinner"></div> AI 正在分析你的回答...';
  try {
    const r = await api('/profile/build', {
      resume_text: document.getElementById('resumeInput').value.trim() + '\n用户补充：' + answer,
      schedule_text: document.getElementById('scheduleInput').value.trim(),
      user_id: S.user?.id || 'demo'
    });
    S.profile = r.profile;
    document.getElementById('profileResult').innerHTML = '<p style="color:var(--accent);font-weight:700;">画像已更新</p>';
    const skills = (r.profile.hard_skills || []).concat(r.profile.soft_skills || []);
    document.getElementById('profileResult').innerHTML += '<div style="margin-top:8px;">' + skills.map(s =>
      '<span class="skill-tag">' + (s.name || s) + '</span>'
    ).join('') + '</div>';
    document.getElementById('profileResult').innerHTML += '<p style="margin-top:8px;">' + (r.profile.profile_summary || '') + '</p>';
  } catch (e) { chatDiv.innerHTML += '<p style="color:var(--danger);">出错：' + e.message + '</p>'; }
}

// ── Page 2: Target Analysis ────────────────────────────
async function analyzeTarget() {
  const pos = document.getElementById('targetPosition').value.trim();
  if (!pos) return alert('请输入目标岗位');
  if (!S.profile) return alert('请先在 Step 1 构建画像');

  const el = document.getElementById('targetResult');
  el.innerHTML = '<div class="spinner"></div> AI 正在分析技能差距...';
  try {
    const r = await api('/analyze', {
      profile: S.profile,
      position_name: pos,
      jd_text: document.getElementById('targetJD').value.trim(),
    });
    S.gapReport = r.gaps || [];
    el.innerHTML = '<p style="font-size:1.5rem;font-weight:700;color:var(--accent-strong);">匹配度：' + (r.overall_match || 0) + '%</p>';
    el.innerHTML += '<p style="color:var(--muted);">' + (r.summary || '') + '</p>';

    (r.gaps || []).forEach(g => {
      const sev = g.severity === 'critical' ? 'badge-warn' : (g.severity === 'moderate' ? 'badge' : 'badge-ok');
      el.innerHTML += '<div class="gap-row"><div><strong>' + g.skill_name + '</strong><br><small>当前 ' + (g.current_level || 0) + '% → 目标 ' + (g.target_level || 80) + '%</small></div><span class="badge ' + sev + '">' + (g.severity || '') + '</span></div>';
    });
  } catch (e) { el.innerHTML = '<p style="color:var(--danger);">连接失败：' + e.message + '</p>'; }
}

// ── Page 3: Learning Path ──────────────────────────────
async function generatePath() {
  if (!S.profile) return alert('请先在 Step 1 构建画像');
  if (!S.gapReport || !S.gapReport.length) return alert('请先在 Step 2 分析目标岗位');

  const el = document.getElementById('pathResult');
  el.innerHTML = '<div class="spinner"></div> AI 正在生成学习路径...';
  try {
    const r = await api('/plan/generate', {
      profile: S.profile,
      gap_report: S.gapReport,
      position_name: document.getElementById('targetPosition').value || '自定义岗位',
      target_date: document.getElementById('targetDate').value || '6个月后',
    });
    S.plan = r.growth_plan || {};
    const yp = (S.plan.yearly_plan || S.plan);

    el.innerHTML = '<p style="font-weight:700;color:var(--accent-strong);">学习路径已生成</p>';
    el.innerHTML += '<p>总时长：<strong>' + (yp.total_weeks || '?') + ' 周</strong></p>';

    (yp.phases || []).forEach(p => {
      el.innerHTML += '<div style="margin:8px 0;padding:12px 16px;background:rgba(255,255,255,0.6);border-radius:12px;border:1px solid var(--line);"><strong>Phase ' + (p.phase_number || '') + ' — ' + (p.title || '') + '</strong>（第' + (p.start_week || '') + '-' + (p.end_week || '') + '周）<br>' + (p.description || '') + '</div>';
    });

    if ((yp.key_milestones || []).length) {
      el.innerHTML += '<p style="margin-top:12px;font-weight:700;">关键里程碑：</p>';
      (yp.key_milestones || []).forEach(m => {
        el.innerHTML += '<div class="milestone">Week ' + m.week + '：' + m.title + ' — ' + (m.description || '') + '</div>';
      });
    }
  } catch (e) { el.innerHTML = '<p style="color:var(--danger);">连接失败：' + e.message + '</p>'; }
}

// ── Page 4: Resources ──────────────────────────────────
async function getResources() {
  const el = document.getElementById('resourcesResult');
  if (!S.gapReport || !S.gapReport.length) {
    el.innerHTML = '<p style="color:var(--muted);">请先完成 Step 2（目标岗位分析）和 Step 3（生成学习路径）。</p>';
    return;
  }
  el.innerHTML = '<div class="spinner"></div> AI 正在搜索全网学习资源...';
  try {
    const r = await api('/chat', {
      message: '根据以下技能差距，推荐 B站、小红书、GitHub、MOOC 上的学习资源：' + JSON.stringify(S.gapReport.slice(0, 5)),
      profile: S.profile,
      gap_report: S.gapReport,
    });
    el.innerHTML = '<p style="font-weight:700;color:var(--accent-strong);">AI 资源推荐</p>';
    el.innerHTML += '<div style="white-space:pre-wrap;line-height:1.8;">' + (r.reply || '') + '</div>';
  } catch (e) { el.innerHTML = '<p style="color:var(--danger);">连接失败：' + e.message + '</p>'; }
}

// ── Page 5: Check-in ───────────────────────────────────
async function doCheckin() {
  const input = document.getElementById('checkinInput').value.trim();
  if (!input) return alert('请输入你的学习进展');
  const el = document.getElementById('checkinResult');
  el.innerHTML = '<div class="spinner"></div> AI 正在分析你的进度...';
  try {
    const r = await api('/chat', {
      message: '本周学习回访。用户反馈：' + input + '。请评估进度，给出鼓励和调整建议。',
      profile: S.profile,
      gap_report: S.gapReport,
    });
    el.innerHTML = '<div style="white-space:pre-wrap;line-height:1.8;padding:16px;background:rgba(15,133,118,0.04);border-radius:14px;">' + (r.reply || '') + '</div>';
    document.getElementById('checkinStatus').textContent = '已回访';
    document.getElementById('checkinStatus').className = 'badge badge-ok';
  } catch (e) { el.innerHTML = '<p style="color:var(--danger);">连接失败：' + e.message + '</p>'; }
}
