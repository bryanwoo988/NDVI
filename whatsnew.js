/* whatsnew.js — the "what's new" sheet shared by Bryan Woo's apps.

   After an update lands, the first launch shows a sheet with each new
   version, its date and what changed, so nobody has to guess whether the
   app moved. Self-contained: no dependencies, its own styles, works offline.

   Each app keeps its release list next to its code, newest first:
     { v: '1.2.0', date: '2026-10-13', notes: { zh: [...], en: [...], ms: [...] } }
   (zht for 繁體 is optional and falls back to zh; a missing language falls
   back to en, then zh.)

   WhatsNew.init({ version, releases, lang, key, isNewUser })
     version    the version this code is — must equal releases[0].v
     lang       () => 'zh' | 'zht' | 'en' | 'ms'
     key        localStorage key that remembers the last version shown
     isNewUser  () => true for a first-ever launch: nothing to catch up on
   WhatsNew.history()  opens the full list (for an About / Settings link) */
(function () {
  'use strict';

  var UI = {
    zh: { updated: '已更新到 v{v}', history: '更新记录', ok: '知道了', close: '关闭' },
    zht: { updated: '已更新到 v{v}', history: '更新記錄', ok: '知道了', close: '關閉' },
    en: { updated: 'Updated to v{v}', history: "What's new", ok: 'OK', close: 'Close' },
    ms: { updated: 'Dikemas kini ke v{v}', history: 'Apa yang baharu', ok: 'OK', close: 'Tutup' },
  };

  var cfg = null;

  // Numeric compare of dotted versions: '1.10.0' > '1.9.2'.
  function cmp(a, b) {
    var x = String(a || '').split('.'), y = String(b || '').split('.');
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  // Releases newer than `seen`, newest first.
  function notesSince(releases, seen) {
    return (releases || []).filter(function (r) { return !seen || cmp(r.v, seen) > 0; });
  }

  function notesIn(r, lang) {
    var n = r.notes || {};
    return n[lang] || (lang === 'zht' && n.zh) || n.en || n.zh || [];
  }

  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) { /* private mode: shown again next time, harmless */ }
    return null;
  }

  // Light or dark, read from the page itself so it matches each app's own theme.
  function isDark() {
    var els = [document.body, document.documentElement];
    for (var i = 0; i < els.length; i++) {
      if (!els[i]) continue;
      var m = getComputedStyle(els[i]).backgroundColor.match(/[\d.]+/g);
      if (m && m.length >= 3 && (m[3] === undefined || +m[3] > 0.1)) {
        return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2] < 128;
      }
    }
    return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }

  var CSS = '' +
    '.wn-scrim{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;animation:wn-fade .2s ease}' +
    '@media(min-width:600px){.wn-scrim{align-items:center}}' +
    '.wn-card{box-sizing:border-box;width:100%;max-width:460px;max-height:82vh;display:flex;flex-direction:column;background:#fff;color:#1c1c1e;border-radius:18px 18px 0 0;' +
    'padding:20px 20px calc(16px + env(safe-area-inset-bottom));font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;' +
    'box-shadow:0 -8px 30px rgba(0,0,0,.25);animation:wn-up .25s ease}' +
    '@media(min-width:600px){.wn-card{border-radius:18px}}' +
    '.wn-dark .wn-card{background:#1f2023;color:#f2f2f4}' +
    '.wn-card h2{margin:0 0 6px;font-size:19px;line-height:1.3}' +
    '.wn-list{overflow-y:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;padding:0 4px}' +
    '.wn-ver{margin:14px 0 6px;font-weight:700;font-size:15px}' +
    '.wn-ver span{font-weight:400;opacity:.65;margin-left:8px;font-size:13.5px}' +
    '.wn-list ul{margin:0;padding-left:20px}' +
    '.wn-list li{margin:0 0 6px}' +
    '.wn-ok{margin-top:14px;align-self:stretch;border:0;border-radius:12px;padding:12px;font:inherit;font-weight:600;font-size:16px;background:#2f7d4f;color:#fff;cursor:pointer}' +
    '@keyframes wn-fade{from{opacity:0}}@keyframes wn-up{from{transform:translateY(40px);opacity:.4}}';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function sheet(title, list, lang) {
    if (document.querySelector('.wn-scrim')) return;
    if (!document.getElementById('wn-style')) {
      var st = el('style'); st.id = 'wn-style'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    var ui = UI[lang] || UI.en;
    var scrim = el('div', 'wn-scrim' + (isDark() ? ' wn-dark' : ''));
    var card = el('div', 'wn-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    var h = el('h2', null, title);
    h.id = 'wn-title';
    card.setAttribute('aria-labelledby', 'wn-title');
    var body = el('div', 'wn-list');
    list.forEach(function (r) {
      var head = el('div', 'wn-ver', 'v' + r.v);
      if (r.date) head.appendChild(el('span', null, r.date));
      var ul = el('ul');
      notesIn(r, lang).forEach(function (t) { ul.appendChild(el('li', null, t)); });
      body.appendChild(head);
      body.appendChild(ul);
    });
    var ok = el('button', 'wn-ok', ui.ok);
    ok.type = 'button';
    function close() {
      scrim.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    ok.onclick = close;
    scrim.onclick = function (e) { if (e.target === scrim) close(); };
    document.addEventListener('keydown', onKey);
    card.appendChild(h);
    card.appendChild(body);
    card.appendChild(ok);
    scrim.appendChild(card);
    document.body.appendChild(scrim);
    ok.focus();
  }

  function lang() {
    var l = cfg && cfg.lang ? cfg.lang() : 'en';
    return UI[l] ? l : 'en';
  }

  window.WhatsNew = {
    cmp: cmp,
    notesSince: notesSince,

    init: function (c) {
      cfg = c;
      var seen = store(c.key);
      if (seen === c.version) return;
      // A first-ever launch has nothing to catch up on.
      if (!seen && c.isNewUser && c.isNewUser()) { store(c.key, c.version); return; }
      // Someone from before this sheet existed sees what this version brought.
      var list = (seen ? notesSince(c.releases, seen) : c.releases.slice(0, 1)).slice(0, 5);
      if (!list.length) { store(c.key, c.version); return; }
      // Marked as seen only once it is on screen: a reload in between (a new
      // service worker taking over) must not swallow it.
      var show = function () {
        store(c.key, c.version);
        sheet((UI[lang()] || UI.en).updated.replace('{v}', c.version), list, lang());
      };
      if (document.readyState === 'complete') setTimeout(show, c.delay || 800);
      else window.addEventListener('load', function () { setTimeout(show, c.delay || 800); });
    },

    history: function () {
      if (!cfg) return;
      sheet((UI[lang()] || UI.en).history, cfg.releases, lang());
    },

    // "v1.2.0 · 2026-10-13" for an About page; works before init() too.
    label: function (releases) {
      var list = releases || (cfg && cfg.releases) || [];
      var r = list[0];
      if (!r) return '';
      return 'v' + r.v + (r.date ? ' · ' + r.date : '');
    },
  };
})();
