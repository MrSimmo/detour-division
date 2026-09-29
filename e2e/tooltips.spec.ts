// R-TIP-1 (DESIGN.md §18.6): tooltips on a resting mouse, on keyboard focus, and on a touch long press.
import { expect, test } from '@playwright/test';
import { boot, startLevel } from './helpers.ts';

test('resting the mouse on a build-bar slot shows its tower within 1 s', async ({ page }) => {
  await startLevel(page);
  const tip = page.locator('#tooltip');
  await page.locator('#buildbar .slot').first().hover();
  await expect(tip).toBeVisible({ timeout: 1000 });
  await expect(tip).toContainText('Rattler');
  await page.mouse.move(3, 3);
  await expect(tip).toBeHidden();
});

test('keyboard focus on a HUD button shows its tooltip', async ({ page }) => {
  await startLevel(page);
  // A key press first, so the programmatic focus counts as keyboard focus (:focus-visible) in every engine.
  await page.keyboard.press('Shift');
  await page.evaluate(() => (document.querySelector('#hud button[aria-label^="Game speed"]') as HTMLButtonElement).focus({ focusVisible: true } as FocusOptions));
  const tip = page.locator('#tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Speed');
});

test('a touch long press on a slot shows the tooltip and does not arm the tower; a tap still arms it', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch events are Chromium-only');
  await startLevel(page);
  const slot = (await page.locator('#buildbar .slot').first().boundingBox())!;
  const x = slot.x + slot.width / 2;
  const y = slot.y + slot.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchEnd') => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const tool = () => page.evaluate(() => (window as unknown as { __game: { tool: string | null } }).__game.tool);
  await touch('touchStart');
  await page.waitForTimeout(700);
  await expect(page.locator('#tooltip')).toBeVisible();
  await expect(page.locator('#tooltip')).toContainText('Rattler');
  await touch('touchEnd');
  await expect(page.locator('#tooltip')).toBeHidden();
  expect(await tool()).toBe(null);
  await touch('touchStart');
  await touch('touchEnd');
  expect(await tool()).toBe('rattler');
});

test('R-GPU-1: on a page that is not a secure context, WebGPU is disabled and its tooltip says why', async ({ page, browserName }) => {
  // What a plain-http LAN address looks like to the page: no secure context, so no navigator.gpu (§19).
  await page.addInitScript(() => {
    Object.defineProperty(window, 'isSecureContext', { value: false });
    delete (Navigator.prototype as { gpu?: unknown }).gpu;
  });
  await boot(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Display' }).click();
  const renderer = page.getByRole('radiogroup', { name: 'Renderer' });
  const gpu = renderer.getByRole('radio', { name: 'WebGPU' });
  await expect(gpu).toHaveAttribute('aria-disabled', 'true');
  const tip = page.locator('#tooltip');
  await gpu.hover();
  await expect(tip).toBeVisible({ timeout: 1000 });
  await expect(tip).toContainText('secure (https) address');
  await gpu.click({ force: true });
  await expect(renderer.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');
  if (browserName !== 'chromium') return;
  // A long press on touch shows the same reason (CDP touch is Chromium-only).
  await page.mouse.move(3, 3);
  await expect(tip).toBeHidden();
  const b = (await gpu.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchEnd') => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 }] });
  await touch('touchStart');
  await page.waitForTimeout(700);
  await expect(tip).toContainText('secure (https) address');
  await touch('touchEnd');
});
