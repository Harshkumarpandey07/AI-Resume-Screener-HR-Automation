// ============================================================
// HireAI — Complete Frontend Application
// ============================================================

const API_BASE = 'http://localhost:8000/api';

// ─── STATE ───────────────────────────────────────────────────
const state = {
  jobs: [],
  candidates: [],
  emailHistory: [],
  settings: {},
  pendingFiles: [],
  currentCandidate: null,
  charts: {},
  pendingSend: null,
};

// ─── NAVIGATION ──────────────────────────────────────────────
function navigate(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('pageTitle').textContent =
    { dashboard: 'Dashboard', jobs: 'Job Postings', screen: 'AI Screening',
      candidates: 'Candidates', emails: 'Email Campaigns', settings: 'Settings' }[page] || page;
  if (page === 'dashboard') refreshDashboard();
  if (page === 'candidates') renderAllCandidates();
  if (page === 'emails') refreshEmailPage();
  return false;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function toggleNotif() {
  document.getElementById('notifPanel').classList.toggle('show');
}

// ─── TOAST ───────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').prepend(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── MODALS ──────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ─── JOBS ─────────────────────────────────────────────────────
function openJobModal(job = null) {
  ['jobTitle','jobDept','jobLocation','jobDescription','jobSkills'].forEach(id => {
    document.getElementById(id).value = job ? (job[id.replace('job','').toLowerCase()] || '') : '';
  });
  openModal('jobModal');
}

async function saveJob() {
  const job = {
    id: Date.now().toString(),
    title: document.getElementById('jobTitle').value.trim(),
    department: document.getElementById('jobDept').value.trim(),
    location: document.getElementById('jobLocation').value.trim(),
    description: document.getElementById('jobDescription').value.trim(),
    skills: document.getElementById('jobSkills').value.split(',').map(s=>s.trim()).filter(Boolean),
    createdAt: new Date().toISOString(),
    candidateCount: 0,
  };
  if (!job.title || !job.description) { toast('Title and description are required', 'error'); return; }

  try {
    const res = await apiFetch('/jobs', { method: 'POST', body: JSON.stringify(job) });
    state.jobs.push(res);
  } catch {
    state.jobs.push(job); // fallback to local
  }
  saveLocal();
  renderJobs();
  closeModal('jobModal');
  toast(`Job "${job.title}" added!`, 'success');
  updateJobSelects();
}

function renderJobs() {
  const grid = document.getElementById('jobsGrid');
  if (!state.jobs.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text2)">
      <div style="font-size:3rem">💼</div><p>No jobs yet. Add your first job posting!</p></div>`;
    return;
  }
  grid.innerHTML = state.jobs.map(j => `
    <div class="job-card">
      <div class="job-card-title">${j.title}</div>
      <div class="job-card-dept">${j.department || 'General'}</div>
      <div class="job-card-meta">
        <span class="job-meta-item">📍 ${j.location || 'Remote'}</span>
        <span class="job-meta-item">👥 ${j.candidateCount || 0} screened</span>
      </div>
      <div class="job-skills">${(j.skills||[]).slice(0,5).map(s=>`<span class="skill-tag">${s}</span>`).join('')}</div>
      <div class="job-card-actions">
        <button class="btn-outline btn-sm" onclick="screenForJob('${j.id}')">🤖 Screen</button>
        <button class="btn-danger btn-sm" onclick="deleteJob('${j.id}')">🗑</button>
      </div>
    </div>`).join('');
}

function deleteJob(id) {
  state.jobs = state.jobs.filter(j => j.id !== id);
  saveLocal(); renderJobs(); updateJobSelects();
  toast('Job deleted', 'info');
}

function screenForJob(id) {
  navigate('screen', document.querySelector('[data-page=screen]'));
  setTimeout(() => {
    const sel = document.getElementById('screenJobSelect');
    if (sel) sel.value = id;
  }, 100);
}

function updateJobSelects() {
  ['screenJobSelect','filterJob'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isFilter = id === 'filterJob';
    el.innerHTML = `<option value="">${isFilter ? 'All Jobs' : '-- Select position --'}</option>` +
      state.jobs.map(j => `<option value="${j.id}">${j.title}</option>`).join('');
  });
}

// ─── FILE UPLOAD ──────────────────────────────────────────────
function handleFiles(files) {
  Array.from(files).forEach(f => {
    if (!state.pendingFiles.find(p => p.name === f.name)) state.pendingFiles.push(f);
  });
  renderFileList();
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
}

function renderFileList() {
  const el = document.getElementById('fileList');
  el.innerHTML = state.pendingFiles.map((f, i) => `
    <div class="file-item">
      <span>📄 ${f.name}</span>
      <span>${(f.size/1024).toFixed(0)}KB
        <button onclick="removeFile(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;margin-left:8px">✕</button>
      </span>
    </div>`).join('');
}

function removeFile(i) {
  state.pendingFiles.splice(i, 1);
  renderFileList();
}

// ─── AI SCREENING ─────────────────────────────────────────────
async function startScreening() {
  const jobId = document.getElementById('screenJobSelect').value;
  const customJD = document.getElementById('customJD').value.trim();
  const threshold = parseInt(document.getElementById('threshold').value);

  if (!jobId && !customJD) { toast('Select a job or enter a description', 'error'); return; }
  if (!state.pendingFiles.length) { toast('Upload at least one resume', 'error'); return; }

  const job = state.jobs.find(j => j.id === jobId);
  const jd = customJD || (job ? job.description : '');

  const btn = document.getElementById('screenBtn');
  btn.innerHTML = `<span class="spinner"></span> Screening with AI...`;
  btn.disabled = true;
  document.getElementById('resultsPlaceholder').style.display = 'none';
  document.getElementById('screeningResults').style.display = 'block';
  document.getElementById('screeningResults').innerHTML = `
    <div style="text-align:center;padding:40px;color:var(--text2)">
      <div class="spinner" style="width:32px;height:32px;margin:0 auto 16px;border-width:3px"></div>
      <p>AI is analyzing ${state.pendingFiles.length} resume(s)...</p>
    </div>`;

  const results = [];
  for (const file of state.pendingFiles) {
    try {
      const result = await screenSingleResume(file, jd, job?.title || 'Position', threshold);
      results.push(result);
      renderScreeningResults(results);
    } catch (err) {
      results.push({ name: file.name, error: err.message });
    }
  }

  // Save candidates
  results.filter(r => !r.error).forEach(r => {
    const candidate = {
      id: Date.now().toString() + Math.random(),
      name: r.name,
      email: r.email || `${r.name.toLowerCase().replace(/\s/g,'')}@example.com`,
      position: job?.title || 'General',
      jobId: jobId || null,
      score: r.score,
      decision: r.decision,
      strengths: r.strengths || [],
      missing: r.missing || [],
      recommendation: r.recommendation || '',
      resumeText: r.resumeText || '',
      emailSent: false,
      screenedAt: new Date().toISOString(),
    };
    state.candidates.push(candidate);
    if (job) job.candidateCount = (job.candidateCount||0)+1;
  });

  saveLocal();
  refreshDashboard();
  btn.innerHTML = '🤖 Start AI Screening';
  btn.disabled = false;
  state.pendingFiles = [];
  renderFileList();
  toast(`Screened ${results.length} resume(s)!`, 'success');
}

async function screenSingleResume(file, jd, jobTitle, threshold) {
  // In production this calls the backend; here we call Claude API directly
  const settings = loadSettings();
  const apiKey = settings.anthropicKey;

  // Read file as text (simulate parsing)
  const resumeText = await readFileAsText(file);

  const prompt = `You are an expert HR screening AI. Analyze this resume for the given job and respond ONLY with a JSON object.

JOB TITLE: ${jobTitle}

JOB DESCRIPTION:
${jd}

RESUME CONTENT (filename: ${file.name}):
${resumeText.substring(0, 4000)}

Respond with ONLY this JSON (no markdown, no extra text):
{
  "candidate_name": "extracted full name or 'Unknown'",
  "candidate_email": "extracted email or ''",
  "score": <integer 0-100>,
  "decision": "<ACCEPT|INTERVIEW|REJECT based on score vs threshold ${threshold}>",
  "strengths": ["strength1","strength2","strength3"],
  "missing_skills": ["skill1","skill2"],
  "recommendation": "2-3 sentence professional recommendation",
  "years_experience": <number or null>,
  "education": "highest degree"
}`;

  if (!apiKey) {
    // Demo mode — generate mock results
    return generateMockResult(file.name, jobTitle, threshold);
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: settings.aiModel || 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  const text = data.content[0].text.replace(/```json|```/g,'').trim();
  const parsed = JSON.parse(text);

  return {
    name: parsed.candidate_name,
    email: parsed.candidate_email,
    score: parsed.score,
    decision: parsed.decision,
    strengths: parsed.strengths,
    missing: parsed.missing_skills,
    recommendation: parsed.recommendation,
    experience: parsed.years_experience,
    education: parsed.education,
    resumeText: resumeText.substring(0, 500),
  };
}

function generateMockResult(filename, jobTitle, threshold) {
  const names = ['Alex Johnson','Priya Sharma','Marcus Chen','Sofia Rodriguez','James Wilson','Amelia Patel'];
  const name = names[Math.floor(Math.random()*names.length)];
  const score = Math.floor(Math.random()*60)+30;
  const decision = score >= threshold ? 'ACCEPT' : score >= threshold-20 ? 'INTERVIEW' : 'REJECT';
  return {
    name, email: `${name.toLowerCase().replace(' ','.')}@email.com`,
    score, decision,
    strengths: ['Strong communication','Relevant experience','Problem-solving skills'],
    missing: ['AWS certification','Team lead experience'],
    recommendation: `${name} shows ${score >= 70 ? 'strong' : 'moderate'} alignment with the ${jobTitle} role. ${score >= 70 ? 'Highly recommended for next steps.' : 'Consider for a screening call.'}`,
    experience: Math.floor(Math.random()*8)+1,
    education: ['BS Computer Science','MS Engineering','BA Business','PhD Physics'][Math.floor(Math.random()*4)],
    resumeText: '(Demo mode — add Anthropic API key in Settings for real AI screening)',
  };
}

async function readFileAsText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result || `[Binary file: ${file.name}]`);
    reader.onerror = () => resolve(`[Could not read: ${file.name}]`);
    if (file.type === 'text/plain') reader.readAsText(file);
    else reader.readAsText(file); // For demo; production uses backend parser
  });
}

function renderScreeningResults(results) {
  const el = document.getElementById('screeningResults');
  el.innerHTML = results.map(r => {
    if (r.error) return `<div class="result-card"><div style="color:var(--red)">❌ ${r.name}: ${r.error}</div></div>`;
    const color = r.decision==='ACCEPT' ? '#10b981' : r.decision==='INTERVIEW' ? '#f59e0b' : '#ef4444';
    const bg = r.decision==='ACCEPT' ? 'rgba(16,185,129,.15)' : r.decision==='INTERVIEW' ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.15)';
    return `<div class="result-card">
      <div class="result-header">
        <div>
          <div class="result-name">${r.name}</div>
          <div class="decision-badge ${r.decision==='ACCEPT'?'badge-accept':r.decision==='INTERVIEW'?'badge-interview':'badge-reject'}" style="margin-top:6px">${r.decision}</div>
        </div>
        <div class="result-score-circle" style="background:${bg};color:${color}">${r.score}</div>
      </div>
      <div class="score-bar" style="margin-bottom:10px"><div class="score-fill" style="width:${r.score}%;background:${color}"></div></div>
      <div style="font-size:.82rem;color:var(--text2);margin-bottom:10px">${r.recommendation}</div>
      <div class="result-tags">
        ${(r.strengths||[]).map(s=>`<span class="tag tag-green">✓ ${s}</span>`).join('')}
        ${(r.missing||[]).map(s=>`<span class="tag tag-red">✗ ${s}</span>`).join('')}
      </div>
    </div>`;
  }).join('');
}

// ─── CANDIDATES PAGE ─────────────────────────────────────────
function filterCandidates() {
  const decision = document.getElementById('filterDecision').value;
  const jobId = document.getElementById('filterJob').value;
  let filtered = state.candidates;
  if (decision) filtered = filtered.filter(c => c.decision === decision);
  if (jobId) filtered = filtered.filter(c => c.jobId === jobId);
  renderCandidateTable(filtered);
}

function renderAllCandidates() {
  updateJobSelects();
  filterCandidates();
}

function renderCandidateTable(candidates) {
  const tbody = document.getElementById('allCandidates');
  if (!candidates.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text2)">No candidates found</td></tr>`;
    return;
  }
  tbody.innerHTML = candidates.map(c => {
    const color = c.score >= 75 ? '#10b981' : c.score >= 50 ? '#f59e0b' : '#ef4444';
    return `<tr>
      <td><div style="font-weight:600">${c.name}</div><div style="font-size:.78rem;color:var(--text2)">${c.email}</div></td>
      <td>${c.position}</td>
      <td><div class="score-wrap">
        <div class="score-bar"><div class="score-fill" style="width:${c.score}%;background:${color}"></div></div>
        <span style="font-weight:700;color:${color}">${c.score}</span>
      </div></td>
      <td><span class="decision-badge ${c.decision==='ACCEPT'?'badge-accept':c.decision==='INTERVIEW'?'badge-interview':'badge-reject'}">${c.decision}</span></td>
      <td>${(c.strengths||[]).slice(0,2).map(s=>`<span class="tag tag-green">${s}</span>`).join(' ')}</td>
      <td style="color:var(--text2);font-size:.8rem">${new Date(c.screenedAt).toLocaleDateString()}</td>
      <td>
        <button class="btn-outline btn-sm" onclick="viewCandidate('${c.id}')">👁 View</button>
        <button class="btn-outline btn-sm" style="margin-left:6px" onclick="sendEmailToOne('${c.id}')">📧</button>
      </td>
    </tr>`;
  }).join('');
}

