// Screenshot capture for the judge's dossier: serves game/ over http, opens it in headless
// Chrome with a software GL backend, and shoots the deterministic frames main.js exposes
// through ?shot=…&seed=…, each of which sets window.__shotReady once painted twice.
//
// The gate wants 3 or 4 images, long side at most 1280, short side at least 480, each at
// most 256 KiB, so 1280x720 JPEG at quality 88 lands inside all three limits.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import puppeteer from '/root/fp-test/node_modules/puppeteer/lib/puppeteer/puppeteer.js';

const ROOT = new URL('../game/', import.meta.url).pathname;
const OUT = new URL('../screenshots/', import.meta.url).pathname;
const PORT = 8123;
const SHOTS = [
  { name: '1-buy-phase.jpg', query: 'shot=buy&seed=7' },
  { name: '2-mid-lane.jpg', query: 'shot=play&seed=11' },
  { name: '3-site-b7.jpg', query: 'shot=site&seed=3' },
  { name: '4-round-end.jpg', query: 'shot=end&seed=5' },
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(ROOT, normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.[/\\])+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/root/.cache/ms-playwright/chromium-1148/chrome-linux/chrome',
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--hide-scrollbars',
    '--disable-dev-shm-usage',
    '--disable-gpu-sandbox',
    '--force-device-scale-factor=1',
  ],
});

for (const shot of SHOTS) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?${shot.query}`, { waitUntil: 'load', timeout: 45000 });
  try {
    await page.waitForFunction('window.__shotReady === true', { timeout: 45000 });
  } catch {
    errors.push('__shotReady never set');
  }
  await page.screenshot({ path: join(OUT, shot.name), type: 'jpeg', quality: 88 });
  console.log(`${shot.name}${errors.length ? `  ERRORS: ${errors.slice(0, 4).join(' | ')}` : '  ok'}`);
  await page.close();
}

await browser.close();
server.close();
