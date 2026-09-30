/* node --test tests/*.test.js */
const test = require('node:test');
const assert = require('node:assert');
const {newerRevision, updateAction, mayAutoReload, JUST_MS, RETRY_MS} = require('../updatelogic.js');

test('a newer Last-Modified is an update', () => {
  // document.lastModified is local "MM/DD/YYYY hh:mm:ss"; the HEAD reply is an HTTP date
  const running = new Date(Date.UTC(2026, 9, 1, 2, 0, 0));
  const fmt = d => `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()} ` +
                   `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  const live = new Date(running.getTime() + 60e3).toUTCString();
  assert.equal(newerRevision(fmt(running), live), true);
});
test('the same revision, an older one, or noise is not an update', () => {
  const t = new Date(Date.UTC(2026, 9, 1, 2, 0, 0));
  assert.equal(newerRevision(t.toUTCString(), t.toUTCString()), false);
  assert.equal(newerRevision(t.toUTCString(), new Date(t - 60e3).toUTCString()), false, 'rollback is not pushed');
  assert.equal(newerRevision(t.toUTCString(), new Date(t.getTime() + 500).toUTCString()), false, 'sub-second jitter');
  assert.equal(newerRevision('', t.toUTCString()), false);
  assert.equal(newerRevision(t.toUTCString(), null), false);
  assert.equal(newerRevision('garbage', 'also garbage'), false);
});
test('what to do with a live update', () => {
  assert.equal(updateAction({hidden:true,  asked:true,  busy:false, sinceVisibleMs:0}), 'defer');
  assert.equal(updateAction({hidden:false, asked:true,  busy:true,  sinceVisibleMs:1e6}), 'apply');
  assert.equal(updateAction({hidden:false, asked:false, busy:false, sinceVisibleMs:JUST_MS}), 'apply');
  assert.equal(updateAction({hidden:false, asked:false, busy:true,  sinceVisibleMs:0}), 'banner', 'mid-task');
  assert.equal(updateAction({hidden:false, asked:false, busy:false, sinceVisibleMs:JUST_MS + 1}), 'banner', 'in use');
});
test('an automatic reload is tried once per version per ten minutes', () => {
  const now = 1e12;
  assert.equal(mayAutoReload(null, 'A', now), true);
  assert.equal(mayAutoReload({v:'A', at:now - 1000}, 'A', now), false);
  assert.equal(mayAutoReload({v:'A', at:now - RETRY_MS}, 'A', now), true);
  assert.equal(mayAutoReload({v:'A', at:now - 1000}, 'B', now), true, 'a different version');
});
