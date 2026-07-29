(function calendarEngineFactory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.OOSCalendar = api;
})(typeof globalThis === "object" ? globalThis : this, function createCalendarEngine() {
  "use strict";

  const DAY_MINUTES = 24 * 60;
  const DEFAULT_DURATION = 60;
  const HIDDEN_BLOCK_STATUSES = new Set(["archived"]);
  const CLOSED_TASK_STATUSES = new Set(["done", "cancelled", "declined", "archived"]);
  const TRACK_MARKS = ["◆", "●", "▲", "◇", "■", "✦", "◌"];

  function pad(value) { return String(value).padStart(2, "0"); }

  function parseDate(date) {
    const match = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }

  function parseDateTime(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return null;
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    if (hour > 23 || minute > 59) return null;
    return {
      date: `${match[1]}-${match[2]}-${match[3]}`,
      year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
      hour, minute, minutes: hour * 60 + minute
    };
  }

  function ordinal(date) {
    const value = parseDate(date);
    return value ? Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 86400000) : null;
  }

  function dateFromOrdinal(value) {
    const date = new Date(value * 86400000);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  function addDays(date, days) {
    const value = ordinal(date);
    return value === null ? "" : dateFromOrdinal(value + Number(days || 0));
  }

  function weekdayIndex(date) {
    const value = ordinal(date);
    return value === null ? 0 : new Date(value * 86400000).getUTCDay();
  }

  function weekStart(date) {
    const day = weekdayIndex(date) || 7;
    return addDays(date, -day + 1);
  }

  function monthStart(date) {
    const value = parseDate(date);
    return value ? `${value.year}-${pad(value.month)}-01` : "";
  }

  function addMonths(date, amount) {
    const value = parseDate(date);
    if (!value) return "";
    const shifted = new Date(Date.UTC(value.year, value.month - 1 + Number(amount || 0), 1));
    return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-01`;
  }

  function monthGrid(date) {
    const first = monthStart(date);
    const start = weekStart(first);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }

  function minuteLabel(minutes) {
    const safe = Math.max(0, Math.min(DAY_MINUTES - 1, Math.round(Number(minutes) || 0)));
    return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`;
  }

  function minuteOfDay(value) { return parseDateTime(value)?.minutes ?? null; }

  function wallValue(value) {
    const parsed = parseDateTime(value);
    const day = parsed ? ordinal(parsed.date) : null;
    return parsed && day !== null ? day * DAY_MINUTES + parsed.minutes : null;
  }

  function dateTimeFromWall(value) {
    const day = Math.floor(value / DAY_MINUTES);
    const minute = ((value % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    return `${dateFromOrdinal(day)}T${minuteLabel(minute)}:00`;
  }

  function addWallMinutes(value, delta) {
    const start = wallValue(value);
    return start === null ? "" : dateTimeFromWall(start + Number(delta || 0));
  }

  function wallMinutesBetween(startAt, endAt) {
    const start = wallValue(startAt);
    const end = wallValue(endAt);
    return start === null || end === null ? null : end - start;
  }

  function timelineIso(date, minutes) {
    const day = ordinal(date);
    return day === null ? "" : dateTimeFromWall(day * DAY_MINUTES + Math.round(Number(minutes) || 0));
  }

  function snapMinute(value, step = 15) {
    const size = Math.max(1, Number(step) || 15);
    return Math.round(Number(value || 0) / size) * size;
  }

  function blockRange(block) {
    const start = wallValue(block?.startAt);
    if (start === null) return null;
    let end = wallValue(block?.endAt);
    if (end === null || end <= start) end = start + DEFAULT_DURATION;
    return { start, end, duration: end - start };
  }

  function blocksOverlap(left, right) {
    const a = blockRange(left);
    const b = blockRange(right);
    return Boolean(a && b && a.start < b.end && b.start < a.end);
  }

  function conflictIds(blocks) {
    const ids = new Set();
    const timed = (Array.isArray(blocks) ? blocks : []).filter((block) => blockRange(block));
    for (let left = 0; left < timed.length; left += 1) {
      for (let right = left + 1; right < timed.length; right += 1) {
        if (blocksOverlap(timed[left], timed[right])) {
          ids.add(timed[left].id);
          ids.add(timed[right].id);
        }
      }
    }
    return ids;
  }

  function blockSegments(block, dates, visibleStart = 0, visibleEnd = DAY_MINUTES) {
    const range = blockRange(block);
    if (!range) return [];
    const result = [];
    for (const date of dates || []) {
      const day = ordinal(date);
      if (day === null) continue;
      const dayStart = day * DAY_MINUTES;
      const clipStart = dayStart + visibleStart;
      const clipEnd = dayStart + visibleEnd;
      const start = Math.max(range.start, clipStart);
      const end = Math.min(range.end, clipEnd);
      if (start >= end) continue;
      result.push({
        id: `${block.id}:${date}`,
        blockId: block.id,
        block,
        date,
        start: start - dayStart,
        end: end - dayStart,
        actualStart: range.start,
        actualEnd: range.end,
        isStart: start === range.start,
        isEnd: end === range.end,
        continuesBefore: start > range.start,
        continuesAfter: end < range.end
      });
    }
    return result;
  }

  function layoutDaySegments(segments) {
    const ordered = (Array.isArray(segments) ? segments : []).slice().sort((a, b) => a.start - b.start || a.end - b.end || String(a.blockId).localeCompare(String(b.blockId)));
    const groups = [];
    let group = [];
    let groupEnd = -1;
    for (const segment of ordered) {
      if (group.length && segment.start >= groupEnd) {
        groups.push(group);
        group = [];
        groupEnd = -1;
      }
      group.push(segment);
      groupEnd = Math.max(groupEnd, segment.end);
    }
    if (group.length) groups.push(group);

    const laidOut = [];
    for (const entries of groups) {
      const laneEnds = [];
      const assigned = entries.map((entry) => {
        let lane = laneEnds.findIndex((end) => end <= entry.start);
        if (lane < 0) lane = laneEnds.length;
        laneEnds[lane] = entry.end;
        return { ...entry, lane };
      });
      const laneCount = Math.max(1, laneEnds.length);
      for (const entry of assigned) {
        laidOut.push({
          ...entry,
          laneCount,
          conflict: entries.length > 1,
          leftPct: (entry.lane / laneCount) * 100,
          widthPct: 100 / laneCount
        });
      }
    }
    return laidOut;
  }

  function activeCalendarBlocks(blocks, filters = {}) {
    return (Array.isArray(blocks) ? blocks : []).filter((block) => {
      if (!block || !block.id || !block.startAt) return false;
      if (filters.status === "cancelled") {
        if (block.status !== "cancelled") return false;
      } else if (filters.status === "completed") {
        if (block.status !== "completed") return false;
      } else if (filters.status === "planned") {
        if (!["planned", "in_progress"].includes(block.status || "planned")) return false;
      } else if (HIDDEN_BLOCK_STATUSES.has(block.status)) return false;
      if (filters.track && filters.track !== "all" && block.goal !== filters.track) return false;
      const locked = Boolean(block.locked || block.kind === "fixed");
      if (filters.type === "fixed" && !locked) return false;
      if (filters.type === "movable" && locked) return false;
      return true;
    });
  }

  function dueItems(tasks, blocks, startDate, endDate) {
    const scheduledTaskIds = new Set((blocks || []).filter((block) => block?.taskId && block.startAt && !["cancelled", "archived"].includes(block.status)).map((block) => block.taskId));
    return (tasks || []).filter((task) => {
      if (!task?.due || scheduledTaskIds.has(task.id) || CLOSED_TASK_STATUSES.has(task.status)) return false;
      return task.due >= startDate && task.due <= endDate;
    }).map((task) => ({ id: `due:${task.id}`, taskId: task.id, date: task.due, title: task.title, goal: task.goal || "", kind: "due" }));
  }

  function firstFreeMinute(blocks, date, duration = DEFAULT_DURATION, preferred = 10 * 60, step = 15) {
    const safeDuration = Math.max(step, Number(duration) || DEFAULT_DURATION);
    const occupied = (Array.isArray(blocks) ? blocks : [])
      .filter((block) => block?.startAt && !["cancelled", "archived"].includes(block.status))
      .flatMap((block) => blockSegments(block, [date]))
      .map((segment) => ({ start: segment.start, end: segment.end }));
    const first = Math.max(0, Math.min(DAY_MINUTES - safeDuration, snapMinute(preferred, step)));
    const candidates = [];
    for (let minute = first; minute <= DAY_MINUTES - safeDuration; minute += step) candidates.push(minute);
    for (let minute = 0; minute < first; minute += step) candidates.push(minute);
    return candidates.find((minute) => !occupied.some((entry) => minute < entry.end && entry.start < minute + safeDuration)) ?? null;
  }

  function stableMarker(value) {
    let hash = 0;
    for (const character of String(value || "system")) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    return TRACK_MARKS[hash % TRACK_MARKS.length];
  }

  function datesBetween(startDate, endDate, max = 62) {
    const start = ordinal(startDate);
    const end = ordinal(endDate);
    if (start === null || end === null || end < start) return [];
    const length = Math.min(max, end - start + 1);
    return Array.from({ length }, (_, index) => dateFromOrdinal(start + index));
  }

  return {
    DAY_MINUTES,
    DEFAULT_DURATION,
    addDays,
    addMonths,
    addWallMinutes,
    activeCalendarBlocks,
    blockRange,
    blockSegments,
    blocksOverlap,
    conflictIds,
    dateTimeFromWall,
    datesBetween,
    dueItems,
    firstFreeMinute,
    layoutDaySegments,
    minuteLabel,
    minuteOfDay,
    monthGrid,
    monthStart,
    ordinal,
    parseDate,
    parseDateTime,
    snapMinute,
    stableMarker,
    timelineIso,
    wallMinutesBetween,
    wallValue,
    weekdayIndex,
    weekStart
  };
});
