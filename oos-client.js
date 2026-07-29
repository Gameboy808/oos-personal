(function exposeOosClient(global) {
  "use strict";

  const VERSION = "oos-unified-v5.1";

  function mutationId(prefix = "hud") {
    const random = global.crypto?.randomUUID?.() || Math.random().toString(16).slice(2);
    return `${prefix}-${Date.now()}-${random}`;
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, { cache: options.method ? undefined : "no-store", ...options });
    let body = {};
    try { body = await response.json(); } catch { /* an empty body is valid for no-content responses */ }
    if (!response.ok) {
      const error = new Error(body.message || body.error || body.code || `HTTP ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  function envelope(state, payload = {}) {
    return {
      ...payload,
      expectedVersion: Number(state?.meta?.version || 0),
      clientMutationId: payload.clientMutationId || mutationId(payload.source === "agent" ? "agent" : "hud")
    };
  }

  async function stateOps(state, ops, summary, options = {}) {
    return requestJson("/api/state-ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope(state, {
        source: options.source || "hud",
        riskLevel: options.riskLevel || "low",
        confirmedMajor: options.confirmedMajor === true,
        summary,
        humanMeaning: options.humanMeaning,
        followUp: options.followUp,
        ops
      }))
    });
  }

  function changeToken(meta) {
    if (meta?.changeToken) return String(meta.changeToken);
    const version = Number(meta?.meta?.version ?? meta?.version ?? 0);
    const queue = meta?.maintenanceQueue || meta?.__maintenanceMeta || meta?.__workerMeta || {};
    return `v:${version}:q:${Number(queue.pending || 0)}:${Number(queue.needsReview || 0)}:${queue.updatedAt || ""}`;
  }

  global.OOSClient = Object.freeze({ VERSION, mutationId, requestJson, envelope, stateOps, changeToken });
})(window);
