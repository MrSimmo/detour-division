// R-LAYOUT-1 (geometry half): the playfield always fits inside the safe area, keeps
// the map's aspect ratio, and never overlaps the reserved HUD bands. R-LAYOUT-4: on phones the
// HUD and build bar are rails either side of the map (ADR-0013).
import { describe, expect, it } from 'vitest';
import { computeLayout, type Layout, type LayoutInput, type Rect } from '../../src/app/layout.ts';

const VIEWPORTS: [string, number, number, LayoutInput['device'], Partial<LayoutInput['safe']>][] = [
  ['iPhone SE landscape', 667, 375, 'phone', {}],
  ['large iPhone landscape', 932, 430, 'phone', { l: 59, r: 59, b: 21 }],
  ['iPhone 17 Pro, Safari landscape', 874, 378, 'phone', { l: 62, r: 62, b: 20 }],
  ['iPad portrait', 820, 1180, 'tablet', { t: 24, b: 20 }],
  ['iPad landscape', 1180, 820, 'tablet', { t: 24, b: 20 }],
  ['1366×768', 1366, 768, 'desktop', {}],
  ['1920×1080', 1920, 1080, 'desktop', {}],
  ['4K', 3840, 2160, 'desktop', {}],
];

const none = { t: 0, r: 0, b: 0, l: 0 };
const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('computeLayout', () => {
  for (const [name, w, h, device, safe] of VIEWPORTS) {
    it(`fits the map inside the safe area on ${name}`, () => {
      const s = { ...none, ...safe };
      const L = computeLayout({ w, h, safe: s, cols: 24, rows: 15, device });
      const pf = L.playfield;
      expect(pf.x).toBeGreaterThanOrEqual(s.l + L.bands.left - 1e-6);
      expect(pf.y).toBeGreaterThanOrEqual(s.t + L.bands.top - 1e-6);
      expect(pf.x + pf.w).toBeLessThanOrEqual(w - s.r - L.bands.right + 1e-6);
      expect(pf.y + pf.h).toBeLessThanOrEqual(h - s.b - L.bands.bottom + 1e-6);
      expect(pf.w / pf.h).toBeCloseTo(24 / 15, 6);
      expect(L.cell * 24).toBeCloseTo(pf.w, 6);
      // Touch targets: a build slot is 64 × uiScale CSS px, or the rails' fitted slot.
      expect(L.rails ? L.rails.slot : 64 * L.uiScale).toBeGreaterThanOrEqual(44);
      // §16.4: no touch device below the legibility floor.
      if (device !== 'desktop') expect(L.uiScale).toBeGreaterThanOrEqual(0.9);
    });
  }

  it('picks whichever arrangement gives the larger map (§18.2), and rails on every phone', () => {
    // A 24×15 map is wider than 16:9 leaves room for, so a side bar wins on landscape screens…
    expect(computeLayout({ w: 1920, h: 1080, safe: none, cols: 24, rows: 15, device: 'desktop' }).arrangement).toBe('side');
    // …and the bottom bar wins on tall screens, where it sits in the letterbox.
    expect(computeLayout({ w: 820, h: 1180, safe: none, cols: 24, rows: 15, device: 'tablet' }).arrangement).toBe('bottom');
    expect(computeLayout({ w: 667, h: 375, safe: none, cols: 24, rows: 15, device: 'phone' }).arrangement).toBe('rails');
  });

  it('scales the HUD with the playfield, within limits', () => {
    const small = computeLayout({ w: 1366, h: 768, safe: none, cols: 24, rows: 15, device: 'desktop' });
    const big = computeLayout({ w: 3840, h: 2160, safe: none, cols: 24, rows: 15, device: 'desktop' });
    expect(big.uiScale).toBeGreaterThan(small.uiScale * 2);
    expect(big.uiScale).toBeLessThanOrEqual(2.5);
  });
});

describe('phone rails (R-LAYOUT-4, ADR-0013)', () => {
  const pro: LayoutInput = { w: 874, h: 378, safe: { t: 0, r: 62, b: 20, l: 62 }, cols: 24, rows: 17, device: 'phone' };
  const rails = (L: Layout): NonNullable<Layout['rails']> => L.rails!;

  it('takes the UI scale from the screen: 1 on an iPhone 17 Pro in Safari, 0.9 on an iPhone SE', () => {
    expect(computeLayout(pro).uiScale).toBeCloseTo(0.994, 3);
    expect(computeLayout({ ...pro, w: 667, h: 375, safe: none }).uiScale).toBe(0.9);
    expect(computeLayout({ ...pro, w: 1100, h: 520, safe: none }).uiScale).toBe(1.25);
  });

  it('keeps the HUD and the build bar off the map, left and right of it, inside the safe area', () => {
    for (const [w, h, safe, rows] of [[874, 378, pro.safe, 17], [874, 378, pro.safe, 15], [667, 375, none, 15], [932, 430, { t: 0, r: 59, b: 21, l: 59 }, 13]] as const) {
      const L = computeLayout({ ...pro, w, h, safe, rows });
      const { hud, bar } = rails(L);
      expect(overlaps(hud, L.playfield)).toBe(false);
      expect(overlaps(bar, L.playfield)).toBe(false);
      expect(hud.x + hud.w).toBeLessThanOrEqual(L.playfield.x);
      expect(bar.x).toBeGreaterThanOrEqual(L.playfield.x + L.playfield.w);
      expect(hud.x).toBeGreaterThanOrEqual(safe.l);
      expect(bar.x + bar.w).toBeLessThanOrEqual(w - safe.r);
      expect(hud.y + hud.h).toBeLessThanOrEqual(h - safe.b);
    }
  });

  it('makes the build slots as large as the column allows, from 44 px up to 64 units', () => {
    const L = computeLayout({ ...pro, slots: 6 });
    const u = L.uiScale;
    const six = rails(L);
    // Six slots, each with its 5-unit lip, and 4-unit gaps, fill the column exactly.
    expect(6 * six.slot + 6 * 5 * u + 5 * 4 * u).toBeCloseTo(six.bar.h, 6);
    expect(six.slot).toBeGreaterThan(44);
    expect(rails(computeLayout({ ...pro, slots: 2 })).slot).toBeCloseTo(64 * u, 6);
    expect(rails(computeLayout({ ...pro, h: 300, slots: 6 })).slot).toBe(44);
  });

  it('keeps the map as large as before on a 24×17 map, at full height', () => {
    const L = computeLayout(pro);
    expect(L.playfield.h).toBeCloseTo(358, 6);
  });
});
