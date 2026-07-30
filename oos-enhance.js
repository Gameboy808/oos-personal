/*
 * OOS 交互增强 (oos-enhance)
 * 在原始前端之上补充「可交互」体验，参照 Focus App 的逻辑：
 * - 右下角固定「更新 / 同步」按钮：点击重新拉取最新状态并合并本地已完成项，给出 toast 反馈
 * - 依赖 static-shim 的 window.__OOS_RELOAD 与 app.js 全局的 load() / toast()
 */
(function () {
  "use strict";

  function addFab() {
    if (document.getElementById("syncFab")) return;
    var btn = document.createElement("button");
    btn.id = "syncFab";
    btn.type = "button";
    btn.setAttribute("aria-label", "同步最新状态");
    btn.innerHTML = '<span class="sync-icon" aria-hidden="true">⟳</span><span class="sync-label">更新</span>';
    document.body.appendChild(btn);

    btn.addEventListener("click", function () {
      if (btn.classList.contains("spinning")) return;
      btn.classList.add("spinning");
      if (typeof toast === "function") toast("正在同步最新状态…");
      // 优先用 shim 暴露的强制重载（拉取 GitHub 最新 state.json 并保留本地完成项）
      if (typeof window.__OOS_RELOAD === "function") {
        window.__OOS_RELOAD();
      } else if (typeof load === "function") {
        load();
      }
      setTimeout(function () {
        btn.classList.remove("spinning");
        if (typeof toast === "function") toast("已更新到最新");
      }, 700);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addFab);
  } else {
    addFab();
  }
})();
