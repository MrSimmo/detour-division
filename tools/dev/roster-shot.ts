// Dev helper: every tower built and every enemy (plain and elite) marching, screenshotted.
// Usage: node tools/dev/roster-shot.ts <url> <outDir> [width height dpr]
import { chromium } from '@playwright/test';

const [url = 'http://localhost:5173/', out = '/tmp', w = '1920', h = '1080', dpr = '1'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: Number(dpr) });
const errors: string[] = [];
page.on('console', (m) => {
  if (m.type() === 'error' || (m.type() === 'warning' && !m.text().includes('GPU stall'))) errors.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`${url}?e2e`);
await page.getByRole('button', { name: 'Tap to start' }).click();
await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
await page.evaluate(() => ((window as unknown as { __profile: { stars: Record<string, number> } }).__profile.stars['dev'] = 60));
await page.getByRole('button', { name: 'Play', exact: true }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/r0-map.png` });
await page.getByRole('button', { name: /^Primrose Lane/ }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/r1-briefing.png` });
await page.getByRole('button', { name: 'Start', exact: true }).click();
await page.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game));
await page.evaluate(() => {
  const g = (window as unknown as { __game: { sim: { state: { loadout: string[]; cash: number; towers: { id: number; tier: number }[] } }; command(c: unknown): { ok: boolean; id?: number } } }).__game;
  const all = ['rattler', 'treacle', 'skylark', 'thumper', 'scorcher', 'sparkplug', 'sunbeam', 'icebox', 'teaurn', 'bellower', 'bubbler', 'piechucker'];
  g.sim.state.loadout = all;
  g.sim.state.cash = 99999;
  all.forEach((t, i) => {
    const r = g.command({ t: 'build', tower: t, cx: 3 + (i % 6) * 3, cy: i < 6 ? 3 : 9 });
    const tw = g.sim.state.towers.find((x) => x.id === r.id);
    if (tw) tw.tier = i % 3;
  });
});
const spawn = (type: string, elite: boolean): Promise<number> => page.evaluate(([t, e]) => (window as unknown as { __spawn(t: string, e: boolean): number }).__spawn(t as string, e as boolean), [type, elite] as const);
const types = ['footling', 'scarper', 'puttputt', 'tinkettle', 'whirligig', 'lummox', 'brolly', 'sawbones', 'trio', 'tubthumper', 'gasbag'];
for (const t of types) {
  await spawn(t, false);
  await page.waitForTimeout(260);
  await spawn(t, true);
  await page.waitForTimeout(260);
}
await page.screenshot({ path: `${out}/r2-battle.png` });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/r3-battle.png` });
for (const b of ['flattener', 'grinder']) await spawn(b, false);
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/r4-bosses.png` });
console.log(errors.length ? [...new Set(errors)].join('\n') : 'no console errors');
await browser.close();
