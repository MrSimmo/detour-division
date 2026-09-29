// R-LANE-2 (DESIGN.md §9.1, ADR-0014): ground units walk on from off screen, and a leaker is drawn walking
// on down its exit lane until it's off screen. Kettle Crossing at 1440×789, a typical laptop browser window, shows
// 2.9 cells of the entrance lane and 5.1 of the exit lane, more than the 2.75 cells units walked at v1.3.
import { expect, test } from '@playwright/test';
import { watch } from './helpers.ts';

type Box = { minX: number; maxX: number; minY: number; maxY: number };
type View = { id: number; body: { getBounds(): Box } };
type G = {
  speed: number;
  sim: { state: { enemies: { id: number }[]; lives: number } };
  scene: { enemies: Map<number, View>; leavers: { v: View }[]; covers: { getBounds(): Box }[] };
};

test('R-LANE-2: units walk on from off screen, and leakers walk off it', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the drawing is the same in every engine');
  const w = watch(page);
  await page.setViewportSize({ width: 1440, height: 789 });
  await page.goto('/?e2e&auto=title');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForSelector('.map-screen');
  await page.evaluate(() => (window as unknown as { __app: { play(id: string, o: object): void } }).__app.play('z1-05', { difficulty: 'casual', loadout: ['rattler'], endless: false }));
  await page.waitForSelector('#hud');

  // 1: frozen the moment they appear, every unit is off the screen and under the trees closing its lane.
  await page.evaluate(() => {
    const win = window as unknown as { __game: G; __spawn(type: string): number };
    win.__game.speed = 0;
    for (const t of ['footling', 'tinkettle', 'scarper']) win.__spawn(t);
  });
  await page.waitForTimeout(300);
  const spawned = await page.evaluate(() => {
    const g = (window as unknown as { __game: G }).__game;
    return [...g.scene.enemies.values()].map((v) => {
      const b = v.body.getBounds();
      const under = g.scene.covers.some((c) => {
        const r = c.getBounds();
        return b.minX >= r.minX && b.maxX <= r.maxX && b.minY >= r.minY && b.maxY <= r.maxY;
      });
      return { maxX: b.maxX, under };
    });
  });
  expect(spawned.length).toBe(3);
  for (const s of spawned) {
    expect(s.maxX, 'off the left of the screen').toBeLessThanOrEqual(0);
    expect(s.under, 'under the trees at the lane end').toBe(true);
  }

  // 2: each leaker is still drawn after the simulation lets it go, and is removed only at the screen's edge.
  await page.evaluate(() => {
    const win = window as unknown as { __game: G; __lastX: Record<number, number>; __gone: number[] };
    win.__lastX = {};
    win.__gone = [];
    const seen = new Set<number>();
    const frame = (): void => {
      const now = new Set(win.__game.scene.leavers.map((l) => l.v.id));
      for (const l of win.__game.scene.leavers) win.__lastX[l.v.id] = l.v.body.getBounds().minX;
      for (const id of seen) if (!now.has(id)) win.__gone.push(id);
      for (const id of now) seen.add(id);
      for (const id of win.__gone) seen.delete(id);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    win.__game.speed = 3;
  });
  await page.waitForFunction(() => (window as unknown as { __game: G }).__game.scene.leavers.length > 0, null, { timeout: 60000 });
  const leaving = await page.evaluate(() => {
    const g = (window as unknown as { __game: G }).__game;
    const l = g.scene.leavers[0]!;
    return { inSim: g.sim.state.enemies.some((e) => e.id === l.v.id), minX: l.v.body.getBounds().minX, lives: g.sim.state.lives };
  });
  expect(leaving.inSim, 'the simulation has let it go').toBe(false);
  expect(leaving.lives).toBeLessThan(20);
  expect(leaving.minX, 'still on screen').toBeLessThan(1440);
  await page.waitForFunction(() => {
    const g = (window as unknown as { __game: G }).__game;
    return g.sim.state.enemies.length === 0 && g.scene.leavers.length === 0;
  }, null, { timeout: 90000 });
  const last = await page.evaluate(() => {
    const win = window as unknown as { __lastX: Record<number, number>; __gone: number[] };
    return win.__gone.map((id) => win.__lastX[id]!);
  });
  expect(last.length, 'all three walked out').toBe(3);
  // A Scarper covers about 6 px a frame at 3×; the old leak point was 2.3 cells (about 140 px) short of the edge.
  for (const x of last) expect(x, 'last drawn at the edge of the screen').toBeGreaterThan(1440 - 20);
  expect(w.errors).toEqual([]);
});
