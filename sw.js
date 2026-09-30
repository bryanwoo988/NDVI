/* NDVI — service worker.

   The shell is cached so the app opens offline. Live data (Sentinel Hub,
   Open-Meteo, RainViewer, map tiles, place search) is NEVER cached, so a stale
   reading can never be shown as if it were current (swpolicy.js).

   No release number here. This used to be cache-first under a hand-bumped
   name (ndvi-shell-v33): a new build needed two launches to show, and a
   release that forgot to bump the name never reached installed phones. Now
   every request for our own files is revalidated with the server (network
   first, 'no-cache'), and the page notices a new revision from index.html's
   Last-Modified (updatelogic.js) — so this file changes only when the
   worker's own logic does. Same scheme as CompareCast and Oil Palm Basics. */
const SHELL = 'ndvi-shell';
const SHELL_FILES = [
  './', './index.html', './swpolicy.js', './updatelogic.js', './manifest.webmanifest',
  './favicon.png', './apple-touch-icon.png', './icon-192.png', './icon-512.png', './qr.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap'
];
/* Unguarded, a failed import takes the whole worker down, and offline support
   with it. The policy file is in the shell, so this only bites on a cold
   install over a bad connection; not intercepting at all keeps the app
   working online until a later launch repairs the worker. */
try{ importScripts('./swpolicy.js'); }catch(e){}
const strategyFor = (typeof cacheStrategy === 'function') ? cacheStrategy : (() => 'never');
const keyFor = (typeof cacheKey === 'function') ? cacheKey : (u => u);

/* How long to wait for the network before falling back to the cache. Long
   enough for a slow rural connection to win, short enough that a dead one
   does not leave the user looking at nothing. */
const NET_TIMEOUT_MS = 2500;

/* Our own files must all be cached or the install is abandoned. Tolerating a
   failure here would let a half-cached build activate on a weak signal and
   delete the previous, complete cache — and the next launch without signal,
   out in the field, would find no app. Refusing keeps the old worker and its
   whole cache serving until a later attempt gets everything.

   'reload' skips the HTTP cache: GitHub Pages allows ten minutes of it, long
   enough to install a new worker around the old build's files.

   Third-party files stay best-effort: the map and the fonts can load them
   from the network later. */
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    const remote = u => /^https?:/.test(u);
    await c.addAll(SHELL_FILES.filter(u => !remote(u)).map(u => new Request(u, {cache:'reload'})));
    await Promise.all(SHELL_FILES.filter(remote).map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    /* the versioned caches of earlier builds ('ndvi-shell-v33', 'onesoil-…') go */
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== SHELL).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const how = strategyFor(req.url, self.location.origin);
  if(how === 'never') return;

  if(how === 'immutable'){
    e.respondWith((async () => {
      const cached = await caches.match(req);
      /* Only a response whose status can be read and is a success replaces
         the cached copy: an opaque CDN error cannot be told from a good file,
         and storing one would replace a working Leaflet with a broken one.
         Leaflet is requested with crossorigin, so its real status is there. */
      const net = fetch(req).then(res => {
        if(res && res.ok)
          caches.open(SHELL).then(c => c.put(req, res.clone())).catch(() => {});
        return res;
      }).catch(() => null);
      if(cached) return cached;
      return (await net) || new Response('Offline', {status:503});
    })());
    return;
  }

  /* Our own files: network first, so the first launch after a deploy gets the
     new code, and the cache is the fallback rather than the default. */
  e.respondWith((async () => {
    const cached = await caches.match(keyFor(req.url));
    let timer;
    const timeout = new Promise(r => { timer = setTimeout(() => r(null), NET_TIMEOUT_MS); });
    /* 'no-cache' asks the server every time (a cheap 304 when nothing changed).
       GitHub Pages marks every file max-age=600, and a plain fetch could answer
       from the browser's HTTP cache for those ten minutes — "network first"
       that still served the old build. A navigation request cannot be re-made
       with options, so it is fetched by URL. */
    const net = (req.mode === 'navigate'
        ? fetch(req.url, {cache:'no-cache', credentials:'same-origin'})
        : fetch(req, {cache:'no-cache'})).then(res => {
      if(res && res.ok) caches.open(SHELL).then(c => c.put(keyFor(req.url), res.clone())).catch(() => {});
      return res && res.ok ? res : null;
    }).catch(() => null);

    const fresh = await Promise.race([net, timeout]);
    clearTimeout(timer);
    if(fresh) return fresh;
    if(cached) return cached;
    /* nothing cached and nothing yet on the wire: let a slow network finish
       rather than failing at the timeout */
    const late = await net;
    if(late) return late;
    if(req.mode === 'navigate'){
      const fallback = await caches.match(keyFor(new URL('./index.html', self.location).href));
      if(fallback) return fallback;
    }
    return new Response('Offline', {status:503, statusText:'Offline'});
  })());
});
