// `npm run bake-art` (ADR-0006): draws all code art in headless Chromium, packs it into
// atlases at @1x and @2x, and writes public/assets/{atlas/*,manifest.json} and the app icons in public/icons/.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = `${root}public/assets/`;
const SCALES = [1, 2];

const server = await createServer({ root, logLevel: 'error', server: { port: 0, strictPort: false }, optimizeDeps: { noDiscovery: true } });
await server.listen();
const base = server.resolvedUrls?.local[0];
if (!base) throw new Error('vite dev server did not start');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('bake page error:', e.message));
  await page.goto(`${base}tools/bake/bake.html`);
  await page.waitForFunction(() => window.__bakeReady === true, undefined, { timeout: 60000 });
  rmSync(`${outDir}atlas`, { recursive: true, force: true });
  mkdirSync(`${outDir}atlas`, { recursive: true });
  const atlases: Record<string, Record<string, string[]>> = {};
  let sprites: Record<string, string> = {};
  let towers: unknown = {};
  let bytes = 0;
  for (const scale of SCALES) {
    const t0 = performance.now();
    const r = await page.evaluate((s) => window.__bake(s), scale);
    for (const p of r.pages) {
      const img = Buffer.from(p.data, 'base64');
      bytes += img.length;
      writeFileSync(`${outDir}atlas/${p.file}.webp`, img);
      writeFileSync(`${outDir}atlas/${p.file}.json`, JSON.stringify(p.json));
    }
    for (const [g, files] of Object.entries(r.groups)) (atlases[g] ??= {})[String(scale)] = files;
    sprites = r.keys;
    towers = r.towers;
    console.log(`@${scale}x: ${r.pages.length} pages (${r.pages.map((p) => `${p.file} ${(p.json as { meta: { size: { w: number; h: number } } }).meta.size.w}×${(p.json as { meta: { size: { w: number; h: number } } }).meta.size.h}`).join(', ')}) in ${Math.round(performance.now() - t0)} ms`);
  }
  // App icons (§20): PNG, which every install surface accepts.
  mkdirSync(`${root}public/icons`, { recursive: true });
  const ICONS: [string, number, 'any' | 'maskable' | 'apple'][] = [
    ['icon-192.png', 192, 'any'],
    ['icon-512.png', 512, 'any'],
    ['icon-maskable-512.png', 512, 'maskable'],
    ['apple-touch-icon.png', 180, 'apple'],
    ['favicon-32.png', 32, 'any'],
  ];
  for (const [file, size, variant] of ICONS) writeFileSync(`${root}public/icons/${file}`, Buffer.from(await page.evaluate(([n, v]) => window.__icon(n, v), [size, variant] as const), 'base64'));
  const manifest = { version: 1, cellArt: 64, generatedBy: 'code-art', atlases, towers, sprites };
  writeFileSync(`${outDir}manifest.json`, JSON.stringify(manifest, null, 1));
  console.log(`${Object.keys(sprites).length} sprites, ${(bytes / 1048576).toFixed(2)} MB of WebP`);
} finally {
  await browser.close();
  await server.close();
}
