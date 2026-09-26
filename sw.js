/* OneSoil — offline shell.
   Caches only the app shell (this page, Leaflet, fonts).
   Live data (Sentinel Hub, Open-Meteo, RainViewer, map tiles) is NEVER cached,
   so you can never be shown a stale reading that looks current. */
const CACHE = "onesoil-shell-v9";
const SHELL_HOSTS = ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => self.skipWaiting());

self.addEventListener("activate", e => e.waitUntil(
  caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  const isShell = e.request.mode === "navigate"
    || url.origin === self.location.origin
    || SHELL_HOSTS.includes(url.host);
  if (!isShell) return;                       // live data goes straight to the network
  e.respondWith(
    caches.open(CACHE).then(c => c.match(e.request).then(hit => {
      const net = fetch(e.request)
        .then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })
        .catch(() => hit);
      return hit || net;                      // cache first, refresh in background
    }))
  );
});