function viewCandidate(id) {
  const c = state.candidates.find(x => x.id === id);
  if (!c) return;
  state.currentCandidate = c;
  const color = c.score >= 75 ? '#10b981' : c.score >= 50 ? '#f59e0b' : '#ef4444';
  document.getElementById('candidateDetailContent').innerHTML = `
    <div class="candidate-profile">
      <div class="profile-section">
        <h4>📋 Basic Info</h4>
        <p><strong>${c.name}</strong></p>
        <p style="color:var(--text2);font-size:.85rem;margin-top:4px">${c.email}</p>
        <p style="margin-top:12px"><strong>Position:</strong> ${c.position}</p>
        <p style="margin-top:6px"><strong>Education:</strong> ${c.education||'N/A'}</p>
        <p style="margin-top:6px"><strong>Experience:</strong> ${c.experience||'N/A'} years</p>
        <p style="margin-top:6px"><strong>Screened:</strong> ${new Date(c.screenedAt).toLocaleString()}</p>
      </div>
      <div class="profile-section">
        <h4>🎯 AI Score</h4>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
          <div class="result-score-circle" style="background:${color}22;color:${color};width:64px;height:64px;font-size:1.3rem">${c.score}</div>
          <span class="decision-badge ${c.decision==='ACCEPT'?'badge-accept':c.decision==='INTERVIEW'?'badge-interview':'badge-reject'}" style="font-size:.9rem">${c.decision}</span>
        </div>
        <p style="font-size:.85rem;color:var(--text2)">${c.recommendation}</p>
      </div>
      <div class="profile-section">
        <h4>✅ Key Strengths</h4>
        ${(c.strengths||[]).map(s=>`<div class="tag tag-green" style="display:inline-block;margin:3px">✓ ${s}</div>`).join('')}
      </div>
      <div class="profile-section">
        <h4>❌ Missing Skills</h4>
        ${(c.missing||[]).map(s=>`<div class="tag tag-red" style="display:inline-block;margin:3px">✗ ${s}</div>`).join('')||'<span style="color:var(--text2);font-size:.85rem">None identified</span>'}
      </div>
    </div>`;
  openModal('candidateModal');
}

