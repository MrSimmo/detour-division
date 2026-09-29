// R-INPUT-1, R-INPUT-2, R-BLOCK-4, R-MARK-1, smoke test, no console errors.
import { expect, test } from '@playwright/test';
import { cellCentre, startLevel, towers, watch } from './helpers.ts';

test('loads, starts a level and runs waves without console errors', async ({ page }) => {
  const w = watch(page);
  await startLevel(page);
  await page.getByRole('button', { name: 'Start the first wave' }).click();
  await page.keyboard.press('f');
  await page.keyboard.press('f');
  await page.waitForTimeout(4000);
  const tick = await page.evaluate(() => (window as unknown as { __game: { sim: { state: { tick: number } } } }).__game.sim.state.tick);
  expect(tick).toBeGreaterThan(150);
  expect(w.errors).toEqual([]);
});

test('mouse: select with a hotkey, click to place, right-click cancels', async ({ page }) => {
  await startLevel(page);
  await page.keyboard.press('1');
  const p = await cellCentre(page, 6, 3);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  expect(await towers(page)).toEqual([{ type: 'rattler', cx: 6, cy: 3 }]);
  // The tool stays selected on desktop for fast building…
  const q = await cellCentre(page, 6, 4);
  await page.mouse.click(q.x, q.y);
  expect((await towers(page)).length).toBe(2);
  // …until a right-click cancels it.
  await page.mouse.click(q.x, q.y, { button: 'right' });
  const r = await cellCentre(page, 8, 8);
  await page.mouse.click(r.x, r.y);
  expect((await towers(page)).length).toBe(2);
});

test('mouse: a refused placement explains why', async ({ page }) => {
  await startLevel(page);
  await page.keyboard.press('1');
  const entrance = await cellCentre(page, 0, 6);
  await page.mouse.move(entrance.x, entrance.y);
  await expect(page.locator('.bubble')).toHaveText("Can't build here");
});

test('keyboard shortcuts: pause, speed, routes, call wave, escape', async ({ page }) => {
  await startLevel(page);
  const g = (): Promise<{ paused: boolean; speed: number; showRoutes: boolean; tool: string | null; started: boolean }> =>
    page.evaluate(() => {
      const x = (window as unknown as { __game: { paused: boolean; speed: number; showRoutes: boolean; tool: string | null; sim: { state: { waves: { started: boolean } } } } }).__game;
      return { paused: x.paused, speed: x.speed, showRoutes: x.showRoutes, tool: x.tool, started: x.sim.state.waves.started };
    });
  await page.keyboard.press('n');
  expect((await g()).started).toBe(true);
  await page.keyboard.press(' ');
  expect((await g()).paused).toBe(true);
  await page.keyboard.press(' ');
  await page.keyboard.press('f');
  expect((await g()).speed).toBe(2);
  await page.keyboard.press('r');
  expect((await g()).showRoutes).toBe(false);
  await page.keyboard.press('2');
  expect((await g()).tool).toBe('treacle');
  await page.keyboard.press('Escape');
  expect((await g()).tool).toBe(null);
});

test('touch: drag from the build bar places the tower under the ghost, above the finger', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch events are Chromium-only');
  await startLevel(page);
  const slot = await page.locator('#buildbar .slot').first().boundingBox();
  const target = await cellCentre(page, 8, 4);
  const lift = await page.evaluate(() => Math.max(48, (window as unknown as { __game: { layoutState: { cell: number } } }).__game.layoutState.cell * 1.4));
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const sx = slot!.x + slot!.width / 2;
  const sy = slot!.y + slot!.height / 2;
  await touch('touchStart', sx, sy);
  // The finger ends one "lift" below the target cell; the ghost is drawn above it.
  const fx = target.x;
  const fy = target.y + lift;
  for (let i = 1; i <= 8; i++) await touch('touchMove', sx + ((fx - sx) * i) / 8, sy + ((fy - sy) * i) / 8);
  await touch('touchEnd', fx, fy);
  expect(await towers(page)).toEqual([{ type: 'rattler', cx: 8, cy: 4 }]);
});

test('R-INPUT-2: mouse drag and drop from the build bar builds in one gesture', async ({ page }) => {
  await startLevel(page);
  const slot = (await page.locator('#buildbar .slot').first().boundingBox())!;
  const target = await cellCentre(page, 8, 4);
  await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await page.mouse.up();
  expect(await towers(page)).toEqual([{ type: 'rattler', cx: 8, cy: 4 }]);
  // Nothing is left armed, and no refusal bubble is left over from cells the drag crossed.
  expect(await page.evaluate(() => (window as unknown as { __game: { tool: string | null } }).__game.tool)).toBe(null);
  await expect(page.locator('.bubble')).toBeHidden();
});

test('R-INPUT-2: after a click-to-arm placement, the new tower cell raises no bubble', async ({ page }) => {
  await startLevel(page);
  await page.keyboard.press('1');
  const p = await cellCentre(page, 7, 3);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  expect((await towers(page)).length).toBe(1);
  await page.mouse.move(p.x + 2, p.y + 1);
  await page.waitForTimeout(300);
  await expect(page.locator('.bubble')).toBeHidden();
  // Moving on to open ground shows the ghost again, still armed.
  const q = await cellCentre(page, 9, 3);
  await page.mouse.move(q.x, q.y);
  expect(await page.evaluate(() => (window as unknown as { __game: { tool: string | null; ghostCell: unknown } }).__game.tool)).toBe('rattler');
});

test('R-BLOCK-4: unbuildable cells are shaded only while placing', async ({ page }) => {
  await startLevel(page);
  type S = { __game: { scene: { maskCells: readonly number[] }; sim: { level: { apron: Uint8Array } } } };
  const shaded = (): Promise<number> => page.evaluate(() => (window as unknown as S).__game.scene.maskCells.length);
  expect(await shaded()).toBe(0);
  await page.keyboard.press('1');
  await page.waitForTimeout(100);
  // Primrose Lane: the two gate aprons (2 × 10 cells) and 10 rock cells.
  const n = await shaded();
  const apron = await page.evaluate(() => [...(window as unknown as S).__game.sim.level.apron].filter(Boolean).length);
  expect(apron).toBe(20);
  expect(n).toBe(30);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  expect(await shaded()).toBe(0);
});

