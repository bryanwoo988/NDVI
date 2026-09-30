/* Which caching rule a request falls under.

   Split out of sw.js so it can be unit tested (tests/swpolicy.test.js): a
   mistake here fails silently — stale code served as if it were current, or
   a reading from last week shown as today's. */

/* Live data, never cached. A satellite layer, a forecast or a radar frame
   served from a cache would look current and not be. Tiles would also fill
   the device. places.googleapis.com is listed by name because
   fonts.googleapis.com, on the same domain, is cached. */
const NEVER_HOSTS = [
  'dataspace.copernicus.eu',      // Sentinel Hub WMS, Statistical API, OAuth
  'workers.dev',                  // token proxy
  'open-meteo.com',
  'rainviewer.com',
  'arcgisonline.com',
  'basemaps.cartocdn.com',
  'openstreetmap.org',            // Nominatim search
  'places.googleapis.com'
];

/* Version-pinned or content-addressed, so they cannot change under us:
   served from the cache, refreshed quietly behind it. */
const IMMUTABLE = /^https:\/\/(cdnjs\.cloudflare\.com\/ajax\/libs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

function cacheStrategy(urlString, selfOrigin){
  let u;
  try{ u = new URL(urlString); }catch(e){ return 'never'; }
  if(u.protocol !== 'https:' && u.protocol !== 'http:') return 'never';
  if(NEVER_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h))) return 'never';
  if(IMMUTABLE.test(urlString)) return 'immutable';
  if(u.origin === selfOrigin) return 'fresh';
  return 'never';
}

/* The cache key for one of our own files: the URL without its query. Keyed
   by the full URL, "./?r=1" and "./" would be two copies, and an offline start
   could only find the one it happened to be opened with. */
function cacheKey(urlString){
  const u = new URL(urlString);
  u.search = '';
  u.hash = '';
  return u.href;
}

if(typeof module !== 'undefined') module.exports = {cacheStrategy, cacheKey};
