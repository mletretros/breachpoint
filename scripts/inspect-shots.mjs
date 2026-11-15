// Structural check of the four judged frames: instead of eyeballing the JPEG we ask the
// live page what it actually rendered — HUD field values, how many meshes the renderer
// submitted, and whether the first-person viewmodel is visible from the active camera.
// Tests only; nothing here ships to the judge.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import puppeteer from '/root/fp-test/node_modules/puppeteer/lib/puppeteer/puppeteer.js';

const ROOT = new URL('../game/', import.meta.url).pathname;
const PORT = 8124;
const SHOTS = [
  { name: '1-buy-phase', query: 'shot=buy&seed=7' },
  { name: '2-mid-lane', query: 'shot=play&seed=11' },
  { name: '3-site-b7', query: 'shot=site&seed=3' },
  { name: '4-round-end', query: 'shot=end&seed=5' },
];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(ROOT, normalize(path === '/' ? '/index.html' : path).replace(/^(\.[/\\])+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const browser = await puppeteer.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1148/chrome-linux/chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

for (const shot of SHOTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html?${shot.query}`, { waitUntil: 'load' });
  let ready = false;
  try {
    await page.waitForFunction('window.__shotReady === true', { timeout: 30000 });
    ready = true;
  } catch {
    ready = false;
  }
  const probe = await page.evaluate(() => {
    const text = (sel) => (document.querySelector(sel)?.textContent ?? '').trim();
    const ids = {};
    for (const el of document.querySelectorAll('[id]')) {
      const t = (el.textContent ?? '').trim();
      if (t && t.length < 24) ids[el.id] = t;
    }
    const canvas = document.querySelector('canvas');
    let px = null;
    if (canvas) {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 36;
      const ctx = c.getContext('2d');
      ctx.drawImage(canvas, 0, 0, 64, 36);
      const d = ctx.getImageData(0, 0, 64, 36).data;
      let lum = 0;
      let uniq = new Set();
      for (let i = 0; i < d.length; i += 4) {
        lum += (d[i] + d[i + 1] + d[i + 2]) / 3;
        uniq.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
      }
      px = { meanLuma: Math.round(lum / (d.length / 4)), distinctColors: uniq.size };
    }
    return { state: window.__shotState ?? null, hud: ids, canvasPixels: px, bodyText: document.body.innerText.slice(0, 300) };
  });
  console.log(`\n=== ${shot.name} ready=${ready} errors=${errors.length ? errors.join(' | ') : 'none'}`);
  console.log('state:', JSON.stringify(probe.state));
  console.log('hud:', JSON.stringify(probe.hud));
  console.log('pixels:', JSON.stringify(probe.canvasPixels));
  if (errors.length) console.log('pageErrors:', errors.join(' | '));
  await page.close();
}

await browser.close();
server.close();
