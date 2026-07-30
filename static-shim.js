/*
 * OOS 静态垫片 (static-shim)
 * 让原始 oos-builder 前端在「无后端」的 GitHub Pages 上照常运行，并且真正可交互：
 * - /api/state 返回「基础 state.json 合并本地 localStorage 覆盖」的结果（刷新不丢用户操作）
 * - /api/state-meta 返回随本地改动变化的 changeToken，让 liveSync 能感知更新
 * - /api/state-ops 真实生效：解析 ops 应用到内存 state，写回 localStorage（task 完成 / 时间块 / onboarding 等）
 * - /api/events 的 EventSource 桩掉，离线不报错
 * 用户在本地的操作（勾选任务、完成时间块、跳过引导等）全部存 localStorage，
 * 刷新页面或重新打开都保留，与 Focus App 的本地优先逻辑一致。
 */
(function () {
  "use strict";
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  var LS_KEY = "oos-state-local-v1";
  var stateCache = null;   // 合并后的当前状态（base + 本地覆盖）
  var baseCache = null;    // 原始 state.json（权威骨架）
  var localUpdatedAt = "";

  function jsonResponse(obj, status) {
    return new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  function loadBase() {
    if (baseCache) return Promise.resolve(baseCache);
    if (!origFetch) return Promise.resolve({});
    return origFetch("./state.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.text(); })
      .then(function (t) { baseCache = JSON.parse(t); return baseCache; })
      .catch(function () { return {}; });
  }

  function getLocal() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { return null; }
  }
  function saveLocal(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // 以 base 为骨架，用本地保存的 task / 时间块 完成状态覆盖，保留用户在 HUD 上的操作
  function mergeState(base, local) {
    if (!local) return base;
    var b = JSON.parse(JSON.stringify(base));
    if (Array.isArray(b.tasks) && Array.isArray(local.tasks)) {
      var tmap = {};
      local.tasks.forEach(function (t) { if (t && t.id) tmap[t.id] = t.status; });
      b.tasks.forEach(function (t) { if (tmap[t.id] != null) t.status = tmap[t.id]; });
    }
    if (Array.isArray(b.scheduleBlocks) && Array.isArray(local.scheduleBlocks)) {
      var bmap = {};
      local.scheduleBlocks.forEach(function (x) { if (x && x.id) bmap[x.id] = x.status; });
      b.scheduleBlocks.forEach(function (x) { if (bmap[x.id] != null) x.status = bmap[x.id]; });
    }
    if (local.onboarding && local.onboarding.firstFlight) {
      b.onboarding = b.onboarding || {};
      b.onboarding.firstFlight = b.onboarding.firstFlight || {};
      if (local.onboarding.firstFlight.status) b.onboarding.firstFlight.status = local.onboarding.firstFlight.status;
      if (local.onboarding.firstFlight.currentStep != null) b.onboarding.firstFlight.currentStep = local.onboarding.firstFlight.currentStep;
    }
    return b;
  }

  function findTask(state, id) {
    return (state.tasks || []).filter(function (t) { return t.id === id; })[0] || null;
  }
  function findBlock(state, id) {
    return (state.scheduleBlocks || []).filter(function (b) { return b.id === id; })[0] || null;
  }
  function setTaskStatus(state, id, status) {
    var t = findTask(state, id);
    if (!t) return;
    t.status = status;
    if (status === "done") t.completedAt = new Date().toISOString();
    else delete t.completedAt;
  }
  function setBlockStatus(state, id, status) {
    var b = findBlock(state, id);
    if (b) b.status = status;
  }
  function setOnboarding(state, status) {
    state.onboarding = state.onboarding || {};
    state.onboarding.firstFlight = state.onboarding.firstFlight || {};
    state.onboarding.firstFlight.status = status;
  }

  // 把 app.js 发来的 ops 应用到状态（覆盖 oos-builder 后端本应做的写操作）
  function applyOps(state, ops) {
    ops = Array.isArray(ops) ? ops : [];
    ops.forEach(function (op) {
      if (!op || !op.type) return;
      var id = op.targetId || (op.block && op.block.id);
      switch (op.type) {
        case "task.complete": setTaskStatus(state, id, "done"); break;
        case "task.reopen": setTaskStatus(state, id, "open"); break;
        case "schedule.complete": setBlockStatus(state, id, "completed"); break;
        case "schedule.cancel": setBlockStatus(state, id, "cancelled"); break;
        case "schedule.update":
          if (op.patch && id) { var blk = findBlock(state, id); if (blk) Object.assign(blk, op.patch); }
          break;
        case "schedule.create":
          if (op.block) { state.scheduleBlocks = state.scheduleBlocks || []; state.scheduleBlocks.push(op.block); }
          break;
        case "schedule.clearTime":
          { var cb = findBlock(state, id); if (cb) { cb.startAt = null; cb.endAt = null; } }
          break;
        case "onboarding.advance":
          if (op.step != null) { state.onboarding = state.onboarding || {}; state.onboarding.firstFlight = state.onboarding.firstFlight || {}; state.onboarding.firstFlight.currentStep = op.step; }
          break;
        case "onboarding.complete": setOnboarding(state, "completed"); break;
        case "onboarding.skip": setOnboarding(state, "skipped"); break;
        case "onboarding.resume": setOnboarding(state, "in_progress"); break;
        default: break;
      }
    });
    if (state.meta) {
      state.meta.version = (Number(state.meta.version) || 0) + 1;
      state.meta.lastUpdated = new Date().toISOString();
    }
    return state;
  }

  function ensureState() {
    if (stateCache) return Promise.resolve(stateCache);
    return loadBase().then(function (base) {
      var local = getLocal();
      stateCache = mergeState(base, local);
      localUpdatedAt = (local && local.__updatedAt) || "";
      return stateCache;
    });
  }

  function tokenOf(state) {
    return "v:" + (state && state.meta ? (state.meta.version || 0) : 0) + ":u:" + localUpdatedAt;
  }

  if (origFetch) {
    window.fetch = function (url, options) {
      var u = String(url);
      if (u.indexOf("state-meta") !== -1) {
        return ensureState().then(function (s) { return jsonResponse({ changeToken: tokenOf(s) }); });
      }
      if (u.indexOf("state-ops") !== -1) {
        var body = {};
        try { body = JSON.parse(String((options && options.body) || "{}")); } catch (e) {}
        return ensureState().then(function (s) {
          applyOps(s, body.ops);
          localUpdatedAt = new Date().toISOString();
          s.__updatedAt = localUpdatedAt;
          saveLocal(s);
          return jsonResponse({ ok: true, version: (s.meta ? s.meta.version : 0), changeToken: tokenOf(s) });
        });
      }
      if (u.indexOf("/api/worker") !== -1) return Promise.resolve(jsonResponse({ items: [], stats: {} }));
      if (u.indexOf("/api/capture") !== -1) return Promise.resolve(jsonResponse({ ok: true, version: 0 }));
      if (u.indexOf("/api/state") !== -1) {
        return ensureState().then(function (s) { return jsonResponse(s); });
      }
      return origFetch(url, options);
    };
  }

  // 供「更新 / 同步」按钮调用：清空缓存，强制从 GitHub 重新拉取最新 state.json 并合并本地完成状态
  window.__OOS_RELOAD = function () {
    baseCache = null;
    stateCache = null;
    if (typeof load === "function") { load(); }
  };

  // 桩掉仅用于本地服务的事件流，避免离线报错
  if (window.EventSource) {
    var RealES = window.EventSource;
    window.EventSource = function (url) {
      if (String(url).indexOf("/api/events") !== -1) {
        this.readyState = 0;
        this.addEventListener = function () {};
        this.removeEventListener = function () {};
        this.close = function () {};
        this.onerror = null;
      } else {
        return new RealES(url);
      }
    };
  }
})();
