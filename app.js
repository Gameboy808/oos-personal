"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const list = (value) => Array.isArray(value) ? value : [];
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const closedTaskStatuses = new Set(["done", "cancelled", "declined", "archived"]);
const closedBlockStatuses = new Set(["completed", "cancelled", "archived"]);
const riskLabel = { high: "高风险", medium: "需关注", low: "稳定" };
const healthLabel = { active: "活跃", watch: "关注", stalled: "停滞" };
const kindLabel = { focus: "专注", fixed: "固定", routine: "例行", buffer: "缓冲", errand: "外出", admin: "行政", recovery: "恢复" };

let state = null;
let stateMeta = null;
window.__OOS_STATE = function () { return state; };
let view = "today";
let selectedTrackId = "";
let selectedDate = "";
let editingBlockId = "";
let selectedNoteId = null;
let editingNoteRef = null;
let financeTab = "guide";
let persistTimer = null;
let tracksViewMode = (function () { try { return localStorage.getItem("oos_tracks_view") || "gallery"; } catch (e) { return "gallery"; } })();
let tracksSort = { key: "name", dir: 1 };
const TRACK_ARCH_ORDER = ["project", "pipeline", "learning", "habit", "trend", "relationship"];
const TRACK_ARCH_LABEL = { project: "项目", pipeline: "商业 / 管道", learning: "学习", habit: "习惯", trend: "趋势", relationship: "关系" };
let firstFlightStep = 0;
let conflictRetry = null;
let majorRetry = null;
let timelineGesture = null;
let draggedTaskId = "";
let liveSyncTimer = null;
let liveSyncInFlight = false;
let liveSyncToken = "";
let liveSyncEvents = null;
let calendarController = null;
let lastWorkerResult = null;

const TIMELINE_START = 6 * 60;
const TIMELINE_END = 24 * 60;
const TIMELINE_STEP = 15;
const TIMELINE_PX_PER_MINUTE = 0.72;

function shortText(value, max = 90) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function todayIso() {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: state?.meta?.timezone || "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch { return new Date().toISOString().slice(0, 10); }
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekdayIndex(date) { return new Date(`${date}T00:00:00Z`).getUTCDay(); }

function safeAccent(value) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : "#151513";
}

function applyTheme() {
  const accent = safeAccent(state?.meta?.theme?.accent);
  const tokens = stateMeta?.themeTokens || {};
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-rgb", hexRgb(accent));
  document.documentElement.style.setProperty("--accent-soft", tokens.accentSoft || `rgba(${hexRgb(accent)}, .12)`);
  document.documentElement.style.setProperty("--accent-muted", tokens.accentMuted || accent);
  document.documentElement.style.setProperty("--accent-strong", tokens.accentStrong || accent);
  document.documentElement.style.setProperty("--on-accent", tokens.onAccent || "#ffffff");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", accent);
}

function hexRgb(hex) {
  const value = hex.slice(1);
  return `${parseInt(value.slice(0, 2), 16)}, ${parseInt(value.slice(2, 4), 16)}, ${parseInt(value.slice(4, 6), 16)}`;
}

function tracks() { return list(state?.tracks).length ? list(state.tracks) : list(state?.goals); }
function track(id) { return tracks().find((item) => item.id === id); }
function goal(id) { return list(state?.goals).find((item) => item.id === id); }
function trackName(id) { return track(id)?.name || goal(id)?.name || (id === "system" ? "System" : id === "inbox" ? "Inbox" : "未分类"); }

// 轨道调色板：每条轨道一个颜色，日历/导航按轨道分色。可在「编辑轨道」里改。
const TRACK_PALETTE = ["#E5484D","#F76808","#FFB224","#46A758","#12A594","#0091FF","#6564DB","#8E4EC6","#E93D82","#6E7681","#A16207","#0CA5E9"];
window.TRACK_PALETTE = TRACK_PALETTE;
function trackColorHex(id) {
  const item = track(id) || goal(id);
  if (item && item.color) return item.color;
  // 已有轨道若没存颜色，按 id 稳定取一个，保证每次打开颜色一致
  let hash = 0; const seed = String(id || "system");
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TRACK_PALETTE[hash % TRACK_PALETTE.length];
}
function navName(item) { return item.navLabel || item.shortName || item.name || item.id; }

function trackHealth(id) {
  const source = state?.__derived?.trackHealth;
  const item = Array.isArray(source)
    ? source.find((entry) => [entry.id, entry.trackId, entry.goalId].includes(id))
    : source?.[id];
  return item || {};
}

function trackModel(item) {
  const linkedGoal = goal(item.id) || {};
  return { ...item, ...linkedGoal, id: item.id, name: linkedGoal.name || item.name || item.id, navLabel: item.navLabel || linkedGoal.navLabel || item.name || item.id };
}

function openTasks() { return list(state?.tasks).filter((task) => !task.archived && !closedTaskStatuses.has(task.status)); }
function notes() { return list(state?.notes); }
function activities() { return list(state?.activity); }
function activeBlocks() { return list(state?.scheduleBlocks).filter((block) => !closedBlockStatuses.has(block.status)); }

function taskScore(task) {
  let score = task.priority === "high" ? 90 : task.priority === "normal" ? 45 : 15;
  if (task.todayFocus || task.hudSlot === "now") score += 100;
  if (task.status === "in_progress") score += 50;
  if (task.due && task.due < todayIso()) score += 80;
  else if (task.due === todayIso()) score += 60;
  return score;
}

function orderedTasks() { return openTasks().slice().sort((a, b) => taskScore(b) - taskScore(a) || String(a.due || "9999").localeCompare(String(b.due || "9999"))); }

function section(title, subtitle, body, className = "") {
  return `<section class="panel ${className}"><header class="panel-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div></header>${body}</section>`;
}

function emptyState(title, text, action = "") {
  return `<div class="empty-state"><span>OPEN SPACE</span><strong>${esc(title)}</strong><p>${esc(text)}</p>${action}</div>`;
}

function badge(text, tone = "") { return `<span class="badge ${tone}">${esc(text)}</span>`; }

function taskTimingLabel(task) {
  const linked = activeBlocks()
    .filter((block) => block.taskId === task.id && blockStart(block) !== null)
    .sort((a, b) => blockStart(a) - blockStart(b))[0];
  if (linked) return blockTime(linked.startAt, true);
  return task.due || "未排期";
}

function taskCard(task, compact = false) {
  const done = task.status === "done" || task.status === "completed";
  return `<article class="task-card ${task.priority === "high" ? "priority-high" : ""} ${done ? "is-done" : ""}"><label class="task-check"><input type="checkbox" data-task="${esc(task.id)}" ${done ? "checked" : ""}><span></span></label><div><div class="task-title"><strong>${esc(shortText(task.title, compact ? 54 : 86))}</strong>${task.priority === "high" ? badge("HIGH", "warn") : ""}</div><p>${esc(shortText(task.nextStep || "下一步待补充。", compact ? 66 : 110))}</p><small>${esc(trackName(task.goal))} · ${esc(taskTimingLabel(task))}</small></div></article>`;
}

function blockStart(block) { const value = Date.parse(block?.startAt || ""); return Number.isFinite(value) ? value : null; }
function blockEnd(block) { const value = Date.parse(block?.endAt || ""); return Number.isFinite(value) ? value : null; }
function blockDate(block) { return String(block?.startAt || "").slice(0, 10); }
function dateTimeInput(value) { return value ? String(value).slice(0, 16) : ""; }

