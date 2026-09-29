// Dev helper (ADR-0012): WebGL against WebGPU on the R-PERF-1 scene (The Last Roundabout, Heroic,
// 300 enemies at 3×), in Chromium on the real GPU (with and without 4× CPU throttling) and WebKit.
// Run it against a production preview, not the dev server: source edits reload the dev server's page.
// Usage: node tools/dev/renderer-bench.ts [url] [seconds]
import { chromium, webkit, type Page } from '@playwright/test';

const [url = 'http://localhost:4173/', secs = '15'] = process.argv.slice(2);
// Headless Chromium only has a software WebGPU adapter unless it is told to use the GPU.
const GPU_ARGS = ['--enable-unsafe-webgpu', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const pct = (a: number[], q: number): number => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(q * a.length))] ?? NaN;
/** The page's test hooks (`?e2e`), loosely typed: this is a dev script. */
type W = Window & Record<string, any>;

async function tapToStart(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Tap to start' }).click({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
}

async function run(engine: 'chromium' | 'webkit', renderer: 'webgl' | 'webgpu', throttle: boolean): Promise<string> {
  const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ args: GPU_ARGS });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  let errors = 0;
  page.on('pageerror', () => errors++);
  page.on('console', (m) => void (m.type() === 'error' && errors++));
  await page.goto(`${url}?e2e&ios=0`);
  await tapToStart(page);
  // Choose the renderer through Settings (any change saves the profile), then relaunch.
  await page.evaluate((r) => ((window as W).__profile.settings.renderer = r), renderer);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('tab', { name: 'Display' }).click();
  const shake = page.getByRole('radiogroup', { name: 'Screen shake' });
  await shake.getByRole('radio', { name: 'Off' }).click();
  await shake.getByRole('radio', { name: 'On' }).click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => (window as W).__saves.settled());
  await page.reload();
  await tapToStart(page);
  const got = await page.evaluate(() => (window as W).__app.pixi.renderer.name);
  await page.evaluate(() => (window as W).__app.play('z5-07', { difficulty: 'heroic', loadout: ['rattler', 'thumper', 'sparkplug', 'icebox', 'sunbeam', 'piechucker'], endless: false }));
  await page.waitForFunction(() => Boolean((window as W).__game));
  await page.evaluate(() => {
    const w = window as W;
    const g = w.__game;
    g.sim.state.cash = 1e9;
    g.sim.state.lives = 1e9;
    const kinds = ['rattler', 'thumper', 'sparkplug', 'icebox', 'sunbeam', 'piechucker'];
    let n = 0;
    for (let y = 1; y < 14; y += 2) for (let x = 1; x < 25; x += 3) g.command({ t: 'build', tower: kinds[n++ % kinds.length], cx: x, cy: y });
    g.speed = 3;
    const types = ['footling', 'scarper', 'tinkettle', 'brolly', 'trio', 'whirligig'];
    let k = 0;
    setInterval(() => {
      for (let i = 0; i < 40 && g.sim.state.enemies.length < 300; i++) w.__spawn(types[k++ % types.length], false, k % g.sim.level.routes.length);
    }, 100);
    setInterval(() => g.command({ t: 'callWave' }), 1500);
  });
  await page.waitForFunction(() => (window as W).__game.sim.state.enemies.length >= 280, undefined, { timeout: 60_000 });
  if (throttle) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    const w = window as W;
    const r = w.__app.pixi.renderer;
    const perf = { render: [] as number[], frame: [] as number[] };
    w.__bench = perf;
    const render = r.render.bind(r);
    r.render = (...a: unknown[]) => {
      const t0 = performance.now();
      render(...a);
      perf.render.push(performance.now() - t0);
    };
    let last = performance.now();
    const loop = (t: number): void => {
      perf.frame.push(t - last);
      last = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.waitForTimeout(Number(secs) * 1000);
  const p = (await page.evaluate(() => (window as W).__bench)) as { render: number[]; frame: number[] };
  await browser.close();
  return `${engine}${throttle ? ' (4× CPU)' : ''} ${renderer} → ${got}: render p50 ${pct(p.render, 0.5).toFixed(2)} ms, p95 ${pct(p.render, 0.95).toFixed(2)} ms; frame p50 ${pct(p.frame, 0.5).toFixed(1)} ms, p95 ${pct(p.frame, 0.95).toFixed(1)} ms; ${errors} errors`;
}

for (const [engine, throttle] of [['chromium', false], ['chromium', true], ['webkit', false]] as const) {
  for (const r of ['webgl', 'webgpu'] as const) console.log(await run(engine, r, throttle));
}
