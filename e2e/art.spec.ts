// V-9 (DESIGN.md §16.7): read straight from the baked atlases, every tree with a trunk under a crown is
// opaque all the way up the line through its trunk, from the foot to the top of the crown.
import { expect, test } from '@playwright/test';

const TREES = ['terrain.z1.tree.0', 'terrain.z1.tree.1', 'terrain.z1.tree.2', 'terrain.z3.tree.0', 'terrain.z3.tree.1', 'terrain.z3.tree.2'];

test('V-9: no tree has a gap between its trunk and its crown, at either scale', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the atlases are the same files in every engine');
  await page.goto('/?e2e&auto=title');
  const gaps = await page.evaluate(async (keys) => {
    type Frame = { frame: { x: number; y: number; w: number; h: number }; spriteSourceSize: { x: number; y: number }; sourceSize: { w: number; h: number }; anchor: { x: number; y: number } };
    const base = new URL('assets/', location.href);
    const manifest = (await (await fetch(new URL('manifest.json', base))).json()) as { sprites: Record<string, string>; atlases: Record<string, Record<string, string[]>> };
    const out: string[] = [];
    for (const scale of ['1', '2']) {
      for (const key of keys) {
        for (const page of manifest.atlases[manifest.sprites[key]!]![scale]!) {
          const atlas = (await (await fetch(new URL(page, base))).json()) as { frames: Record<string, Frame>; meta: { image: string } };
          const f = atlas.frames[key];
          if (!f) continue;
          const img = await createImageBitmap(await (await fetch(new URL(page.replace(/[^/]+$/, atlas.meta.image), base))).blob());
          const c = new OffscreenCanvas(f.frame.w, f.frame.h);
          const g = c.getContext('2d')!;
          g.drawImage(img, f.frame.x, f.frame.y, f.frame.w, f.frame.h, 0, 0, f.frame.w, f.frame.h);
          const x = Math.round(f.anchor.x * f.sourceSize.w - f.spriteSourceSize.x);
          const foot = Math.round(f.anchor.y * f.sourceSize.h - f.spriteSourceSize.y - 2 * Number(scale));
          const a = g.getImageData(x, 0, 1, f.frame.h).data;
          let top = foot;
          for (let y = 0; y <= foot; y++) {
            if (a[y * 4 + 3]! > 200) {
              top = y;
              break;
            }
          }
          const holes: number[] = [];
          for (let y = top; y <= foot; y++) if (a[y * 4 + 3]! <= 200) holes.push(y);
          if (holes.length) out.push(`${key} @${scale}x: ${holes.length} clear px between the crown top (y ${top}) and the foot (y ${foot}), from y ${holes[0]} to ${holes[holes.length - 1]}`);
        }
      }
    }
    return out;
  }, TREES);
  expect(gaps).toEqual([]);
});

test('V-10: a Zone 1 gate lane runs into the field with no edge', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine is enough for a measurement of the painted ground');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?e2e&auto=title');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForSelector('.map-screen');
  await page.evaluate(() => (window as unknown as { __app: { play(id: string, o: object): void } }).__app.play('z1-01', { difficulty: 'casual', loadout: ['rattler'], endless: false }));
  await page.waitForSelector('#hud');
  await page.keyboard.press('r');
  await page.waitForTimeout(500);
  // Primrose Lane's west gate (rows 5–7): across the lane's middle rows, from 2.5 cells outside the
  // field's edge to 2.5 cells inside it, the brightest column-to-column step in mean brightness.
  const geo = await page.evaluate(() => {
    const w = (window as unknown as { __game: { scene: { world: { x: number; y: number; scale: { x: number } } } } }).__game.scene.world;
    return { x: w.x, y: w.y, cell: 64 * w.scale.x };
  });
  const png = (await page.screenshot()).toString('base64');
  const step = await page.evaluate(
    async ({ png, g }) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
      const x0 = Math.max(0, Math.round(g.x - 2.5 * g.cell));
      const x1 = Math.round(g.x + 2.5 * g.cell);
      const y0 = Math.round(g.y + 5.35 * g.cell);
      const y1 = Math.round(g.y + 7.65 * g.cell);
      const c = new OffscreenCanvas(x1 - x0, y1 - y0);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, -x0, -y0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const col = Array.from({ length: c.width }, (_, x) => {
        let s = 0;
        for (let y = 0; y < c.height; y++) {
          const i = (y * c.width + x) * 4;
          s += 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
        }
        return s / c.height;
      });
      const smooth = col.map((_, i) => {
        const w = col.slice(Math.max(0, i - 1), i + 2);
        return w.reduce((a, b) => a + b, 0) / w.length;
      });
      return Math.max(...smooth.slice(1).map((v, i) => Math.abs(v - smooth[i]!)));
    },
    { png, g: geo },
  );
  expect(step).toBeLessThanOrEqual(5);
});
