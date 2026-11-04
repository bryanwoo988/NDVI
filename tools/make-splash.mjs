// Renders the splash in index.html into iOS launch images (apple-touch-startup-image),
// one per iPhone screen size, and writes the matching <link> tags into index.html.
// Same scheme as AnyScan. Run after changing the splash: node tools/make-splash.mjs
//
// The images carry only the logo and the name. A launch image cannot follow the
// language chosen in the app, so the tagline is left to the live splash, which
// fades it in over the image.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

// Playwright is resolved via require so a globally installed copy works too.
const { chromium } = createRequire(import.meta.url)('playwright')

const root = new URL('..', import.meta.url).pathname
const indexPath = `${root}index.html`
let html = readFileSync(indexPath, 'utf8')
const css = html.match(/<style id="splash-css">([\s\S]*?)<\/style>/)[1]
const logo = `data:image/png;base64,${readFileSync(`${root}icon-192.png`).toString('base64')}`
const markup = `<div id="splash"><div class="splash-logo"><img src="${logo}" alt=""></div>
  <div class="splash-name">NDVI</div><div class="splash-tag">&nbsp;</div><div class="splash-upd"></div></div>`

// CSS width × height (portrait) and pixel ratio of each iPhone screen.
const DEVICES = [
  [440, 956, 3], // 16 Pro Max
  [402, 874, 3], // 16 Pro
  [430, 932, 3], // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [390, 844, 3], // 12, 12 Pro, 13, 13 Pro, 14
  [375, 812, 3], // X, XS, 11 Pro, 12 mini, 13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [414, 736, 3], // 6/7/8 Plus
  [375, 667, 2], // 6/7/8, SE 2nd/3rd gen
]

mkdirSync(`${root}splash`, { recursive: true })
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const links = []
for (const [w, h, dpr] of DEVICES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0}${css}</style></head><body>${markup}</body></html>`)
  await page.waitForTimeout(100)
  const name = `splash-${w * dpr}x${h * dpr}.png`
  await page.screenshot({ path: `${root}splash/${name}` })
  await page.close()
  links.push(`<link rel="apple-touch-startup-image" href="./splash/${name}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)">`)
}
await browser.close()

html = html.replace(/<!--SPLASH-LINKS-->[\s\S]*?<!--\/SPLASH-LINKS-->/, `<!--SPLASH-LINKS-->\n${links.join('\n')}\n<!--/SPLASH-LINKS-->`)
writeFileSync(indexPath, html)
console.log(`wrote ${DEVICES.length} launch images`)
