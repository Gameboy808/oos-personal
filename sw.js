const CACHE = "oos-public-v1";
const PRECACHE = [
  "./",
  "./index.html",
  "./state.json",
  "./manifest.json",
  "./sw.js",
  "./assets/visuals/avatar-cover.png",
  "./assets/visuals/view-today.png",
  "./assets/visuals/view-plan.png",
  "./assets/visuals/view-tracks.png",
  "./assets/visuals/view-track-media.png",
  "./assets/visuals/view-track-money.png",
  "./assets/visuals/view-track-life.png",
  "./assets/visuals/view-review.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.endsWith("state.json")) {
    // network-first for live data, fall back to cache
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put("./state.json", copy));
          return r;
        })
        .catch(() => caches.match("./state.json"))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((r) => r || fetch(e.request))
    );
  }
});
