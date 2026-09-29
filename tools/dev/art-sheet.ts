// Dev helper: renders a labelled contact sheet of sprites to a PNG, without touching
// public/assets. Usage: node tools/dev/art-sheet.ts <out.png> <scale> <key-prefix>...
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const [out, scale = '2', ...prefixes] = process.argv.slice(2);
if (!out || prefixes.length === 0) throw new Error('usage: art-sheet.ts <out.png> <scale> <prefix>...');
const root = fileURLToPath(new URL('../../', import.meta.url));
const server = await createServer({ root, logLevel: 'error', server: { port: 0 }, optimizeDeps: { noDiscovery: true } });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${server.resolvedUrls!.local[0]}tools/bake/bake.html`);
  await page.waitForFunction(() => window.__bakeReady === true);
  const png = await page.evaluate(([p, s]) => window.__sheet(p, s), [prefixes, Number(scale)] as const);
  writeFileSync(out, Buffer.from(png, 'base64'));
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
  await server.close();
}
