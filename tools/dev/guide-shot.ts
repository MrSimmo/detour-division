// Dev helper: field guide screenshots. Usage: node tools/dev/guide-shot.ts <url> <outDir>
import { chromium } from '@playwright/test';

const [url = 'http://localhost:5173/', out = '/tmp'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
await page.goto(`${url}?e2e`);
await page.getByRole('button', { name: 'Tap to start' }).click();
await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
await page.evaluate(() => {
  const p = (window as unknown as { __profile: { stars: Record<string, number>; seen: Record<string, true> } }).__profile;
  p.stars['dev'] = 25;
  for (const k of ['footling', 'scarper', 'tinkettle', 'brolly', 'lummox', 'gasbag', 'flattener']) {
    p.seen[`enemy.${k}.n`] = true;
    p.seen[`enemy.${k}.e`] = true;
  }
});
await page.getByRole('button', { name: /Field guide/ }).click();
await page.locator('.guide-grid .entry').nth(6).click();
await page.screenshot({ path: `${out}/g1-towers.png` });
await page.getByRole('tab', { name: 'Enemies' }).click();
await page.locator('.guide-grid .entry:not(.unknown)').nth(5).click();
await page.screenshot({ path: `${out}/g2-enemies.png` });
await browser.close();
