/*
 * OOS 云端同步 (oos-sync)
 * 把本地的多桶数据（主状态 + 自媒体 + 灵感 + 英语进度）打包同步到 GitHub 私有仓库，
 * 实现手机 / 电脑跨设备一致。逻辑对齐 Focus App 的云端同步：
 *  - 开机（若开启自动同步且有 Token）：先从云端拉取并合并，保证看到其他设备的最新改动
 *  - 任意本地改动（任务/轨道/自媒体/灵感）：5 秒后自动上传
 *  - 右下角「同步」按钮：手动双向同步（先拉后推）
 *  - ⚙ 设置：粘贴 Token、开关自动同步、手动上传 / 从云端恢复
 * 合并策略：数组按 id 并集（云端覆盖同 id，但绝不删除本地独有项）；标量字段非空优先。
 */
(function () {
  "use strict";

  var REPO = "Gameboy808/oos-cloud-data";
  var PATH = "data.json";
  var BUCKETS = ["oos-state-local-v1", "oos-social-v1", "oos-insp-v1", "oos-eng"];
  var LS_TOKEN = "oos-sync-token";
  var LS_CFG = "oos-sync-cfg";
  var LS_AT = "oos-sync-at";

  function getToken() { try { return localStorage.getItem(LS_TOKEN) || ""; } catch (e) { return ""; } }
  function getCfg() { try { return JSON.parse(localStorage.getItem(LS_CFG)) || { auto: true }; } catch (e) { return { auto: true }; } }
  function setCfg(c) { try { localStorage.setItem(LS_CFG, JSON.stringify(c)); } catch (e) {} }
  function getAt() { try { return localStorage.getItem(LS_AT) || ""; } catch (e) { return ""; } }
  function setAt(v) { try { localStorage.setItem(LS_AT, v); } catch (e) {} }
  function toastMsg(m) { if (typeof window.toast === "function") window.toast(m); else if (window.OOSM && window.OOSM.toast) window.OOSM.toast(m); else console.log(m); }

  /* ---------- base64 (UTF-8 safe) ---------- */
  function b64encode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64decode(b64) {
    var bin = atob(b64.replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* ---------- 读取本地多桶 ---------- */
  function getBuckets() {
    var out = {};
    BUCKETS.forEach(function (k) {
      try { var v = localStorage.getItem(k); if (v) out[k] = JSON.parse(v); } catch (e) {}
    });
    return out;
  }

  function unionArr(a, b) {
    var s = {};
    (a || []).concat(b || []).forEach(function (x) { if (x != null) s[x] = 1; });
    return Object.keys(s);
  }

  /* ---------- 把云端数据合并回本地（id 并集，绝不删除本地独有项） ---------- */
  var merging = false;
  function mergeBuckets(cloud) {
    if (!cloud || !cloud.buckets) return;
    merging = true;
    try {
      var local = getBuckets();
      BUCKETS.forEach(function (k) {
        var cb = cloud.buckets[k];
        if (cb == null) return;
        if (k === "oos-state-local-v1") {
          var base = local[k] || {};
          ["tasks", "tracks", "goals", "scheduleBlocks", "notes"].forEach(function (arr) {
            if (!Array.isArray(cb[arr])) return;
            var map = {};
            (base[arr] || []).forEach(function (x) { if (x && x.id) map[x.id] = x; });
            cb[arr].forEach(function (x) { if (x && x.id) map[x.id] = x; });
            base[arr] = Object.keys(map).map(function (id) { return map[id]; });
          });
          if (cb.onboarding) base.onboarding = cb.onboarding;
          if (cb.__updatedAt) base.__updatedAt = cb.__updatedAt;
          if (cb.meta) base.meta = cb.meta;
          localStorage.setItem(k, JSON.stringify(base));
        } else if (k === "oos-social-v1") {
          var sLocal = local[k] || {};
          Object.keys(cb).forEach(function (pkey) {
            var c = cb[pkey] || {};
            var l = sLocal[pkey] || {};
            var merged = l;
            merged.username = ((c.username || "").length >= (l.username || "").length) ? (c.username || l.username || "") : (l.username || c.username || "");
            merged.homepage = c.homepage || l.homepage || "";
            var posts = {};
            (l.posts || []).forEach(function (x) { if (x && x.id) posts[x.id] = x; });
            (c.posts || []).forEach(function (x) { if (x && x.id) posts[x.id] = x; });
            merged.posts = Object.keys(posts).map(function (id) { return posts[id]; });
            sLocal[pkey] = merged;
          });
          localStorage.setItem(k, JSON.stringify(sLocal));
        } else if (k === "oos-insp-v1") {
          var iLocal = local[k] || { favs: [], saved: [] };
          var iCloud = cb || { favs: [], saved: [] };
          iLocal.favs = unionArr(iLocal.favs, iCloud.favs);
          iLocal.saved = unionArr(iLocal.saved, iCloud.saved);
          localStorage.setItem(k, JSON.stringify(iLocal));
        } else {
          localStorage.setItem(k, JSON.stringify(cb)); // oos-eng 等小对象：云端为准
        }
      });
    } finally {
      merging = false;
    }
  }

  /* ---------- GitHub API ---------- */
  function gh(method, body) {
    var token = getToken();
    if (!token) return Promise.reject(new Error("no-token"));
    var url = "https://api.github.com/repos/" + REPO + "/contents/" + PATH;
    var headers = {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json"
    };
    var opts = { method: method, headers: headers };
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, status: r.status, data: j }; });
    });
  }

  function upload() {
    var token = getToken();
    if (!token) { toastMsg("请先在同步设置里粘贴 Token"); return Promise.reject(new Error("no-token")); }
    var payload = { updatedAt: new Date().toISOString(), buckets: getBuckets() };
    var content = b64encode(JSON.stringify(payload, null, 2));
    return gh("GET").then(function (res) {
      var sha = res.data && res.data.sha;
      var body = { message: "OOS sync " + payload.updatedAt, content: content, branch: "main" };
      if (sha) body.sha = sha;
      return gh("PUT", body);
    }).then(function (res) {
      if (!res.ok) throw new Error((res.data && res.data.message) || "上传失败");
      setAt(payload.updatedAt);
      return true;
    });
  }

  function download() {
    var token = getToken();
    if (!token) return Promise.reject(new Error("no-token"));
    return gh("GET").then(function (res) {
      if (res.status === 404) return null; // 云端还没有数据
      if (!res.ok) throw new Error((res.data && res.data.message) || "下载失败");
      var c = res.data && res.data.content;
      if (!c) return null;
      return JSON.parse(b64decode(c));
    }).then(function (cloud) {
      if (cloud) { mergeBuckets(cloud); setAt(cloud.updatedAt || new Date().toISOString()); }
      return cloud;
    });
  }

  function reloadApp() {
    if (typeof window.__OOS_RELOAD === "function") window.__OOS_RELOAD();
    else if (typeof load === "function") load();
  }

  function setFabSpin(on) {
    var fab = document.getElementById("syncFab");
    if (fab) fab.classList.toggle("spinning", !!on);
  }

  /* 手动双向同步：先拉后推 */
  function syncNow() {
    if (getToken() && getCfg().auto === false) { /* 仍允许手动 */ }
    setFabSpin(true);
    toastMsg("正在同步云端…");
    download().then(function () {
      return upload();
    }).then(function () {
      reloadApp();
      setFabSpin(false);
      toastMsg("已同步到云端 ✓");
    }).catch(function (err) {
      setFabSpin(false);
      if ((err && err.message) === "no-token") { openSettings(); toastMsg("请先填写 Token"); }
      else toastMsg("同步失败：" + (err && err.message ? err.message : "检查 Token / 网络"));
    });
  }

  /* ---------- 自动上传（监听 localStorage 写入） ---------- */
  var uploadTimer = null;
  function scheduleUpload() {
    if (uploadTimer) clearTimeout(uploadTimer);
    uploadTimer = setTimeout(function () {
      uploadTimer = null;
      upload().catch(function () {});
    }, 5000);
  }
  function installWriteHook() {
    var orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      orig(k, v);
      if (merging) return; // 合并过程内的写入不触发上传，避免死循环
      if (BUCKETS.indexOf(k) !== -1) {
        var cfg = getCfg();
        if (cfg.auto && getToken()) scheduleUpload();
      }
    };
  }

  /* 开机拉取（pull on open） */
  function bootPull() {
    var cfg = getCfg();
    if (cfg.auto && getToken()) {
      download().then(function (cloud) {
        if (cloud) reloadApp();
      }).catch(function () {});
    }
  }

  /* ---------- 设置面板 ---------- */
  var STYLE = "#syncGear{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;border:none;background:rgba(0,0,0,.06);color:#333;font-size:15px;cursor:pointer;margin-left:8px}#syncGear:hover{background:rgba(16,185,129,.18)}" +
    ".oos-sync-modal h3{margin:0 0 14px;font-size:18px}.oos-sync-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}" +
    ".oos-sync-row label{font-size:13px;opacity:.7}.oos-sync-token{width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,.14);border-radius:10px;font-size:13px;font-family:inherit;margin-bottom:14px}" +
    ".oos-sync-actions{display:flex;gap:10px;margin-top:6px}.oos-sync-actions button{flex:1;padding:11px;border-radius:11px;font-weight:600;cursor:pointer;border:none;font-size:13px}" +
    ".oos-sync-actions .primary{background:#10b981;color:#fff}.oos-sync-actions .ghost{background:rgba(0,0,0,.06)}" +
    ".oos-sync-status{margin-top:12px;font-size:12px;opacity:.6;min-height:16px}.oos-sync-help{margin-top:10px;font-size:11px;opacity:.5;line-height:1.5}";
  function injectStyle() { var s = document.createElement("style"); s.textContent = STYLE; document.head.appendChild(s); }

  function openSettings() {
    var token = getToken();
    var cfg = getCfg();
    var mask = document.createElement("div");
    mask.className = "oos-modal-mask"; mask.id = "oosSyncModal";
    mask.innerHTML = '<div class="oos-modal oos-sync-modal">' +
      '<h3>云端同步 · Cloud Sync</h3>' +
      '<label style="font-size:12px;opacity:.6;display:block;margin-bottom:5px">GitHub Token（仅存你本机浏览器，不会写入代码）</label>' +
      '<input class="oos-sync-token" id="syncToken" type="password" placeholder="粘贴 ghPAT_xxx 或 ghp_xxx" value="' + esc(token) + '">' +
      '<div class="oos-sync-row"><label>自动同步（改完自动上传 / 开机自动拉取）</label>' +
      '<input type="checkbox" id="syncAuto" ' + (cfg.auto !== false ? "checked" : "") + ' style="width:18px;height:18px"></div>' +
      '<div class="oos-sync-actions">' +
      '<button class="primary" id="syncUpload">立即上传</button>' +
      '<button class="ghost" id="syncRestore">从云端恢复</button>' +
      '</div>' +
      '<div class="oos-sync-status" id="syncStatus"></div>' +
      '<div class="oos-sync-help">没有 Token？登录 github.com → 右上角头像 → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token，勾选 <b>repo</b> 权限，生成后粘贴到这里。这个仓库是私有的，只有你能看。</div>' +
      '</div>';
    mask.addEventListener("click", function (e) { if (e.target === mask) mask.remove(); });
    document.body.appendChild(mask);

    function setStatus(m) { var s = document.getElementById("syncStatus"); if (s) s.textContent = m; }
    document.getElementById("syncUpload").addEventListener("click", function () {
      var tk = document.getElementById("syncToken").value.trim();
      if (!tk) { setStatus("请先粘贴 Token"); return; }
      localStorage.setItem(LS_TOKEN, tk);
      setCfg({ auto: document.getElementById("syncAuto").checked });
      setStatus("上传中…");
      upload().then(function () { setStatus("✓ 已上传到云端（" + new Date().toLocaleString() + "）"); toastMsg("已上传"); })
        .catch(function (e) { setStatus("上传失败：" + (e.message || e)); });
    });
    document.getElementById("syncRestore").addEventListener("click", function () {
      var tk = document.getElementById("syncToken").value.trim();
      if (!tk) { setStatus("请先粘贴 Token"); return; }
      localStorage.setItem(LS_TOKEN, tk);
      setCfg({ auto: document.getElementById("syncAuto").checked });
      setStatus("从云端恢复中…");
      download().then(function (cloud) {
        if (!cloud) { setStatus("云端还没有数据，请先上传一次"); return; }
        reloadApp(); setStatus("✓ 已从云端恢复"); toastMsg("已从云端恢复");
      }).catch(function (e) { setStatus("恢复失败：" + (e.message || e)); });
    });
    mask.querySelector(".oos-modal").addEventListener("click", function (e) {
      if (e.target.id === "syncToken" || e.target.closest(".oos-sync-actions")) return;
    });
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- 齿轮入口 ---------- */
  function injectGear() {
    var foot = document.querySelector(".launcher-foot");
    if (!foot || document.getElementById("syncGear")) return;
    var g = document.createElement("button");
    g.id = "syncGear"; g.type = "button"; g.textContent = "⚙"; g.title = "云端同步设置";
    g.addEventListener("click", openSettings);
    foot.appendChild(g);
  }

  /* ---------- 暴露给 FAB ---------- */
  window.OOS_SYNC = { syncNow: syncNow, openSettings: openSettings, upload: upload, download: download };

  /* ---------- 启动 ---------- */
  function boot() {
    injectStyle();
    injectGear();
    installWriteHook();
    bootPull();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
