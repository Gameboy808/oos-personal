/*
 * OOS 静态垫片 (static-shim)
 * 让原始 oos-builder 前端在「无后端」的 GitHub Pages 上照常渲染：
 * - 把 /api/state 等接口重定向到本地 state.json
 * - /api/state-meta 返回空对象（app 自动回退到 state.meta）
 * - 写操作 (state-ops / capture / worker) 返回 200 的 no-op，避免页面报错
 * - 把 /api/events 的 EventSource 桩掉，离线也不报错
 * 仅在 URL 命中 OOS 内部 API 时拦截，其余请求原样放行。
 */
(function () {
  "use strict";
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  var stateCache = null;

  function jsonResponse(obj, status) {
    return new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  function loadState() {
    if (stateCache) return Promise.resolve(stateCache);
    if (!origFetch) return Promise.resolve({});
    return origFetch("./state.json", { cache: "no-store" })
      .then(function (r) { return r.text(); })
      .then(function (t) { stateCache = JSON.parse(t); return stateCache; })
      .catch(function () { return {}; });
  }

  if (origFetch) {
    window.fetch = function (url, options) {
      var u = String(url);
      if (u.indexOf("state-meta") !== -1) return Promise.resolve(jsonResponse({}));
      if (u.indexOf("state-ops") !== -1) return Promise.resolve(jsonResponse({ ok: true, version: 0 }));
      if (u.indexOf("/api/worker") !== -1) return Promise.resolve(jsonResponse({ items: [], stats: {} }));
      if (u.indexOf("/api/capture") !== -1) return Promise.resolve(jsonResponse({ ok: true, version: 0 }));
      if (u.indexOf("/api/state") !== -1) {
        return loadState().then(function (s) { return jsonResponse(s); });
      }
      return origFetch(url, options);
    };
  }

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