function emailCurrentCandidate() {
  if (state.currentCandidate) sendEmailToOne(state.currentCandidate.id);
}

function sendEmailToOne(id) {
  const c = state.candidates.find(x => x.id === id);
  if (!c) return;
  closeModal('candidateModal');
  navigate('emails', document.querySelector('[data-page=emails]'));
  setTimeout(() => loadTemplate(c.decision==='ACCEPT'?'accept':c.decision==='INTERVIEW'?'interview':'reject'), 200);
}

// ─── EMAIL PAGE ───────────────────────────────────────────────
const emailTemplates = {
  accept: {
    subject: 'Congratulations! You\'ve Been Selected — {{POSITION}}',
    body: `Dear {{NAME}},

We are thrilled to inform you that after carefully reviewing your application, you have been selected to move forward in our hiring process for the {{POSITION}} role.

Your background and skills impressed our team, and we believe you would be a valuable addition to {{COMPANY}}.

Our HR team will be in touch shortly with the next steps. Please feel free to reach out if you have any questions.

Congratulations once again!

Warm regards,
HR Team — {{COMPANY}}`
  },
  interview: {
    subject: 'Interview Invitation — {{POSITION}} at {{COMPANY}}',
    body: `Dear {{NAME}},

Thank you for your interest in the {{POSITION}} position at {{COMPANY}}.

We were impressed with your profile and would like to invite you for an interview. Our team will be in touch within 2 business days to schedule a convenient time.

Please ensure your contact details are up to date and let us know your availability.

We look forward to speaking with you!

Best regards,
HR Team — {{COMPANY}}`
  },
  reject: {
    subject: 'Update on Your Application — {{POSITION}}',
    body: `Dear {{NAME}},

Thank you for taking the time to apply for the {{POSITION}} position at {{COMPANY}} and for your interest in joining our team.

After careful consideration of all applications, we regret to inform you that we will not be moving forward with your application at this time. This was a difficult decision given the quality of candidates we received.

We encourage you to apply for future positions that match your profile. We will keep your resume on file for upcoming opportunities.

We wish you the very best in your career journey.

Kind regards,
HR Team — {{COMPANY}}`
  },
  custom: { subject: '', body: '' }
};

