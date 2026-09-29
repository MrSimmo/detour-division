// §20 saves in the browser: R-SAVE-2 resume, and profile progress kept across a reload.
import { expect, test } from '@playwright/test';
import { startLevel, watch } from './helpers.ts';

type G = { sim: { state: { cash: number; waves: { next: number } } }; command(c: unknown): unknown; speed: number };
type W = { __game: G; __hash(): string; __saves: { settled(): Promise<unknown> }; __profile: { stars: Record<string, number> } };

test('R-SAVE-2: after the page is hidden and reloaded, the battle resumes with an identical hash', async ({ page }) => {
  test.setTimeout(90_000);
  const w = watch(page);
  await startLevel(page);
  await page.evaluate(() => {
    const g = (window as unknown as W).__game;
    g.sim.state.cash += 300;
    for (const y of [3, 5, 7, 9]) g.command({ t: 'build', tower: 'rattler', cx: 8, cy: y });
    g.command({ t: 'callWave' });
    g.speed = 3;
  });
  await page.waitForFunction(() => (window as unknown as W).__game.sim.state.waves.next >= 3, undefined, { timeout: 60_000 });
  // Hide the page and read the hash in the same task, so no frame runs in between.
  const before = await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    return (window as unknown as W).__hash();
  });
  await page.evaluate(() => (window as unknown as W).__saves.settled());
  await page.reload();
  await page.getByRole('button', { name: 'Tap to start' }).click();
  await page.getByRole('button', { name: /^Resume Primrose Lane, wave \d+/ }).click();
  await page.waitForFunction(() => Boolean((window as unknown as Partial<W>).__game));
  const after = await page.evaluate(() => (window as unknown as W).__hash());
  expect(after).toBe(before);
  // It resumes paused, on the pause menu.
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  expect(w.errors).toEqual([]);
});

test('progress survives a reload: stars from a win are still there', async ({ page }) => {
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'Tap to start' }).click();
  await page.evaluate(async () => {
    const win = window as unknown as W & { __app: { settings(b: () => void): void } };
    win.__profile.stars['z1-01'] = 2;
    // Settings changes save the profile; use that path rather than a private hook.
    win.__app.settings(() => {});
  });
  await page.getByRole('slider', { name: 'Music volume' }).fill('35');
  await page.evaluate(() => (window as unknown as W).__saves.settled());
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as unknown as W).__saves.settled());
  await page.reload();
  await page.getByRole('button', { name: 'Tap to start' }).waitFor();
  const r = await page.evaluate(() => {
    const p = (window as unknown as { __profile: { stars: Record<string, number>; settings: { music: number } } }).__profile;
    return { stars: p.stars['z1-01'], music: p.settings.music };
  });
  expect(r).toEqual({ stars: 2, music: 0.35 });
});

test('Saves: export a code, lose progress, import it back; the file download is a .ddsave', async ({ page, browserName, context }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are a Chromium feature in Playwright');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const w = watch(page);
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'Tap to start' }).click();
  await page.evaluate(() => {
    const p = (window as unknown as W).__profile;
    p.stars['z1-01'] = 3;
    p.stars['z1-02'] = 1;
  });
  await page.getByRole('button', { name: 'Saves' }).click();
  await page.getByRole('button', { name: 'Copy a save code' }).click();
  await expect(page.getByRole('status')).toHaveText('Save code copied.');
  const code = await page.getByRole('textbox', { name: 'Save code' }).inputValue();
  expect(code).toMatch(/^DD1-/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save to a file' }).click();
  expect((await download).suggestedFilename()).toBe('detour-division.ddsave');
  // Lose the progress, then paste the code back.
  await page.evaluate(() => {
    const p = (window as unknown as W).__profile;
    delete p.stars['z1-01'];
    delete p.stars['z1-02'];
  });
  await page.getByRole('textbox', { name: 'Save code' }).fill(code);
  await page.getByRole('button', { name: 'Load the code' }).click();
  await expect(page.getByRole('status')).toContainText('This save has 4 stars');
  await page.getByRole('button', { name: 'Replace my progress' }).click();
  await expect(page.getByRole('status')).toHaveText('Loaded. Welcome back.');
  expect(await page.evaluate(() => (window as unknown as W).__profile.stars)).toEqual({ 'z1-01': 3, 'z1-02': 1 });
  // A damaged code is refused in plain words.
  await page.getByRole('textbox', { name: 'Save code' }).fill('DD1-nonsense.00000000');
  await page.getByRole('button', { name: 'Load the code' }).click();
  await expect(page.getByRole('status')).toContainText("That didn't load");
  expect(w.errors).toEqual([]);
});

test('iOS Safari: the Add to Home Screen explainer shows once, and not again after "Got it"', async ({ page }) => {
  const w = watch(page);
  await page.goto('/?e2e&ios=1');
  await page.getByRole('button', { name: 'Tap to start' }).click();
  await expect(page.getByRole('dialog', { name: 'Add to Home Screen' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('dialog', { name: 'Add to Home Screen' })).toHaveCount(0);
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as unknown as W).__saves.settled());
  await page.reload();
  await page.getByRole('button', { name: 'Tap to start' }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Add to Home Screen' })).toHaveCount(0);
  expect(w.errors).toEqual([]);
});
