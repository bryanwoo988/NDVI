/* node --test tests/*.test.js */
const test = require('node:test');
const assert = require('node:assert');
const {cacheStrategy, cacheKey} = require('../swpolicy.js');
const SELF = 'https://bryanwoo988.github.io';

test('our own files are fetched fresh', () => {
  for(const p of ['/NDVI/', '/NDVI/index.html', '/NDVI/sw.js', '/NDVI/qr.svg', '/NDVI/updatelogic.js?r=1'])
    assert.equal(cacheStrategy(SELF + p, SELF), 'fresh', p);
});
test('live data is never cached', () => {
  for(const u of [
    'https://sh.dataspace.copernicus.eu/ogc/wms/abc?service=WMS&request=GetMap',
    'https://sh.dataspace.copernicus.eu/api/v1/statistics',
    'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
    'https://cdse-token.hockhynnwoo.workers.dev',
    'https://api.open-meteo.com/v1/forecast?latitude=3',
    'https://api.rainviewer.com/public/weather-maps.json',
    'https://tilecache.rainviewer.com/v2/radar/1/256/7/1/1/2/1_1.png',
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/1/1/1',
    'https://a.basemaps.cartocdn.com/light_all/1/1/1.png',
    'https://nominatim.openstreetmap.org/search?q=x',
    'https://places.googleapis.com/v1/places:searchText'
  ]) assert.equal(cacheStrategy(u, SELF), 'never', u);
});
test('pinned libraries and fonts are served from the cache', () => {
  assert.equal(cacheStrategy('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js', SELF), 'immutable');
  assert.equal(cacheStrategy('https://fonts.googleapis.com/css2?family=Manrope', SELF), 'immutable');
  assert.equal(cacheStrategy('https://fonts.gstatic.com/s/manrope/v15/x.woff2', SELF), 'immutable');
});
test('anything else, and anything unparseable, is left alone', () => {
  assert.equal(cacheStrategy('https://example.com/x.js', SELF), 'never');
  assert.equal(cacheStrategy('blob:https://bryanwoo988.github.io/abc', SELF), 'never');
  assert.equal(cacheStrategy('not a url', SELF), 'never');
  assert.equal(cacheStrategy('https://evil-dataspace.copernicus.eu.example.com/x', SELF), 'never');
});
test('one cache entry per file, whatever query it was asked with', () => {
  assert.equal(cacheKey(SELF + '/NDVI/?r=1'), SELF + '/NDVI/');
  assert.equal(cacheKey(SELF + '/NDVI/index.html?x=2#y'), SELF + '/NDVI/index.html');
});
