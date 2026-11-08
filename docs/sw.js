// Offline shell. The build id below is stamped at build time so each deploy is detected as an update.
const BUILD = "1794156791585";
const CACHE = "aykor-khata-" + BUILD;
const ASSETS = ["./assets/hind-siliguri-bengali-400-normal-qtENw2Fc.woff","./assets/hind-siliguri-bengali-400-normal-rHQ7AW0H.woff2","./assets/hind-siliguri-bengali-600-normal-DLZF4s8q.woff2","./assets/hind-siliguri-bengali-600-normal-D_VSXRuy.woff","./assets/hind-siliguri-latin-400-normal-B2m00w2e.woff","./assets/hind-siliguri-latin-400-normal-esES0U7a.woff2","./assets/hind-siliguri-latin-600-normal-Cgt-s7Wl.woff","./assets/hind-siliguri-latin-600-normal-DHrLfb92.woff2","./assets/index-CMgfJHc4.js","./assets/index-ChLajY4N.css","./assets/papaparse.min-ByR08rpR.js","./assets/pdf-BPz4r3pH.js","./assets/pdf-p4e7IUqL.js","./assets/pdf.worker.min-CiNja6b-.js","./assets/pdf.worker.min-DKQKFyKK.js","./assets/tiro-bangla-bengali-400-normal-CIbHCMPl.woff","./assets/tiro-bangla-bengali-400-normal-v3lAayBG.woff2","./assets/tiro-bangla-latin-400-normal-1lYSvEyl.woff2","./assets/tiro-bangla-latin-400-normal-DSiOXPjq.woff","./assets/xlsx-OBRp1OTM.js"]; // every built file, listed at build time so the app opens offline from the first visit
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
