// R-LAYOUT-3 (dialogs fit, nothing scrolls, everything follows a resize) and V-7 (no hover jump),
// in a desktop window resized the way a player would drag it.
import { expect, test } from '@playwright/test';
import { boot, fitProblems, grantStars, watch } from './helpers.ts';

const SIZES = [
  { width: 1366, height: 768 },
  { width: 1024, height: 600 },
  { width: 800, height: 500 },
];

test.describe('R-LAYOUT-3: dialogs fit a resized desktop window', () => {
  test('title, settings (every tab), saves and the field guide', async ({ page }) => {
    const w = watch(page);
    await page.setViewportSize(SIZES[0]!);
    await boot(page, '&ios=0');
    for (const size of SIZES) {
      await page.setViewportSize(size);
      expect(await fitProblems(page), `title ${size.width}×${size.height}`).toEqual([]);
      await page.getByRole('button', { name: 'Settings' }).click();
      for (const tab of ['Sound', 'Display', 'Controls']) {
        await page.getByRole('tab', { name: tab }).click();
        expect(await fitProblems(page), `settings/${tab} ${size.width}×${size.height}`).toEqual([]);
      }
      await page.getByRole('button', { name: 'Done' }).click();
      await page.getByRole('button', { name: 'Saves' }).click();
      expect(await fitProblems(page), `saves ${size.width}×${size.height}`).toEqual([]);
      await page.getByRole('button', { name: 'Done' }).click();
      await page.getByRole('button', { name: 'Field guide' }).click();
      expect(await fitProblems(page), `guide ${size.width}×${size.height}`).toEqual([]);
      await page.getByRole('button', { name: 'Close' }).click();
    }
    expect(w.errors).toEqual([]);
  });

  test('an open dialog refits when the window shrinks under it', async ({ page }) => {
    await page.setViewportSize(SIZES[0]!);
    await boot(page, '&ios=0');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('tab', { name: 'Controls' }).click();
    for (const size of [SIZES[2]!, SIZES[1]!, SIZES[0]!]) {
      await page.setViewportSize(size);
      expect(await fitProblems(page), `${size.width}×${size.height}`).toEqual([]);
    }
  });

  test('the world map fits the window and its medallions follow a resize', async ({ page }) => {
    await page.setViewportSize(SIZES[0]!);
    await boot(page, '&ios=0');
    await grantStars(page);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const nodes = page.locator('.node');
    await expect(nodes.first()).toBeVisible();
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await page.waitForTimeout(300);
      const outside = await page.evaluate(() => [...document.querySelectorAll('.node')].filter((n) => { const q = n.getBoundingClientRect(); return q.left < 0 || q.top < 0 || q.right > innerWidth || q.bottom > innerHeight; }).length);
      expect(outside, `${size.width}×${size.height}`).toBe(0);
    }
    // The briefing, over the map, fits too.
    await page.getByRole('button', { name: /^Primrose Lane/ }).click();
    for (const size of SIZES) {
      await page.setViewportSize(size);
      expect(await fitProblems(page), `briefing ${size.width}×${size.height}`).toEqual([]);
    }
  });

  test('the level and its pause menu follow a resize', async ({ page }) => {
    await page.setViewportSize(SIZES[0]!);
    await boot(page, '&ios=0');
    await grantStars(page);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: /^Primrose Lane/ }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game));
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const g = (window as unknown as { __game: { layoutState: { playfield: { x: number; y: number; w: number; h: number } } } }).__game;
        const pf = g.layoutState.playfield;
        return { pf, W: innerWidth, H: innerHeight, canvas: [document.querySelector('canvas')!.clientWidth, document.querySelector('canvas')!.clientHeight] };
      });
      expect(r.canvas).toEqual([size.width, size.height]);
      expect(r.pf.x).toBeGreaterThanOrEqual(0);
      expect(r.pf.y).toBeGreaterThanOrEqual(0);
      expect(r.pf.x + r.pf.w).toBeLessThanOrEqual(r.W + 1);
      expect(r.pf.y + r.pf.h).toBeLessThanOrEqual(r.H + 1);
    }
    await page.keyboard.press(' ');
    for (const size of SIZES) {
      await page.setViewportSize(size);
      expect(await fitProblems(page), `pause ${size.width}×${size.height}`).toEqual([]);
    }
  });
});

test('V-7: a map medallion keeps its centre on hover and press', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page, '&ios=0');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const node = page.getByRole('button', { name: /^Primrose Lane/ });
  await node.waitFor();
  await page.mouse.move(2, 400);
  await page.waitForTimeout(300);
  const centre = async (): Promise<{ x: number; y: number }> => {
    const b = (await node.boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const rest = await centre();
  await node.hover();
  await page.waitForTimeout(300);
  const hover = await centre();
  expect(Math.abs(hover.x - rest.x)).toBeLessThan(0.5);
  expect(Math.abs(hover.y - rest.y)).toBeLessThanOrEqual(2);
  // A locked medallion (the next level) behaves the same.
  const locked = page.locator('.node.locked').first();
  const lb = (await locked.boundingBox())!;
  await page.mouse.move(2, 400);
  await page.waitForTimeout(300);
  await locked.hover();
  await page.waitForTimeout(300);
  const lh = (await locked.boundingBox())!;
  expect(Math.abs(lh.x - lb.x)).toBeLessThan(0.5);
  expect(Math.abs(lh.y - lb.y)).toBeLessThanOrEqual(2);
});
