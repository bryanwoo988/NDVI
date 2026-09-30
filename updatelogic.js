/* Getting a new build onto phones that already have the app open.

   The service worker used to be cache-first with a hand-bumped version
   (ndvi-shell-v33): an update needed two launches to show, and a release
   that forgot to bump the number never reached anyone who had installed the
   app. An iPhone also resumes a home-screen app far more often than it
   relaunches it, so it could run last week's code for days. The page now asks
   the server which build is live when it opens, whenever it comes back to the
   screen, and every quarter hour in use; these functions decide what that
   check means. Same rules as CompareCast and Oil Palm Basics. */

/* Whether the index.html live on the server is a newer revision than the one
   this page is running.

   Both are index.html's Last-Modified, which GitHub Pages sets on every
   deploy: the running one from document.lastModified ("MM/DD/YYYY hh:mm:ss",
   local time), the live one from a HEAD request (an HTTP date). A revision
   needs nobody to remember anything. Only a newer one counts — a rollback is
   not pushed onto phones — and anything unreadable counts as no update. */
function newerRevision(running, live){
  const a = Date.parse(String(running || '')), b = Date.parse(String(live || ''));
  return isFinite(a) && isFinite(b) && b - a >= 1000;
}

/* What to do once a newer build is known to be live.

   apply  — reload now: the app has just been opened or brought back, or the
            user asked, so nothing is being interrupted
   banner — say a new version is ready, with a button: someone mid-task (a
            sheet open, a field being drawn, a box being typed in) is never
            yanked out of what they are doing
   defer  — in the background: decide again when the app comes back

   "Just" is three seconds — long enough to cover the check itself. */
const JUST_MS = 3000;
function updateAction(s){
  if(s.hidden) return 'defer';
  if(s.asked) return 'apply';
  if(!s.busy && s.sinceVisibleMs <= JUST_MS) return 'apply';
  return 'banner';
}

/* An automatic reload is tried once per version per ten minutes. Without a
   service worker in control — private browsing, a first visit — the browser's
   HTTP cache can serve the old files for up to ten minutes after a deploy
   (GitHub Pages sends max-age=600); reloading again would land on the old
   build, see the new one live, and reload again, in a loop. After one try the
   update is offered instead, and a tap on it always goes through. */
const RETRY_MS = 10 * 60e3;
function mayAutoReload(tried, v, now){
  return !(tried && tried.v === v && now - tried.at < RETRY_MS);
}

if(typeof module !== 'undefined') module.exports = {newerRevision, updateAction, mayAutoReload, JUST_MS, RETRY_MS};
