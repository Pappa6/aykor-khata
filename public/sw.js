// Offline shell. The build id below is stamped at build time so each deploy is detected as an update.
const BUILD = "__BUILD__";
const CACHE = "aykor-khata-" + BUILD;
const ASSETS = __ASSETS__; // every built file, listed at build time so the app opens offline from the first visit
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./rules/rules.json"].concat(ASSETS);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // never touch other origins
  // The rules file is always fetched fresh when online, so a corrected rule reaches everyone.
  if (url.pathname.endsWith("/rules/rules.json")) {
    e.respondWith(
      fetch(req, { cache: "no-store" })
        .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return r; })
        .catch(() => caches.match(req, { ignoreVary: true })),
    );
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreVary: true }).then((hit) =>
      hit ||
      fetch(req).then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return r;
      }).catch(() => (req.mode === "navigate" ? caches.match("./index.html") : Response.error())),
    ),
  );
});
