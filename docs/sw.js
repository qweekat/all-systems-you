// Keeps the app's own files on the device so it opens with no internet. Health data is never sent anywhere.
const CACHE = "all-systems-you-0.1.0-fc9caab4ef";
const FILES = ["./", "index.html", "pantry.html", "checker.html", "sources.html", "manifest.webmanifest", "qrcode.js", "icons/icon-180.png", "icons/icon-512.png", "icons/daily-helper.svg"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // fonts and anything else outside the app: browser default
  if (url.pathname.includes("/api/")) return; // a computer host's live data, never cached
  e.respondWith(caches.match(e.request, {ignoreSearch: true}).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  })));
});