function loadTemplate(type) {
  const t = emailTemplates[type];
  const company = loadSettings().companyName || 'Our Company';
  document.getElementById('emailSubject').value = (t.subject||'').replace(/{{COMPANY}}/g, company);
  document.getElementById('emailBody').value = (t.body||'').replace(/{{COMPANY}}/g, company);
}

function refreshEmailPage() {
  const accepted = state.candidates.filter(c => c.decision==='ACCEPT' && !c.emailSent);
  const interview = state.candidates.filter(c => c.decision==='INTERVIEW' && !c.emailSent);
  const rejected = state.candidates.filter(c => c.decision==='REJECT' && !c.emailSent);
  document.getElementById('qsAcceptCount').textContent = `${accepted.length} pending`;
  document.getElementById('qsInterviewCount').textContent = `${interview.length} pending`;
  document.getElementById('qsRejectCount').textContent = `${rejected.length} pending`;
  loadTemplate('accept');
  renderEmailHistory();
}

function quickSend(decision) {
  const type = decision==='ACCEPT'?'accept':decision==='INTERVIEW'?'interview':'reject';
  loadTemplate(type);
  document.getElementById('sendToGroup').value = decision;
  sendEmails();
}

function sendEmails() {
  const group = document.getElementById('sendToGroup').value;
  const subject = document.getElementById('emailSubject').value;
  const body = document.getElementById('emailBody').value;
  const targets = group === 'ALL'
    ? state.candidates
    : state.candidates.filter(c => c.decision === group);

  if (!targets.length) { toast('No candidates in this group', 'error'); return; }

  const settings = loadSettings();
  const company = settings.companyName || 'Our Company';

  document.getElementById('confirmEmailTitle').textContent = `Send to ${targets.length} candidates?`;
  document.getElementById('confirmEmailContent').innerHTML = `
    <div style="background:var(--bg3);border-radius:10px;padding:16px;margin-bottom:16px">
      <div style="font-size:.85rem;color:var(--text2);margin-bottom:8px">Recipients (${targets.length})</div>
      ${targets.slice(0,5).map(c=>`<div style="font-size:.85rem;margin-bottom:4px">• ${c.name} &lt;${c.email}&gt;</div>`).join('')}
      ${targets.length > 5 ? `<div style="color:var(--text2);font-size:.82rem">... and ${targets.length-5} more</div>` : ''}
    </div>
    <div style="background:var(--bg3);border-radius:10px;padding:16px">
      <div style="font-weight:600;margin-bottom:6px">${subject.replace(/{{NAME}}/g,'[Name]').replace(/{{COMPANY}}/g,company)}</div>
      <div style="font-size:.82rem;color:var(--text2);white-space:pre-wrap">${body.substring(0,200).replace(/{{NAME}}/g,'[Name]').replace(/{{COMPANY}}/g,company)}...</div>
    </div>`;

  state.pendingSend = { targets, subject, body, company, group };
  openModal('confirmEmailModal');
}

