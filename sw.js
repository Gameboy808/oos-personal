/*
 * OOS 公网版 Service Worker
 * - 导航请求走 network-first（保证每次拿到最新页面）
 * - 静态资源走 cache-first（离线也能开）
 * - CACHE_VERSION 变动即强制刷新缓存
 */
const CACHE_VERSION = "oos-white-v20";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./state.json",
  "./static-shim.js",
  "./styles.css",
  "./calendar.css",
  "./public-overrides.css",
  "./app.js",
  "./calendar-engine.js",
  "./calendar-ui.js",
  "./oos-client.js",
  "./oos-enhance.js",
  "./oos-modules.js",
  "./oos-sync.js",
  "./favicon.svg",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp.ok && url.origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
