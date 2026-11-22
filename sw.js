// Service worker: strona działa offline; pliki wyników zawsze najpierw z sieci (zapas w localStorage).
const SHELL = "typer-shell-v1";
const FILES = ["./", "index.html", "styles.css", "app.js", "i18n.js", "easter.js", "manifest.webmanifest",
  "img/bundesliga.png", "img/k.jpg", "img/favicon.png", "img/icon-192.png", "fonts/Poppins-Regular.ttf",
  "fonts/Poppins-Medium.ttf", "fonts/Poppins-Bold.ttf"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => null)))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== SHELL).map(x => caches.delete(x)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/data/")) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(SHELL).then(x => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match("index.html"))));
});
