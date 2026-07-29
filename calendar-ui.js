(function calendarUiFactory(root, factory) {
  const api = factory(root.OOSCalendar);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OOSCalendarUI = api;
})(typeof globalThis === "object" ? globalThis : this, function createCalendarUi(Calendar) {
  "use strict";

  if (!Calendar) throw new Error("OOSCalendar is required before calendar-ui.js");

  const START_MINUTE = 0;
  const END_MINUTE = 24 * 60;
  const STEP = 15;
  const PX_PER_MINUTE = 0.72;
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  const CLOSED_TASKS = new Set(["done", "cancelled", "declined", "archived"]);

  function create(options) {
    const controller = {
      mode: "workbench",
      anchor: "",
      trackFilter: "all",
      typeFilter: "all",
      statusFilter: "all",
      gesture: null,
      backlogPointer: null,
      monthPointer: null,
      draggedTaskId: "",
      draggedBlockId: "",
      keyboardDrafts: new Map(),
      root: null,
      bound: false,
      scrollTop: null
    };

    const esc = options.esc;
    const shortText = options.shortText;
    const getState = options.getState;
    const trackName = options.trackName;
    const toast = options.toast;

    function state() { return getState() || {}; }
    function tracks() { return Array.isArray(state().tracks) && state().tracks.length ? state().tracks : (state().goals || []); }
    function openTasks() { return (state().tasks || []).filter((task) => !task.archived && !CLOSED_TASKS.has(task.status)); }
    function allBlocks() { return Array.isArray(state().scheduleBlocks) ? state().scheduleBlocks : []; }
    function visibleBlocks() {
      return Calendar.activeCalendarBlocks(allBlocks(), {
        track: controller.trackFilter,
        type: controller.typeFilter,
        status: controller.statusFilter
      });
    }
    function conflictCandidates(blocks = visibleBlocks()) {
      return blocks.filter((block) => ["planned", "in_progress", ""].includes(block.status || "planned"));
    }
    function today() { return options.today(); }
    function marker(goal) { return Calendar.stableMarker(goal || "system"); }
    function locked(block) { return Boolean(block.locked || block.kind === "fixed"); }
    function blockById(id) { return allBlocks().find((block) => block.id === id) || null; }
    function range() {
      const anchor = controller.anchor || today();
      if (controller.mode === "week") {
        const start = Calendar.weekStart(anchor);
        return { start, end: Calendar.addDays(start, 6), dates: Calendar.datesBetween(start, Calendar.addDays(start, 6)) };
      }
      if (controller.mode === "workbench") {
        const start = Calendar.weekStart(anchor);
        return { start, end: Calendar.addDays(start, 27), dates: Calendar.datesBetween(start, Calendar.addDays(start, 27)) };
      }
      const dates = Calendar.monthGrid(anchor);
      return { start: dates[0], end: dates.at(-1), dates };
    }
    function inRangeBlocks(blocks, dates) {
      return blocks.filter((block) => Calendar.blockSegments(block, dates).length);
    }
    function dueFor(currentRange) {
      return Calendar.dueItems(openTasks(), allBlocks(), currentRange.start, currentRange.end).filter((item) => controller.trackFilter === "all" || item.goal === controller.trackFilter);
    }
    function scheduledTaskIds() {
      return new Set(allBlocks().filter((block) => block.taskId && block.startAt && !["cancelled", "archived"].includes(block.status)).map((block) => block.taskId));
    }
    function backlogEntries() {
      const scheduled = scheduledTaskIds();
      const tasks = openTasks().filter((task) => !scheduled.has(task.id)).map((task) => ({ type: "task", id: task.id, title: task.title, goal: task.goal || "", due: task.due || "", task }));
      const looseBlocks = allBlocks().filter((block) => !block.startAt && !block.taskId && !["completed", "cancelled", "archived"].includes(block.status)).map((block) => ({ type: "block", id: block.id, title: block.title, goal: block.goal || "", due: "", block }));
      return [...tasks, ...looseBlocks].filter((entry) => controller.trackFilter === "all" || entry.goal === controller.trackFilter);
    }
    function formatRange(currentRange) {
      if (controller.mode === "workbench") return `${currentRange.start} — ${currentRange.end} · 四周工作台`;
      if (controller.mode === "week") return `${currentRange.start} — ${currentRange.end}`;
      const month = Calendar.monthStart(controller.anchor || today());
      return `${month.slice(0, 7)} · ${controller.mode === "month" ? "月视图" : "Agenda"}`;
    }
    function filtersMarkup() {
      const trackOptions = tracks().map((item) => `<option value="${esc(item.id)}" ${controller.trackFilter === item.id ? "selected" : ""}>${esc(item.navLabel || item.name)}</option>`).join("");
      return `<div class="calendar-filters"><label>轨道<select data-calendar-filter="track"><option value="all">全部 Track</option>${trackOptions}</select></label><label>类型<select data-calendar-filter="type"><option value="all" ${controller.typeFilter === "all" ? "selected" : ""}>全部</option><option value="fixed" ${controller.typeFilter === "fixed" ? "selected" : ""}>固定</option><option value="movable" ${controller.typeFilter === "movable" ? "selected" : ""}>可移动</option></select></label><label>状态<select data-calendar-filter="status"><option value="all" ${controller.statusFilter === "all" ? "selected" : ""}>全部状态</option><option value="planned" ${controller.statusFilter === "planned" ? "selected" : ""}>计划中</option><option value="completed" ${controller.statusFilter === "completed" ? "selected" : ""}>已完成</option><option value="cancelled" ${controller.statusFilter === "cancelled" ? "selected" : ""}>已取消</option></select></label></div>`;
    }
    function toolbar(currentRange) {
      return `<header class="calendar-toolbar"><div><span class="eyebrow">${esc(formatRange(currentRange))}</span><h2>计划工作台</h2><p>四周看全局，选中一天后直接调整当天时间线。</p></div><div class="calendar-modes" role="tablist" aria-label="日历视图"><button type="button" data-calendar-mode="workbench" class="${controller.mode === "workbench" ? "active" : ""}">工作台</button><button type="button" data-calendar-mode="week" class="${controller.mode === "week" ? "active" : ""}">周</button><button type="button" data-calendar-mode="month" class="${controller.mode === "month" ? "active" : ""}">月</button><button type="button" data-calendar-mode="agenda" class="${controller.mode === "agenda" ? "active" : ""}">Agenda</button></div><div class="calendar-nav"><button type="button" data-calendar-shift="-1" aria-label="上一段">←</button><button type="button" data-calendar-today>今天</button><button type="button" data-calendar-shift="1" aria-label="下一段">→</button><button type="button" class="primary" data-block-new>+ 时间块</button></div></header><div class="calendar-filterbar"><strong>时间块只存一份；四周总览与所选日时间线是同一排期的两种尺度。</strong>${filtersMarkup()}</div>`;
    }
    function summary(blocks, due) {
      const conflicts = Calendar.conflictIds(conflictCandidates(blocks));
      const fixed = blocks.filter(locked).length;
      return `<div class="calendar-summary"><span><strong>${blocks.length}</strong> 个时间块</span><span><strong>${fixed}</strong> 个固定块</span><span><strong>${due.length}</strong> 个未安排截止</span><span class="${conflicts.size ? "warn" : ""}"><strong>${conflicts.size}</strong> 个冲突块</span></div>`;
    }
    function backlog() {
      const entries = backlogEntries();
      return `<aside class="calendar-backlog"><header><div><span class="eyebrow">UNSCHEDULED</span><h3>等待排期</h3></div><strong>${entries.length}</strong></header><p>拖到四周日历可先指定日期；拖到所选日时间线可精确指定时间。</p><div class="calendar-backlog-list">${entries.map((entry) => `<article draggable="true" data-calendar-backlog-type="${entry.type}" data-calendar-backlog-id="${esc(entry.id)}" tabindex="0"><i>${marker(entry.goal)}</i><div><strong>${esc(shortText(entry.title || "未命名", 48))}</strong><span>${esc(trackName(entry.goal))}${entry.due ? ` · ${esc(entry.due)}` : ""}</span></div><button type="button" ${entry.type === "task" ? `data-block-task="${esc(entry.id)}"` : `data-calendar-open="${esc(entry.id)}"`}>安排</button></article>`).join("") || `<div class="empty-state"><span>OPEN SPACE</span><strong>没有待排任务</strong><p>保留余量也是计划的一部分。</p></div>`}</div><div class="calendar-legend-v2"><span><i></i>可移动</span><span><i class="fixed"></i>固定</span><span><i class="conflict"></i>冲突</span></div></aside>`;
    }
    function blockMarkup(segment, conflictIds) {
      const block = segment.block;
      const isLocked = locked(block);
      const compact = segment.end - segment.start < 45;
      const top = (segment.start - START_MINUTE) * PX_PER_MINUTE;
      const height = Math.max(28, (segment.end - segment.start) * PX_PER_MINUTE);
      const canMove = segment.isStart && !isLocked && !["completed", "cancelled"].includes(block.status);
      const canResize = segment.isStart && segment.isEnd && !isLocked && !["completed", "cancelled"].includes(block.status);
      const time = `${Calendar.minuteLabel(segment.start)}—${Calendar.minuteLabel(segment.end)}`;
      return `<article class="calendar-block status-${esc(block.status || "planned")} ${compact ? "compact" : ""} ${isLocked ? "locked" : ""} ${conflictIds.has(block.id) ? "conflict" : ""}" style="--block-top:${top}px;--block-height:${height}px;--block-left:${segment.leftPct}%;--block-width:${segment.widthPct}%" data-calendar-block="${esc(block.id)}" data-calendar-date="${segment.date}" data-calendar-start-segment="${segment.isStart ? "1" : "0"}" data-calendar-end-segment="${segment.isEnd ? "1" : "0"}"><button type="button" class="calendar-block-drag" data-calendar-drag="${esc(block.id)}" ${canMove ? "" : "disabled"} aria-label="${canMove ? "拖动时间块" : isLocked ? "固定时间块" : "续接时间块"}"><span>${esc(time)}</span><span>${isLocked ? "◆ LOCK" : segment.continuesBefore ? "↳" : "⠿"}</span></button><button type="button" class="calendar-block-body" data-calendar-open="${esc(block.id)}" title="${esc(`${block.title} · ${time} · ${trackName(block.goal)}`)}"><strong>${marker(block.goal)} ${esc(shortText(block.title || "未命名时间块", 56))}</strong><span class="calendar-block-track">${esc(trackName(block.goal))}</span><span class="calendar-block-note">${esc(shortText(block.note || "", 52))}</span></button>${canResize ? `<button type="button" class="calendar-block-resize" data-calendar-resize="${esc(block.id)}" aria-label="调整结束时间"></button>` : ""}</article>`;
    }
    function weekView(blocks, due, currentRange) {
      const height = (END_MINUTE - START_MINUTE) * PX_PER_MINUTE;
      const hours = Array.from({ length: 25 }, (_, index) => index);
      const segments = Calendar.blockSegments ? blocks.flatMap((block) => Calendar.blockSegments(block, currentRange.dates, START_MINUTE, END_MINUTE)) : [];
      const byDate = Object.fromEntries(currentRange.dates.map((date) => [date, Calendar.layoutDaySegments(segments.filter((segment) => segment.date === date))]));
      const conflicts = Calendar.conflictIds(conflictCandidates(blocks));
      const dueByDate = Object.fromEntries(currentRange.dates.map((date) => [date, due.filter((item) => item.date === date)]));
      const now = new Date();
      const nowMinute = now.getHours() * 60 + now.getMinutes();
      return `<div class="week-calendar"><div class="week-head"><span>GMT+8</span>${currentRange.dates.map((date) => `<button type="button" class="week-day-head ${date === today() ? "today" : ""} ${date === controller.anchor ? "selected" : ""}" data-calendar-date-select="${date}"><small>周${WEEKDAYS[Calendar.weekdayIndex(date)]}</small><strong>${date.slice(8)}</strong><span>${byDate[date].length ? `${byDate[date].length} 段` : "留白"}</span></button>`).join("")}</div><div class="all-day-strip"><span class="all-day-label">截止</span>${currentRange.dates.map((date) => `<div class="all-day-cell">${dueByDate[date].map((item) => `<button type="button" class="due-chip" data-block-task="${esc(item.taskId)}" title="${esc(item.title)}">${marker(item.goal)} ${esc(shortText(item.title, 34))}</button>`).join("")}</div>`).join("")}</div><div class="week-scroll"><div class="week-grid" style="--calendar-height:${height}px"><div class="week-ruler">${hours.map((hour) => `<span style="top:${hour * 60 * PX_PER_MINUTE}px">${String(hour).padStart(2, "0")}:00</span>`).join("")}</div>${currentRange.dates.map((date) => `<div class="week-day-stage ${date === today() ? "today" : ""}" data-calendar-stage="${date}">${hours.map((hour) => `<i class="week-hour-line" style="top:${hour * 60 * PX_PER_MINUTE}px"></i>`).join("")}${date === today() ? `<i class="week-now-line" style="top:${nowMinute * PX_PER_MINUTE}px"></i>` : ""}${byDate[date].map((segment) => blockMarkup(segment, conflicts)).join("")}<div class="calendar-drop-cursor"><span></span></div></div>`).join("")}</div></div></div>`;
    }
    function selectedDayTimeline(blocks, due, date) {
      const height = (END_MINUTE - START_MINUTE) * PX_PER_MINUTE;
      const hours = Array.from({ length: 25 }, (_, index) => index);
      const segments = Calendar.layoutDaySegments(blocks.flatMap((block) => Calendar.blockSegments(block, [date], START_MINUTE, END_MINUTE)));
      const conflicts = Calendar.conflictIds(conflictCandidates(blocks));
      const dayDue = due.filter((item) => item.date === date);
      const now = new Date();
      const nowMinute = now.getHours() * 60 + now.getMinutes();
      return `<section class="selected-day-timeline" aria-label="所选日期时间线"><header><div><span class="eyebrow">SELECTED DAY</span><h3>${esc(date)} · 周${WEEKDAYS[Calendar.weekdayIndex(date)]}</h3></div><span>${segments.length} 个时间块</span></header><div class="selected-day-due">${dayDue.map((item) => `<button type="button" class="due-chip" data-block-task="${esc(item.taskId)}">截止 · ${esc(shortText(item.title, 42))}</button>`).join("")}</div><div class="week-scroll selected-day-scroll"><div class="week-grid selected-day-grid" style="--calendar-height:${height}px"><div class="week-ruler">${hours.map((hour) => `<span style="top:${hour * 60 * PX_PER_MINUTE}px">${String(hour).padStart(2, "0")}:00</span>`).join("")}</div><div class="week-day-stage ${date === today() ? "today" : ""}" data-calendar-stage="${date}">${hours.map((hour) => `<i class="week-hour-line" style="top:${hour * 60 * PX_PER_MINUTE}px"></i>`).join("")}${date === today() ? `<i class="week-now-line" style="top:${nowMinute * PX_PER_MINUTE}px"></i>` : ""}${segments.map((segment) => blockMarkup(segment, conflicts)).join("")}<div class="calendar-drop-cursor"><span></span></div></div></div></div></section>`;
    }
    function workbenchView(blocks, due, currentRange) {
      const byDate = Object.fromEntries(currentRange.dates.map((date) => [date, blocks.filter((block) => Calendar.blockSegments(block, [date]).length)]));
      const dueByDate = Object.fromEntries(currentRange.dates.map((date) => [date, due.filter((item) => item.date === date)]));
      return `<div class="calendar-workbench-main"><section class="four-week-calendar" aria-label="四周日历"><div class="four-week-weekdays">${["一", "二", "三", "四", "五", "六", "日"].map((day) => `<span>周${day}</span>`).join("")}</div><div class="four-week-grid">${currentRange.dates.map((date) => {
        const entries = [
          ...byDate[date].map((block) => ({ type: "block", title: block.title, block })),
          ...dueByDate[date].map((item) => ({ type: "due", title: item.title, item }))
        ];
        return `<article class="four-week-day ${date === today() ? "today" : ""} ${date === controller.anchor ? "selected" : ""}" data-calendar-date-drop="${date}"><button type="button" class="four-week-date" data-calendar-date-select="${date}"><strong>${date.slice(8)}</strong><span>${date.slice(5, 7)}月</span></button><div class="four-week-events">${entries.slice(0, 3).map((entry) => entry.type === "block" ? `<button type="button" draggable="${locked(entry.block) ? "false" : "true"}" class="four-week-event ${locked(entry.block) ? "fixed" : ""}" data-calendar-open="${esc(entry.block.id)}" data-calendar-month-block="${esc(entry.block.id)}" title="${esc(entry.title)}">${marker(entry.block.goal)} ${esc(shortText(entry.title, 22))}</button>` : `<button type="button" class="four-week-event due" data-block-task="${esc(entry.item.taskId)}" title="${esc(entry.title)}">截止 · ${esc(shortText(entry.title, 20))}</button>`).join("")}${entries.length > 3 ? `<span class="four-week-more">+${entries.length - 3}</span>` : ""}</div></article>`;
      }).join("")}</div></section>${selectedDayTimeline(byDate[controller.anchor] || [], due, controller.anchor)}</div>`;
    }
    function monthView(blocks, due, currentRange) {
      const month = Calendar.monthStart(controller.anchor || today()).slice(0, 7);
      return `<div class="month-calendar"><div class="month-weekdays">${["一", "二", "三", "四", "五", "六", "日"].map((day) => `<span>周${day}</span>`).join("")}</div><div class="month-grid">${currentRange.dates.map((date) => {
        const events = blocks.filter((block) => Calendar.blockSegments(block, [date]).length).map((block) => ({ type: "block", block, title: block.title, fixed: locked(block) }));
        const datesDue = due.filter((item) => item.date === date).map((item) => ({ type: "due", item, title: item.title }));
        const combined = [...events, ...datesDue];
        return `<div class="month-day ${date.slice(0, 7) === month ? "" : "outside"} ${date === today() ? "today" : ""}"><button type="button" data-calendar-date-select="${date}"><strong>${date.slice(8)}</strong></button><div class="month-events">${combined.slice(0, 4).map((entry) => entry.type === "block" ? `<button type="button" class="month-event ${entry.fixed ? "fixed" : ""}" data-calendar-open="${esc(entry.block.id)}">${marker(entry.block.goal)} ${esc(shortText(entry.title, 32))}</button>` : `<button type="button" class="month-event due" data-block-task="${esc(entry.item.taskId)}">⌁ ${esc(shortText(entry.title, 32))}</button>`).join("")}${combined.length > 4 ? `<span class="month-more">+ ${combined.length - 4} 项</span>` : ""}</div></div>`;
      }).join("")}</div></div>`;
    }
    function agendaView(blocks, due, currentRange) {
      const segments = blocks.flatMap((block) => Calendar.blockSegments(block, currentRange.dates));
      const populated = currentRange.dates.filter((date) => segments.some((item) => item.date === date) || due.some((item) => item.date === date));
      if (!populated.length) return `<div class="agenda-calendar"><div class="empty-state"><span>OPEN SPACE</span><strong>这段时间没有日程</strong><p>你可以新建时间块，或把右侧任务拖进周视图。</p></div></div>`;
      return `<div class="agenda-calendar">${populated.map((date) => {
        const daySegments = segments.filter((item) => item.date === date).sort((a, b) => a.start - b.start);
        const dayDue = due.filter((item) => item.date === date);
        return `<section class="agenda-day"><header><strong>${date.slice(5)}</strong><span>周${WEEKDAYS[Calendar.weekdayIndex(date)]}</span></header><div class="agenda-events">${dayDue.map((item) => `<button type="button" class="agenda-event due" data-block-task="${esc(item.taskId)}"><time>全天截止</time><i>⌁</i><div><strong>${esc(item.title)}</strong><span>${esc(trackName(item.goal))}</span></div></button>`).join("")}${daySegments.map((segment) => `<button type="button" class="agenda-event" data-calendar-open="${esc(segment.block.id)}"><time>${Calendar.minuteLabel(segment.start)}—${Calendar.minuteLabel(segment.end)}</time><i>${marker(segment.block.goal)}</i><div><strong>${esc(segment.block.title)}</strong><span>${esc(trackName(segment.block.goal))}</span></div><em>${locked(segment.block) ? "固定" : segment.block.status || "planned"}</em></button>`).join("")}</div></section>`;
      }).join("")}</div>`;
    }
    function render(root, extras = {}) {
      controller.root = root;
      controller.anchor ||= today();
      const currentRange = range();
      const blocks = inRangeBlocks(visibleBlocks(), currentRange.dates);
      const due = dueFor(currentRange);
      const main = controller.mode === "workbench" ? workbenchView(blocks, due, currentRange) : controller.mode === "month" ? monthView(blocks, due, currentRange) : controller.mode === "agenda" ? agendaView(blocks, due, currentRange) : weekView(blocks, due, currentRange);
      root.innerHTML = `${extras.healthHtml || ""}${extras.recoveryHtml || ""}<section class="calendar-shell calendar-workbench-v3">${toolbar(currentRange)}${summary(blocks, due)}<div class="calendar-workbench-v2"><main class="calendar-main">${main}</main>${backlog()}</div></section>`;
      if (["week", "workbench"].includes(controller.mode)) {
        requestAnimationFrame(() => {
          const scroller = root.querySelector(".week-scroll");
          if (!scroller) return;
          if (controller.scrollTop === null) {
            const scrollBlocks = controller.mode === "workbench" ? blocks.filter((block) => Calendar.parseDateTime(block.startAt)?.date === controller.anchor) : blocks;
            const earliest = scrollBlocks.map((block) => Calendar.minuteOfDay(block.startAt)).filter((value) => value !== null).sort((a, b) => a - b)[0];
            controller.scrollTop = Math.max(0, ((earliest ?? 8 * 60) - 60) * PX_PER_MINUTE);
          }
          scroller.scrollTop = controller.scrollTop;
          scroller.addEventListener("scroll", () => { controller.scrollTop = scroller.scrollTop; }, { passive: true, once: true });
        });
      }
    }
    function rerender() { options.renderHost(); }
    function shift(amount) {
      controller.anchor = controller.mode === "workbench" ? Calendar.addDays(controller.anchor || today(), Number(amount) * 28) : controller.mode === "week" ? Calendar.addDays(controller.anchor || today(), Number(amount) * 7) : Calendar.addMonths(controller.anchor || today(), Number(amount));
      controller.scrollTop = null;
      rerender();
    }
    function minuteFromPointer(stage, clientY) {
      const rect = stage.getBoundingClientRect();
      const raw = START_MINUTE + (clientY - rect.top) / PX_PER_MINUTE;
      return Math.max(START_MINUTE, Math.min(END_MINUTE - STEP, Calendar.snapMinute(raw, STEP)));
    }
    function candidateConflict(id, startAt, endAt) {
      const candidate = { ...(blockById(id) || {}), id, startAt, endAt };
      return conflictCandidates().some((block) => block.id !== id && Calendar.blocksOverlap(candidate, block));
    }
    function previewGesture(event) {
      const gesture = controller.gesture;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const targetStage = gesture.mode === "move" ? document.elementsFromPoint(event.clientX, event.clientY).map((item) => item.closest?.("[data-calendar-stage]")).find(Boolean) || gesture.stage : gesture.stage;
      const targetDate = targetStage.dataset.calendarStage;
      const pointerMinute = minuteFromPointer(targetStage, event.clientY);
      const minute = gesture.mode === "move" ? Math.max(START_MINUTE, Math.min(END_MINUTE - STEP, Calendar.snapMinute(pointerMinute - gesture.grabOffsetMinutes, STEP))) : pointerMinute;
      if (gesture.mode === "move") {
        gesture.previewStart = Calendar.timelineIso(targetDate, minute);
        gesture.previewEnd = Calendar.addWallMinutes(gesture.previewStart, gesture.duration);
        if (targetStage !== gesture.element.parentElement) targetStage.append(gesture.element);
      } else {
        let endAt = Calendar.timelineIso(targetDate, minute);
        if (Calendar.wallMinutesBetween(gesture.originalStart, endAt) < STEP) endAt = Calendar.addWallMinutes(gesture.originalStart, STEP);
        gesture.previewStart = gesture.originalStart;
        gesture.previewEnd = endAt;
      }
      gesture.stage = targetStage;
      const startMinute = Calendar.minuteOfDay(gesture.previewStart);
      const duration = Math.max(STEP, Calendar.wallMinutesBetween(gesture.previewStart, gesture.previewEnd));
      gesture.element.style.setProperty("--block-top", `${startMinute * PX_PER_MINUTE}px`);
      gesture.element.style.setProperty("--block-height", `${Math.max(28, duration * PX_PER_MINUTE)}px`);
      gesture.element.style.setProperty("--block-left", "0%");
      gesture.element.style.setProperty("--block-width", "100%");
      gesture.element.classList.toggle("conflict", candidateConflict(gesture.block.id, gesture.previewStart, gesture.previewEnd));
      const label = gesture.element.querySelector(".calendar-block-drag span");
      if (label) label.textContent = `${Calendar.minuteLabel(startMinute)}—${Calendar.minuteLabel(Calendar.minuteOfDay(gesture.previewEnd))} · 预览`;
      event.preventDefault();
    }
    async function finishGesture(event) {
      const gesture = controller.gesture;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      controller.gesture = null;
      gesture.element.classList.remove("dragging");
      if (gesture.previewStart === gesture.originalStart && gesture.previewEnd === gesture.originalEnd) return rerender();
      const conflict = candidateConflict(gesture.block.id, gesture.previewStart, gesture.previewEnd);
      await options.mutate([{ type: "schedule.update", targetId: gesture.block.id, patch: { startAt: gesture.previewStart, endAt: gesture.previewEnd } }], conflict ? "时间块已保存；冲突保持可见，系统没有自动重排。" : gesture.mode === "resize" ? "时间块长度已调整。" : "时间块已移动。");
    }
    function clearBacklogDropPreview() {
      controller.root?.querySelectorAll(".week-day-stage.drop-active").forEach((stage) => stage.classList.remove("drop-active"));
    }
    function beginBacklogPointer(event) {
      const entry = event.target.closest?.("[data-calendar-backlog-id]");
      if (!entry || event.target.closest("button") || event.button !== 0) return;
      controller.backlogPointer = { pointerId: event.pointerId, entry, id: entry.dataset.calendarBacklogId, type: entry.dataset.calendarBacklogType, stage: null, minute: null };
      entry.classList.add("dragging");
      entry.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }
    function moveBacklogPointer(event) {
      const drag = controller.backlogPointer;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const stage = document.elementsFromPoint(event.clientX, event.clientY).map((item) => item.closest?.("[data-calendar-stage]")).find(Boolean) || null;
      clearBacklogDropPreview();
      drag.stage = stage;
      if (!stage) return;
      drag.minute = minuteFromPointer(stage, event.clientY);
      stage.classList.add("drop-active");
      const cursor = stage.querySelector(".calendar-drop-cursor");
      cursor.style.top = `${drag.minute * PX_PER_MINUTE}px`;
      cursor.querySelector("span").textContent = `${Calendar.minuteLabel(drag.minute)} · 放在这里`;
      event.preventDefault();
    }
    async function finishBacklogPointer(event) {
      const drag = controller.backlogPointer;
      if (!drag || drag.pointerId !== event.pointerId) return;
      controller.backlogPointer = null;
      drag.entry.classList.remove("dragging");
      clearBacklogDropPreview();
      if (!drag.stage || drag.minute === null) return;
      const startAt = Calendar.timelineIso(drag.stage.dataset.calendarStage, drag.minute);
      const endAt = Calendar.addWallMinutes(startAt, 60);
      if (drag.type === "block") {
        const block = blockById(drag.id);
        if (!block || locked(block)) return;
        await options.mutate([{ type: "schedule.update", targetId: block.id, patch: { startAt, endAt } }], candidateConflict(block.id, startAt, endAt) ? "已排入日程；冲突保持可见，系统没有自动重排。" : "时间块已排入日程。");
        return;
      }
      const task = openTasks().find((item) => item.id === drag.id);
      if (!task) return;
      const block = { id: `block-${Date.now()}`, taskId: task.id, title: task.title, goal: task.goal || "", kind: "focus", startAt, endAt, status: "planned", source: "hud", locked: false, note: task.nextStep || "" };
      await options.mutate([{ type: "schedule.create", block }], candidateConflict("", startAt, endAt) ? "已排入日程；冲突保持可见，系统没有自动重排。" : "任务已拖入日程。");
    }
    function beginMonthPointer(event) {
      const element = event.target.closest?.("[data-calendar-month-block]");
      if (!element || event.button !== 0) return;
      const block = blockById(element.dataset.calendarMonthBlock);
      if (!block || locked(block)) return;
      controller.monthPointer = { pointerId: event.pointerId, element, blockId: block.id, startX: event.clientX, startY: event.clientY, target: null, active: false };
      element.setPointerCapture?.(event.pointerId);
    }
    function moveMonthPointer(event) {
      const drag = controller.monthPointer;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
      drag.active = true;
      drag.element.classList.add("dragging");
      controller.root?.querySelectorAll("[data-calendar-date-drop].drop-active").forEach((item) => item.classList.remove("drop-active"));
      drag.target = document.elementsFromPoint(event.clientX, event.clientY).map((item) => item.closest?.("[data-calendar-date-drop]")).find(Boolean) || null;
      drag.target?.classList.add("drop-active");
      event.preventDefault();
    }
    async function finishMonthPointer(event) {
      const drag = controller.monthPointer;
      if (!drag || drag.pointerId !== event.pointerId) return;
      controller.monthPointer = null;
      drag.element.classList.remove("dragging");
      controller.root?.querySelectorAll("[data-calendar-date-drop].drop-active").forEach((item) => item.classList.remove("drop-active"));
      if (!drag.active || !drag.target) return;
      event.preventDefault();
      event.stopPropagation();
      await moveBlockToDate(drag.blockId, drag.target.dataset.calendarDateDrop);
    }
    function beginGesture(event) {
      const handle = event.target.closest("[data-calendar-drag],[data-calendar-resize]");
      if (!handle || event.button !== 0) return;
      const element = handle.closest("[data-calendar-block]");
      const block = blockById(element?.dataset.calendarBlock);
      if (!block) return;
      if (locked(block)) return toast("固定时间块不可拖动或缩放；可打开详情后完成或取消。");
      const mode = handle.matches("[data-calendar-resize]") ? "resize" : "move";
      if ((mode === "move" && element.dataset.calendarStartSegment !== "1") || (mode === "resize" && element.dataset.calendarEndSegment !== "1")) return;
      const range = Calendar.blockRange(block);
      const grabOffsetMinutes = mode === "move" ? Math.max(0, (event.clientY - element.getBoundingClientRect().top) / PX_PER_MINUTE) : 0;
      controller.gesture = { pointerId: event.pointerId, element, block, mode, stage: element.closest("[data-calendar-stage]"), originalStart: block.startAt, originalEnd: block.endAt || Calendar.addWallMinutes(block.startAt, 60), previewStart: block.startAt, previewEnd: block.endAt || Calendar.addWallMinutes(block.startAt, 60), duration: range.duration, grabOffsetMinutes };
      element.classList.add("dragging");
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    }
    function keyboardPreview(element, event) {
      const block = blockById(element.dataset.calendarBlock);
      if (!block) return false;
      if (event.key === "Enter") { options.openEditor(block.id); return true; }
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return false;
      event.preventDefault();
      if (locked(block)) { toast("固定时间块不可用方向键移动或缩放。"); return true; }
      const existing = controller.keyboardDrafts.get(block.id) || { startAt: block.startAt, endAt: block.endAt || Calendar.addWallMinutes(block.startAt, 60), timer: null };
      let delta = event.key === "ArrowUp" ? -STEP : event.key === "ArrowDown" ? STEP : event.key === "ArrowLeft" ? -Calendar.DAY_MINUTES : Calendar.DAY_MINUTES;
      if (event.shiftKey && ["ArrowUp", "ArrowDown"].includes(event.key)) existing.endAt = Calendar.addWallMinutes(existing.endAt, delta);
      else { existing.startAt = Calendar.addWallMinutes(existing.startAt, delta); existing.endAt = Calendar.addWallMinutes(existing.endAt, delta); }
      if (Calendar.wallMinutesBetween(existing.startAt, existing.endAt) < STEP) existing.endAt = Calendar.addWallMinutes(existing.startAt, STEP);
      clearTimeout(existing.timer);
      existing.timer = setTimeout(async () => {
        controller.keyboardDrafts.delete(block.id);
        await options.mutate([{ type: "schedule.update", targetId: block.id, patch: { startAt: existing.startAt, endAt: existing.endAt } }], "键盘调整已保存。");
      }, 420);
      controller.keyboardDrafts.set(block.id, existing);
      const label = element.querySelector(".calendar-block-drag span");
      if (label) label.textContent = `${Calendar.minuteLabel(Calendar.minuteOfDay(existing.startAt))}—${Calendar.minuteLabel(Calendar.minuteOfDay(existing.endAt))} · 预览`;
      return true;
    }
    async function scheduleTaskOnDate(taskId, date, minute = null) {
      const task = openTasks().find((item) => item.id === taskId);
      if (!task) return;
      const startMinute = minute ?? Calendar.firstFreeMinute(allBlocks(), date, 60, 10 * 60, STEP);
      if (startMinute === null) return toast("当天没有可容纳 60 分钟任务的空档。");
      const startAt = Calendar.timelineIso(date, startMinute);
      const endAt = Calendar.addWallMinutes(startAt, 60);
      const block = { id: `block-${Date.now()}`, taskId: task.id, title: task.title, goal: task.goal || "", kind: "focus", startAt, endAt, status: "planned", source: "hud", locked: false, note: task.nextStep || "" };
      controller.anchor = date;
      await options.mutate([{ type: "schedule.create", block }], candidateConflict("", startAt, endAt) ? "已排入所选日期；冲突保持可见。" : "任务已排入所选日期。" );
    }
    async function moveBlockToDate(blockId, date) {
      const block = blockById(blockId);
      if (!block) return;
      if (locked(block)) return toast("固定时间块不能移动到其他日期。");
      const startMinute = Calendar.minuteOfDay(block.startAt);
      const duration = Calendar.blockRange(block)?.duration || 60;
      const startAt = Calendar.timelineIso(date, startMinute ?? 10 * 60);
      const endAt = Calendar.addWallMinutes(startAt, duration);
      controller.anchor = date;
      await options.mutate([{ type: "schedule.update", targetId: block.id, patch: { startAt, endAt } }], candidateConflict(block.id, startAt, endAt) ? "时间块已跨日移动；冲突保持可见。" : "时间块已移动到所选日期。" );
    }
    function bind() {
      if (controller.bound) return;
      controller.bound = true;
      document.addEventListener("click", (event) => {
        const mode = event.target.closest("[data-calendar-mode]");
        if (mode) { controller.mode = mode.dataset.calendarMode; controller.scrollTop = null; rerender(); event.stopPropagation(); return; }
        const shiftButton = event.target.closest("[data-calendar-shift]");
        if (shiftButton) { shift(shiftButton.dataset.calendarShift); event.stopPropagation(); return; }
        if (event.target.closest("[data-calendar-today]")) { controller.anchor = today(); controller.scrollTop = null; rerender(); event.stopPropagation(); return; }
        const dateButton = event.target.closest("[data-calendar-date-select]");
        if (dateButton) { controller.anchor = dateButton.dataset.calendarDateSelect; if (controller.mode === "month") controller.mode = "week"; controller.scrollTop = null; rerender(); event.stopPropagation(); return; }
        const open = event.target.closest("[data-calendar-open]");
        if (open) { options.openEditor(open.dataset.calendarOpen); event.stopPropagation(); }
      });
      document.addEventListener("change", (event) => {
        const filter = event.target.closest("[data-calendar-filter]");
        if (!filter) return;
        controller[`${filter.dataset.calendarFilter}Filter`] = filter.value;
        controller.scrollTop = null;
        rerender();
      });
      document.addEventListener("pointerdown", beginGesture);
      document.addEventListener("pointerdown", beginBacklogPointer);
      document.addEventListener("pointerdown", beginMonthPointer);
      document.addEventListener("pointermove", previewGesture);
      document.addEventListener("pointermove", moveBacklogPointer);
      document.addEventListener("pointermove", moveMonthPointer);
      document.addEventListener("pointerup", finishGesture);
      document.addEventListener("pointerup", finishBacklogPointer);
      document.addEventListener("pointerup", finishMonthPointer);
      document.addEventListener("pointercancel", (event) => {
        if (controller.gesture?.pointerId === event.pointerId) { controller.gesture.element.classList.remove("dragging"); controller.gesture = null; rerender(); }
        if (controller.backlogPointer?.pointerId === event.pointerId) { controller.backlogPointer.entry.classList.remove("dragging"); controller.backlogPointer = null; clearBacklogDropPreview(); }
        if (controller.monthPointer?.pointerId === event.pointerId) { controller.monthPointer.element.classList.remove("dragging"); controller.monthPointer = null; controller.root?.querySelectorAll("[data-calendar-date-drop].drop-active").forEach((item) => item.classList.remove("drop-active")); }
      });
      document.addEventListener("keydown", (event) => {
        const element = event.target.closest?.("[data-calendar-block]");
        if (element) keyboardPreview(element, event);
        const backlog = event.target.closest?.("[data-calendar-backlog-id]");
        if (backlog && ["Enter", " "].includes(event.key) && !event.target.closest("button")) {
          event.preventDefault();
          if (backlog.dataset.calendarBacklogType === "task") options.openEditor("", backlog.dataset.calendarBacklogId);
          else options.openEditor(backlog.dataset.calendarBacklogId);
        }
      });
      document.addEventListener("dragstart", (event) => {
        const scheduled = event.target.closest("[data-calendar-month-block]");
        if (scheduled) {
          const block = blockById(scheduled.dataset.calendarMonthBlock);
          if (!block || locked(block)) { event.preventDefault(); return; }
          controller.draggedBlockId = block.id;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/oos-block", block.id);
          scheduled.classList.add("dragging");
          return;
        }
        const entry = event.target.closest("[data-calendar-backlog-id]");
        if (!entry) return;
        controller.draggedTaskId = entry.dataset.calendarBacklogType === "task" ? entry.dataset.calendarBacklogId : "";
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/oos-task", controller.draggedTaskId);
        entry.classList.add("dragging");
      });
      document.addEventListener("dragend", (event) => {
        event.target.closest("[data-calendar-backlog-id],[data-calendar-month-block]")?.classList.remove("dragging");
        controller.root?.querySelectorAll(".drop-active").forEach((item) => item.classList.remove("drop-active"));
        controller.draggedTaskId = "";
        controller.draggedBlockId = "";
      });
      document.addEventListener("dragover", (event) => {
        const day = event.target.closest("[data-calendar-date-drop]");
        if (day && (controller.draggedTaskId || controller.draggedBlockId)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = controller.draggedBlockId ? "move" : "copy";
          day.classList.add("drop-active");
          return;
        }
        const stage = event.target.closest("[data-calendar-stage]");
        if (!stage || !controller.draggedTaskId) return;
        event.preventDefault();
        const minute = minuteFromPointer(stage, event.clientY);
        stage.classList.add("drop-active");
        const cursor = stage.querySelector(".calendar-drop-cursor");
        cursor.style.top = `${minute * PX_PER_MINUTE}px`;
        cursor.querySelector("span").textContent = `${Calendar.minuteLabel(minute)} · 放在这里`;
      });
      document.addEventListener("dragleave", (event) => { const target = event.target.closest("[data-calendar-stage],[data-calendar-date-drop]"); if (target && !target.contains(event.relatedTarget)) target.classList.remove("drop-active"); });
      document.addEventListener("drop", async (event) => {
        const day = event.target.closest("[data-calendar-date-drop]");
        if (day && (controller.draggedTaskId || controller.draggedBlockId)) {
          event.preventDefault();
          const date = day.dataset.calendarDateDrop;
          const taskId = controller.draggedTaskId;
          const blockId = controller.draggedBlockId;
          controller.draggedTaskId = "";
          controller.draggedBlockId = "";
          day.classList.remove("drop-active");
          if (blockId) await moveBlockToDate(blockId, date);
          else await scheduleTaskOnDate(taskId, date);
          return;
        }
        const stage = event.target.closest("[data-calendar-stage]");
        if (!stage || !controller.draggedTaskId) return;
        event.preventDefault();
        const taskId = controller.draggedTaskId;
        controller.draggedTaskId = "";
        stage.classList.remove("drop-active");
        const start = minuteFromPointer(stage, event.clientY);
        await scheduleTaskOnDate(taskId, stage.dataset.calendarStage, start);
      });
    }

    bind();
    controller.render = render;
    controller.resetToToday = () => { controller.anchor = today(); controller.mode = "workbench"; controller.scrollTop = null; };
    return controller;
  }

  return { create, constants: { START_MINUTE, END_MINUTE, STEP, PX_PER_MINUTE } };
});