function executeSend() {
  const { targets, subject, body, company, group } = state.pendingSend;

  // Simulate sending (in production, calls backend)
  targets.forEach(c => {
    const personalSub = subject.replace(/{{NAME}}/g, c.name.split(' ')[0]).replace(/{{POSITION}}/g, c.position).replace(/{{COMPANY}}/g, company);
    const personalBody = body.replace(/{{NAME}}/g, c.name.split(' ')[0]).replace(/{{POSITION}}/g, c.position).replace(/{{COMPANY}}/g, company);
    console.log(`📧 Sending to ${c.email}:\nSubject: ${personalSub}\n${personalBody.substring(0,100)}...`);
    c.emailSent = true;
    c.emailSentAt = new Date().toISOString();
  });

  const campaign = {
    id: Date.now().toString(),
    name: `${group} Campaign`,
    subject: subject.substring(0,40),
    count: targets.length,
    date: new Date().toISOString(),
    status: 'Sent',
  };
  state.emailHistory.unshift(campaign);
  saveLocal();
  closeModal('confirmEmailModal');
  toast(`✅ ${targets.length} emails sent successfully!`, 'success');
  refreshEmailPage();
}

function renderEmailHistory() {
  const tbody = document.getElementById('emailHistory');
  if (!state.emailHistory.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text2)">No campaigns yet</td></tr>`;
    return;
  }
  tbody.innerHTML = state.emailHistory.map(h => `
    <tr>
      <td>${h.name}</td>
      <td style="color:var(--text2)">${h.subject}...</td>
      <td><strong>${h.count}</strong></td>
      <td style="color:var(--text2);font-size:.8rem">${new Date(h.date).toLocaleString()}</td>
      <td><span class="decision-badge badge-accept">${h.status}</span></td>
    </tr>`).join('');
}

