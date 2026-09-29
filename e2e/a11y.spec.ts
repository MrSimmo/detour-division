// §21 accessibility: R-A11Y-1 (rebinding, reduced motion, colour-blind mode), arrow keys and focus loss.
import { expect, test, type Page } from '@playwright/test';
import { boot, openPrimrose, watch } from './helpers.ts';

type G = {
  paused: boolean;
  speed: number;
  setTool(t: string | null): void;
  setGhost(c: { cx: number; cy: number } | null): void;
  scene: { fx: { kick(n: number): void; shake: number }; root: { position: { x: number; y: number } }; ghostBase: { tint: number } };
};
const game = (page: Page) => page.evaluate(() => (window as unknown as { __game: G }).__game.paused);

async function openSettings(page: Page, tab: 'Sound' | 'Display' | 'Controls'): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: tab }).click();
}

test('R-A11Y-1: a rebound key works in a level, the old key no longer does, and a clash swaps', async ({ page }) => {
  const w = watch(page);
  await boot(page, '&ios=0');
  await openSettings(page, 'Controls');
  await page.getByRole('button', { name: /^Pause: Space/ }).click();
  await page.keyboard.press('p');
  await expect(page.getByRole('status')).toHaveText('P now does "Pause".');
  // Taking a key that's in use swaps the two.
  await page.getByRole('button', { name: /^Call the next wave: N/ }).click();
  await page.keyboard.press('f');
  await expect(page.getByRole('status')).toContainText('"Game speed" moved to N');
  await page.getByRole('button', { name: 'Done' }).click();
  await openPrimrose(page);
  await page.keyboard.press(' ');
  expect(await game(page)).toBe(false);
  await page.keyboard.press('p');
  expect(await game(page)).toBe(true);
  const keys = await page.evaluate(() => (window as unknown as { __profile: { settings: { keys: Record<string, string> } } }).__profile.settings.keys);
  expect(keys).toMatchObject({ pause: 'p', wave: 'f', speed: 'n' });
  expect(w.errors).toEqual([]);
});

/** Kicks the camera hard and reports the largest scene offset seen over a few frames. */
async function shakeOffset(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const g = (window as unknown as { __game: G }).__game;
    g.scene.fx.kick(10);
    let most = 0;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      most = Math.max(most, Math.abs(g.scene.root.position.x), Math.abs(g.scene.root.position.y));
    }
    return most;
  });
}

test('R-A11Y-1: with reduced motion on, no shake transform is applied (and with it off, one is)', async ({ page }) => {
  await boot(page, '&ios=0');
  await openPrimrose(page);
  expect(await shakeOffset(page)).toBeGreaterThan(0);
  await page.keyboard.press(' ');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Display' }).click();
  await page.getByRole('radiogroup', { name: 'Reduced motion' }).getByRole('radio', { name: 'On' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe('reduced');
  expect(await shakeOffset(page)).toBe(0);
});

test('R-A11Y-1: colour-blind mode draws an invalid ghost in the colour-blind orange token', async ({ page }) => {
  await boot(page, '&ios=0');
  await openSettings(page, 'Display');
  await page.getByRole('radiogroup', { name: 'Colour-blind colours' }).getByRole('radio', { name: 'On' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await openPrimrose(page);
  // Primrose Lane has rocks at (3,2) and (4,2): a Rattler can't go there.
  const tint = await page.evaluate(() => {
    const g = (window as unknown as { __game: G }).__game;
    g.setTool('rattler');
    g.setGhost({ cx: 3, cy: 2 });
    return g.scene.ghostBase.tint;
  });
  expect(tint).toBe(0xe69f00);
});

test('arrow keys move focus through menu buttons', async ({ page }) => {
  await boot(page, '&ios=0');
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('Play');
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.activeElement?.textContent)).toContain('Field guide');
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('Play');
});

test('the level pauses when the window loses focus at normal speed, but not on fast-forward', async ({ page }) => {
  await boot(page, '&ios=0');
  await openPrimrose(page);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await game(page)).toBe(true);
  await page.keyboard.press(' ');
  expect(await game(page)).toBe(false);
  await page.keyboard.press('f');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await game(page)).toBe(false);
});