function blockTime(value, includeDate = false) {
  if (!value) return "待排期";
  const date = new Date(value);
  return date.toLocaleString("zh-CN", includeDate ? { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit" });
}

function conflictIds(blocks) {
  const ids = new Set();
  const timed = blocks.filter((block) => blockStart(block) !== null && blockEnd(block) !== null);
  for (let left = 0; left < timed.length; left += 1) {
    for (let right = left + 1; right < timed.length; right += 1) {
      if (blockStart(timed[left]) < blockEnd(timed[right]) && blockStart(timed[right]) < blockEnd(timed[left])) {
        ids.add(timed[left].id); ids.add(timed[right].id);
      }
    }
  }
  return ids;
}

function scheduleCard(block, conflicts = new Set()) {
  const locked = Boolean(block.locked || block.kind === "fixed");
  return `<article class="schedule-card kind-${esc(block.kind || "focus")} ${conflicts.has(block.id) ? "conflict" : ""} ${locked ? "locked" : ""}"><div class="schedule-time"><strong>${esc(blockTime(block.startAt))}</strong><span>${block.endAt ? esc(blockTime(block.endAt)) : ""}</span></div><div class="schedule-copy"><div>${badge(kindLabel[block.kind] || "时间块")}${block.goal ? badge(trackName(block.goal), "quiet") : ""}${locked ? badge("已锁定", "quiet") : ""}${conflicts.has(block.id) ? badge("冲突", "warn") : ""}</div><strong>${esc(block.title || "未命名时间块")}</strong><p>${esc(shortText(block.note || "", 88))}</p></div><div class="schedule-actions">${locked ? "" : `<button type="button" data-block-edit="${esc(block.id)}">编辑</button>`}<button type="button" data-block-status="completed" data-block="${esc(block.id)}">完成</button><button type="button" data-block-status="cancelled" data-block="${esc(block.id)}">取消</button>${block.startAt && !locked ? `<button type="button" data-block-clear="${esc(block.id)}">清空时间</button>` : ""}</div></article>`;
}

function operationalStatus() {
  const integrity = stateMeta?.integrity || {};
  const truth = stateMeta?.currentTruth || {};
  const integrityReady = integrity.ok !== false && integrity.valid !== false;
  const truthReady = truth.exists !== false && truth.fresh !== false && truth.stale !== true;
  const operationalReady = stateMeta?.readiness?.operationalReady ?? state?.meta?.readiness?.operationalReady ?? (integrityReady && truthReady);
  const visualReady = stateMeta?.readiness?.visualReady ?? state?.meta?.readiness?.visualReady ?? (state?.visual?.mode === "reviewed" && state?.visual?.status === "approved");
  return { integrityReady, truthReady, operationalReady, visualReady };
}

function healthPanel() {
  const status = operationalStatus();
  const queue = stateMeta?.maintenanceQueue || stateMeta?.maintenance || {};
  const pending = Number(queue.stateOpsPending || 0);
  const agentReview = Number(queue.agentReviewPending || 0);
  const needsReview = Number(queue.needsReview || 0);
  const headline = status.operationalReady ? "运行就绪，可以开始使用" : "运行层需要检查";
  return `<section class="health-strip ${status.operationalReady && !needsReview ? "ready" : "attention"}"><div class="health-main"><i></i><span><small>OPERATIONAL</small><strong>${headline}</strong></span></div><div class="health-facts"><span class="${status.integrityReady ? "" : "warn"}">Schema · ${status.integrityReady ? "Ready" : "Check"}</span><span class="${status.truthReady ? "" : "warn"}">Current Truth · ${status.truthReady ? "Fresh" : "Stale"}</span><span>Visual · ${status.visualReady ? "Enhanced" : "Asset-free"}</span><button type="button" class="${needsReview ? "warn" : ""}" data-worker-open>后台同步 · ${needsReview ? `${needsReview} 待确认` : pending ? `${pending} 处理中` : agentReview ? `${agentReview} 待 Agent` : "清晰"}</button></div></section>`;
}

function workerStatusLabel(item) {
  if (item.type === "capture.review" && item.status === "pending") return "等待 Agent 判断";
  return {
    queued: "等待执行",
    processing: "正在执行",
    projection_pending: "正在刷新投影",
    needs_review: "等待用户确认",
    conflict: "版本冲突",
    failed: "执行失败",
    done: "已完成",
    dismissed: "已忽略",
    superseded: "已被新操作替代"
  }[item.status] || item.status || "未知";
}

async function openWorkerDrawer() {
  let payload = { items: [], stats: stateMeta?.maintenanceQueue || {} };
  try { payload = await requestJson(`/api/worker?t=${Date.now()}`); }
  catch (error) { toast(`没有读到后台同步记录：${error.message}`); }
  const items = list(payload.items)
    .slice()
    .sort((left, right) => Date.parse(right.updatedAt || right.createdAt || 0) - Date.parse(left.updatedAt || left.createdAt || 0))
    .slice(0, 12);
  const stats = payload.stats || {};
  $("#overlayRoot").innerHTML = `<div class="overlay" data-overlay-close></div><aside class="drawer worker-drawer" role="dialog" aria-modal="true" aria-label="后台同步"><header><div><span class="eyebrow">EMBEDDED WORKER</span><h2>后台同步</h2></div><button type="button" data-overlay-close>×</button></header><div class="worker-explainer"><strong>Worker 是本地确定性执行器，不是 subagent。</strong><p>它负责排队、校验版本与风险、原子写入、刷新 Current Truth 和发送同步事件；需要理解语义的捕捉会明确等待 Agent 判断。</p><div><span>执行中 ${Number(stats.stateOpsPending || 0)}</span><span>待 Agent ${Number(stats.agentReviewPending || 0)}</span><span class="${Number(stats.needsReview || 0) ? "warn" : ""}">待确认 ${Number(stats.needsReview || 0)}</span></div></div><div class="worker-list">${items.map((item) => `<article class="worker-item status-${esc(item.status)}"><i></i><div><strong>${esc(shortText(item.humanMeaning || item.summary || item.sourceText || item.type, 82))}</strong><p>${esc(workerStatusLabel(item))}${item.reviewReason ? ` · ${esc(item.reviewReason)}` : ""}</p><small>${esc(item.source || "system")} · ${esc(String(item.updatedAt || item.createdAt || "").replace("T", " ").slice(0, 16))}${item.stateVersionAfter ? ` · state v${Number(item.stateVersionAfter)}` : ""}</small></div></article>`).join("") || emptyState("还没有后台记录", "第一次任务或 HUD 操作后，这里会留下完整路径。")}</div><footer class="worker-foot"><span>State 是唯一真源；队列只记录执行过程。</span><button type="button" data-overlay-close>关闭</button></footer></aside>`;
}

function onboardingStatus() {
  const direct = state?.onboarding?.firstFlight?.status || state?.onboarding?.status;
  if (direct) return direct;
  const markers = activities().filter((item) => /\[onboarding:first-flight\]/.test(String(item.text || "")));
  if (markers.length) {
    const value = String(markers[0].text).match(/\b(completed|skipped|resumed)\b/)?.[1];
    if (value) return value;
  }
  return localStorage.getItem("oos.first-flight.status") || "not_started";
}

function permanentGuideCard() {
  const status = onboardingStatus();
  return `<section class="guide-card ${status === "completed" ? "complete" : ""}"><div class="guide-route" aria-hidden="true"><i></i><i></i><i></i></div><div><span class="eyebrow">HOW TO USE OOS</span><h2>聊天负责判断，HUD 负责看清，Worker 负责安全写入。</h2><p>说出进展 → Agent 判断含义 → Worker 同步状态 → 所有页面一起变化。</p></div><button type="button" data-first-flight-open>${status === "completed" ? "查看用法" : status === "skipped" ? "恢复引导" : "开始 First Flight"}</button></section>`;
}

function currentAndNextBlock() {
  const now = Date.now();
  const blocks = activeBlocks().filter((block) => blockStart(block) !== null).sort((a, b) => blockStart(a) - blockStart(b));
  const current = blocks.find((block) => blockStart(block) <= now && (blockEnd(block) || blockStart(block) + 3600000) > now) || null;
  const next = blocks.find((block) => blockStart(block) > now) || null;
  return { current, next };
}

function derivedAttention() {
  const labels = { overdue: "逾期任务", due_today: "今日截止", review_due: "任务复查", wake_due: "事项已唤醒", open_question: "待确认问题", cadence_due: "轨道需要关注", decision_review_due: "决定到复查点" };
  return list(state.__derived?.attention?.items).map((item) => {
    const task = item.entityType === "task" ? list(state.tasks).find((entry) => entry.id === item.entityId) : null;
    const question = item.entityType === "question" ? list(state.questions).find((entry) => entry.id === item.entityId) : null;
    const decision = item.entityType === "decision" ? list(state.decisions).find((entry) => entry.id === item.entityId) : null;
    const itemTrack = item.entityType === "track" ? track(item.entityId) : null;
    return { ...item, label: labels[item.reason] || "需要关注", text: task?.title || question?.text || decision?.title || itemTrack?.name || item.title || "查看最新状态" };
  }).slice(0, 3);
}

function attentionPanel(items) {
  return section("需要你留意", "来自同一 state 的日期、复查点与轨道节奏", `<div class="attention-list">${items.map((item) => `<article class="attention-item ${esc(item.severity || "low")}"><span>${esc(item.label)}</span><strong>${esc(shortText(item.text, 52))}</strong><small>${esc(item.date || trackName(item.trackId))}</small></article>`).join("") || emptyState("目前没有提醒", "系统会在真正需要判断时把事项放到这里。")}</div>`);
}

function todaySequence(primary, tasks) {
  const primaryTaskId = primary?.taskId || "";
  const firstScheduledAt = new Map();
  for (const block of activeBlocks().filter((item) => item.taskId && item.startAt).sort((left, right) => blockStart(left) - blockStart(right))) {
    if (!firstScheduledAt.has(block.taskId)) firstScheduledAt.set(block.taskId, blockStart(block));
  }
  const remaining = tasks
    .filter((task) => task.id !== primaryTaskId)
    .sort((left, right) => {
      const leftAt = firstScheduledAt.get(left.id) ?? Number.POSITIVE_INFINITY;
      const rightAt = firstScheduledAt.get(right.id) ?? Number.POSITIVE_INFINITY;
      return leftAt - rightAt;
    });
  const nowTask = primary ? null : remaining.shift() || null;
  const next = remaining.splice(0, 2);
  const later = remaining.splice(0, 2);
  const taskRows = (rows, emptyText) => rows.length
    ? `<div class="timeline-pair">${rows.map((task) => taskCard(task, true)).join("")}</div>`
    : emptyState(emptyText, "给突发情况留一点空间。");
  return `<section class="cockpit-timeline"><header><div><span class="eyebrow">FLIGHT PLAN</span><h2>今日推进序列</h2></div><span>NOW → NEXT → LATER</span></header><div class="timeline-stage now-stage"><span class="timeline-stage-label">现在</span>${primary ? scheduleCard(primary, conflictIds(activeBlocks())) : nowTask ? taskCard(nowTask) : emptyState("没有正在执行的事项", "在聊天里说一句现在想推进什么。")}</div><div class="timeline-stage next-stage"><span class="timeline-stage-label">接下来</span>${taskRows(next, "没有紧邻任务")}</div><div class="timeline-stage later-stage"><span class="timeline-stage-label">稍后关注</span>${taskRows(later, "没有需要保活的事项")}</div></section>`;
}

function hardWindowPanel() {
  const today = todayIso();
  const start = addDays(today, -14);
  const end = addDays(today, 45);
  const scheduledTaskIds = new Set(activeBlocks().map((block) => block.taskId).filter(Boolean));
  const dueTasks = openTasks()
    .filter((task) => /^\d{4}-\d{2}-\d{2}$/.test(String(task.due || "")) && task.due >= start && task.due <= end)
    .map((task) => ({
      id: task.id,
      date: task.due,
      title: task.title,
      goal: task.goal,
      kind: "截止",
      detail: scheduledTaskIds.has(task.id) ? "已有执行时间" : "尚未安排执行时间"
    }));
  const fixed = activeBlocks()
    .filter((block) => block.kind === "fixed" && block.startAt && blockDate(block) >= start && blockDate(block) <= end)
    .map((block) => ({
      id: block.id,
      date: blockDate(block),
      title: block.title,
      goal: block.goal,
      kind: "固定",
      detail: `${blockTime(block.startAt)}–${blockTime(block.endAt)}`
    }));
  const rows = [...dueTasks, ...fixed].sort((left, right) => left.date.localeCompare(right.date)).slice(0, 8);
  return section("近期硬窗口", "截止日和固定行程来自同一份 State", `<div class="hard-window-list">${rows.map((item) => `<article class="${item.date < today ? "overdue" : ""}"><time>${esc(item.date.slice(5).replace("-", "/"))}</time><div><span>${esc(trackName(item.goal))} · ${esc(item.kind)}</span><strong>${esc(shortText(item.title, 54))}</strong><p>${esc(item.detail)}</p></div></article>`).join("") || emptyState("未来 45 天没有硬窗口", "没有硬节点时，日历会保持安静。")}</div>`);
}

function renderToday() {
  const tasks = orderedTasks();
  const focus = tasks[0] || null;
  const schedule = currentAndNextBlock();
  const primary = schedule.current || schedule.next;
  const attention = derivedAttention();
  setHero("NOW / CURRENT VECTOR", primary?.title || focus?.title || "今天先守住一个真实动作。", schedule.current ? "当前时间块正在进行。" : schedule.next ? `下一段：${blockTime(schedule.next.startAt, true)}。` : focus ? focus.nextStep || "完成最小可交付动作。" : "没有紧急事项，先做一次轻量检查。");
  $("#pageTitle").textContent = "Today";
  const trackSignals = tracks().map(trackModel).map((item) => ({ item, health: trackHealth(item.id) })).sort((a, b) => ({ stalled: 3, watch: 2, active: 1 }[b.health.status || b.health.health || "active"] - ({ stalled: 3, watch: 2, active: 1 }[a.health.status || a.health.health || "active"]))).slice(0, 3);
  $("#viewContent").innerHTML = `${healthPanel()}${onboardingStatus() === "completed" ? "" : permanentGuideCard()}<div class="today-grid"><div class="today-command">${todaySequence(primary, tasks)}${hardWindowPanel()}</div><aside class="signal-stack">${attentionPanel(attention)}${section("轨道信号", "优先看需要重新点火的主线", `<div class="signal-list">${trackSignals.map(({ item, health }) => `<button type="button" data-track="${esc(item.id)}"><i class="${esc(health.status || health.health || "active")}"></i><span><strong>${esc(item.name)}</strong><small>${Number.isFinite(health.quietDays) ? `${health.quietDays} 天无动作` : "尚无动作记录"}</small></span><em>${health.unscheduled ? "未排期" : ""}</em></button>`).join("") || emptyState("尚无轨道", "完成 First Flight 后建立第一条轨道。")}</div>`)}</aside></div>${section("最近发生", "只展示已记录的事实", activityFeed(5))}${capturePanel()}${memoQuickCard()}${todayClosePanel()}${section("My Tracks", "长期主线保持可见，但不与今天争夺注意力", `<div class="track-grid compact">${tracks().map(trackModel).map((item, index) => trackOverview(item, index)).join("")}</div>${ganttTodayMarkup()}`)}`;
}

function ganttTodayMarkup() {
  const today = todayIso();
  const START = TIMELINE_START, END = TIMELINE_END, total = END - START;
  const dayBlocks = activeBlocks().filter((b) => blockDate(b) === today).sort((a, b) => blockStart(a) - blockStart(b));
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const within = nowMin >= START && nowMin <= END;
  const nowPct = ((nowMin - START) / total) * 100;
  const hours = [];
  for (let h = Math.ceil(START / 60); h <= END / 60; h += 1) hours.push(h);
  const scaleHtml = `<div class="gantt-scale"><div class="gantt-scale-spacer"></div><div class="gantt-scale-track">${
    hours.map((h) => `<span class="gantt-hour" style="left:${((h * 60 - START) / total) * 100}%">${String(h).padStart(2, "0")}:00</span>`).join("")
  }${within ? `<i class="gantt-now-head" style="left:${nowPct}%">现在</i>` : ""}</div></div>`;
  const rows = dayBlocks.map((b) => {
    const range = blockMinutes(b);
    if (range.start === null) return "";
    const s = Math.max(START, range.start), e = Math.min(END, range.end);
    const left = ((s - START) / total) * 100;
    const width = Math.max(2.5, ((e - s) / total) * 100);
    const color = trackColorHex(b.goal);
    const ongoing = within && nowMin >= range.start && nowMin < range.end;
    const tName = trackName(b.goal);
    const startL = minuteLabel(range.start), endL = minuteLabel(range.end);
    const titleTxt = b.title + " · " + startL + "—" + endL + " · " + tName;
    return `<div class="gantt-row">
      <div class="gantt-label"><i style="background:${color}"></i><span>${esc(shortText(b.title || "未命名", 16))}</span><small>${startL}</small></div>
      <div class="gantt-track">
        ${within ? `<i class="gantt-now" style="left:${nowPct}%"></i>` : ""}
        <button type="button" class="gantt-bar ${ongoing ? "ongoing" : ""}" style="left:${left}%;width:${width}%;--bc:${color}" data-block-edit="${esc(b.id)}" title="${esc(titleTxt)}"><em>${esc(tName)}</em><span>${startL}–${endL}</span></button>
      </div>
    </div>`;
  }).join("");
  const scheduledTaskIds = new Set(dayBlocks.map((b) => b.taskId).filter(Boolean));
  const unscheduled = openTasks().filter((t) => t.due === today && !scheduledTaskIds.has(t.id));
  const unscheduledHtml = unscheduled.length ? `<div class="gantt-unscheduled"><span class="eyebrow">未排期 · 今天到期</span><div class="gantt-chip-row">${unscheduled.map((t) => `<span class="gantt-chip" style="--bc:${trackColorHex(t.goal)}"><i></i>${esc(shortText(t.title, 22))}</span>`).join("")}</div></div>` : "";
  return section("今日时间分布", "甘特图 · 今天几点到几点做什么，按轨道颜色区分", `${scaleHtml}<div class="gantt">${rows || `<div class="gantt-empty">今天还没有安排时间块。去 Plan 视图拖动安排，这里就会出现你的甘特图。</div>`}</div>${unscheduledHtml}`, "gantt-panel");
}

function activityFeed(limit) {
  const rows = activities().filter((item) => {
    const text = String(item.text || "");
    return !/\[onboarding:first-flight\]/.test(text) && !/^\[(?:worker|system)\]\s*/i.test(text);
  }).slice(0, limit);
  return `<div class="activity-feed">${rows.map((item) => `<article><span>${esc(String(item.date || "最近").slice(0, 10))}</span><div><strong>${esc(trackName(item.relatedGoal || item.goal))}</strong><p>${esc(shortText(item.text || item.summary, 110))}</p></div></article>`).join("") || emptyState("还没有活动", "在下方记录一句进展，时间线就会开始生长。")}</div>`;
}

function capturePanel() {
  return `<form id="captureForm" class="capture"><div><span class="eyebrow">QUICK CAPTURE</span><strong>灵感、闲言碎语与真实进展</strong></div><select name="kind" aria-label="记录类型"><option value="inspiration">灵感</option><option value="thought">随想</option><option value="progress">进展</option><option value="note">笔记</option></select><select name="relatedGoal" aria-label="关联轨道"><option value="">不关联</option>${tracks().map((item) => `<option value="${esc(item.id)}">${esc(navName(item))}</option>`).join("")}</select><textarea name="text" rows="2" placeholder="先收下来；需要行动时再让 Agent 帮你转成任务。"></textarea><button type="submit">收下</button></form>`;
}

function memoQuickCard() {
  return `<div class="today-memo-quick">
    <div class="today-memo-quick-head"><span class="eyebrow">QUICK MEMO</span><strong>备忘录速记</strong></div>
    <div class="today-memo-quick-body">
      <textarea id="todayMemoInput" rows="2" placeholder="随手记一条，保存到备忘录…"></textarea>
      <div class="today-memo-quick-actions">
        <button type="button" class="memo-quick-link" data-memo-open>打开备忘录</button>
        <button type="button" class="memo-quick-save-btn" data-memo-today-save>保存</button>
      </div>
    </div>
  </div>`;
}

function todayClosePanel() {
  const today = todayIso();
  const completed = list(state.tasks).filter((task) => String(task.completedAt || "").slice(0, 10) === today);
  const executions = list(state.logs?.executions).filter((entry) => String(entry.completedAt || "").slice(0, 10) === today);
  const receipts = list(state.receipts).filter((receipt) => {
    if (String(receipt.committedAt || receipt.createdAt || "").slice(0, 10) !== today || receipt.status !== "committed") return false;
    if (["worker", "system"].includes(String(receipt.source || "").toLowerCase())) return false;
    return receipt.operation !== "task.lifecycle.maintain";
  });
  const facts = [...completed.map((task) => `完成任务：${task.title}`), ...executions.map((entry) => `完成一次执行：${entry.title}`), ...receipts.map((receipt) => receipt.humanMeaning || receipt.summary).filter(Boolean)].slice(0, 6);
  return `<div class="review-layout today-close">${section("今日收尾", "从任务、执行证据和语义变化自动汇总", facts.length ? `<div class="activity-feed">${facts.map((fact) => `<article><i></i><div><strong>${esc(fact)}</strong></div></article>`).join("")}</div>` : emptyState("今天还没有可汇总的执行证据", "完成时间块或更新任务后，这里会自动形成收尾线索。"))}<form id="reviewForm" class="editor-card review-form"><span class="eyebrow">CLOSE THE LOOP</span><h2>补充判断，不重复维护待办</h2><label><span>今天最重要的真实进展</span><textarea name="progress" rows="2"></textarea></label><label><span>阻力或需要 Agent 明天追问的事</span><textarea name="blocker" rows="2"></textarea></label><label><span>明天唯一优先方向</span><textarea name="tomorrow" rows="2"></textarea></label><button type="submit">保存收尾记录</button></form></div>`;
}

function weekStart(date) {
  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value.toISOString().slice(0, 10);
}

function minuteOfDay(value) {
  if (!value) return null;
  const match = String(value).match(/T(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function minuteLabel(minutes) {
  const safe = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function timelineIso(date, minutes) {
  return `${date}T${minuteLabel(minutes)}:00`;
}

function blockMinutes(block) {
  const start = minuteOfDay(block.startAt);
  const end = minuteOfDay(block.endAt);
  return { start, end: end ?? (start === null ? null : start + 60) };
}

function timelineConflict(blockId, start, end, blocks = []) {
  return blocks.some((other) => {
    if (other.id === blockId) return false;
    const range = blockMinutes(other);
    return range.start !== null && range.end !== null && start < range.end && range.start < end;
  });
}

function timelineBlock(block, dayBlocks) {
  const range = blockMinutes(block);
  if (range.start === null) return "";
  const start = Math.max(TIMELINE_START, range.start);
  const end = Math.min(TIMELINE_END, Math.max(start + TIMELINE_STEP, range.end));
  const top = (start - TIMELINE_START) * TIMELINE_PX_PER_MINUTE;
  const height = Math.max(34, (end - start) * TIMELINE_PX_PER_MINUTE);
  const conflict = timelineConflict(block.id, range.start, range.end, dayBlocks);
  const locked = Boolean(block.locked || block.kind === "fixed");
  return `<article class="timeline-block kind-${esc(block.kind || "focus")} ${conflict ? "conflict" : ""} ${locked ? "locked" : ""}" style="--block-top:${top}px;--block-height:${height}px" data-timeline-block="${esc(block.id)}" tabindex="0" role="button" aria-label="${esc(`${block.title}，${minuteLabel(range.start)} 到 ${minuteLabel(range.end)}${locked ? "，固定时间" : "，可拖动"}`)}"><span class="block-grip" aria-hidden="true"></span><div><small>${esc(minuteLabel(range.start))} — ${esc(minuteLabel(range.end))}${locked ? " · LOCKED" : ""}</small><strong>${esc(shortText(block.title || "未命名时间块", 58))}</strong><em>${esc(trackName(block.goal))}</em></div>${locked ? `<i class="lock-mark" aria-hidden="true">◆</i>` : `<button type="button" class="resize-handle" data-resize-block="${esc(block.id)}" tabindex="-1" aria-label="调整 ${esc(block.title)} 的结束时间"></button>`}</article>`;
}

function conflictRecoveryBanner() {
  if (!conflictRetry) return "";
  return `<div class="recovery-banner"><div><strong>日程在另一处更新过</strong><span>已经刷新到最新版本。你可以检查后重试刚才的操作，不会静默覆盖。</span></div><button type="button" data-conflict-retry>重试操作</button><button type="button" data-conflict-dismiss aria-label="放弃重试">×</button></div>`;
}

function timelineMarkup(blocks) {
  const height = (TIMELINE_END - TIMELINE_START) * TIMELINE_PX_PER_MINUTE;
  const hours = Array.from({ length: (TIMELINE_END - TIMELINE_START) / 60 + 1 }, (_, index) => TIMELINE_START / 60 + index);
  return `<div class="day-timeline" style="--timeline-height:${height}px"><div class="time-ruler" aria-hidden="true">${hours.map((hour) => `<span style="top:${(hour * 60 - TIMELINE_START) * TIMELINE_PX_PER_MINUTE}px">${String(hour).padStart(2, "0")}:00</span>`).join("")}</div><div class="time-stage" data-timeline-dropzone="${esc(selectedDate)}" style="height:${height}px" aria-label="${esc(selectedDate)} 时间轴">${hours.map((hour) => `<i class="hour-line" style="top:${(hour * 60 - TIMELINE_START) * TIMELINE_PX_PER_MINUTE}px"></i>`).join("")}${blocks.map((block) => timelineBlock(block, blocks)).join("")}<div class="drop-cursor" aria-hidden="true"><span></span></div></div></div>`;
}

function renderPlan() {
  selectedDate ||= todayIso();
  const start = weekStart(selectedDate);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const blocks = activeBlocks();
  const selectedBlocks = blocks.filter((block) => blockDate(block) === selectedDate).sort((a, b) => blockStart(a) - blockStart(b));
  const conflicts = conflictIds(selectedBlocks);
  const scheduledTasks = new Set(blocks.map((block) => block.taskId).filter(Boolean));
  const backlog = openTasks().filter((task) => !scheduledTasks.has(task.id));
  setHero("PLAN / TIME CANVAS", "把下一步放进真实时间，而不是更长的清单。", "拖动时间块改变开始时间，拉动底部调整长度；固定事项保持锁定，冲突只提示、不代替你决定。");
  $("#pageTitle").textContent = "Plan";
  $("#viewContent").innerHTML = `${healthPanel()}${conflictRecoveryBanner()}<section class="plan-shell"><header class="plan-toolbar"><div><span class="eyebrow">${esc(start)} — ${esc(days.at(-1))}</span><h2>时间工作台</h2><p>15 分钟刻度 · 拖放安排 · 键盘方向键微调</p></div><div class="calendar-nav"><button type="button" data-week-shift="-7" aria-label="上一周">←</button><button type="button" data-plan-today>今天</button><button type="button" data-week-shift="7" aria-label="下一周">→</button><button type="button" class="primary" data-block-new>+ 时间块</button></div></header><div class="week-strip">${days.map((date) => { const count = blocks.filter((block) => blockDate(block) === date).length; return `<button type="button" class="day ${date === selectedDate ? "selected" : ""} ${date === todayIso() ? "today" : ""}" data-date="${date}"><small>${["日","一","二","三","四","五","六"][weekdayIndex(date)]}</small><strong>${date.slice(8)}</strong><span>${count ? `${count} 块` : "留白"}</span></button>`; }).join("")}</div><div class="calendar-workbench"><div class="agenda timeline-agenda"><header><div><span class="eyebrow">DAY VIEW</span><h3>${esc(selectedDate)}</h3></div><strong>${selectedBlocks.length} 个时间块${conflicts.size ? ` · ${conflicts.size} 个冲突` : ""}</strong></header>${conflicts.size ? `<div class="conflict-alert">红色描边表示时间重叠；系统没有移动任何安排。</div>` : ""}${timelineMarkup(selectedBlocks)}</div><aside class="backlog"><header><div><span class="eyebrow">UNSCHEDULED</span><h3>未排期任务</h3></div><strong>${backlog.length}</strong></header><p class="backlog-hint">拖到左侧时间轴，或用“安排”精确设置。</p><div class="backlog-list">${backlog.slice(0, 16).map((task) => `<article draggable="true" data-backlog-task="${esc(task.id)}" tabindex="0"><span class="drag-dots" aria-hidden="true">⠿</span><div><strong>${esc(task.title)}</strong><span>${esc(trackName(task.goal))}${task.due ? ` · ${task.due}` : ""}</span></div><button type="button" data-block-task="${esc(task.id)}">安排</button></article>`).join("") || emptyState("任务都已安排", "别急着把剩余时间填满。")}</div><div class="calendar-legend"><span><i class="focus"></i>可移动</span><span><i class="fixed"></i>固定</span><span><i class="conflict"></i>冲突</span></div></aside></div></section>`;
  if (editingBlockId) openBlockEditor(editingBlockId);
}

function renderPlanV2() {
  selectedDate ||= todayIso();
  setHero("PLAN / CALENDAR", "把所有日程放进同一张真实日历。", "月视图看硬窗口，周视图安排时间块，Agenda 在密集日程中保留完整可读性。冲突只提示，不自动替你重排。");
  $("#pageTitle").textContent = "Plan";
  if (!calendarController) {
    calendarController = window.OOSCalendarUI.create({
      esc,
      shortText,
      getState: () => state,
      getMeta: () => stateMeta,
      today: todayIso,
      trackName,
      trackColor: trackColorHex,
      toast,
      openEditor: openBlockEditor,
      mutate: stateOps,
      renderHost: renderPlanV2
    });
  }
  calendarController.anchor ||= selectedDate;
  calendarController.render($("#viewContent"), { healthHtml: healthPanel(), recoveryHtml: conflictRecoveryBanner() });
}

function archetypeOf(item) {
  const value = String(item.archetype || item.trackType || item.type || "").toLowerCase();
  if (/trend/.test(value)) return "trend";
  if (/habit|fitness|health|routine/.test(value)) return "habit";
  if (/pipeline|commercial|sales|deal/.test(value)) return "pipeline";
  if (/relationship|family|partner/.test(value)) return "relationship";
  if (/knowledge|learning|study|research/.test(value)) return "learning";
  return "project";
}

function tracksViewSwitch() {
  const views = [["gallery", "画廊"], ["board", "看板"], ["table", "表格"], ["list", "列表"]];
  return `<div class="view-switch" role="tablist" aria-label="轨道视图切换">${views.map(([key, label]) => `<button type="button" role="tab" aria-selected="${tracksViewMode === key}" class="view-switch-btn ${tracksViewMode === key ? "active" : ""}" data-track-view="${key}">${label}</button>`).join("")}</div>`;
}

function renderTracks() {
  const models = tracks().map(trackModel);
  setHero("TRACKS / LONG ARCS", "看见长期旅程，不被任务数量淹没。", "每条轨道只回答四件事：在哪、往哪、下一步、是否还在燃烧。");
  $("#pageTitle").textContent = "Tracks";
  const activeCount = models.filter((item) => ["active", "watch"].includes(trackHealth(item.id).status || "active")).length;
  const stalledCount = models.filter((item) => (trackHealth(item.id).status || "") === "stalled").length;
  const summary = `<section class="tracks-summary"><div><span class="eyebrow">LONG ARCS</span><h2>长期主线不是任务堆，是持续被看见的方向。</h2><p>每条 Track 都从同一组任务、日程、证据和笔记实时派生。</p></div><dl><div><dt>活跃</dt><dd>${activeCount}</dd></div><div><dt>停滞</dt><dd>${stalledCount}</dd></div><div><dt>总轨道</dt><dd>${models.length}</dd></div></dl></section>`;
  let body;
  if (tracksViewMode === "board") body = tracksBoard(models);
  else if (tracksViewMode === "table") body = tracksTable(models);
  else if (tracksViewMode === "list") body = tracksList(models);
  else body = `<section class="track-grid">${models.map((item, index) => trackOverview(item, index)).join("") || emptyState("还没有轨道", "在 First Flight 中定义第一条想长期推进的主线。")}</section>`;
  $("#viewContent").innerHTML = `${healthPanel()}${summary}${tracksViewSwitch()}${body}`;
}

function tracksBoard(models) {
  if (!models.length) return emptyState("还没有轨道", "在 First Flight 中定义第一条想长期推进的主线。");
  return `<div class="track-board" data-board>${TRACK_ARCH_ORDER.map((arch) => {
    const col = models.filter((item) => archetypeOf(item) === arch);
    return `<section class="board-col" data-drop-arch="${arch}"><header><span>${TRACK_ARCH_LABEL[arch]}</span><strong>${col.length}</strong></header><div class="board-col-body" data-drop-zone>${col.map(boardCard).join("") || `<p class="lane-empty">把轨道拖到这里</p>`}</div></section>`;
  }).join("")}<p class="board-hint">拖动卡片可改类型，或在卡片里直接选「类型」。</p></div>`;
}

function boardCard(item) {
  const health = trackHealth(item.id);
  const status = health.status || "active";
  const progress = Math.max(0, Math.min(100, Number(item.progress) || 0));
  const opts = TRACK_ARCH_ORDER.map((a) => `<option value="${a}" ${archetypeOf(item) === a ? "selected" : ""}>${TRACK_ARCH_LABEL[a]}</option>`).join("");
  return `<article class="board-card status-${esc(status)}" draggable="true" data-track="${esc(item.id)}" data-arch="${esc(archetypeOf(item))}"><h3>${esc(item.name)}</h3><p>${esc(shortText(item.nextAction || item.stage || "下一步待补充", 80))}</p><div class="board-card-foot"><span class="mini-progress"><i style="width:${progress}%"></i></span><strong>${progress}%</strong></div><label class="board-type"><span>类型</span><select data-track-set-arch="${esc(item.id)}">${opts}</select></label></article>`;
}

function tracksTable(models) {
  if (!models.length) return emptyState("还没有轨道", "在 First Flight 中定义第一条想长期推进的主线。");
  const cols = [["name", "名称"], ["archetype", "类型"], ["stage", "阶段"], ["progress", "进度"], ["status", "状态"], ["nextAction", "下一步"]];
  const sorted = [...models].sort((a, b) => {
    const va = trackSortValue(a, tracksSort.key), vb = trackSortValue(b, tracksSort.key);
    if (va < vb) return -1 * tracksSort.dir;
    if (va > vb) return 1 * tracksSort.dir;
    return 0;
  });
  const head = `<tr>${cols.map(([key, label]) => `<th class="${tracksSort.key === key ? "sorted" : ""}" data-track-sort="${key}">${label}${tracksSort.key === key ? `<i class="sort-caret">${tracksSort.dir > 0 ? "▲" : "▼"}</i>` : ""}</th>`).join("")}</tr>`;
  const rows = sorted.map((item) => {
    const health = trackHealth(item.id);
    const status = health.status || "active";
    const progress = Math.max(0, Math.min(100, Number(item.progress) || 0));
    return `<tr class="status-${esc(status)}" data-track="${esc(item.id)}"><td class="tt-name">${esc(item.name)}</td><td>${esc(TRACK_ARCH_LABEL[archetypeOf(item)] || archetypeOf(item))}</td><td>${esc(item.stage || "—")}</td><td><span class="mini-progress"><i style="width:${progress}%"></i></span><span class="tt-pct">${progress}%</span></td><td>${esc(healthLabel[status] || status)}</td><td class="tt-next">${esc(shortText(item.nextAction || "—", 60))}</td></tr>`;
  }).join("");
  return `<div class="track-table-wrap"><table class="track-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}

function trackSortValue(item, key) {
  if (key === "progress") return Number(item.progress) || 0;
  if (key === "archetype") return TRACK_ARCH_LABEL[archetypeOf(item)] || archetypeOf(item);
  if (key === "stage") return String(item.stage || "");
  if (key === "status") return trackHealth(item.id).status || "active";
  if (key === "nextAction") return String(item.nextAction || "");
  return String(item.name || "");
}

function tracksList(models) {
  if (!models.length) return emptyState("还没有轨道", "在 First Flight 中定义第一条想长期推进的主线。");
  return `<ul class="track-list">${models.map((item, index) => {
    const health = trackHealth(item.id);
    const status = health.status || "active";
    const progress = Math.max(0, Math.min(100, Number(item.progress) || 0));
    return `<li class="track-list-item status-${esc(status)}" data-track="${esc(item.id)}"><span class="tl-index">${String(index + 1).padStart(2, "0")}</span><span class="tl-name">${esc(item.name)}</span><span class="tl-arch">${esc(TRACK_ARCH_LABEL[archetypeOf(item)] || archetypeOf(item))}</span><span class="tl-stage">${esc(item.stage || "—")}</span><span class="tl-prog"><i style="width:${progress}%"></i></span><strong class="tl-pct">${progress}%</strong></li>`;
  }).join("")}</ul>`;
}

function trackOverview(item, index) {
  const health = trackHealth(item.id);
  const status = health.status || health.health || "active";
  const progress = Math.max(0, Math.min(100, Number(item.progress) || 0));
  return `<button type="button" class="track-card archetype-${archetypeOf(item)} status-${esc(status)}" data-track="${esc(item.id)}"><header><span>${String(index + 1).padStart(2, "0")} · ${esc(item.role || archetypeOf(item))}</span><i class="${esc(status)}"></i></header><h2>${esc(item.name)}</h2><p>${esc(shortText(item.summary || item.stage || "阶段待补充", 82))}</p><div class="track-next"><span>NEXT</span><strong>${esc(shortText(item.nextAction || "下一步待补充", 62))}</strong></div><div class="track-line"><i style="width:${progress}%"></i></div><footer><strong>${progress}%</strong><span>${esc(item.stage || "待补充")}</span><span>${health.unscheduled ? "未排期" : healthLabel[status] || status}</span></footer></button>`;
}

function renderTrack(id) {
  const item = trackModel(track(id) || goal(id) || { id, name: id });
  const archetype = archetypeOf(item);
  const health = trackHealth(id);
  const tasks = openTasks().filter((task) => task.goal === id);
  const relatedNotes = notes().filter((note) => list(note.relatedGoals).includes(id));
  const milestones = list(state?.logs?.milestones)
    .filter((entry) => entry.goal === id)
    .sort((left, right) => String(left.date || "9999-12-31").localeCompare(String(right.date || "9999-12-31")))
    .slice(0, 6);
  setHero(`TRACK / ${archetype.toUpperCase()}`, item.name, item.nextAction || "下一步待补充。");
  $("#pageTitle").textContent = navName(item);
  const special = archetypePanel(archetype, item, health, tasks, milestones, relatedNotes);
  const nextBlock = activeBlocks().filter((block) => block.goal === id && block.startAt).sort((left, right) => blockStart(left) - blockStart(right))[0];
  const visionCover = item.visionImage ? `<div class="track-cover"><img src="${esc(item.visionImage)}" alt="${esc(item.name)} 愿景图"></div>` : "";
  $("#viewContent").innerHTML = `<button type="button" class="back-link" data-view="tracks">← 返回 Tracks</button><div class="track-actions-row"><button type="button" class="oos-edit-track" data-edit-track="${esc(id)}">编辑轨道</button><button type="button" class="oos-edit-track danger" data-delete-track="${esc(id)}">删除轨道</button></div>${visionCover}<section class="track-hero archetype-${archetype}"><div><span class="eyebrow">${esc(item.role || archetype)} · ${esc(healthLabel[health.status] || health.status || "活跃")}</span><h2>${esc(item.name)}</h2><p>${esc(item.summary || item.nextAction || "下一步待补充。")}</p></div><aside class="track-summary-metrics"><div><span>当前阶段</span><strong>${esc(item.stage || "待补充")}</strong></div><div><span>下一动作</span><strong>${esc(shortText(item.nextAction || "待补充", 70))}</strong></div><div><span>下一日程</span><strong>${esc(nextBlock ? `${blockTime(nextBlock.startAt, true)} · ${nextBlock.title}` : "尚未排期")}</strong></div></aside></section>${special}<div class="two-col">${section("开放任务", `${tasks.length} 项仍在轨道上`, `<div class="task-list">${tasks.map((task) => taskCard(task, true)).join("") || emptyState("没有开放任务", "如果轨道仍然活跃，补一个最小下一步。")}</div>`)}${section("相关笔记", "用于快速恢复上下文", `<div class="note-list compact">${relatedNotes.slice(0, 6).map(noteRow).join("") || emptyState("暂无关联笔记", "只保存未来值得重新读到的内容。")}</div>`)}</div>`;
}

function trackViews(item) {
  const derivedSource = state?.__derived?.trackViews;
  const derived = Array.isArray(derivedSource)
    ? derivedSource.find((entry) => entry.trackId === item.id || entry.id === item.id)
    : derivedSource?.[item.id];
  const rows = list(derived?.views).length ? list(derived.views) : list(item.views);
  return rows.filter((entry) => entry && typeof entry === "object");
}

function viewFor(item, types) {
  const accepted = new Set(types);
  return trackViews(item).find((entry) => accepted.has(String(entry.type || entry.kind || "").toLowerCase())) || {};
}

function numericValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function metricEntries(item, viewConfig = {}) {
  const metricKey = String(viewConfig.metric || viewConfig.metricKey || viewConfig.key || item.metricKey || viewConfig.id || "").toLowerCase();
  const sources = Array.isArray(viewConfig.entries) ? [...viewConfig.entries] : [
    ...list(viewConfig.data), ...list(item.metrics), ...list(state?.logs?.metrics), ...list(state?.metrics)
  ];
  if (state?.metrics && !Array.isArray(state.metrics) && typeof state.metrics === "object") {
    for (const [key, rows] of Object.entries(state.metrics)) {
      for (const row of list(rows)) sources.push({ metricKey: key, ...row });
    }
  }
  return sources.map((entry, index) => {
    if (entry === null || entry === undefined) return null;
    if (typeof entry === "number") return { value: entry, date: "", note: "", index };
    const owner = entry.trackId || entry.goal || entry.relatedGoal;
    if (owner && owner !== item.id) return null;
    const entryKey = String(entry.metricKey || entry.metric || entry.key || entry.type || "").toLowerCase();
    if (metricKey && entryKey && metricKey !== entryKey) return null;
    const value = numericValue(entry.value ?? entry.number ?? entry.measurement ?? entry.amount);
    if (value === null) return null;
    return { value, date: String(entry.date || entry.recordedAt || entry.at || entry.createdAt || "").slice(0, 10), note: String(entry.note || entry.summary || ""), index };
  }).filter(Boolean).sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.index - b.index);
}

function trendPanel(item, health) {
  const viewConfig = viewFor(item, ["trend-line", "line", "trend", "metric"]);
  const entries = metricEntries(item, viewConfig);
  const unit = String(viewConfig.unit || item.unit || item.metricUnit || "").trim();
  const target = numericValue(viewConfig.target ?? item.targetValue ?? item.target);
  const metricKey = String(viewConfig.metric || viewConfig.metricKey || viewConfig.key || item.metricKey || viewConfig.id || "value");
  const title = viewConfig.title || item.metricName || item.metric || "趋势记录";
  let chart = emptyState("还没有真实数值", `记录第一次${unit ? `（${unit}）` : ""}后，这里才会出现折线。${target !== null ? ` 目标：${target}${unit}。` : ""}`);
  let summary = `<div class="trend-summary"><strong>—<small>最新记录</small></strong><strong>${target === null ? "—" : `${esc(target)}${esc(unit)}`}<small>目标</small></strong><strong>${health.quietDays ?? "?"}<small>安静天数</small></strong></div>`;
  if (entries.length) {
    const width = 760, height = 250, left = 58, right = 22, top = 24, bottom = 42;
    const values = entries.map((entry) => entry.value).concat(target === null ? [] : [target]);
    let min = Math.min(...values), max = Math.max(...values);
    const spread = Math.max(1, max - min);
    min -= spread * .12; max += spread * .12;
    const x = (index) => entries.length === 1 ? (left + width - right) / 2 : left + index * (width - left - right) / (entries.length - 1);
    const y = (value) => top + (max - value) * (height - top - bottom) / (max - min || 1);
    const points = entries.map((entry, index) => `${x(index).toFixed(1)},${y(entry.value).toFixed(1)}`).join(" ");
    const targetY = target === null ? null : y(target);
    const ticks = [max, (max + min) / 2, min];
    chart = `<div class="trend-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}，${entries.length} 条真实记录"><g class="chart-grid">${ticks.map((tick) => `<line x1="${left}" y1="${y(tick)}" x2="${width - right}" y2="${y(tick)}"></line><text x="${left - 10}" y="${y(tick) + 4}">${esc(Number(tick.toFixed(1)))}</text>`).join("")}</g>${targetY === null ? "" : `<g class="target-line"><line x1="${left}" y1="${targetY}" x2="${width - right}" y2="${targetY}"></line><text x="${width - right}" y="${targetY - 7}" text-anchor="end">TARGET ${esc(target)}${esc(unit)}</text></g>`}<polyline class="trend-area-line" points="${points}"></polyline>${entries.map((entry, index) => `<g class="trend-point"><circle cx="${x(index)}" cy="${y(entry.value)}" r="5"></circle><title>${esc(`${entry.date || "未注明日期"} · ${entry.value}${unit}${entry.note ? ` · ${entry.note}` : ""}`)}</title></g>`).join("")}<text class="date-label" x="${left}" y="${height - 13}">${esc(entries[0].date || "起点")}</text><text class="date-label" x="${width - right}" y="${height - 13}" text-anchor="end">${esc(entries.at(-1).date || "最新")}</text></svg></div>`;
    const latest = entries.at(-1), previous = entries.at(-2);
    const delta = previous ? latest.value - previous.value : null;
    summary = `<div class="trend-summary"><strong>${esc(latest.value)}${esc(unit)}<small>最新 · ${esc(latest.date || "未注明日期")}</small></strong><strong>${delta === null ? "—" : `${delta > 0 ? "+" : ""}${Number(delta.toFixed(2))}${unit}`}<small>较上次</small></strong><strong>${target === null ? "—" : `${esc(target)}${esc(unit)}`}<small>目标</small></strong></div>`;
  }
  const form = `<form id="metricForm" class="metric-form" data-track-id="${esc(item.id)}" data-view-id="${esc(viewConfig.id || metricKey)}" data-metric-key="${esc(metricKey)}" data-unit="${esc(unit)}"><div><span class="eyebrow">LOG A REAL VALUE</span><strong>记录一次</strong></div><label><span>数值${unit ? `（${esc(unit)}）` : ""}</span><input name="value" type="number" step="any" required inputmode="decimal"></label><label><span>日期</span><input name="date" type="date" required value="${esc(todayIso())}"></label><label class="metric-note"><span>备注</span><input name="note" maxlength="160" placeholder="可选：当时发生了什么"></label><button type="submit">写入趋势</button></form>`;
  return section(title, `${entries.length} 条真实记录${unit ? ` · 单位 ${unit}` : ""}`, `${summary}${chart}${form}`, "archetype-panel trend-panel");
}

function habitPanel(item, health) {
  const viewConfig = viewFor(item, ["habit-heatmap", "habit-grid", "heatmap", "habit"]);
  const records = [...activities(), ...list(state?.logs?.habits), ...list(viewConfig.entries)].filter((entry) => [entry.relatedGoal, entry.goal, entry.trackId].includes(item.id));
  const activeDates = new Set(records.map((entry) => String(entry.date || entry.recordedAt || "").slice(0, 10)).filter(Boolean));
  const dates = Array.from({ length: 42 }, (_, index) => addDays(todayIso(), index - 41));
  return section(viewConfig.title || "行动热力", `过去 6 周 · 建议每 ${item.cadenceDays || health.cadenceDays || 7} 天至少一次`, `<div class="habit-visual"><div class="habit-score"><strong>${activeDates.size}<small>记录日</small></strong><span>${health.quietDays ?? "?"} 天安静</span></div><div class="habit-heatmap" role="img" aria-label="过去六周真实行动热力图">${dates.map((date) => `<i class="${activeDates.has(date) ? "filled" : ""} ${date === todayIso() ? "today" : ""}" title="${esc(date)}${activeDates.has(date) ? " · 有记录" : " · 无记录"}"></i>`).join("")}</div><p>${esc(item.metric || viewConfig.description || "空白格表示没有记录，不等于失败。")}</p></div>`, "archetype-panel habit-panel");
}

function pipelinePanel(item) {
  const viewConfig = viewFor(item, ["pipeline-board", "pipeline", "kanban", "funnel"]);
  const rows = [...list(state?.logs?.pipeline), ...list(viewConfig.entries)].filter((entry) => !entry.goal && !entry.trackId || [entry.goal, entry.trackId].includes(item.id));
  const stages = list(viewConfig.stages).length ? list(viewConfig.stages) : ["lead", "active", "review", "done"];
  return section(viewConfig.title || "流动看板", "机会停在哪里，比总数更重要", `<div class="pipeline-board">${stages.map((stage) => { const stageRows = rows.filter((entry) => String(entry.status || stages[0]) === stage); return `<section><header><span>${esc(stage)}</span><strong>${stageRows.length}</strong></header>${stageRows.slice(0, 4).map((entry) => `<article><strong>${esc(shortText(entry.title || entry.brand || "未命名机会", 46))}</strong><p>${esc(shortText(entry.nextAction || entry.note || "下一步待补充", 62))}</p>${entry.amount ? `<small>${esc(entry.amount)}</small>` : ""}</article>`).join("") || `<p class="lane-empty">暂无项目</p>`}</section>`; }).join("")}</div>`, "archetype-panel pipeline-panel");
}

function learningPanel(item, relatedNotes) {
  const viewConfig = viewFor(item, ["learning-progress", "learning", "coverage", "knowledge"]);
  const questions = list(state?.questions).filter((entry) => [entry.goal, entry.trackId].includes(item.id));
  const checkpoints = list(viewConfig.checkpoints).length ? list(viewConfig.checkpoints) : relatedNotes.slice(0, 5).map((note) => ({ title: note.title, status: "captured" }));
  return section(viewConfig.title || "学习覆盖", "把笔记、问题和检查点连成一条可返回的路", `<div class="learning-map"><div class="learning-rings"><strong>${relatedNotes.length}<small>关联笔记</small></strong><span>${questions.filter((entry) => !entry.resolved).length} 个开放问题</span></div><div class="checkpoint-list">${checkpoints.map((entry, index) => `<article><i>${String(index + 1).padStart(2, "0")}</i><div><strong>${esc(entry.title || entry.name || "学习检查点")}</strong><span>${esc(entry.status || "captured")}</span></div></article>`).join("") || emptyState("还没有知识节点", "记录第一条笔记或开放问题后，这里会形成路径。")}</div></div>`, "archetype-panel learning-panel");
}

function relationshipPanel(item, tasks, relatedNotes) {
  const viewConfig = viewFor(item, ["relationship-pulse", "relationship", "touchpoints", "timeline"]);
  const touchpoints = [...list(state?.relationship?.entries), ...activities(), ...list(viewConfig.entries)].filter((entry) => [entry.relatedGoal, entry.goal, entry.trackId].includes(item.id)).slice(0, 8);
  return section(viewConfig.title || "关系节律", "只呈现被明确记录的互动，不推断情绪", `<div class="relationship-visual"><div class="relationship-orbit"><i></i><strong>${touchpoints.length}<small>近期互动</small></strong><span>${tasks.length} 个开放行动 · ${relatedNotes.length} 条笔记</span></div><div class="touchpoint-list">${touchpoints.map((entry) => `<article><time>${esc(String(entry.date || entry.recordedAt || "").slice(0, 10) || "最近")}</time><p>${esc(shortText(entry.note || entry.text || entry.summary || "已记录一次互动", 82))}</p></article>`).join("") || emptyState("暂无互动记录", "没有记录就保持空白；系统不会替你猜测关系状态。")}</div></div>`, "archetype-panel relationship-panel");
}

function projectPanel(item, milestones, tasks) {
  const viewConfig = viewFor(item, ["milestone-timeline", "project", "milestones", "timeline"]);
  const seen = new Set();
  const rows = [...list(viewConfig.entries), ...milestones]
    .filter((entry) => {
      const key = entry.id || `${entry.date || entry.due || ""}|${entry.title || entry.name || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => String(left.date || left.due || "9999-12-31").localeCompare(String(right.date || right.due || "9999-12-31")))
    .slice(0, 8);
  const datedTasks = tasks.filter((task) => task.due).slice(0, 4).map((task) => ({ title: task.title, date: task.due, status: task.status || "open" }));
  const entries = rows.length ? rows : datedTasks;
  return section(viewConfig.title || "里程碑航线", "项目只用可验证节点前进", `<div class="project-route">${entries.map((entry, index) => `<article class="${/done|complete/.test(String(entry.status)) ? "done" : ""}"><i>${String(index + 1).padStart(2, "0")}</i><div><time>${esc(entry.date || entry.due || "待定")}</time><strong>${esc(entry.title || entry.name || "里程碑")}</strong><p>${esc(shortText(entry.summary || entry.note || entry.status || "等待真实进展", 88))}</p></div></article>`).join("") || emptyState("暂无里程碑", "不编造进度；添加第一个可以验收的节点后，路线才会出现。")}</div>`, "archetype-panel project-panel");
}

function archetypePanel(archetype, item, health, tasks, milestones, relatedNotes) {
  if (archetype === "habit") return habitPanel(item, health);
  if (archetype === "pipeline") return pipelinePanel(item);
  if (archetype === "learning") return learningPanel(item, relatedNotes);
  if (archetype === "trend") return trendPanel(item, health);
  if (archetype === "relationship") return relationshipPanel(item, tasks, relatedNotes);
  return projectPanel(item, milestones, tasks);
}

function noteRow(note) {
  const rawTitle = String(note.title || "").trim();
  const firstLine = (rawTitle || String(note.body || "新备忘录")).split("\n")[0];
  const restLines = String(note.body || "").split("\n").filter((line, i) => i > 0 && line.trim());
  const preview = (rawTitle ? restLines : String(note.body || "").split("\n").slice(1)).join("  ");
  const date = String(note.updatedAt || note.date || "").slice(0, 10);
  return `<article class="memo-item ${note.pinned ? "pinned" : ""}" data-note-open="${esc(note.id)}">
    <div class="memo-item-main">
      <div class="memo-item-head"><strong>${esc(shortText(firstLine || "未命名", 60))}</strong>${note.pinned ? `<i class="memo-pin" title="已置顶">📌</i>` : ""}</div>
      <span class="memo-date">${esc(date)}</span>
      <p>${esc(shortText(preview || "暂无更多内容", 90))}</p>
    </div>
    <div class="memo-item-actions">
      <button type="button" class="memo-act" data-note-pin="${esc(note.id)}">${note.pinned ? "取消置顶" : "置顶"}</button>
      <button type="button" class="memo-act danger" data-note-delete="${esc(note.id)}">删除</button>
    </div>
  </article>`;
}

function renderNotes() {
  const query = $("#searchInput").value.trim().toLowerCase();
  if (selectedNoteId === "__new") { renderNoteEditor(null); return; }
  if (selectedNoteId) { renderNoteEditor(selectedNoteId); return; }
  let list = notes().slice();
  list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  if (query) list = list.filter((note) => `${note.title} ${note.body} ${list(note.tags).join(" ")}`.toLowerCase().includes(query));
  setHero("备忘录", "随手记，随时翻。", "任何页面右下角「+ 速记」都能一键记下。");
  $("#pageTitle").textContent = "备忘录";
  $("#viewContent").innerHTML = `<div class="memo-layout">
    <div class="memo-toolbar">
      <button type="button" class="memo-new" data-note-new>＋ 新建备忘录</button>
      <span class="memo-count">${list.length} 条</span>
    </div>
    <div class="memo-list">${list.map(noteRow).join("") || emptyState("还没有备忘录", "点上方「新建」，或任何页面用右下角「+ 速记」随手记一条。")}</div>
  </div>`;
}

const BLOCK_TYPES = [
  { type: "paragraph", label: "正文" },
  { type: "h1", label: "标题1" },
  { type: "h2", label: "标题2" },
  { type: "h3", label: "标题3" },
  { type: "todo", label: "待办" },
  { type: "quote", label: "引用" },
  { type: "callout", label: "提示" },
  { type: "code", label: "代码" },
  { type: "divider", label: "分割线" },
  { type: "image", label: "图片" },
  { type: "toggle", label: "折叠" }
];

function ensureNoteBlocks(note) {
  if (!note) return [];
  if (!Array.isArray(note.blocks)) {
    const body = String(note.body || "").replace(/\r/g, "");
    const lines = body.split("\n").filter((line, i, arr) => !(i === arr.length - 1 && line.trim() === ""));
    note.blocks = lines.length ? lines.map((line) => ({ type: "paragraph", content: line })) : [{ type: "paragraph", content: "" }];
  }
  return note.blocks;
}

function deriveNoteBody(blocks) {
  return (blocks || []).map((b) => {
    if (b.type === "divider") return "";
    if (b.type === "image") return b.src ? "[图片]" : "";
    if (b.type === "toggle") return (b.content || "") + (b.children ? "\n" + b.children : "");
    return b.content || "";
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function deriveNoteTitle(blocks) {
  const first = (blocks || []).find((b) => (b.content || b.children || "").trim());
  const text = first ? (first.content || first.children || "").trim() : "";
  return text ? text.slice(0, 120) : "新备忘录";
}

function blockRowMarkup(block, idx) {
  const t = block.type || "paragraph";
  const typeLabel = (BLOCK_TYPES.find((b) => b.type === t) || {}).label || "正文";
  let inner = "";
  if (t === "divider") {
    inner = `<div class="nb-divider"><span></span></div>`;
  } else if (t === "image") {
    inner = `<div class="nb-image">${block.src ? `<img src="${esc(block.src)}" alt="">` : `<div class="nb-image-empty">还没有图片</div>`}<div class="nb-image-actions"><button type="button" class="nb-mini" data-block-img="${idx}">${block.src ? "更换图片" : "上传图片"}</button>${block.src ? `<button type="button" class="nb-mini danger" data-img-remove="${idx}">删除图片</button>` : ""}</div><input type="file" accept="image/*" hidden data-block-file="${idx}"></div>`;
  } else if (t === "todo") {
    inner = `<label class="nb-todo"><input type="checkbox" data-todo-toggle="${idx}" ${block.checked ? "checked" : ""}><textarea data-block-content="${idx}" rows="1" placeholder="待办事项…">${esc(block.content || "")}</textarea></label>`;
  } else if (t === "toggle") {
    const open = !block.collapsed;
    inner = `<div class="nb-toggle ${open ? "open" : ""}"><button type="button" class="nb-toggle-head" data-toggle-collapse="${idx}"><span class="nb-caret">${open ? "▾" : "▸"}</span><textarea data-block-title="${idx}" rows="1" placeholder="折叠标题…">${esc(block.content || "")}</textarea></button>${open ? `<textarea data-block-content="${idx}" rows="2" placeholder="展开后写细节…" class="nb-toggle-body">${esc(block.children || "")}</textarea>` : ""}</div>`;
  } else {
    const ph = t === "h1" ? "大标题" : t === "h2" ? "中标题" : t === "h3" ? "小标题" : t === "quote" ? "引用一句话…" : t === "callout" ? "提示 / 强调…" : t === "code" ? "代码…" : "写点什么…";
    inner = `<textarea data-block-content="${idx}" rows="1" class="nb-text nb-${t}" placeholder="${ph}">${esc(block.content || "")}</textarea>`;
  }
  return `<div class="nb-row nb-type-${t}" data-block-index="${idx}">
    <div class="nb-gutter">
      <button type="button" class="nb-type-btn" data-block-type="${idx}" title="切换类型">${esc(typeLabel)}</button>
      <div class="nb-type-menu" data-type-menu="${idx}" hidden>${BLOCK_TYPES.map((b) => `<button type="button" data-set-type="${idx}" data-type="${b.type}">${esc(b.label)}</button>`).join("")}</div>
    </div>
    <div class="nb-main">${inner}</div>
    <div class="nb-ops">
      <button type="button" class="nb-mini" data-block-up="${idx}" title="上移">↑</button>
      <button type="button" class="nb-mini" data-block-down="${idx}" title="下移">↓</button>
      <button type="button" class="nb-mini danger" data-block-del="${idx}" title="删除">✕</button>
    </div>
  </div>`;
}

function rerenderNoteBlocks(note) {
  const nb = $("#noteBlocks");
  if (!nb) return;
  nb.innerHTML = note.blocks.map(blockRowMarkup).join("") + `<button type="button" class="nb-add" data-block-add="${note.blocks.length - 1}">＋ 添加块（或输入“/”选类型）</button>`;
  autoGrowAll(nb);
}

function autoGrow(ta) {
  if (!ta) return;
  ta.style.height = "auto";
  ta.style.height = Math.max(ta.scrollHeight, 38) + "px";
}
function autoGrowAll(root) {
  root.querySelectorAll("textarea").forEach(autoGrow);
}
function focusBlock(idx) {
  const nb = $("#noteBlocks");
  if (!nb) return;
  const ta = nb.querySelector(`[data-block-content="${idx}"], [data-block-title="${idx}"]`) || nb.querySelector(`.nb-row[data-block-index="${idx}"]`);
  if (ta && ta.focus) { ta.focus(); if (ta.setSelectionRange) { const len = ta.value.length; ta.setSelectionRange(len, len); } autoGrow(ta); }
}
function toggleTypeMenu(nb, idx) {
  const menu = nb.querySelector(`[data-type-menu="${idx}"]`);
  if (!menu) return;
  const willOpen = menu.hasAttribute("hidden");
  nb.querySelectorAll(".nb-type-menu").forEach((m) => m.setAttribute("hidden", ""));
  if (willOpen) menu.removeAttribute("hidden");
}
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { if (window.__OOS_PERSIST) window.__OOS_PERSIST(); }, 400);
}
function compressNoteImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const maxW = 1200;
        const ratio = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * ratio; canvas.height = img.height * ratio;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        let b64 = canvas.toDataURL("image/webp", 0.82);
        if (b64.length > 320 * 1024) b64 = canvas.toDataURL("image/jpeg", 0.7);
        resolve(b64);
      };
      img.onerror = function () { resolve(""); };
      img.src = e.target.result;
    };
    reader.onerror = function () { resolve(""); };
    reader.readAsDataURL(file);
  });
}

function wireNoteBlocks(note) {
  const nb = $("#noteBlocks");
  if (!nb) return;
  autoGrowAll(nb);
  let composing = false;
  let composingTa = null;
  function updateBlock(ta) {
    const idx = Number(ta.dataset.blockContent != null ? ta.dataset.blockContent : ta.dataset.blockTitle);
    const b = note.blocks[idx];
    if (!b) return;
    if (ta.dataset.blockTitle != null) b.children = ta.value;
    else b.content = ta.value;
    note.body = deriveNoteBody(note.blocks);
    autoGrow(ta);
    if (b.type === "paragraph" && ta.value === "/") toggleTypeMenu(nb, idx);
  }
  nb.addEventListener("compositionstart", (e) => {
    const ta = e.target.closest("[data-block-content],[data-block-title]");
    if (ta) { composing = true; composingTa = ta; }
  });
  nb.addEventListener("compositionend", (e) => {
    const ta = e.target.closest("[data-block-content],[data-block-title]");
    if (ta) { composing = false; composingTa = null; updateBlock(ta); schedulePersist(); }
  });
  nb.addEventListener("input", (e) => {
    const ta = e.target.closest("[data-block-content],[data-block-title]");
    if (!ta) return;
    updateBlock(ta);
    if (!e.isComposing && !composing) schedulePersist();
  });
  nb.addEventListener("change", (e) => {
    const cb = e.target.closest("[data-todo-toggle]");
    if (cb) { const b = note.blocks[Number(cb.dataset.todoToggle)]; if (b) { b.checked = cb.checked; schedulePersist(); } }
  });
  nb.addEventListener("click", (e) => {
    const typeBtn = e.target.closest("[data-block-type]");
    if (typeBtn) { toggleTypeMenu(nb, Number(typeBtn.dataset.blockType)); return; }
    const setType = e.target.closest("[data-set-type]");
    if (setType) {
      const idx = Number(setType.dataset.setType); const ty = setType.dataset.type; const b = note.blocks[idx];
      if (b) { b.type = ty; if (ty === "toggle" && b.children === undefined) b.children = ""; if (b.content === "/") b.content = ""; rerenderNoteBlocks(note); schedulePersist(); }
      nb.querySelectorAll(".nb-type-menu").forEach((m) => m.setAttribute("hidden", ""));
      return;
    }
    const del = e.target.closest("[data-block-del]");
    if (del) { const idx = Number(del.dataset.blockDel); note.blocks.splice(idx, 1); if (!note.blocks.length) note.blocks.push({ type: "paragraph", content: "" }); rerenderNoteBlocks(note); schedulePersist(); return; }
    const up = e.target.closest("[data-block-up]");
    if (up) { const idx = Number(up.dataset.blockUp); if (idx > 0) { const tmp = note.blocks[idx - 1]; note.blocks[idx - 1] = note.blocks[idx]; note.blocks[idx] = tmp; rerenderNoteBlocks(note); focusBlock(idx - 1); schedulePersist(); } return; }
    const down = e.target.closest("[data-block-down]");
    if (down) { const idx = Number(down.dataset.blockDown); if (idx < note.blocks.length - 1) { const tmp = note.blocks[idx + 1]; note.blocks[idx + 1] = note.blocks[idx]; note.blocks[idx] = tmp; rerenderNoteBlocks(note); focusBlock(idx + 1); schedulePersist(); } return; }
    const add = e.target.closest("[data-block-add]");
    if (add) { const idx = Number(add.dataset.blockAdd); note.blocks.splice(idx + 1, 0, { type: "paragraph", content: "" }); rerenderNoteBlocks(note); focusBlock(idx + 1); schedulePersist(); return; }
    const imgBtn = e.target.closest("[data-block-img]");
    if (imgBtn) { const fi = nb.querySelector(`[data-block-file="${imgBtn.dataset.blockImg}"]`); if (fi) fi.click(); return; }
    const imgFile = e.target.closest("[data-block-file]");
    if (imgFile) { const idx = Number(imgFile.dataset.blockFile); const file = imgFile.files && imgFile.files[0]; if (file) compressNoteImage(file).then((b64) => { if (b64) { note.blocks[idx].src = b64; rerenderNoteBlocks(note); schedulePersist(); } }); return; }
    const imgRemove = e.target.closest("[data-img-remove]");
    if (imgRemove) { const idx = Number(imgRemove.dataset.imgRemove); note.blocks[idx].src = ""; rerenderNoteBlocks(note); schedulePersist(); return; }
    const toggle = e.target.closest("[data-toggle-collapse]");
    if (toggle) { const b = note.blocks[Number(toggle.dataset.toggleCollapse)]; if (b) { b.collapsed = !b.collapsed; rerenderNoteBlocks(note); schedulePersist(); } return; }
  });
}

function saveNoteBlocks(note) {
  if (!note) return;
  const titleInput = $("#noteTitleInput");
  const tagsInput = $("#noteTagsInput");
  const title = (titleInput && titleInput.value.trim()) || deriveNoteTitle(note.blocks);
  const tags = tagsInput ? String(tagsInput.value || "").split(/[,，]/).map((s) => s.trim()).filter(Boolean) : (note.tags || []);
  const body = deriveNoteBody(note.blocks);
  if (note.id && note.id !== "note-new") {
    note.title = title; note.body = body; note.tags = tags; note.updatedAt = new Date().toISOString();
    stateOps([{ type: "note.update", targetId: note.id, patch: { title, body, tags, blocks: note.blocks } }], "已保存。");
  } else {
    stateOps([{ type: "note.add", note: { title, body, tags, blocks: note.blocks, relatedGoals: [] } }], "已保存。");
    selectedNoteId = null;
  }
}

function renderNoteEditor(id) {
  let note;
  if (id && id !== "__new") {
    note = notes().find((item) => item.id === id) || null;
    if (!note) { selectedNoteId = null; renderNotes(); return; }
  } else {
    note = { id: "note-new", title: "", body: "", tags: [], blocks: [{ type: "paragraph", content: "" }] };
  }
  ensureNoteBlocks(note);
  editingNoteRef = note;
  setHero("备忘录", id && id !== "__new" ? "编辑中" : "新建", "块编辑器：输入“/”或点左侧按钮切换类型。");
  $("#pageTitle").textContent = id && id !== "__new" ? "编辑备忘录" : "新建备忘录";
  $("#viewContent").innerHTML = `<button type="button" class="back-link" data-note-back>← 返回列表</button>
    <div class="memo-editor">
      <input id="noteTitleInput" class="memo-title-input" value="${esc(note.title || "")}" maxlength="120" placeholder="标题（可选，留空取首行）">
      <div id="noteBlocks" class="note-blocks">${note.blocks.map(blockRowMarkup).join("")}<button type="button" class="nb-add" data-block-add="${note.blocks.length - 1}">＋ 添加块（或输入“/”选类型）</button></div>
      <input id="noteTagsInput" class="memo-tags-input" value="${esc(Array.isArray(note.tags) ? note.tags.join(", ") : "")}" placeholder="标签（逗号分隔）">
      <div class="memo-editor-actions">
        <button type="button" class="memo-act" data-note-pin="${esc(note.id !== "note-new" ? note.id : "")}" ${note.id !== "note-new" ? "" : "disabled"}>${note.id !== "note-new" && note.pinned ? "取消置顶" : "置顶"}</button>
        <button type="button" class="memo-act danger" data-note-delete="${esc(note.id !== "note-new" ? note.id : "")}" ${note.id !== "note-new" ? "" : "disabled"}>删除</button>
        <button type="button" class="memo-save" data-note-blocks-save>保存</button>
      </div>
    </div>`;
  wireNoteBlocks(note);
}

function renderReview() {
  const done = list(state?.tasks).filter((task) => task.status === "done").length;
  const open = openTasks().length;
  setHero("REVIEW / CLOSE THE LOOP", "不写长总结，只留下明天能用的信息。", "回看真实推进、卡点和下一步，让今天形成闭环。");
  $("#pageTitle").textContent = "Review";
  $("#viewContent").innerHTML = `${healthPanel()}<div class="review-stats"><article><strong>${done}</strong><span>已完成任务</span></article><article><strong>${open}</strong><span>开放任务</span></article><article><strong>${notes().length}</strong><span>外脑笔记</span></article><article><strong>${tracks().length}</strong><span>活跃轨道</span></article></div><div class="review-layout">${section("最近进展", "先看事实，再做判断", activityFeed(7))}<form id="reviewForm" class="editor-card review-form"><span class="eyebrow">DAILY REVIEW</span><h2>今晚三问</h2><label><span>今天实际推进了什么？</span><textarea name="progress" rows="3"></textarea></label><label><span>卡在哪里，原因是什么？</span><textarea name="blocker" rows="3"></textarea></label><label><span>明天最重要的一件事？</span><textarea name="tomorrow" rows="3"></textarea></label><button type="submit">保存复盘</button></form></div>`;
}

function visualAssetForCurrentView() {
  if (!(stateMeta?.readiness?.visualReady ?? state?.meta?.readiness?.visualReady)) return "";
  const assets = state?.visual?.assets || {};
  if (view === "track") return assets.tracks?.[selectedTrackId] || "";
  return assets.views?.[view] || "";
}

function setHero(eyebrow, title, subtitle) {
  $("#heroEyebrow").textContent = eyebrow;
  $("#heroTitle").textContent = title;
  $("#heroSubtitle").textContent = subtitle;
  const image = $("#heroVisual");
  const source = visualAssetForCurrentView();
  if (image) {
    image.hidden = !source;
    if (source) image.src = source;
    else image.removeAttribute("src");
  }
}

function renderShell() {
  applyTheme();
  document.body.classList.toggle("plan-mode", view === "plan");
  document.body.classList.toggle("tracks-mode", view === "tracks");
  document.body.classList.toggle("track-mode", view === "track");
  const status = operationalStatus();
  $("#dateLine").textContent = `${new Date().toLocaleDateString("zh-CN")} · schema ${state.meta.schemaVersion} · v${state.meta.version}`;
  $("#railStatus").textContent = status.operationalReady ? "运行就绪" : "需要检查";
  $("#railHealth").className = status.operationalReady ? "ready" : "attention";
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $("#navTracks").innerHTML = tracks().slice(0, 7).map((item) => `<button type="button" class="nav-track ${view === "track" && selectedTrackId === item.id ? "active" : ""}" data-track="${esc(item.id)}" title="${esc(item.name)}" style="--tc:${esc(trackColorHex(item.id))}"><i></i><span>${esc(shortText(navName(item), 18))}</span></button>`).join("");
}

function render() {
  renderShell();
  if (view === "plan") renderPlanV2();
  else if (view === "tracks") renderTracks();
  else if (view === "track") renderTrack(selectedTrackId);
  else if (view === "notes") renderNotes();
  else if (view === "review") renderReview();
  else if (view === "finance") renderFinance();
  else renderToday();
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 2600);
}

async function requestJson(url, options = {}) {
  return window.OOSClient.requestJson(url, options);
}

function stateChangeToken(meta) {
  return window.OOSClient.changeToken(meta);
}

function clientMutationId(prefix = "hud") {
  return window.OOSClient.mutationId(prefix);
}

async function load(options = {}) {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  [state, stateMeta] = await Promise.all([requestJson(`/api/state?t=${Date.now()}`), requestJson(`/api/state-meta?t=${Date.now()}`)]);
  liveSyncToken = stateChangeToken(stateMeta);
  selectedDate ||= todayIso();
  render();
  if (options.preserveUi) window.requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
  if (options.offerFirstFlight && ["not_started", "in_progress"].includes(onboardingStatus()) && sessionStorage.getItem("oos.first-flight.hidden") !== "1") openFirstFlight();
}

async function checkStateMeta() {
  if (liveSyncInFlight) return;
  liveSyncInFlight = true;
  try {
    const nextMeta = await requestJson(`/api/state-meta?t=${Date.now()}`);
    const nextToken = stateChangeToken(nextMeta);
    if (!liveSyncToken) liveSyncToken = nextToken;
    else if (nextToken !== liveSyncToken) await load({ preserveUi: true });
  } catch (error) {
    console.warn("OOS live sync paused:", error.message);
  } finally { liveSyncInFlight = false; }
}

function startLiveSync() {
  if (liveSyncTimer) clearInterval(liveSyncTimer);
  liveSyncTimer = setInterval(checkStateMeta, 5000);
  if ("EventSource" in window) {
    liveSyncEvents?.close();
    liveSyncEvents = new EventSource("/api/events");
    liveSyncEvents.addEventListener("state.changed", checkStateMeta);
    liveSyncEvents.addEventListener("worker.changed", checkStateMeta);
    liveSyncEvents.onerror = () => { /* polling remains the deterministic fallback */ };
  }
}

async function handleConflict(error, fallback, retry = null) {
  if (error.status === 409 && error.body?.code === "state_conflict") {
    conflictRetry = retry;
    await load();
    toast("状态已刷新；刚才的操作尚未写入，可检查后重试。");
    return;
  }
  const reviewReason = error.body?.code || error.body?.result?.reviewReason || "";
  const confirmable = new Set(["large_schedule_shift", "bulk_schedule_change", "locked_block_change", "priority_change", "task_completion_impact", "declared_high_risk"]);
  if (error.status === 422 && confirmable.has(reviewReason) && retry) {
    majorRetry = { ...retry, reviewReason };
    const label = reviewReason === "large_schedule_shift" ? "这次调整跨越了较大的时间范围" : reviewReason === "bulk_schedule_change" ? "这次会同时改动多个日程" : "这次操作会改变重要状态";
    $("#overlayRoot").innerHTML = `<div class="overlay" data-major-dismiss></div><aside class="drawer major-review" role="dialog" aria-modal="true" aria-label="确认重要调整"><header><div><span class="eyebrow">CONFIRM CHANGE</span><h2>确认这次调整</h2></div><button type="button" data-major-dismiss aria-label="关闭">×</button></header><div class="locked-block-detail"><p>${esc(label)}。系统尚未写入，请确认后再提交，不会自动覆盖原计划。</p><dl><div><dt>操作</dt><dd>${esc(retry.message || "更新状态")}</dd></div><div><dt>保护原因</dt><dd>${esc(reviewReason)}</dd></div></dl><footer><button type="button" data-major-dismiss>保持原计划</button><button type="button" class="primary" data-major-confirm>确认调整</button></footer></div></aside>`;
    toast("这次调整需要你确认后才会写入。");
    return;
  }
  toast(error.message || fallback || "操作失败");
}

async function stateOps(ops, message, options = {}) {
  try {
    const result = await requestJson("/api/state-ops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(window.OOSClient.envelope(state, { clientMutationId: options.clientMutationId || clientMutationId("hud-op"), source: "hud", confirmedMajor: options.confirmedMajor === true, summary: message, ops })) });
    lastWorkerResult = result;
    conflictRetry = null;
    majorRetry = null;
    await load();
    if (!options.silent) toast(`${message}${result.version ? ` · 后台同步至 v${result.version}` : ""}`);
    return true;
  } catch (error) { await handleConflict(error, "状态更新失败", { ops, message, options }); return false; }
}

async function mutateBlock(id, patch) {
  const block = id ? null : { id: `block-${Date.now()}`, ...patch };
  const ops = [id ? { type: "schedule.update", targetId: id, patch } : { type: "schedule.create", block }];
  const ok = await stateOps(ops, id ? "时间块已更新。" : "时间块已创建。");
  if (ok) { editingBlockId = ""; closeOverlay(); }
}

function blockEditorMarkup(block = null, task = null) {
  const isLocked = Boolean(block && (block.locked || block.kind === "fixed"));
  const isClosed = Boolean(block && ["completed", "cancelled", "archived"].includes(block.status));
  if (isLocked || isClosed) return `<div class="overlay" data-overlay-close></div><aside class="drawer" role="dialog" aria-modal="true"><header><div><span class="eyebrow">${isLocked ? "LOCKED BLOCK" : "SCHEDULE HISTORY"}</span><h2>${esc(block.title || "时间块")}</h2></div><button type="button" data-overlay-close>×</button></header><div class="locked-block-detail"><p>${isLocked ? "固定块不能在日历中拖动或缩放。它仍可明确标记完成或取消。" : `这个时间块已${block.status === "completed" ? "完成" : "取消"}，在“全部状态”中作为日程历史保留。`}</p><dl><div><dt>时间</dt><dd>${esc(blockTime(block.startAt, true))} — ${esc(blockTime(block.endAt, true))}</dd></div><div><dt>轨道</dt><dd>${esc(trackName(block.goal))}</dd></div><div><dt>备注</dt><dd>${esc(block.note || "无")}</dd></div></dl><footer><button type="button" data-overlay-close>关闭</button>${isClosed ? "" : `<button type="button" data-block-status="cancelled" data-block="${esc(block.id)}">取消</button><button type="button" class="primary" data-block-status="completed" data-block="${esc(block.id)}">完成</button>`}</footer></div></aside>`;
  const startAt = dateTimeInput(block?.startAt) || `${selectedDate || todayIso()}T09:00`;
  const endAt = dateTimeInput(block?.endAt) || `${selectedDate || todayIso()}T10:30`;
  return `<div class="overlay" data-overlay-close></div><aside class="drawer" role="dialog" aria-modal="true"><header><div><span class="eyebrow">${block ? "EDIT BLOCK" : "NEW BLOCK"}</span><h2>${block ? "编辑时间块" : "安排一个真实承诺"}</h2></div><button type="button" data-overlay-close>×</button></header><form id="blockForm" data-block-id="${esc(block?.id || "")}"><label><span>标题</span><input name="title" required maxlength="120" value="${esc(block?.title || task?.title || "")}"></label><div class="field-pair"><label><span>开始</span><input name="startAt" type="datetime-local" value="${esc(startAt)}"></label><label><span>结束</span><input name="endAt" type="datetime-local" value="${esc(endAt)}"></label></div><div class="field-pair"><label><span>类型</span><select name="kind">${Object.entries(kindLabel).map(([value,label]) => `<option value="${value}" ${value === (block?.kind || "focus") ? "selected" : ""}>${label}</option>`).join("")}</select></label><label><span>轨道</span><select name="goal"><option value="">不关联</option>${tracks().map((item) => `<option value="${esc(item.id)}" ${item.id === (block?.goal || task?.goal) ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></label></div><label><span>备注</span><textarea name="note" rows="4">${esc(block?.note || task?.nextStep || "")}</textarea></label><input type="hidden" name="taskId" value="${esc(block?.taskId || task?.id || "")}"><footer>${block?.startAt ? `<button type="button" class="danger" data-block-clear="${esc(block.id)}">清空时间</button>` : `<span></span>`}${block ? `<button type="button" data-block-status="cancelled" data-block="${esc(block.id)}">取消</button><button type="button" data-block-status="completed" data-block="${esc(block.id)}">完成</button>` : ""}<button type="button" data-overlay-close>关闭</button><button type="submit" class="primary">保存</button></footer></form></aside>`;
}

function openBlockEditor(blockId = "", taskId = "") {
  const block = list(state?.scheduleBlocks).find((item) => item.id === blockId) || null;
  editingBlockId = blockId;
  const task = openTasks().find((item) => item.id === taskId) || null;
  $("#overlayRoot").innerHTML = blockEditorMarkup(block, task);
  setTimeout(() => $("#overlayRoot input[name=title]")?.focus(), 10);
}

function closeOverlay() { $("#overlayRoot").replaceChildren(); editingBlockId = ""; }

function firstFlightMarkup() {
  const steps = [
    { number: "01", label: "认识驾驶舱", title: "Today 看现在，Tracks 看长期。", text: "聊天是入口，Current Truth 保存最近 24–72 小时的定位，HUD 只负责把状态投影出来；你不需要手工维护另一套系统。", demo: "先看 Today 的当前动作，再看 Tracks 中哪条长期轨道需要继续点火。" },
    { number: "02", label: "报告真实进展", title: "在聊天里说出一条刚发生的事实。", text: "不用学习命令，也不要整理成周报。直接说完成了什么、卡在哪里，或正在等待谁。兼容 Agent 会把事实写回 OOS。", demo: "例如：第一版提案已经发给客户，现在等周五反馈。" },
    { number: "03", label: "看到系统更新", title: "刷新 HUD，看事实如何改变下一步。", text: "进展进入状态后，Today、轨道连续性、任务和风险信号会从同一份真源重新计算。HUD 不是静态网页。", demo: "一句进展 → 状态更新 → Today 与 Track 同步变化。" },
    { number: "04", label: "完成一个动作", title: "在 HUD 完成或安排一个真实事项。", text: "勾选任务，或在 Plan 里创建时间块。低风险操作可以在 HUD 完成；方向和优先级变化仍然回到聊天确认。", demo: "尝试完成一项任务，或给下一步安排 30–90 分钟。" },
    { number: "05", label: "掌握三句话", title: "以后，你只需要自然地开口。", text: "用“记录一下”保存事实，用“今天怎么安排”形成节奏，用“我现在该做什么”获得此刻的建议。系统会在使用中继续定制。", demo: "记录一下…… / 今天怎么安排？ / 我现在该做什么？" }
  ];
  const step = steps[firstFlightStep];
  return `<div class="overlay first-flight-overlay"></div><section class="first-flight" role="dialog" aria-modal="true" aria-label="First Flight"><aside><div class="flight-mark"><i></i></div><span>FIRST FLIGHT</span><h2>五步开始使用<br>你的 OOS</h2><div class="flight-progress">${steps.map((item, index) => `<button type="button" data-flight-step="${index}" class="${index === firstFlightStep ? "active" : index < firstFlightStep ? "done" : ""}"><i>${item.number}</i><span>${item.label}</span></button>`).join("")}</div><button type="button" class="skip" data-flight-skip>暂时跳过</button></aside><main><span class="eyebrow">STEP ${step.number} / 05</span><h2>${esc(step.title)}</h2><p>${esc(step.text)}</p><blockquote>${esc(step.demo)}</blockquote><div class="flight-mini-route" aria-hidden="true"><i></i><i></i><i></i><span></span></div><footer><button type="button" data-flight-back ${firstFlightStep === 0 ? "disabled" : ""}>上一步</button>${firstFlightStep < steps.length - 1 ? `<button type="button" class="primary" data-flight-next>继续</button>` : `<button type="button" class="primary" data-flight-finish>进入 OOS</button>`}</footer></main></section>`;
}

function openFirstFlight() {
  sessionStorage.removeItem("oos.first-flight.hidden");
  const savedStep = Math.max(0, Number(state?.onboarding?.firstFlight?.currentStep || 1) - 1);
  firstFlightStep = onboardingStatus() === "completed" ? 0 : Math.max(firstFlightStep, savedStep);
  $("#overlayRoot").innerHTML = firstFlightMarkup();
}

async function persistOnboarding(status) {
  localStorage.setItem("oos.first-flight.status", status);
  const type = status === "completed" ? "onboarding.complete" : status === "skipped" ? "onboarding.skip" : "onboarding.resume";
  const ok = await stateOps([{ type }], status === "completed" ? "First Flight 已完成。" : status === "skipped" ? "已跳过，可随时恢复。" : "First Flight 已恢复。", { silent: true });
  return ok;
}

function timelineMinuteFromPointer(stage, clientY) {
  const rect = stage.getBoundingClientRect();
  const raw = TIMELINE_START + (clientY - rect.top) / TIMELINE_PX_PER_MINUTE;
  return Math.max(TIMELINE_START, Math.min(TIMELINE_END - TIMELINE_STEP, Math.round(raw / TIMELINE_STEP) * TIMELINE_STEP));
}

function beginTimelineGesture(event) {
  const element = event.target.closest("[data-timeline-block]");
  if (!element || event.button !== 0) return;
  const block = activeBlocks().find((entry) => entry.id === element.dataset.timelineBlock);
  if (!block) return;
  if (block.locked || block.kind === "fixed") { toast("固定时间块已锁定；请在编辑面板中明确修改。"); return; }
  const range = blockMinutes(block);
  if (range.start === null || range.end === null) return;
  timelineGesture = {
    pointerId: event.pointerId, element, block,
    mode: event.target.closest("[data-resize-block]") ? "resize" : "move",
    clientY: event.clientY, start: range.start, end: range.end,
    previewStart: range.start, previewEnd: range.end
  };
  element.classList.add("dragging");
  element.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function moveTimelineGesture(event) {
  if (!timelineGesture || timelineGesture.pointerId !== event.pointerId) return;
  const delta = Math.round(((event.clientY - timelineGesture.clientY) / TIMELINE_PX_PER_MINUTE) / TIMELINE_STEP) * TIMELINE_STEP;
  const duration = timelineGesture.end - timelineGesture.start;
  if (timelineGesture.mode === "resize") {
    timelineGesture.previewStart = timelineGesture.start;
    timelineGesture.previewEnd = Math.max(timelineGesture.start + TIMELINE_STEP, Math.min(TIMELINE_END, timelineGesture.end + delta));
  } else {
    timelineGesture.previewStart = Math.max(TIMELINE_START, Math.min(TIMELINE_END - duration, timelineGesture.start + delta));
    timelineGesture.previewEnd = timelineGesture.previewStart + duration;
  }
  const top = (timelineGesture.previewStart - TIMELINE_START) * TIMELINE_PX_PER_MINUTE;
  const height = Math.max(34, (timelineGesture.previewEnd - timelineGesture.previewStart) * TIMELINE_PX_PER_MINUTE);
  timelineGesture.element.style.setProperty("--block-top", `${top}px`);
  timelineGesture.element.style.setProperty("--block-height", `${height}px`);
  const dayBlocks = activeBlocks().filter((entry) => blockDate(entry) === selectedDate);
  timelineGesture.element.classList.toggle("conflict-preview", timelineConflict(timelineGesture.block.id, timelineGesture.previewStart, timelineGesture.previewEnd, dayBlocks));
  const label = timelineGesture.element.querySelector("small");
  if (label) label.textContent = `${minuteLabel(timelineGesture.previewStart)} — ${minuteLabel(timelineGesture.previewEnd)} · 预览`;
}

async function endTimelineGesture(event) {
  if (!timelineGesture || timelineGesture.pointerId !== event.pointerId) return;
  const gesture = timelineGesture;
  timelineGesture = null;
  gesture.element.classList.remove("dragging");
  if (gesture.previewStart === gesture.start && gesture.previewEnd === gesture.end) return;
  await stateOps([{ type: "schedule.update", targetId: gesture.block.id, patch: { startAt: timelineIso(selectedDate, gesture.previewStart), endAt: timelineIso(selectedDate, gesture.previewEnd) } }], timelineConflict(gesture.block.id, gesture.previewStart, gesture.previewEnd, activeBlocks().filter((entry) => blockDate(entry) === selectedDate)) ? "时间块已保存；请处理标出的冲突。" : "时间块已移动。");
}

async function keyboardMoveBlock(element, event) {
  const block = activeBlocks().find((entry) => entry.id === element.dataset.timelineBlock);
  if (!block) return;
  if (event.key === "Enter") { openBlockEditor(block.id); return; }
  if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  if (block.locked || block.kind === "fixed") return toast("固定时间块已锁定。");
  const range = blockMinutes(block);
  const delta = event.key === "ArrowUp" ? -TIMELINE_STEP : TIMELINE_STEP;
  let start = range.start, end = range.end;
  if (event.shiftKey) end = Math.max(start + TIMELINE_STEP, Math.min(TIMELINE_END, end + delta));
  else {
    const duration = end - start;
    start = Math.max(TIMELINE_START, Math.min(TIMELINE_END - duration, start + delta));
    end = start + duration;
  }
  await stateOps([{ type: "schedule.update", targetId: block.id, patch: { startAt: timelineIso(selectedDate, start), endAt: timelineIso(selectedDate, end) } }], event.shiftKey ? "时间块长度已调整。" : "时间块已移动 15 分钟。");
}

document.addEventListener("click", async (event) => {
  const nav = event.target.closest("[data-view]");
  if (nav) { view = nav.dataset.view; selectedTrackId = ""; closeOverlay(); window.scrollTo(0, 0); render(); return; }
  const trackViewBtn = event.target.closest("[data-track-view]");
  if (trackViewBtn) { tracksViewMode = trackViewBtn.dataset.trackView; try { localStorage.setItem("oos_tracks_view", tracksViewMode); } catch (e) {} render(); return; }
  const trackSortBtn = event.target.closest("[data-track-sort]");
  if (trackSortBtn) { const key = trackSortBtn.dataset.trackSort; if (tracksSort.key === key) tracksSort.dir *= -1; else { tracksSort.key = key; tracksSort.dir = 1; } render(); return; }
  const trackTarget = event.target.closest("[data-track]");
  if (trackTarget && !event.target.closest("select")) { view = "track"; selectedTrackId = trackTarget.dataset.track; closeOverlay(); window.scrollTo(0, 0); render(); return; }
  const editTrack = event.target.closest("[data-edit-track]");
  if (editTrack) { if (typeof window.openTrackEditor === "function") window.openTrackEditor(editTrack.dataset.editTrack); return; }
  const deleteTrack = event.target.closest("[data-delete-track]");
  if (deleteTrack) {
    const delId = deleteTrack.dataset.deleteTrack;
    const delName = trackName(delId);
    if (confirm(`确定删除轨道「${delName}」？\n这会同时删除它的任务、日程和趋势记录，且无法撤销。`)) {
      stateOps([{ type: "track.delete", targetId: delId }], "轨道已删除。").then(() => { view = "tracks"; selectedTrackId = ""; render(); });
    }
    return;
  }
  const notePin = event.target.closest("[data-note-pin]");
  if (notePin && notePin.dataset.notePin) { await stateOps([{ type: "note.pin", targetId: notePin.dataset.notePin }], "已更新置顶。"); renderNotes(); return; }
  const noteDelete = event.target.closest("[data-note-delete]");
  if (noteDelete && noteDelete.dataset.noteDelete) {
    if (confirm("确定删除这条备忘录？删除后无法恢复。")) {
      await stateOps([{ type: "note.delete", targetId: noteDelete.dataset.noteDelete }], "已删除。");
      selectedNoteId = null; renderNotes();
    }
    return;
  }
  const noteNew = event.target.closest("[data-note-new]");
  if (noteNew) { selectedNoteId = "__new"; renderNotes(); return; }
  const noteBack = event.target.closest("[data-note-back]");
  if (noteBack) { selectedNoteId = null; renderNotes(); return; }
  const noteOpen = event.target.closest("[data-note-open]");
  if (noteOpen) { selectedNoteId = noteOpen.dataset.noteOpen; renderNotes(); return; }
  const memoTodaySave = event.target.closest("[data-memo-today-save]");
  if (memoTodaySave) {
    const ta = document.getElementById("todayMemoInput");
    const body = ta ? ta.value.trim() : "";
    if (!body) { toast("写点什么再保存"); return; }
    const firstLine = body.split("\n")[0].slice(0, 120);
    await stateOps([{ type: "note.add", note: { title: firstLine, body } }], "已记到备忘录。");
    if (ta) ta.value = "";
    return;
  }
  const memoOpen = event.target.closest("[data-memo-open]");
  if (memoOpen) { view = "notes"; selectedNoteId = null; render(); return; }
  const finTab = event.target.closest("[data-fin-tab]");
  if (finTab) { financeTab = finTab.dataset.finTab; renderFinance(); return; }
  const finAdd = event.target.closest("[data-fin-add]");
  if (finAdd) { openFinModal(finAdd.dataset.finAdd, ""); return; }
  const finEdit = event.target.closest("[data-fin-edit]");
  if (finEdit) { const p = finEdit.dataset.finEdit.split(":"); openFinModal(p[0], p[1]); return; }
  const finDel = event.target.closest("[data-fin-del]");
  if (finDel) {
    const p = finDel.dataset.finDel.split(":");
    const label = p[0] === "fixed" ? "固定开支" : p[0] === "expenses" ? "开支记录" : "心愿";
    if (confirm(`确定删除这条${label}？删除后无法恢复。`)) {
      stateOps([{ type: "finance.delete", collection: p[0], targetId: p[1] }], "已删除。").then(() => { if (view === "finance") renderFinance(); });
    }
    return;
  }
  const guideToggle = event.target.closest("[data-guide-toggle]");
  if (guideToggle) { guideToggle.classList.toggle("open"); return; }
  const wishBuy = event.target.closest("[data-wish-buy]");
  if (wishBuy) {
    const fin = (state && state.finance) || { wishes: [] };
    const w = (fin.wishes || []).find((x) => x.id === wishBuy.dataset.wishBuy);
    if (w) { const ns = w.status === "bought" ? "pending" : "bought"; stateOps([{ type: "finance.update", collection: "wishes", targetId: w.id, patch: { status: ns } }], ns === "bought" ? "已标记为购买。" : "已取消。").then(() => { if (view === "finance") renderFinance(); }); }
    return;
  }
  const blocksSave = event.target.closest("[data-note-blocks-save]");
  if (blocksSave) { saveNoteBlocks(editingNoteRef); return; }
  const date = event.target.closest("[data-date]");
  if (date) { selectedDate = date.dataset.date; renderPlan(); return; }
  const weekShift = event.target.closest("[data-week-shift]");
  if (weekShift) { selectedDate = addDays(selectedDate || todayIso(), Number(weekShift.dataset.weekShift)); renderPlan(); return; }
  if (event.target.closest("[data-plan-today]")) { selectedDate = todayIso(); renderPlan(); return; }
  if (event.target.closest("[data-conflict-dismiss]")) { conflictRetry = null; renderPlanV2(); return; }
  if (event.target.closest("[data-conflict-retry]") && conflictRetry) { const retry = conflictRetry; await stateOps(retry.ops, retry.message, retry.options); return; }
  if (event.target.closest("[data-major-dismiss]")) { majorRetry = null; closeOverlay(); return; }
  if (event.target.closest("[data-major-confirm]") && majorRetry) { const retry = majorRetry; closeOverlay(); await stateOps(retry.ops, retry.message, { ...retry.options, confirmedMajor: true, clientMutationId: clientMutationId("hud-confirmed-major") }); return; }
  if (event.target.closest("[data-worker-open]")) { await openWorkerDrawer(); return; }
  const newBlock = event.target.closest("[data-block-new]");
  if (newBlock) { openBlockEditor(); return; }
  const taskBlock = event.target.closest("[data-block-task]");
  if (taskBlock) { openBlockEditor("", taskBlock.dataset.blockTask); return; }
  const edit = event.target.closest("[data-block-edit]");
  if (edit) { openBlockEditor(edit.dataset.blockEdit); return; }
  const blockStatus = event.target.closest("[data-block-status]");
  if (blockStatus) { closeOverlay(); await stateOps([{ type: blockStatus.dataset.blockStatus === "completed" ? "schedule.complete" : "schedule.cancel", targetId: blockStatus.dataset.block }], blockStatus.dataset.blockStatus === "completed" ? "时间块已完成。" : "时间块已取消。"); return; }
  const clear = event.target.closest("[data-block-clear]");
  if (clear) { await stateOps([{ type: "schedule.clearTime", targetId: clear.dataset.blockClear }], "时间已清空，任务回到未排期。"); closeOverlay(); return; }
  if (event.target.closest("[data-overlay-close]")) { closeOverlay(); return; }
  if (event.target.closest("[data-first-flight-open]")) { if (onboardingStatus() === "skipped") await persistOnboarding("in_progress"); openFirstFlight(); return; }
  const flightStep = event.target.closest("[data-flight-step]");
  if (flightStep) { firstFlightStep = Number(flightStep.dataset.flightStep); openFirstFlight(); return; }
  if (event.target.closest("[data-flight-back]")) { firstFlightStep = Math.max(0, firstFlightStep - 1); openFirstFlight(); return; }
  if (event.target.closest("[data-flight-next]")) { firstFlightStep = Math.min(4, firstFlightStep + 1); await stateOps([{ type: "onboarding.advance", step: firstFlightStep + 1 }], "", { silent: true }); openFirstFlight(); return; }
  if (event.target.closest("[data-flight-skip]")) { sessionStorage.setItem("oos.first-flight.hidden", "1"); closeOverlay(); await persistOnboarding("skipped"); render(); return; }
  if (event.target.closest("[data-flight-finish]")) { sessionStorage.setItem("oos.first-flight.hidden", "1"); closeOverlay(); await persistOnboarding("completed"); render(); }
});

document.addEventListener("pointerdown", beginTimelineGesture);
document.addEventListener("pointermove", moveTimelineGesture);
document.addEventListener("pointerup", endTimelineGesture);
document.addEventListener("pointercancel", () => { timelineGesture?.element?.classList.remove("dragging"); timelineGesture = null; });

document.addEventListener("dblclick", (event) => {
  const block = event.target.closest("[data-timeline-block]");
  if (block) openBlockEditor(block.dataset.timelineBlock);
});

document.addEventListener("dragstart", (event) => {
  const task = event.target.closest("[data-backlog-task]");
  if (!task) return;
  draggedTaskId = task.dataset.backlogTask;
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("text/oos-task", draggedTaskId);
  event.dataTransfer.setData("text/plain", draggedTaskId);
  task.classList.add("dragging");
});

document.addEventListener("dragend", (event) => {
  event.target.closest("[data-backlog-task]")?.classList.remove("dragging");
  setTimeout(() => { draggedTaskId = ""; }, 0);
});

// 轨道看板拖拽：按类型分列，拖卡片改类型（与日程时间轴拖拽互不干扰）
document.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".board-card");
  if (!card) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/oos-track", card.dataset.track);
  event.dataTransfer.setData("text/plain", card.dataset.track);
  card.classList.add("dragging");
});
document.addEventListener("dragend", (event) => {
  const card = event.target.closest(".board-card");
  if (card) card.classList.remove("dragging");
  document.querySelectorAll(".board-col-body.drag-over").forEach((z) => z.classList.remove("drag-over"));
});
document.addEventListener("dragover", (event) => {
  const zone = event.target.closest(".board-col-body");
  if (!zone) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  document.querySelectorAll(".board-col-body.drag-over").forEach((z) => { if (z !== zone) z.classList.remove("drag-over"); });
  zone.classList.add("drag-over");
});
document.addEventListener("drop", (event) => {
  const zone = event.target.closest(".board-col-body");
  if (!zone) return;
  event.preventDefault();
  zone.classList.remove("drag-over");
  const id = event.dataTransfer.getData("text/oos-track") || event.dataTransfer.getData("text/plain");
  const col = zone.closest(".board-col");
  const arch = col && col.dataset.dropArch;
  if (!id || !arch) return;
  const item = track(id);
  if (!item || archetypeOf(item) === arch) return;
  stateOps([{ type: "track.update", targetId: id, patch: { archetype: arch, trackType: arch } }], `已移到「${TRACK_ARCH_LABEL[arch] || arch}」`).then(() => render());
});

document.addEventListener("dragover", (event) => {
  const stage = event.target.closest("[data-timeline-dropzone]");
  const types = Array.from(event.dataTransfer.types || []);
  if (!stage || (!draggedTaskId && !types.includes("text/oos-task") && !types.includes("text/plain"))) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  const minute = timelineMinuteFromPointer(stage, event.clientY);
  stage.classList.add("drop-active");
  const cursor = stage.querySelector(".drop-cursor");
  cursor.style.top = `${(minute - TIMELINE_START) * TIMELINE_PX_PER_MINUTE}px`;
  cursor.querySelector("span").textContent = `${minuteLabel(minute)} · 放在这里`;
});

document.addEventListener("dragleave", (event) => {
  const stage = event.target.closest("[data-timeline-dropzone]");
  if (stage && !stage.contains(event.relatedTarget)) stage.classList.remove("drop-active");
});

document.addEventListener("drop", async (event) => {
  const stage = event.target.closest("[data-timeline-dropzone]");
  if (!stage) return;
  const taskId = event.dataTransfer.getData("text/oos-task") || event.dataTransfer.getData("text/plain") || draggedTaskId;
  draggedTaskId = "";
  const task = openTasks().find((entry) => entry.id === taskId);
  if (!task) return;
  event.preventDefault();
  stage.classList.remove("drop-active");
  const start = timelineMinuteFromPointer(stage, event.clientY);
  const end = Math.min(TIMELINE_END, start + 60);
  const block = { id: `block-${Date.now()}`, taskId: task.id, title: task.title, goal: task.goal || "", kind: "focus", startAt: timelineIso(selectedDate, start), endAt: timelineIso(selectedDate, end), status: "planned", source: "hud", locked: false, note: task.nextStep || "" };
  await stateOps([{ type: "schedule.create", block }], timelineConflict("", start, end, activeBlocks().filter((entry) => blockDate(entry) === selectedDate)) ? "已排入日程；请检查标出的时间冲突。" : "任务已拖入日程。");
});

document.addEventListener("change", (event) => {
  const archSel = event.target.closest("select[data-track-set-arch]");
  if (archSel) {
    const id = archSel.dataset.trackSetArch;
    const arch = archSel.value;
    const item = track(id);
    if (item && archetypeOf(item) !== arch) {
      stateOps([{ type: "track.update", targetId: id, patch: { archetype: arch, trackType: arch } }], `类型已改为「${TRACK_ARCH_LABEL[arch] || arch}」`).then(() => render());
    }
    return;
  }
  if (event.target.matches("[data-task]")) stateOps([{ type: event.target.checked ? "task.complete" : "task.reopen", targetId: event.target.dataset.task }], "任务已更新。");
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  if (form.id === "captureForm") {
    const text = String(data.text || "").trim();
    if (!text) return;
    try { const result = await requestJson("/api/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(window.OOSClient.envelope(state, { clientMutationId: clientMutationId("hud-capture"), source: "hud", text, kind: data.kind, relatedGoal: data.relatedGoal || "inbox" })) }); lastWorkerResult = result; await load(); toast(`笔记已由 Worker 写入 v${result.version}；分类项等待 Agent 判断。`); }
    catch (error) { await handleConflict(error, "记录失败"); }
    return;
  }
  if (form.id === "blockForm") {
    if (data.startAt && data.endAt && Date.parse(data.endAt) <= Date.parse(data.startAt)) return toast("结束时间必须晚于开始时间。");
    const kind = data.kind || "focus";
    await mutateBlock(form.dataset.blockId || "", { taskId: data.taskId || "", title: String(data.title || "").trim(), goal: data.goal || "", kind, startAt: data.startAt || null, endAt: data.endAt || null, status: "planned", source: "hud", locked: kind === "fixed", note: String(data.note || "").trim() });
    return;
  }
  if (form.id === "noteForm") {
    const noteId = String(data.id || "").trim();
    const noteObj = { title: String(data.title || "").trim(), body: String(data.body || "").trim(), tags: String(data.tags || "").split(/[,，]/).map((item) => item.trim()).filter(Boolean), relatedGoals: data.relatedGoal ? [data.relatedGoal] : [] };
    if (noteId) {
      await stateOps([{ type: "note.update", targetId: noteId, patch: noteObj }], "已保存。");
      selectedNoteId = noteId;
    } else {
      await stateOps([{ type: "note.add", note: noteObj }], "已保存。");
      selectedNoteId = null;
    }
    renderNotes();
    return;
  }
  if (form.id === "reviewForm") {
    if (![data.progress, data.blocker, data.tomorrow].some((value) => String(value || "").trim())) return toast("至少回答一项再保存。");
    await stateOps([{ type: "review.add", review: data }], "今日复盘已保存。");
    return;
  }
  if (form.id === "metricForm") {
    const value = numericValue(data.value);
    if (value === null) return toast("请输入有效数值。");
    const entry = { value, date: data.date || todayIso(), note: String(data.note || "").trim(), unit: form.dataset.unit || "" };
    await stateOps([{ type: "metric.record", trackId: form.dataset.trackId, viewId: form.dataset.viewId, metricKey: form.dataset.metricKey, entry }], "真实数值已写入趋势。");
  }
  if (form.id === "finForm") {
    const collection = form.dataset.collection || "fixed";
    const id = form.dataset.id || "";
    const name = String(data.name || "").trim();
    if (!name) return toast("名称不能为空。");
    let item;
    if (collection === "fixed") {
      const amount = numOrNull(data.amount);
      const dueDay = intOrNull(data.dueDay);
      item = { id: id || `fin-${Date.now()}`, name, amount: amount != null ? amount : 0, dueDay: dueDay != null ? dueDay : null, category: String(data.category || "").trim(), note: String(data.note || "").trim() };
    } else if (collection === "expenses") {
      const amount = numOrNull(data.amount);
      item = { id: id || `fin-${Date.now()}`, date: data.date || todayIso(), name, amount: amount != null ? amount : 0, category: String(data.category || "").trim(), note: String(data.note || "").trim() };
    } else {
      const estPrice = numOrNull(data.estPrice);
      item = { id: id || `fin-${Date.now()}`, name, estPrice: estPrice != null ? estPrice : 0, priority: data.priority === "longterm" ? "longterm" : "now", reason: String(data.reason || "").trim() };
      if (!id) item.status = "pending";
    }
    const op = id ? { type: "finance.update", collection, targetId: id, patch: item } : { type: "finance.add", collection, item };
    await stateOps([op], id ? "已更新。" : "已保存。");
    if (view === "finance") renderFinance();
    closeOverlay();
    return;
  }
});

$("#searchInput").addEventListener("input", () => { if (view === "notes") renderNotes(); });
document.addEventListener("keydown", async (event) => {
  const timelineBlock = event.target.closest?.("[data-timeline-block]");
  if (timelineBlock) { await keyboardMoveBlock(timelineBlock, event); return; }
  const backlogTask = event.target.closest?.("[data-backlog-task]");
  if (backlogTask && ["Enter", " "].includes(event.key) && !event.target.closest("button")) { event.preventDefault(); openBlockEditor("", backlogTask.dataset.backlogTask); return; }
  if (event.key === "Escape" && !$("#overlayRoot .first-flight")) closeOverlay();
});

document.addEventListener("visibilitychange", () => { if (!document.hidden) checkStateMeta(); });
window.addEventListener("focus", checkStateMeta);

// 全局速记：任何页面右下角「+ 速记」调用，轻弹窗秒存一条备忘录
window.openQuickMemo = function () {
  const root = document.getElementById("overlayRoot");
  if (!root) return;
  root.innerHTML = `<div class="memo-quick-overlay"><div class="memo-quick-card">
    <div class="memo-quick-head"><strong>随手记</strong><button type="button" class="memo-quick-close" aria-label="关闭">×</button></div>
    <textarea id="memoQuickText" rows="5" placeholder="想到什么直接写…（第一行会作为标题）" autofocus></textarea>
    <div class="memo-quick-actions"><button type="button" class="memo-quick-cancel">取消</button><button type="button" class="memo-quick-save">保存</button></div>
  </div></div>`;
  const overlay = root.querySelector(".memo-quick-overlay");
  const text = root.querySelector("#memoQuickText");
  const close = () => { root.innerHTML = ""; };
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  root.querySelector(".memo-quick-close").addEventListener("click", close);
  root.querySelector(".memo-quick-cancel").addEventListener("click", close);
  root.querySelector(".memo-quick-save").addEventListener("click", async () => {
    const body = text.value.trim();
    if (!body) { toast("写点什么再保存吧"); return; }
    const firstLine = body.split("\n")[0].slice(0, 120);
    await stateOps([{ type: "note.add", note: { title: firstLine, body } }], "已记下来。");
    close();
    if (view === "notes") renderNotes();
  });
  text.focus();
};

function fmtMoney(n) {
  const v = Number(n) || 0;
  return "¥" + (Number.isInteger(v) ? v.toLocaleString("zh-CN") : v.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}
function numOrNull(v) { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; }
function intOrNull(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }

function finIcon(name) {
  const I = {
    album: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3.2"/><path d="M3 9h18"/></svg>',
    goose: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="12" cy="14" rx="7" ry="5"/><path d="M19 9l3-2v4l-3-1"/><circle cx="9" cy="12" r="1"/></svg>',
    split: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16M4 12h16M4 18h16"/><path d="M9 6v12M15 6v12" opacity=".4"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z"/><path d="M5 4v16"/></svg>',
    shield: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z"/></svg>'
  };
  return I[name] || I.star;
}

const FIN_GUIDE = [
  { key: "album", icon: "album", title: "梦想相册 & 储蓄罐", one: "把想要的东西可视化", detail: "把想买的东西写成清单，最好配上图，每天看一眼。可以用本页「购物心愿单」记录，或专门建一条备忘录贴图。", benefit: "让“存钱”有了具体的画面，冲动消费会自然减少——你清楚自己为什么在忍。" },
  { key: "goose", icon: "goose", title: "养鹅原则（先储蓄后消费）", one: "收入先喂鹅，再花", detail: "拿到收入，先拿出 10–20% 放进“会下金蛋的鹅”（储蓄 / 低风险投资），剩下的才用于开销。鹅永远不动本金。", benefit: "复利会替你滚动赚钱，长期走向“被动收入”和财务自由，而不是一直为钱打工。" },
  { key: "split", icon: "split", title: "分账户：鹅 / 梦想 / 日常", one: "把钱分成三份", detail: "参考 50/30/20 思路：日常开销、梦想储蓄（旅行/大件）、养鹅各占一份。本页的「固定开支」「购物心愿单」就是帮你看清这三块。", benefit: "一眼看清钱去哪了，能立刻判断一笔消费该不该花，控制“想要”不失控。" },
  { key: "book", icon: "book", title: "坚持记账（知道钱去哪了）", one: "每笔记录，月底复盘", detail: "用本页「固定开支」记每月必花，「本月开支」记日常消费。月底看看总额和分类。", benefit: "能揪出隐形漏洞（每天奶茶、随手打车），把省下来的钱喂鹅和梦想，越记越有钱。" },
  { key: "shield", icon: "shield", title: "远离消费债", one: "不透支消费", detail: "尽量不用信用卡透支、不分期买用不起的东西。真要买大件，先塞进「购物心愿单」攒钱。", benefit: "不付利息，现金流始终健康，遇到机会才有钱上车。" },
  { key: "star", icon: "star", title: "成功日记（自信账户）", one: "记录每个小成就", detail: "每完成一次存钱、一次复盘、一次拒绝冲动消费，都记一笔。可以写在备忘录里。", benefit: "强化“我真的能管住钱”的信念，理财是长跑，自信让你坚持得更久。" }
];

function financeGuideMarkup() {
  return `<section class="panel fin-guide-panel"><header class="panel-head"><div><h2>使用说明</h2><p>《小狗钱钱》的核心理财逻辑，点开每张卡看「为什么这样做」</p></div></header>
    <div class="fin-guide-list">${FIN_GUIDE.map((g) => `<div class="fin-guide-card" data-guide-toggle="${g.key}">
      <div class="fin-guide-head"><span class="fin-guide-icon">${finIcon(g.icon)}</span><div><strong>${esc(g.title)}</strong><small>${esc(g.one)}</small></div><span class="fin-guide-caret">▾</span></div>
      <div class="fin-guide-detail"><p>${esc(g.detail)}</p><p class="fin-benefit"><b>这样做的好处：</b>${esc(g.benefit)}</p></div>
    </div>`).join("")}</div>
    <div class="fin-guide-foot">先用「固定开支」和「本月开支」把账记起来，再用「购物心愿单」给想买的东西排优先级——这就是小狗钱钱教你的“先看见钱，再指挥钱”。</div>
  </section>`;
}

function financeFixedMarkup(fin) {
  const items = fin.fixed || [];
  const total = items.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  return `<section class="panel"><header class="panel-head"><div><h2>固定开支</h2><p>每月必花的钱（房租、话费、会员…）</p></div><span class="fin-sum">月固定 ${fmtMoney(total)}</span></header>
    <div class="fin-list">${items.length ? items.map((x) => `<article class="fin-row">
      <div class="fin-row-main"><strong>${esc(x.name || "未命名")}</strong><small>${esc(x.category || "未分类")}${x.dueDay ? " · 每月 " + esc(x.dueDay) + " 号" : ""}</small></div>
      <span class="fin-amt">${fmtMoney(x.amount)}</span>
      <div class="fin-row-ops"><button type="button" class="fin-mini" data-fin-edit="fixed:${esc(x.id)}">编辑</button><button type="button" class="fin-mini danger" data-fin-del="fixed:${esc(x.id)}">删除</button></div>
    </article>`).join("") : emptyState("还没有固定开支", "点下方按钮，把每月必花的钱记下来。")}</div>
    <button type="button" class="fin-add" data-fin-add="fixed">＋ 添加固定开支</button>
  </section>`;
}

function financeExpensesMarkup(fin) {
  const all = fin.expenses || [];
  const month = todayIso().slice(0, 7);
  const items = all.filter((x) => String(x.date || "").slice(0, 7) === month).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const total = items.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  return `<section class="panel"><header class="panel-head"><div><h2>本月开支</h2><p>${month} 的日常消费记录</p></div><span class="fin-sum">本月已花 ${fmtMoney(total)}</span></header>
    <div class="fin-list">${items.length ? items.map((x) => `<article class="fin-row">
      <div class="fin-row-main"><strong>${esc(x.name || "未命名")}</strong><small>${esc(x.date || "")}${x.category ? " · " + esc(x.category) : ""}</small></div>
      <span class="fin-amt">${fmtMoney(x.amount)}</span>
      <div class="fin-row-ops"><button type="button" class="fin-mini" data-fin-edit="expenses:${esc(x.id)}">编辑</button><button type="button" class="fin-mini danger" data-fin-del="expenses:${esc(x.id)}">删除</button></div>
    </article>`).join("") : emptyState("本月还没有开支记录", "买杯奶茶、打个车都记一笔，月底就知道钱去哪了。")}</div>
    <button type="button" class="fin-add" data-fin-add="expenses">＋ 记录一笔开支</button>
  </section>`;
}

function financeWishesMarkup(fin) {
  const all = fin.wishes || [];
  const now = all.filter((x) => x.priority !== "longterm").sort((a, b) => (Number(a.estPrice) || 0) - (Number(b.estPrice) || 0));
  const long = all.filter((x) => x.priority === "longterm").sort((a, b) => (Number(a.estPrice) || 0) - (Number(b.estPrice) || 0));
  const card = (x) => `<article class="fin-wish ${x.status === "bought" ? "bought" : ""}">
    <div class="fin-wish-top"><strong>${esc(x.name || "未命名")}</strong><span class="fin-wish-price">${fmtMoney(x.estPrice)}</span></div>
    ${x.reason ? `<p class="fin-wish-reason">${esc(x.reason)}</p>` : ""}
    <div class="fin-wish-ops">
      <button type="button" class="fin-mini" data-wish-buy="${esc(x.id)}">${x.status === "bought" ? "取消已购" : "标记已购"}</button>
      <button type="button" class="fin-mini" data-fin-edit="wishes:${esc(x.id)}">编辑</button>
      <button type="button" class="fin-mini danger" data-fin-del="wishes:${esc(x.id)}">删除</button>
    </div>
  </article>`;
  return `<section class="panel"><header class="panel-head"><div><h2>购物心愿单</h2><p>想买的东西排个序：现在优先买 vs 长期目标</p></div></header>
    <div class="fin-wish-group"><h3 class="fin-wish-h3 now">现在优先买 <span>${now.length}</span></h3>${now.length ? now.map(card).join("") : `<p class="fin-empty">把近期想买、买得起的放这里。</p>`}</div>
    <div class="fin-wish-group"><h3 class="fin-wish-h3 long">长期目标 <span>${long.length}</span></h3>${long.length ? long.map(card).join("") : `<p class="fin-empty">大额、不急的放这里，慢慢攒。</p>`}</div>
    <button type="button" class="fin-add" data-fin-add="wishes">＋ 添加一个心愿</button>
  </section>`;
}

function renderFinance() {
  const fin = (state && state.finance) || { fixed: [], expenses: [], wishes: [] };
  setHero("小狗钱钱", "把每一分钱，都养成会下金蛋的鹅。", "《小狗钱钱》式理财：先储蓄后消费，可视化愿望，记账看清漏洞。");
  $("#pageTitle").textContent = "小狗钱钱";
  const tabs = [["guide", "使用说明"], ["fixed", "固定开支"], ["expenses", "本月开支"], ["wishes", "购物心愿单"]];
  const tabBar = `<div class="fin-tabs">${tabs.map((t) => `<button type="button" class="fin-tab ${financeTab === t[0] ? "active" : ""}" data-fin-tab="${t[0]}">${t[1]}</button>`).join("")}</div>`;
  let body = "";
  if (financeTab === "guide") body = financeGuideMarkup();
  else if (financeTab === "fixed") body = financeFixedMarkup(fin);
  else if (financeTab === "expenses") body = financeExpensesMarkup(fin);
  else body = financeWishesMarkup(fin);
  $("#viewContent").innerHTML = tabBar + `<div class="fin-view">${body}</div>`;
}

function finFields(collection, item) {
  item = item || {};
  if (collection === "fixed") {
    return `<label><span>名称</span><input name="name" required maxlength="60" value="${esc(item.name || "")}" placeholder="如：房租 / 话费 / 会员"></label>
      <div class="field-pair"><label><span>每月金额（¥）</span><input name="amount" type="number" min="0" step="0.01" value="${esc(item.amount != null ? item.amount : "")}" placeholder="0"></label>
      <label><span>每月几号扣（1–28）</span><input name="dueDay" type="number" min="1" max="28" value="${esc(item.dueDay != null ? item.dueDay : "")}" placeholder="可选"></label></div>
      <label><span>分类</span><input name="category" maxlength="20" value="${esc(item.category || "")}" placeholder="如：居住 / 饮食 / 订阅"></label>
      <label><span>备注</span><textarea name="note" rows="2">${esc(item.note || "")}</textarea></label>`;
  }
  if (collection === "expenses") {
    return `<label><span>日期</span><input name="date" type="date" value="${esc(item.date || todayIso())}"></label>
      <label><span>名称</span><input name="name" required maxlength="60" value="${esc(item.name || "")}" placeholder="买了什么"></label>
      <div class="field-pair"><label><span>金额（¥）</span><input name="amount" type="number" min="0" step="0.01" value="${esc(item.amount != null ? item.amount : "")}" placeholder="0"></label>
      <label><span>分类</span><input name="category" maxlength="20" value="${esc(item.category || "")}" placeholder="如：餐饮 / 交通"></label></div>
      <label><span>备注</span><textarea name="note" rows="2">${esc(item.note || "")}</textarea></label>`;
  }
  return `<label><span>想要的东西</span><input name="name" required maxlength="60" value="${esc(item.name || "")}" placeholder="如：新相机 / 显示器"></label>
    <div class="field-pair"><label><span>预估价格（¥）</span><input name="estPrice" type="number" min="0" step="0.01" value="${esc(item.estPrice != null ? item.estPrice : "")}" placeholder="0"></label>
    <label><span>优先级</span><select name="priority"><option value="now" ${item.priority !== "longterm" ? "selected" : ""}>现在优先买</option><option value="longterm" ${item.priority === "longterm" ? "selected" : ""}>长期目标</option></select></label></div>
    <label><span>为什么想要（理由）</span><textarea name="reason" rows="2">${esc(item.reason || "")}</textarea></label>`;
}

function openFinModal(collection, id) {
  const fin = (state && state.finance) || { fixed: [], expenses: [], wishes: [] };
  const item = id ? (fin[collection] || []).find((x) => x.id === id) : null;
  const titleMap = { fixed: item ? "编辑固定开支" : "添加固定开支", expenses: item ? "编辑开支" : "记录一笔开支", wishes: item ? "编辑心愿" : "添加一个心愿" };
  const root = $("#overlayRoot");
  if (!root) return;
  root.innerHTML = `<div class="overlay" data-overlay-close></div><aside class="drawer fin-drawer" role="dialog" aria-modal="true"><header><div><span class="eyebrow">小狗钱钱</span><h2>${esc(titleMap[collection])}</h2></div><button type="button" data-overlay-close>×</button></header><form id="finForm" data-collection="${collection}" data-id="${esc(id || "")}">${finFields(collection, item)}<footer><button type="button" data-overlay-close>取消</button><button type="submit" class="primary">保存</button></footer></form></aside>`;
}

load({ offerFirstFlight: false }).then(startLiveSync).catch((error) => {
  $("#viewContent").innerHTML = `<section class="load-error"><span>CONNECTION LOST</span><h2>没有读到 OOS 状态</h2><p>${esc(error.message)}</p><button type="button" onclick="location.reload()">重新连接</button></section>`;
});