// ─── DASHBOARD ────────────────────────────────────────────────
function refreshDashboard() {
  const total = state.candidates.length;
  const accepted = state.candidates.filter(c=>c.decision==='ACCEPT').length;
  const interview = state.candidates.filter(c=>c.decision==='INTERVIEW').length;
  const rejected = state.candidates.filter(c=>c.decision==='REJECT').length;

  animateCount('statTotal', total);
  animateCount('statAccepted', accepted);
  animateCount('statInterview', interview);
  animateCount('statRejected', rejected);

  // Quick send counts
  document.getElementById('qsAcceptCount').textContent = `${state.candidates.filter(c=>c.decision==='ACCEPT'&&!c.emailSent).length} pending`;
  document.getElementById('qsInterviewCount').textContent = `${state.candidates.filter(c=>c.decision==='INTERVIEW'&&!c.emailSent).length} pending`;
  document.getElementById('qsRejectCount').textContent = `${state.candidates.filter(c=>c.decision==='REJECT'&&!c.emailSent).length} pending`;

  renderRecentCandidates();
  initCharts(accepted, interview, rejected);
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  let current = 0;
  const step = Math.max(1, Math.floor(target / 20));
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(interval);
  }, 50);
}

function renderRecentCandidates() {
  const tbody = document.getElementById('recentCandidates');
  const recent = [...state.candidates].reverse().slice(0, 5);
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text2)">No candidates yet. Start screening!</td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(c => {
    const color = c.score >= 75 ? '#10b981' : c.score >= 50 ? '#f59e0b' : '#ef4444';
    return `<tr>
      <td><div style="font-weight:600">${c.name}</div><div style="font-size:.78rem;color:var(--text2)">${c.email}</div></td>
      <td>${c.position}</td>
      <td><span style="font-weight:700;color:${color}">${c.score}/100</span></td>
      <td><span class="decision-badge ${c.decision==='ACCEPT'?'badge-accept':c.decision==='INTERVIEW'?'badge-interview':'badge-reject'}">${c.decision}</span></td>
      <td style="color:var(--text2);font-size:.8rem">${new Date(c.screenedAt).toLocaleDateString()}</td>
      <td><button class="btn-outline btn-sm" onclick="viewCandidate('${c.id}')">View</button></td>
    </tr>`;
  }).join('');
}

