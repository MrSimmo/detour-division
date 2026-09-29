// Screenshots at the §23.2 viewports plus the layout checks of R-LAYOUT-1 to 5, R-HUD-1, V-2 and V-8.
import { expect, test, type Page } from '@playwright/test';
import { boot, cellCentre, fitProblems, smallText, startLevel, watch } from './helpers.ts';

const VIEWPORTS = [
  { name: 'iphone-se-landscape', width: 667, height: 375, dpr: 2, touch: true, safe: '' },
  { name: 'iphone-large-landscape', width: 932, height: 430, dpr: 3, touch: true, safe: '&safe=0,59,21,59' },
  // The v1.2 phone review's reference size: iPhone 17 Pro, Safari, landscape.
  { name: 'iphone-17-pro-safari', width: 874, height: 378, dpr: 3, touch: true, safe: '&safe=0,62,20,62' },
  { name: 'ipad-portrait', width: 820, height: 1180, dpr: 2, touch: true, safe: '&safe=24,0,20,0' },
  { name: 'ipad-landscape', width: 1180, height: 820, dpr: 2, touch: true, safe: '&safe=24,0,20,0' },
  { name: 'desktop-1366', width: 1366, height: 768, dpr: 1, touch: false, safe: '' },
  { name: 'desktop-1080p', width: 1920, height: 1080, dpr: 1, touch: false, safe: '' },
  { name: 'desktop-4k', width: 3840, height: 2160, dpr: 1, touch: false, safe: '' },
];

async function checkLayout(page: Page, safe: string): Promise<boolean> {
  const [t = 0, r = 0, b = 0, l = 0] = safe ? safe.replace('&safe=', '').split(',').map(Number) : [];
  const res = await page.evaluate(
    ([st, sr, sb, sl]) => {
      const W = innerWidth;
      const H = innerHeight;
      const doc = document.scrollingElement!;
      const rects = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].map((e) => e.getBoundingClientRect());
      const clusters = rects('#hud .hud-cluster');
      const bar = rects('#buildbar')[0]!;
      const rails = document.getElementById('hud')!.classList.contains('rails');
      const pf = (window as unknown as { __game: { layoutState: { playfield: { x: number; y: number; w: number; h: number } } } }).__game.layoutState.playfield;
      const field = new DOMRect(pf.x, pf.y, pf.w, pf.h);
      const inside = [...clusters, bar].every((q) => q.left >= sl - 1 && q.top >= st - 1 && q.right <= W - sr + 1 && q.bottom <= H - sb + 1);
      const overlap = (a: DOMRect, c: DOMRect) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
      let overlaps = 0;
      const all = [...clusters, bar];
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (overlap(all[i]!, all[j]!)) overlaps++;
      const small = [...document.querySelectorAll<HTMLElement>('button')].filter((e) => {
        const q = e.getBoundingClientRect();
        return q.width > 0 && (q.width < 43.5 || q.height < 43.5);
      }).length;
      // R-HUD-1: one top-face height and aligned tops across the top HUD. In the phone rails the plates
      // stack instead, with their left edges aligned, and the two-line wave plate is exempt.
      const faces = rects(rails ? '#hud .plate:not(.wave), #hud .btn' : '#hud .plate, #hud .btn');
      const spread = (a: number[]) => Math.max(...a) - Math.min(...a);
      const edges = rails ? rects('#hud .plate, #hud .next-wave .btn').map((q) => q.left) : faces.map((q) => q.top);
      // R-LAYOUT-4: nothing in the HUD or the build bar covers the map, border included.
      const onField = [...clusters, ...rects('#buildbar .slot')].filter((q) => overlap(q, field)).length;
      return { scrollW: doc.scrollWidth, scrollH: doc.scrollHeight, W, H, inside, overlaps, small, faceSpread: spread(faces.map((q) => q.height)), edgeSpread: spread(edges), onField, rails };
    },
    [t, r, b, l] as const,
  );
  expect(res.scrollW).toBeLessThanOrEqual(res.W);
  expect(res.scrollH).toBeLessThanOrEqual(res.H);
  expect(res.inside).toBe(true);
  expect(res.overlaps).toBe(0);
  expect(res.small).toBe(0);
  expect(res.faceSpread).toBeLessThanOrEqual(1);
  expect(res.edgeSpread).toBeLessThanOrEqual(1);
  expect(res.onField).toBe(0);
  return res.rails;
}

