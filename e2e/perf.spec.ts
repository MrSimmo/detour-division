// R-PERF-1 (DESIGN.md §19): under 4× CPU throttling in Chromium, with 300 enemies at 3× speed and
// heavy effects: a sim tick ≤ 2 ms at p95, a render ≤ 8 ms at p95, ≤ 30 draw calls, and no heap
// growth across 10 waves.
import { expect, test } from '@playwright/test';
import { boot } from './helpers.ts';

test('R-PERF-1: budgets hold under 4× CPU throttling with 300 enemies at 3×', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CPU throttling and heap measurement are Chromium-only');
  test.setTimeout(300_000);
  await boot(page, '&ios=0');
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(async () => {
    const w = window as unknown as { __app: { play(id: string, c: unknown): Promise<void> } };
    await w.__app.play('z5-07', { difficulty: 'heroic', loadout: ['rattler', 'thumper', 'sparkplug', 'icebox', 'sunbeam', 'piechucker'], endless: false });
  });
  await page.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game));
  // Towers of every weapon type, then a stream that keeps 300 enemies on the field, calling waves early.
  await page.evaluate(() => {
    type G = { sim: { state: { cash: number; lives: number; enemies: unknown[]; waves: { next: number } }; level: { routes: unknown[] } }; command(c: unknown): { ok: boolean }; speed: number };
    const w = window as unknown as { __game: G; __spawn(t: string, e: boolean, r: number): number };
    const g = w.__game;
    g.sim.state.cash = 1e9;
    g.sim.state.lives = 1e9;
    const kinds = ['rattler', 'thumper', 'sparkplug', 'icebox', 'sunbeam', 'piechucker'];
    let tried = 0;
    for (let y = 1; y < 14; y += 2) for (let x = 1; x < 25; x += 3) g.command({ t: 'build', tower: kinds[tried++ % kinds.length], cx: x, cy: y });
    g.speed = 3;
    const types = ['footling', 'scarper', 'tinkettle', 'brolly', 'trio', 'whirligig'];
    let k = 0;
    setInterval(() => {
      for (let i = 0; i < 40 && g.sim.state.enemies.length < 300; i++) w.__spawn(types[k++ % types.length]!, false, k % g.sim.level.routes.length);
    }, 100);
    setInterval(() => g.command({ t: 'callWave' }), 1500);
  });
  await page.waitForFunction(() => (window as unknown as { __game: { sim: { state: { enemies: unknown[] } } } }).__game.sim.state.enemies.length >= 280, undefined, { timeout: 60_000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // Probes: sim ticks (the game's own), render time and draw calls per frame (wrapping the renderer and GL).
  await page.evaluate(() => {
    type R = { render(...a: unknown[]): void; gl: WebGL2RenderingContext };
    const w = window as unknown as { __app: { pixi: { renderer: R } }; __game: { tickTimes: number[] | null }; __perf: { render: number[]; draws: number[] } };
    const perf = { render: [] as number[], draws: [] as number[] };
    w.__perf = perf;
    w.__game.tickTimes = [];
    const r = w.__app.pixi.renderer;
    let draws = 0;
    const gl = r.gl as unknown as Record<string, (...a: unknown[]) => unknown>;
    for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const orig = gl[f]!.bind(gl);
      gl[f] = (...a: unknown[]) => {
        draws++;
        return orig(...a);
      };
    }
    const render = r.render.bind(r);
    r.render = (...a: unknown[]) => {
      draws = 0;
      const t0 = performance.now();
      render(...a);
      perf.render.push(performance.now() - t0);
      perf.draws.push(draws);
    };
  });
  const heap = async (): Promise<number> => {
    await cdp.send('HeapProfiler.collectGarbage');
    return (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576;
  };
  const waves = (): Promise<number> => page.evaluate(() => (window as unknown as { __game: { sim: { state: { waves: { next: number } } } } }).__game.sim.state.waves.next);
  const w0 = await waves();
  const heapStart = await heap();
  await page.waitForFunction((n) => (window as unknown as { __game: { sim: { state: { waves: { next: number } } } } }).__game.sim.state.waves.next >= n, w0 + 10, { timeout: 240_000, polling: 1000 });
  const heapEnd = await heap();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const r = await page.evaluate(() => {
    const w = window as unknown as { __game: { tickTimes: number[] }; __perf: { render: number[]; draws: number[] } };
    const p95 = (xs: number[]): number => [...xs].sort((a, z) => a - z)[Math.floor(xs.length * 0.95)] ?? NaN;
    return { tickP95: p95(w.__game.tickTimes), ticks: w.__game.tickTimes.length, renderP95: p95(w.__perf.render), frames: w.__perf.render.length, drawsP95: p95(w.__perf.draws), drawsMax: Math.max(...w.__perf.draws) };
  });
  console.log(JSON.stringify({ ...r, heapStart: heapStart.toFixed(1), heapEnd: heapEnd.toFixed(1) }));
  expect(r.tickP95).toBeLessThanOrEqual(2);
  expect(r.renderP95).toBeLessThanOrEqual(8);
  expect(r.drawsP95).toBeLessThanOrEqual(30);
  expect(heapEnd - heapStart).toBeLessThan(2);
});
