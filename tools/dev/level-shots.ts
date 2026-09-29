// Dev helper: open levels directly in the running dev server, call the first wave, and screenshot each.
// Usage: node tools/dev/level-shots.ts <outDir> <level-id>... (dev server on :5173, or BASE=<url>)
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [out = '/tmp', ...ids] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors: string[] = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`${process.env.BASE ?? 'http://localhost:5173/'}?e2e`);
await page.getByRole('button', { name: 'Tap to start' }).click({ timeout: 20000 });
await page.waitForSelector('.title-screen:not(.splash) .card .btn.go');
// Go through the world map first: it loads asynchronously and would otherwise replace the level.
await page.click('.card .btn.go');
await page.waitForSelector('.map-screen');
for (const id of ids) {
  const lv = JSON.parse(readFileSync(`data/levels/${id.slice(0, 2)}/${id}.json`, 'utf8')) as { loadout: { bot: string[]; fixed?: string[] }; bot?: { plan?: { build?: { tower: string; cx: number; cy: number } }[] } };
  const loadout = lv.loadout.fixed ?? lv.loadout.bot;
  await page.evaluate(([i, l]) => (window as any).__app.play(i, { difficulty: 'casual', loadout: l, endless: false }), [id, loadout] as const);
  await page.waitForSelector('#hud');
  await page.waitForTimeout(500);
  // A few towers from the level's own plan, if it has one, so the screenshot shows built ground too.
  const builds = (lv.bot?.plan ?? []).flatMap((s) => (s.build ? [s.build] : [])).slice(0, 12);
  await page.evaluate((bs) => {
    const g = (window as any).__game;
    g.sim.state.cash += 2000;
    for (const s of bs) g.command({ t: 'build', tower: s.tower, cx: s.cx, cy: s.cy });
    g.command({ t: 'callWave' });
  }, builds);
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${out}/${id}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