for (const v of VIEWPORTS) {
  test.describe(v.name, () => {
    test.use({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dpr, hasTouch: v.touch, isMobile: v.touch && v.width < 1000 });

    test('title, level and tower panel fit and look right', async ({ page }, info) => {
      const w = watch(page);
      await page.goto(`/?e2e${v.safe}`);
      await expect(page.getByRole('button', { name: 'Tap to start' })).toBeVisible();
      await page.screenshot({ animations: 'disabled', path: info.outputPath(`${v.name}-0-splash.png`) });
      await boot(page, v.safe);
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
      await page.screenshot({ animations: 'disabled', path: info.outputPath(`${v.name}-1-title.png`) });
      // R-LAYOUT-3: every dialog fits this viewport without scrolling. V-8: touch text is 11 px or more.
      const legible = async (where: string): Promise<void> => {
        if (v.touch) expect(await smallText(page), `V-8 ${where}`).toEqual([]);
      };
      expect(await fitProblems(page), 'title').toEqual([]);
      await legible('title');
      await page.getByRole('button', { name: 'Settings' }).click();
      for (const tab of ['Sound', 'Display', 'Controls']) {
        await page.getByRole('tab', { name: tab }).click();
        expect(await fitProblems(page), `settings/${tab}`).toEqual([]);
        await legible(`settings/${tab}`);
        await page.screenshot({ animations: 'disabled', path: info.outputPath(`${v.name}-1-settings-${tab.toLowerCase()}.png`) });
      }
      await page.getByRole('button', { name: 'Done' }).click();
      await page.getByRole('button', { name: 'Field guide' }).click();
      expect(await fitProblems(page), 'guide').toEqual([]);
      await legible('guide');
      await page.getByRole('tab', { name: 'Enemies' }).click();
      expect(await fitProblems(page), 'guide/enemies').toEqual([]);
      await page.getByRole('button', { name: 'Close' }).click();
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ animations: 'disabled', path: info.outputPath(`${v.name}-1b-map.png`) });
      await page.getByRole('button', { name: /^Primrose Lane/ }).click();
      expect(await fitProblems(page), 'briefing').toEqual([]);
      await legible('briefing');
      await page.screenshot({ animations: 'disabled', path: info.outputPath(`${v.name}-1c-briefing.png`) });
      await startLevel(page, v.safe);
      await page.waitForTimeout(300);
      // Phones use the rails arrangement (R-LAYOUT-4); nothing else does.
      expect(await checkLayout(page, v.safe)).toBe(v.touch && v.width < 1000 && v.height < 500);
      await legible('level');
      await page.screenshot({ animations: 'disabled', path: info.outputPath(`${v.name}-2-level.png`) });
      await page.evaluate(() => {
        const g = (window as unknown as { __game: { command(c: unknown): unknown; select(id: number): void; sim: { state: { towers: { id: number }[] } } } }).__game;
        for (const [cx, cy] of [[6, 4], [6, 5], [6, 6], [6, 7], [9, 8], [9, 7]]) g.command({ t: 'build', tower: 'rattler', cx, cy });
        g.command({ t: 'callWave' });
      });
      await page.waitForTimeout(3500);
      const p = await cellCentre(page, 6, 5);
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(350);
      await page.screenshot({ animations: 'disabled', path: info.outputPath(`${v.name}-3-panel.png`) });
      await checkLayout(page, v.safe);
      await legible('panel');
      // The tower panel stays on the screen.
      const panel = await page.locator('.panel').boundingBox();
      expect(panel).not.toBeNull();
      expect(panel!.y + panel!.height).toBeLessThanOrEqual(v.height + 1);
      expect(w.errors).toEqual([]);
    });
  });
}

test.describe('R-LAYOUT-5: the world map on a phone', () => {
  test.use({ viewport: { width: 874, height: 378 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });

  test('pinches out to the whole map and back in to 1.5×, and a drag from a medallion pans', async ({ page }) => {
    const w = watch(page);
    await boot(page, '&ios=0&safe=0,62,20,62');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const node = page.getByRole('button', { name: /^Primrose Lane/ });
    await node.waitFor();
    const cdp = await page.context().newCDPSession(page);
    type Pt = { x: number; y: number; id: number };
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: Pt[] = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    const zoom = () => page.evaluate(() => (window as unknown as { __map: { zoom(): { k: number; fit: number; open: number } } }).__map.zoom());
    const pinch = async (from: number, to: number): Promise<void> => {
      const pts = (d: number): Pt[] => [{ x: 437 - d, y: 220, id: 1 }, { x: 437 + d, y: 220, id: 2 }];
      await touch('touchStart', pts(from));
      for (let i = 1; i <= 12; i++) await touch('touchMove', pts(from + ((to - from) * i) / 12));
      await touch('touchEnd');
    };
    const opening = await zoom();
    expect(opening.k).toBeCloseTo(opening.open, 6);
    await pinch(150, 20);
    const out = await zoom();
    expect(out.k).toBeCloseTo(out.fit, 6);
    const outside = await page.evaluate(() => [...document.querySelectorAll('.node')].filter((n) => { const q = n.getBoundingClientRect(); return q.left < 0 || q.top < 0 || q.right > innerWidth || q.bottom > innerHeight; }).length);
    expect(outside).toBe(0);
    await pinch(20, 400);
    await pinch(20, 400);
    const inn = await zoom();
    expect(inn.k).toBeCloseTo(inn.open * 1.5, 6);
    // Back to the opening view, then drag the map by a medallion: it moves, and the level doesn't open.
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await node.waitFor();
    const before = (await node.boundingBox())!;
    const at = { x: before.x + before.width / 2, y: before.y + before.height / 2, id: 1 };
    await touch('touchStart', [at]);
    // Leftwards: the map opens centred on Primrose Lane, near its left edge, so it can't go further right.
    for (let i = 1; i <= 8; i++) await touch('touchMove', [{ ...at, x: at.x - 15 * i }]);
    await touch('touchEnd');
    await page.waitForTimeout(300);
    const after = (await node.boundingBox())!;
    expect(before.x - after.x).toBeGreaterThan(60);
    await expect(page.locator('.briefing')).toHaveCount(0);
    // A tap still opens it.
    await node.tap();
    await expect(page.locator('.briefing')).toBeVisible();
    expect(w.errors).toEqual([]);
  });
});

test.describe('phone portrait', () => {
  test.use({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  test('shows the rotate prompt (R-LAYOUT-2)', async ({ page }, info) => {
    await page.goto('/?e2e');
    await expect(page.locator('#rotate')).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: info.outputPath('phone-portrait-rotate.png') });
  });
});
