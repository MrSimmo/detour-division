// Dev helper: drives the running game in headless Chromium and saves screenshots.
// Usage: node tools/dev/shot.ts <url> <outDir> [width height dpr]
import { chromium } from '@playwright/test';

const [url = 'http://localhost:5173/', out = '/tmp', w = '1366', h = '768', dpr = '1'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: Number(dpr) });
const errors: string[] = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.getByRole('button', { name: 'Tap to start' }).click({ timeout: 20000 });
await page.waitForSelector('.title-screen:not(.splash) .card .btn.go');
await page.screenshot({ path: `${out}/01-title.png` });
await page.click('.card .btn.go');
await page.waitForSelector('#buildbar .slot');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/02-level.png` });
// Build a small maze with the mouse: select slots by hotkey and click cells.
const cellPos = async (cx: number, cy: number): Promise<{ x: number; y: number }> =>
  page.evaluate(([x, y]) => (window as unknown as { __game: { toScreen(a: number, b: number): { x: number; y: number } } }).__game.toScreen(x + 0.5, y + 0.5), [cx, cy]);
const place = async (key: string, cells: [number, number][]): Promise<void> => {
  await page.keyboard.press(key);
  for (const [x, y] of cells) {
    const p = await cellPos(x, y);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
  }
  await page.keyboard.press('Escape');
};
await place('1', [[6, 4], [6, 5], [6, 6], [6, 7], [9, 8], [9, 7], [9, 6]]);
await place('2', [[6, 8]]);
await place('3', [[12, 3]]);
// Hover a ghost to show the route preview.
await page.keyboard.press('1');
const g = await cellPos(12, 6);
await page.mouse.move(g.x, g.y);
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/03-ghost.png` });
await page.keyboard.press('Escape');
await page.click('#hud .next-wave .btn');
await page.keyboard.press('f');
await page.keyboard.press('f');
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/04-combat.png` });
const t = await cellPos(6, 5);
await page.mouse.click(t.x, t.y);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/05-panel.png` });
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
