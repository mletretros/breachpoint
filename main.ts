// Breachpoint: VANTA vs HALO on Cinder Yard.
// This program packages the game for the grader. It copies game/ and screenshots/
// into the output directory and writes dossier.json, the artifact the judge reads.
// It also enforces constraints on file sizes, counts, and off-disk references.
//
// Run it locally: node serve.ts, then MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const MAX_FILES = 993;
const MAX_GAME_BYTES = 50331648; // 48 MiB
const INDEX_MAX_BYTES = 1048576; // 1 MiB
const SCREENSHOT_MAX_BYTES = 262144; // 256 KiB
const SCREENSHOT_MAX_COUNT = 4;
const SCREENSHOT_MIN_COUNT = 3;

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// 1. Capture screenshots check
const screenshots = join(here, 'screenshots');
if (!existsSync(screenshots)) throw new Error('Capture screenshots before building the dossier');
const captures = readdirSync(screenshots).filter(name => !name.startsWith('.'));
if (captures.length < SCREENSHOT_MIN_COUNT || captures.length > SCREENSHOT_MAX_COUNT) {
  throw new Error('Expected three or four browser captures');
}
for (const name of captures) {
  const info = lstatSync(join(screenshots, name));
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|jpe?g)$/i.test(name) || !info.isFile() || info.size > SCREENSHOT_MAX_BYTES) {
    throw new Error(`Invalid screenshot: ${name}`);
  }
}

// 2. game/index.html check
const gameDir = join(here, 'game');
const indexHtmlPath = join(gameDir, 'index.html');
if (!existsSync(indexHtmlPath)) {
  throw new Error('game/index.html is missing');
}
const indexInfo = lstatSync(indexHtmlPath);
if (indexInfo.size > INDEX_MAX_BYTES) {
  throw new Error(`game/index.html exceeds ${INDEX_MAX_BYTES} bytes`);
}
const indexContent = readFileSync(indexHtmlPath, 'utf-8');
const importMapMatches = Array.from(indexContent.matchAll(/<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/gi));
if (importMapMatches.length !== 1) {
  throw new Error('game/index.html must have exactly one import map');
}
let importMap;
try {
  importMap = JSON.parse(importMapMatches[0][1]);
} catch (e) {
  throw new Error('game/index.html import map is not valid JSON');
}
if (!importMap?.imports?.['three'] || importMap.imports['three'] !== './vendor/three/three.module.min.js') {
  throw new Error('game/index.html import map must map "three" exactly to "./vendor/three/three.module.min.js"');
}

// 3. File limits and off-disk reference check
let fileCount = 0;
let totalBytes = 0;

function walk(dir: string, relativeDir: string) {
  const entries = readdirSync(dir);
  for (const name of entries) {
    const path = join(dir, name);
    const relPath = relativeDir ? `${relativeDir}/${name}` : name;
    const info = lstatSync(path);

    if (info.isSymbolicLink()) {
      throw new Error(`Symlinks are not allowed: ${relPath}`);
    }

    if (info.isDirectory()) {
      walk(path, relPath);
    } else if (info.isFile()) {
      fileCount++;
      totalBytes += info.size;

      if (!relPath.startsWith('vendor/') && (relPath.endsWith('.js') || relPath.endsWith('.html'))) {
        const text = readFileSync(path, 'utf8');
        if (/https?:\/\//.test(text)) throw new Error(`Off-disk reference found in ${relPath}`);
        if (/src\s*=\s*["']\/\//.test(text)) throw new Error(`Off-disk reference found in ${relPath}`);
        if (/import\s*\(\s*['"](?:https?:)?\/\//.test(text)) throw new Error(`Off-disk absolute import found in ${relPath}`);
      }
    }
  }
}
walk(gameDir, '');

console.log(`game/ scanned: ${fileCount} files, ${totalBytes} bytes`);

if (fileCount > MAX_FILES) {
  throw new Error(`Too many files in game/: ${fileCount} (max ${MAX_FILES})`);
}
if (totalBytes > MAX_GAME_BYTES) {
  throw new Error(`Too many bytes in game/: ${totalBytes} (max ${MAX_GAME_BYTES})`);
}

// 4. Output generation
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648
  })
);
