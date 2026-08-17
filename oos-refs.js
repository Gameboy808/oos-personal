/*
 * OOS · 跨板块引用（@提及 + 反向链接）
 * - token: @ref{kind:id|label}  kind ∈ note|task|track|wish
 * - 备忘录块编辑器输入 @ 弹出实体选择器（IME 安全）
 * - 显示处把 token 渲染成可点击 chip；目标实体显示反向链接
 * - 无外部依赖，纯 SVG/DOM，PWA 离线可用
 *
 * 依赖的全局（与 app.js 同处经典脚本的全局词法作用域，可直接引用）：
 *   state, view, selectedNoteId, selectedTrackId, financeTab,
 *   notes(), openTasks(), tracks(), render(), esc()
 */
(function () {
  "use strict";

  const REF_RE = /@ref\{(note|task|track|wish):([^|{}]+)\|([^|{}]+)\}/g;
  const KIND_LABEL = { note: "备忘录", task: "任务", track: "轨道", wish: "心愿" };

  function collectEntities() {
    const out = [];
    try { (notes ? notes() : []).forEach((n) => out.push({ kind: "note", id: n.id, label: n.title || "备忘录" })); } catch (e) {}
    try { (openTasks ? openTasks() : []).forEach((t) => out.push({ kind: "task", id: t.id, label: t.title || "任务" })); } catch (e) {}
    try { (tracks ? tracks() : []).forEach((t) => out.push({ kind: "track", id: t.id, label: t.name || "轨道" })); } catch (e) {}
    try {
      const fin = (state && state.finance) || {};
      (fin.wishes || []).forEach((w) => out.push({ kind: "wish", id: w.id, label: w.name || "心愿" }));
    } catch (e) {}
    return out;
  }

  function extractRefs(text) {
    const res = [];
    const re = new RegExp(REF_RE.source, "g");
    let m;
    while ((m = re.exec(String(text || "")))) res.push({ kind: m[1], id: m[2], label: m[3] });
    return res;
  }

  function renderRefs(text) {
    const safe = (window.esc ? window.esc(String(text || "")) : String(text || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
    return safe.replace(REF_RE, function (_m, kind, id, label) {
      return `<span class="ref-chip" data-ref-kind="${kind}" data-ref-id="${id}" title="跳转到${KIND_LABEL[kind] || kind}">${label}<i class="ref-arrow">↗</i></span>`;
    });
  }

  function openRef(kind, id) {
    if (!id) return;
    if (kind === "note") { view = "notes"; selectedNoteId = id; }
    else if (kind === "track") { view = "track"; selectedTrackId = id; }
    else if (kind === "wish") { view = "finance"; financeTab = "wishes"; }
    else if (kind === "task") { view = "today"; }
    else return;
    render();
    window.scrollTo(0, 0);
  }

  function computeBacklinks(targetKind, targetId) {
    const sources = [];
    const seen = new Set();
    function scan(text, src) {
      const refs = extractRefs(text);
      if (refs.some((r) => r.kind === targetKind && r.id === targetId)) {
        const key = src.kind + ":" + src.id;
        if (!seen.has(key)) { seen.add(key); sources.push(src); }
      }
    }
    (notes ? notes() : []).forEach((n) => scan(n.body || "", { kind: "note", id: n.id, label: n.title || "备忘录" }));
    (openTasks ? openTasks() : []).forEach((t) => scan((t.title || "") + " " + (t.nextStep || ""), { kind: "task", id: t.id, label: t.title || "任务" }));
    (tracks ? tracks() : []).forEach((t) => scan((t.summary || "") + " " + (t.nextAction || ""), { kind: "track", id: t.id, label: t.name || "轨道" }));
    return sources;
  }

  function chipHtml(src) {
    const label = window.esc ? window.esc(src.label) : src.label;
    return `<span class="ref-chip" data-ref-kind="${src.kind}" data-ref-id="${src.id}" title="跳转到${KIND_LABEL[src.kind] || src.kind}">${label}<i class="ref-arrow">↗</i></span>`;
  }

  function backlinksSection(targetKind, targetId) {
    const list = computeBacklinks(targetKind, targetId);
    const items = list.map(chipHtml).join("");
    return `<section class="panel ref-backlinks"><header class="panel-head"><div><h2>被引用</h2><p>哪些内容关联到了这个${KIND_LABEL[targetKind] || "条目"}</p></div></header><div class="ref-backlinks-list">${items || `<p class="fin-empty">还没有其他内容引用它。去备忘录里输入 @ 关联一下。</p>`}</div></section>`;
  }

  function backlinksInline(targetKind, targetId) {
    const list = computeBacklinks(targetKind, targetId);
    if (!list.length) return "";
    const chips = list.slice(0, 4).map(chipHtml).join("");
    return `<div class="ref-back-inline"><span class="ref-back-count">被 ${list.length} 处引用</span>${chips}</div>`;
  }

  function renderRefsPanel(note) {
    if (!note || note.id === "note-new") {
      return `<div class="ref-panel-inner"><p class="ref-hint">在正文里输入 <code>@</code> 可关联任务 / 轨道 / 心愿 / 其他备忘录，这里会显示引用与反向链接。</p></div>`;
    }
    const outgoing = extractRefs(note.body || "");
    const backs = computeBacklinks("note", note.id);
    const outHtml = outgoing.length ? outgoing.map(chipHtml).join("") : `<span class="ref-empty">还没有引用。输入 @ 关联。</span>`;
    const backHtml = backs.length ? backs.map(chipHtml).join("") : `<span class="ref-empty">还没有其他内容引用这条备忘录。</span>`;
    return `<div class="ref-panel-inner">
      <div class="ref-group"><h4>出链（这条引用了）</h4><div class="ref-chips">${outHtml}</div></div>
      <div class="ref-group"><h4>反向链接（被引用）</h4><div class="ref-chips">${backHtml}</div></div>
    </div>`;
  }

  function fillNoteRefs(note) {
    const el = document.getElementById("noteRefs");
    if (el) el.innerHTML = `<div class="ref-panel"><div class="ref-panel-head">引用 / 反向链接</div>${renderRefsPanel(note)}</div>`;
  }

  /* ---------- @ 选择器 ---------- */
  let picker = null; // { ta, start, items, index, popup }

  function closePicker() {
    picker = null;
    const p = document.getElementById("refPicker");
    if (p) p.hidden = true;
  }

  function ensurePickerEl() {
    let p = document.getElementById("refPicker");
    if (!p) {
      p = document.createElement("div");
      p.id = "refPicker";
      p.className = "ref-picker";
      p.hidden = true;
      document.body.appendChild(p);
    }
    return p;
  }

  function sanitizeLabel(s) { return String(s || "").replace(/[|{}]/g, "-").slice(0, 40); }

  function renderPicker() {
    if (!picker) return;
    const { items, index, popup } = picker;
    popup.innerHTML = items.map((it, i) =>
      `<button type="button" class="ref-opt ${i === index ? "active" : ""}" data-ref-opt="${i}"><span class="ref-opt-kind">${KIND_LABEL[it.kind] || it.kind}</span><span class="ref-opt-label">${window.esc ? window.esc(it.label) : it.label}</span></button>`
    ).join("");
  }

  function openPicker(ta, start, query, items) {
    const p = ensurePickerEl();
    picker = { ta, start, items, index: 0, popup: p };
    renderPicker();
    const rect = ta.getBoundingClientRect();
    p.style.top = (window.scrollY + rect.bottom + 6) + "px";
    p.style.left = (window.scrollX + rect.left) + "px";
    p.hidden = false;
  }

  function movePicker(delta) {
    if (!picker) return;
    picker.index = (picker.index + delta + picker.items.length) % picker.items.length;
    renderPicker();
  }

  function selectPicker(optIndex) {
    if (!picker) return;
    const i = optIndex != null ? optIndex : picker.index;
    const ent = picker.items[i];
    if (!ent) return;
    const ta = picker.ta;
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, picker.start);
    const after = ta.value.slice(pos);
    const token = `@ref{${ent.kind}:${ent.id}|${sanitizeLabel(ent.label)}} `;
    ta.value = before + token + after;
    const caret = (before + token).length;
    ta.setSelectionRange(caret, caret);
    ta.focus();
    closePicker();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function evaluateTrigger(ta) {
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const m = before.match(/@([^@\s]*)$/);
    if (!m) { closePicker(); return; }
    const query = m[1].toLowerCase();
    const start = pos - query.length - 1;
    const items = collectEntities().filter((e) => !query || (`${e.label} ${KIND_LABEL[e.kind] || e.kind}`).toLowerCase().includes(query)).slice(0, 8);
    if (!items.length) { closePicker(); return; }
    if (picker && picker.ta === ta) {
      picker.items = items;
      picker.start = start;
      picker.index = Math.min(picker.index, items.length - 1);
      renderPicker();
      picker.popup.hidden = false;
    } else {
      openPicker(ta, start, query, items);
    }
  }

  function init() {
    document.addEventListener("input", (e) => {
      const ta = e.target && e.target.closest ? e.target.closest("[data-block-content],[data-block-title]") : null;
      if (!ta) return;
      if (e.isComposing) return; // IME 合成期间不处理
      evaluateTrigger(ta);
    });
    document.addEventListener("keydown", (e) => {
      if (!picker) return;
      if (e.isComposing) return; // 拼音确认键不拦截
      if (e.key === "ArrowDown") { e.preventDefault(); movePicker(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); movePicker(-1); }
      else if (e.key === "Enter") { e.preventDefault(); selectPicker(); }
      else if (e.key === "Escape") { e.preventDefault(); closePicker(); }
    });
    document.addEventListener("click", (e) => {
      if (e.target && e.target.closest) {
        const opt = e.target.closest("[data-ref-opt]");
        if (opt && picker) { e.preventDefault(); selectPicker(Number(opt.dataset.refOpt)); return; }
        const chip = e.target.closest(".ref-chip");
        if (chip) { e.preventDefault(); openRef(chip.dataset.refKind, chip.dataset.refId); return; }
      }
    });
    document.addEventListener("blur", (e) => {
      if (picker && e.target === picker.ta) {
        setTimeout(() => { if (picker) closePicker(); }, 140);
      }
    }, true);
  }

  window.OOSRefs = {
    collectEntities, extractRefs, renderRefs, openRef, computeBacklinks,
    backlinksSection, backlinksInline, renderRefsPanel, fillNoteRefs, init, REF_RE
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
