/* node --test tests/*.test.js
   Runs sw.js itself, unmodified, against a fake worker scope: a service worker
   cannot be registered in the development browser, so this is where its
   install, clean-up and fetch routing get exercised. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://bryanwoo988.github.io';
const BASE = ORIGIN + '/NDVI/';

function makeWorker({net}){
  const store = new Map();                    // cacheName -> Map(url -> Response)
  const open = name => {
    if(!store.has(name)) store.set(name, new Map());
    const m = store.get(name);
    const key = r => typeof r === 'string' ? new URL(r, BASE).href : r.url;
    return {
      put: async (r, res) => { m.set(key(r), res); },
      match: async r => { const v = m.get(key(r)); return v ? v.clone() : undefined; },
      add: async r => { const res = await scope.fetch(typeof r === 'string' ? new Request(new URL(r, BASE)) : r);
                        if(!res.ok) throw new Error('bad'); m.set(key(r), res); },
      addAll: async rs => { for(const r of rs) await open(name).add(r); }
    };
  };
  const handlers = {};
  const scope = {
    location: new URL(BASE + 'sw.js'),
    addEventListener: (t, h) => { handlers[t] = h; },
    skipWaiting: () => {},
    clients: {claim: async () => {}},
    caches: {
      open: async n => open(n),
      keys: async () => [...store.keys()],
      delete: async n => store.delete(n),
      match: async r => { for(const n of store.keys()){ const v = await open(n).match(r); if(v) return v; } }
    },
    fetch: async (r, opts) => {
      const url = typeof r === 'string' ? r : r.url;
      scope.fetchLog.push({url, cache: (opts && opts.cache) || (r.cache) || 'default'});
      return net(url);
    },
    fetchLog: [],
    importScripts: f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx),
    /* in a worker, a relative URL resolves against the worker's own location */
    Request: class extends Request { constructor(u, o){ super(typeof u === 'string' ? new URL(u, BASE).href : u, o); } },
    Response, URL, setTimeout, clearTimeout, Promise, console
  };
  scope.self = scope;
  const ctx = vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), ctx);
  const fire = async (type, extra) => {
    let waited = null, responded = null;
    const ev = Object.assign({waitUntil: p => { waited = p; }, respondWith: p => { responded = p; }}, extra);
    handlers[type](ev);
    if(waited) await waited;
    return responded ? await responded : undefined;
  };
  return {store, fire, scope};
}
const ok = body => new Response(body, {status: 200});
const navReq = u => ({url: u, method: 'GET', mode: 'navigate'});

test('install caches every shell file fresh from the server, and all-or-nothing', async () => {
  const w = makeWorker({net: async u => ok('v2:' + u)});
  await w.fire('install');
  const shell = w.store.get('ndvi-shell');
  for(const f of ['', 'index.html', 'swpolicy.js', 'updatelogic.js', 'qr.svg', 'manifest.webmanifest'])
    assert.ok(shell.has(BASE + f), 'cached ' + f);
  const own = w.scope.fetchLog.filter(x => x.url.startsWith(BASE));
  assert.ok(own.length && own.every(x => x.cache === 'reload'), 'own files skip the HTTP cache');

  const broken = makeWorker({net: async u => u.endsWith('qr.svg') ? new Response('', {status: 404}) : ok('x')});
  await assert.rejects(broken.fire('install'), 'a half-cached build must not install');
});

test('activate removes the old hand-versioned caches', async () => {
  const w = makeWorker({net: async () => ok('x')});
  for(const n of ['ndvi-shell-v33', 'onesoil-shell-v33', 'ndvi-shell']) await (await w.scope.caches.open(n)).put(BASE, ok('x'));
  await w.fire('activate');
  assert.deepEqual([...w.store.keys()], ['ndvi-shell']);
});

test('our files: the network wins when it answers, and refreshes the cache', async () => {
  const w = makeWorker({net: async () => ok('NEW')});
  await (await w.scope.caches.open('ndvi-shell')).put(BASE + 'index.html', ok('OLD'));
  const res = await w.fire('fetch', {request: new Request(BASE + 'index.html')});
  assert.equal(await res.text(), 'NEW');
  assert.equal(w.scope.fetchLog.at(-1).cache, 'no-cache', 'revalidated, not answered from the HTTP cache');
  await new Promise(r => setTimeout(r, 10));
  assert.equal(await (await w.scope.caches.match(BASE + 'index.html')).text(), 'NEW');
});

test('our files: offline, the cached copy is served', async () => {
  const w = makeWorker({net: async () => { throw new TypeError('offline'); }});
  await (await w.scope.caches.open('ndvi-shell')).put(BASE + 'index.html', ok('CACHED'));
  const res = await w.fire('fetch', {request: new Request(BASE + 'index.html')});
  assert.equal(await res.text(), 'CACHED');
});

test('a navigation with a query, offline, still opens the app', async () => {
  const w = makeWorker({net: async () => { throw new TypeError('offline'); }});
  await (await w.scope.caches.open('ndvi-shell')).put(BASE + 'index.html', ok('APP'));
  const res = await w.fire('fetch', {request: navReq(BASE + '?from=home')});
  assert.equal(await res.text(), 'APP');
});

test('our files: a dead-slow network falls back to the cache at the timeout', async () => {
  const w = makeWorker({net: () => new Promise(r => setTimeout(() => r(ok('LATE')), 4000))});
  await (await w.scope.caches.open('ndvi-shell')).put(BASE + 'index.html', ok('CACHED'));
  const t0 = Date.now();
  const res = await w.fire('fetch', {request: new Request(BASE + 'index.html')});
  assert.equal(await res.text(), 'CACHED');
  assert.ok(Date.now() - t0 < 3500, 'served at the 2.5 s timeout, not after the network');
});

test('live data is never intercepted', async () => {
  const w = makeWorker({net: async () => ok('x')});
  for(const u of ['https://sh.dataspace.copernicus.eu/ogc/wms/x?request=GetMap',
                  'https://api.open-meteo.com/v1/forecast', 'https://cdse-token.hockhynnwoo.workers.dev'])
    assert.equal(await w.fire('fetch', {request: new Request(u)}), undefined, u);
  assert.equal(await w.fire('fetch', {request: new Request(BASE, {method: 'POST', body: 'x'})}), undefined, 'POST');
});
