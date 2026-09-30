/* Regenerate qr.svg if the app's address ever changes (APP_URL in index.html).

     node tools/make-qr.mjs [url]

   Uses the QR encoder from OilPalmWiki (js/qrcode.js), which is verified
   byte-for-byte against segno there, so nothing is downloaded. Its toSVG()
   builds DOM nodes; this writes the same drawing as text so it runs in node. */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { encode } = await import(join(here, '..', '..', 'OilPalmWiki', 'js', 'qrcode.js'));

const text = process.argv[2] || 'https://bryanwoo988.github.io/NDVI/';
const quiet = 2;                                   // the page adds its own white padding
const { size, modules, version } = encode(text);
const dim = size + quiet * 2;
let d = '';
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
  if (modules[y][x] === 1) d += `M${x + quiet},${y + quiet}h1v1h-1z`;
writeFileSync(join(here, '..', 'qr.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img">` +
  `<rect width="${dim}" height="${dim}" fill="#fff"/><path d="${d}" fill="#000"/></svg>\n`);
console.log(`qr.svg: ${text} (version ${version}, ${size}x${size})`);
