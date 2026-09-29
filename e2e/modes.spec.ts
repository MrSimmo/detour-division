// §10.1 HUD variations for the special modes, reached through the real map and briefing.
import { expect, test, type Page } from '@playwright/test';
import { boot, grantStars, watch } from './helpers.ts';

/** Marks every campaign level won once, so any node on the map can be opened (test profiles only). */
async function unlockAll(page: Page): Promise<void> {
  await page.evaluate(() => {
    const p = (window as unknown as { __profile: { stars: Record<string, number> } }).__profile;
    for (let z = 1; z <= 5; z++) for (let i = 1; i <= 8; i++) p.stars[`z${z}-0${i}`] = 1;
  });
}

async function open(page: Page, name: string): Promise<void> {
  await boot(page);
  await grantStars(page);
  await unlockAll(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('#buildbar .slot').first()).toBeVisible();
  await page.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game));
}

test('Sudden Death shows a clock that starts with the first wave', async ({ page }) => {
  const w = watch(page);
  await open(page, 'Sandglass');
  const hud = page.locator('#hud');
  await expect(hud).toContainText('Hold');
  await expect(hud).toContainText('4:00');
  await page.keyboard.press('n');
  await expect(hud).not.toContainText('4:00', { timeout: 5000 });
  expect(w.errors).toEqual([]);
});

test('Time Trial shows knock-outs against the target, and the clock', async ({ page }) => {
  const w = watch(page);
  await open(page, 'The Long Mirage');
  const hud = page.locator('#hud');
  await expect(hud).toContainText('Defeated');
  await expect(hud).toContainText('0/180');
  await expect(hud).toContainText('5:00');
  expect(w.errors).toEqual([]);
});

test('Puzzle offers no early-call bonus and uses its fixed loadout', async ({ page }) => {
  const w = watch(page);
  await open(page, 'Haybale Hollow');
  await expect(page.locator('#buildbar .slot')).toHaveCount(2);
  await page.keyboard.press('n');
  await expect(page.locator('#hud')).toContainText('Next');
  await expect(page.locator('#hud')).not.toContainText('Next +');
  expect(w.errors).toEqual([]);
});
