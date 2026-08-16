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
    btn.innerHTML = '<span class="sync-icon" aria-hidden="true">⟳</span><span class="sync-label">同步</span>';
    // 放入左侧导航栏底部（在连接状态之前），桌面端不再占用右下角
    var launcher = document.querySelector(".launcher");
    if (launcher) {
      var foot = launcher.querySelector(".launcher-foot");
      if (foot) launcher.insertBefore(btn, foot);
      else launcher.appendChild(btn);
    } else {
      document.body.appendChild(btn);
    }

    btn.addEventListener("click", function () {
      if (btn.classList.contains("spinning")) return;
      // 若云端同步模块已就绪，走真正的双向云端同步；否则退回本地重载
      if (window.OOS_SYNC && typeof window.OOS_SYNC.syncNow === "function") {
        window.OOS_SYNC.syncNow();
        return;
      }
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

  function addMemoFab() {
    if (document.getElementById("memoFab")) return;
    var btn = document.createElement("button");
    btn.id = "memoFab";
    btn.type = "button";
    btn.setAttribute("aria-label", "速记备忘录");
    btn.innerHTML = '<span class="memo-fab-icon" aria-hidden="true">✎</span><span class="memo-fab-label">速记</span>';
    document.body.appendChild(btn);
    btn.addEventListener("click", function () {
      if (typeof window.openQuickMemo === "function") window.openQuickMemo();
      else if (typeof toast === "function") toast("备忘录模块加载中…");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { addFab(); addMemoFab(); });
  } else {
    addFab();
    addMemoFab();
  }
})();
