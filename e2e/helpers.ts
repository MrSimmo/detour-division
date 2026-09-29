import { expect, type Page } from '@playwright/test';

export interface Watch {
  errors: string[];
}

/** Fails the test on any console error, page error or failed request (§23.2). */
export function watch(page: Page): Watch {
  const w: Watch = { errors: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') w.errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => w.errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => w.errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol !== 'data:' && u.protocol !== 'blob:') w.errors.push(`offsite request: ${r.url()}`);
  });
  return w;
}

/** Grants stars so every tower is unlocked (test profiles only). */
export async function grantStars(page: Page, n = 60): Promise<void> {
  await page.evaluate((stars) => {
    const p = (window as unknown as { __profile: { stars: Record<string, number> } }).__profile;
    p.stars['e2e-grant'] = stars;
  }, n);
}

/** Loads the game and taps through the boot splash (the gesture that unlocks audio) to the title. */
export async function boot(page: Page, query = ''): Promise<void> {
  await page.goto(`/?e2e${query}`);
  await page.getByRole('button', { name: 'Tap to start' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
}

/** Splash → title → world map → briefing → level, through the real UI. */
export async function startLevel(page: Page, query = '', difficulty: 'Casual' | 'Tough' | 'Heroic' = 'Casual'): Promise<void> {
  await boot(page, query);
  await openPrimrose(page, difficulty);
}

/** From the title: world map → Primrose Lane's briefing → the level. */
export async function openPrimrose(page: Page, difficulty: 'Casual' | 'Tough' | 'Heroic' = 'Casual'): Promise<void> {
  await grantStars(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: /^Primrose Lane/ }).click();
  await page.getByRole('radio', { name: new RegExp(`^${difficulty}`) }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('#buildbar .slot').first()).toBeVisible();
  await page.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game));
}

export async function cellCentre(page: Page, cx: number, cy: number): Promise<{ x: number; y: number }> {
  return page.evaluate(([x, y]) => (window as unknown as { __game: { toScreen(a: number, b: number): { x: number; y: number } } }).__game.toScreen(x + 0.5, y + 0.5), [cx, cy] as const);
}

export async function towers(page: Page): Promise<{ type: string; cx: number; cy: number }[]> {
  return page.evaluate(() => (window as unknown as { __game: { sim: { state: { towers: { type: string; cx: number; cy: number }[] } } } }).__game.sim.state.towers.map((t) => ({ type: t.type, cx: t.cx, cy: t.cy })));
}

/** V-8: visible UI text below 11 CSS px (on the topmost overlay when one is open), as "text (size)". */
export async function smallText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const top = [...document.querySelectorAll('.overlay')].pop();
    const scope = top ?? document.getElementById('ui')!;
    const bad: string[] = [];
    for (const el of scope.querySelectorAll<HTMLElement>('*')) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
      const q = el.getBoundingClientRect();
      if (q.width === 0 || q.bottom < 0 || q.top > innerHeight || el.closest('.visually-hidden')) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < 10.95) bad.push(`${el.textContent!.trim().slice(0, 24)} (${px.toFixed(1)} px)`);
    }
    return bad;
  });
}

/** R-LAYOUT-3: every open dialog inside the viewport, and no scroll container hiding content. */
export async function fitProblems(page: Page): Promise<string[]> {
  // The dialog entrance animation scales the card; wait it out, and the 250 ms resize budget.
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const W = innerWidth;
    const H = innerHeight;
    const bad: string[] = [];
    for (const card of document.querySelectorAll<HTMLElement>('.overlay > .card')) {
      const q = card.getBoundingClientRect();
      const name = card.getAttribute('aria-label') ?? card.className;
      if (q.left < -1 || q.top < -1 || q.right > W + 1 || q.bottom > H + 1) bad.push(`${name} at ${Math.round(q.left)},${Math.round(q.top)}–${Math.round(q.right)},${Math.round(q.bottom)} in ${W}×${H}`);
      // Nothing spills out of the card, and no control is off the screen.
      for (const el of card.querySelectorAll<HTMLElement>('button, input, textarea, .setting, .row')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > q.right + 1 || r.bottom > q.bottom + 1 || r.left < q.left - 1) bad.push(`${name}: ${el.className || el.tagName} "${el.textContent?.trim().slice(0, 20)}" spills out of the card`);
      }
      for (const el of [card, ...card.querySelectorAll<HTMLElement>('*')]) {
        const cs = getComputedStyle(el);
        if (!/(auto|scroll)/.test(`${cs.overflowX} ${cs.overflowY}`)) continue;
        if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) bad.push(`${name}: ${el.className} scrolls`);
      }
    }
    return bad;
  });
}
