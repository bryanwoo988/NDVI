# Release rule

Every change that ships to users adds an entry at the top of `RELEASES` in `index.html`:
the new version number, today's date (YYYY-MM-DD), and what changed in plain
words for users, in every language the app supports. After the update the app
shows these notes once ("what's new" sheet: version, date, changes), and the
About/Settings screen shows the current version and the full history.

Each entry also carries `at`: the moment of the release in UTC, as an ISO
instant (`date -u +%Y-%m-%dT%H:%M:00Z`). The app shows it in the phone's own
time zone. `date` is the release day in Malaysia (UTC+8), not the build
machine's UTC day: after 16:00 UTC that is the next day.

Version numbers: bug fixes bump the last digit, new features the middle one.

Shared standard for all of Bryan Woo's apps (including new ones):
https://github.com/bryanwoo988/woobrothers.my/blob/main/APP-STANDARDS.md