function initCharts(accepted, interview, rejected) {
  // Activity Chart
  const actCtx = document.getElementById('activityChart')?.getContext('2d');
  if (actCtx) {
    if (state.charts.activity) state.charts.activity.destroy();
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const data = days.map(() => Math.floor(Math.random()*8)+1);
    state.charts.activity = new Chart(actCtx, {
      type: 'line',
      data: { labels: days, datasets: [{ label: 'Screened', data, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.1)', tension: .4, fill: true, pointRadius: 4, pointBackgroundColor: '#6366f1' }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#2a2a3a' }, ticks: { color: '#8888aa' } }, y: { grid: { color: '#2a2a3a' }, ticks: { color: '#8888aa' } } } }
    });
  }

  // Pie Chart
  const pieCtx = document.getElementById('pieChart')?.getContext('2d');
  if (pieCtx) {
    if (state.charts.pie) state.charts.pie.destroy();
    state.charts.pie = new Chart(pieCtx, {
      type: 'doughnut',
      data: { labels: ['Accepted','Interview','Rejected'], datasets: [{ data: [accepted||1, interview||1, rejected||1], backgroundColor: ['#10b981','#f59e0b','#ef4444'], borderColor: '#16161e', borderWidth: 3 }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#8888aa', padding: 16 } } }, cutout: '65%' }
    });
  }
}

// ─── SETTINGS ─────────────────────────────────────────────────
function saveSettings() {
  const settings = {
    anthropicKey: document.getElementById('anthropicKey').value,
    emailService: document.getElementById('emailService').value,
    emailKey: document.getElementById('emailKey').value,
    fromEmail: document.getElementById('fromEmail').value,
    acceptThreshold: document.getElementById('acceptThreshold').value,
    interviewThreshold: document.getElementById('interviewThreshold').value,
    aiModel: document.getElementById('aiModel').value,
    companyName: document.getElementById('companyName').value,
  };
  localStorage.setItem('hireai_settings', JSON.stringify(settings));
  state.settings = settings;
  toast('Settings saved!', 'success');
}

function loadSettings() {
  try { return JSON.parse(localStorage.getItem('hireai_settings') || '{}'); } catch { return {}; }
}

function loadSettingsUI() {
  const s = loadSettings();
  if (s.anthropicKey) document.getElementById('anthropicKey').value = s.anthropicKey;
  if (s.emailService) document.getElementById('emailService').value = s.emailService;
  if (s.emailKey) document.getElementById('emailKey').value = s.emailKey;
  if (s.fromEmail) document.getElementById('fromEmail').value = s.fromEmail;
  if (s.acceptThreshold) document.getElementById('acceptThreshold').value = s.acceptThreshold;
  if (s.interviewThreshold) document.getElementById('interviewThreshold').value = s.interviewThreshold;
  if (s.aiModel) document.getElementById('aiModel').value = s.aiModel;
  if (s.companyName) document.getElementById('companyName').value = s.companyName;
}

function toggleKey(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

// ─── LOCAL STORAGE ────────────────────────────────────────────
function saveLocal() {
  localStorage.setItem('hireai_jobs', JSON.stringify(state.jobs));
  localStorage.setItem('hireai_candidates', JSON.stringify(state.candidates));
  localStorage.setItem('hireai_emailHistory', JSON.stringify(state.emailHistory));
}

function loadLocal() {
  try { state.jobs = JSON.parse(localStorage.getItem('hireai_jobs') || '[]'); } catch { state.jobs = []; }
  try { state.candidates = JSON.parse(localStorage.getItem('hireai_candidates') || '[]'); } catch { state.candidates = []; }
  try { state.emailHistory = JSON.parse(localStorage.getItem('hireai_emailHistory') || '[]'); } catch { state.emailHistory = []; }
}

// ─── API FETCH ────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── SEARCH ──────────────────────────────────────────────────
function handleSearch(query) {
  if (!query.trim()) return;
  const lq = query.toLowerCase();
  const matched = state.candidates.filter(c =>
    c.name.toLowerCase().includes(lq) || c.position.toLowerCase().includes(lq) || c.email.toLowerCase().includes(lq)
  );
  if (matched.length) {
    navigate('candidates', document.querySelector('[data-page=candidates]'));
    renderCandidateTable(matched);
  }
}

// ─── DEMO DATA ────────────────────────────────────────────────
function loadDemoData() {
  if (state.jobs.length || state.candidates.length) return;
  state.jobs = [
    { id:'j1', title:'Senior Full Stack Developer', department:'Engineering', location:'Remote', description:'We are looking for a senior full stack developer with 5+ years experience in React, Node.js, and AWS...', skills:['React','Node.js','AWS','TypeScript','PostgreSQL'], candidateCount: 3 },
    { id:'j2', title:'Product Manager', department:'Product', location:'New York, NY', description:'Lead product strategy and roadmap for our core platform...', skills:['Product Strategy','Agile','SQL','Stakeholder Management'], candidateCount: 2 },
    { id:'j3', title:'Data Scientist', department:'Analytics', location:'San Francisco, CA', description:'Build ML models and data pipelines to drive business insights...', skills:['Python','TensorFlow','SQL','Statistics'], candidateCount: 1 },
  ];
  state.candidates = [
    { id:'c1', name:'Alex Johnson', email:'alex.johnson@email.com', position:'Senior Full Stack Developer', jobId:'j1', score:87, decision:'ACCEPT', strengths:['React expert','5yr experience','AWS certified'], missing:[], recommendation:'Strong fit for the role.', screenedAt: new Date(Date.now()-86400000*2).toISOString(), emailSent:false },
    { id:'c2', name:'Priya Sharma', email:'priya.sharma@email.com', position:'Senior Full Stack Developer', jobId:'j1', score:64, decision:'INTERVIEW', strengths:['Node.js proficient','Good problem solver'], missing:['AWS experience'], recommendation:'Good candidate, worth interviewing.', screenedAt: new Date(Date.now()-86400000).toISOString(), emailSent:false },
    { id:'c3', name:'Marcus Chen', email:'marcus.chen@email.com', position:'Product Manager', jobId:'j2', score:91, decision:'ACCEPT', strengths:['Agile expert','7yr PM experience','Strong leadership'], missing:[], recommendation:'Excellent candidate.', screenedAt: new Date(Date.now()-3600000*5).toISOString(), emailSent:true },
    { id:'c4', name:'Sofia Rodriguez', email:'sofia.r@email.com', position:'Data Scientist', jobId:'j3', score:42, decision:'REJECT', strengths:['Good statistics'], missing:['TensorFlow','Production ML experience'], recommendation:'Needs more experience.', screenedAt: new Date(Date.now()-3600000*2).toISOString(), emailSent:false },
    { id:'c5', name:'James Wilson', email:'j.wilson@email.com', position:'Senior Full Stack Developer', jobId:'j1', score:78, decision:'ACCEPT', strengths:['TypeScript','PostgreSQL','Team leader'], missing:['AWS'], recommendation:'Strong full stack skills.', screenedAt: new Date(Date.now()-3600000).toISOString(), emailSent:false },
  ];
  saveLocal();
}

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadLocal();
  loadDemoData();
  loadSettingsUI();
  renderJobs();
  updateJobSelects();
  refreshDashboard();
  loadTemplate('accept');

  // Drag-over style
  const zone = document.getElementById('uploadZone');
  if (zone) {
    zone.addEventListener('dragover', () => zone.classList.add('drag-over'));
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  }

  // Close notif on outside click
  document.addEventListener('click', e => {
    const panel = document.getElementById('notifPanel');
    if (!e.target.closest('.notif-btn') && panel.classList.contains('show')) {
      panel.classList.remove('show');
    }
  });

  toast('Welcome to HireAI! 🚀 Add your Anthropic API key in Settings to enable real AI screening.', 'info');
});