// §20 offline PWA: R-PWA-1, plus the installability basics (manifest, icons, CSP).
import { spawn } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { openPrimrose, watch } from './helpers.ts';

test.use({ serviceWorkers: 'allow' });

/** A private preview server for this test, so it can be stopped: offline for real, not emulated.
 * Playwright's WebKit fails navigations under setOffline() before a service worker can answer them. */
async function privateServer(outDir = 'dist'): Promise<{ url: string; stop(): Promise<void> }> {
  // A fresh port every time: reusing one straight after a server dies can leave WebKit waiting on it.
  const port = await new Promise<number>((resolve) => {
    const probe = createServer().listen(0, () => {
      const a = probe.address() as AddressInfo;
      probe.close(() => resolve(a.port));
    });
  });
  const p = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--outDir', outDir], { stdio: 'ignore' });
  const url = `http://localhost:${port}/`;
  let up = false;
  for (let i = 0; i < 80 && !up; i++) {
    try {
      up = (await fetch(url)).ok;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!up) throw new Error(`the private preview server on ${port} did not start`);
  return {
    url,
    stop: () =>
      new Promise((resolve) => {
        if (p.exitCode !== null || p.signalCode !== null) return resolve();
        p.once('exit', () => resolve());
        p.kill('SIGTERM');
      }),
  };
}

test('R-PWA-1: after one visit it loads and plays a level offline, with no failed requests or console errors', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'R-PWA-1 names Chromium and WebKit');
  test.setTimeout(120_000);
  const server = await privateServer();
  try {
    const w = watch(page);
    await page.goto(`${server.url}?e2e`);
    // Let each load finish booting before the next reload, so the test never cancels its own fetches.
    await page.getByRole('button', { name: 'Tap to start' }).waitFor();
    // Wait for the worker to install (the whole precache) and take control on the next load.
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active?.state !== 'activated') await new Promise<void>((r) => reg.active!.addEventListener('statechange', () => reg.active!.state === 'activated' && r()));
    });
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.getByRole('button', { name: 'Tap to start' }).waitFor();
    await server.stop();
    await expect(fetch(server.url)).rejects.toThrow();
    await page.reload();
    await page.getByRole('button', { name: 'Tap to start' }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
    await openPrimrose(page);
    await page.evaluate(() => {
      const g = (window as unknown as { __game: { sim: { state: { cash: number } }; command(c: unknown): unknown; speed: number } }).__game;
      g.sim.state.cash += 200;
      for (const y of [3, 5, 7]) g.command({ t: 'build', tower: 'rattler', cx: 8, cy: y });
      g.command({ t: 'callWave' });
      g.speed = 3;
    });
    await page.waitForFunction(() => (window as unknown as { __game: { sim: { state: { stats: { kills: number } } } } }).__game.sim.state.stats.kills > 3, undefined, { timeout: 60_000 });
    expect(w.errors).toEqual([]);
  } finally {
    // Already stopped on the happy path; this catches a failure part-way through.
    await server.stop();
  }
});

test('the web app manifest names the game, installs standalone in landscape, and has every icon', async ({ request }) => {
  const m = (await (await request.get('/manifest.webmanifest')).json()) as { name: string; short_name: string; display: string; orientation: string; icons: { src: string; sizes: string; purpose?: string }[] };
  expect(m).toMatchObject({ name: 'Detour Division', short_name: 'Detour Div.', display: 'standalone', orientation: 'landscape' });
  expect(m.icons.map((i) => `${i.sizes}${i.purpose ? ` ${i.purpose}` : ''}`).sort()).toEqual(['192x192', '512x512', '512x512 maskable']);
  for (const src of [...m.icons.map((i) => i.src), 'icons/apple-touch-icon.png', 'icons/favicon-32.png']) expect((await request.get(`/${src}`)).ok(), src).toBe(true);
});

test('updates: a new version found mid-session shows "Update ready" on menus only, and applies at the next launch', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the update logic is shared; one engine is enough');
  test.setTimeout(120_000);
  const dir = mkdtempSync(join(tmpdir(), 'dd-update-'));
  cpSync('dist', dir, { recursive: true });
  const server = await privateServer(dir);
  try {
    const w = watch(page);
    await page.goto(`${server.url}?e2e`);
    await page.getByRole('button', { name: 'Tap to start' }).waitFor();
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active?.state !== 'activated') await new Promise<void>((r) => reg.active!.addEventListener('statechange', () => reg.active!.state === 'activated' && r()));
    });
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    const first = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.active!.scriptURL);
    await page.getByRole('button', { name: 'Tap to start' }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
    // Publish a "new version": any byte change to sw.js makes the browser install it as an update.
    appendFileSync(join(dir, 'sw.js'), '\n// e2e: a new version\n');
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
    await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting), undefined, { timeout: 60_000 });
    await expect(page.getByRole('status').filter({ hasText: 'Update ready' })).toBeVisible();
    // Not in a level.
    await openPrimrose(page);
    await expect(page.locator('.update-badge')).toHaveCount(0);
    // The next cold launch activates the waiting worker and reloads before any menu.
    await page.goto(`${server.url}?e2e`);
    await page.getByRole('button', { name: 'Tap to start' }).waitFor();
    const after = await page.evaluate(async () => {
      const reg = (await navigator.serviceWorker.getRegistration())!;
      return { waiting: Boolean(reg.waiting), controlled: Boolean(navigator.serviceWorker.controller) };
    });
    expect(after).toEqual({ waiting: false, controlled: true });
    expect(first).toContain('sw.js');
    expect(w.errors).toEqual([]);
  } finally {
    await server.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
