// DESIGN.md §18.2: fit the playfield to the largest size that fits, respecting safe
// areas, with the HUD scaled from the playfield (or, on phones, from the screen). Pure, so it is unit-tested.

export interface Insets {
  t: number;
  r: number;
  b: number;
  l: number;
}

export interface LayoutInput {
  w: number;
  h: number;
  safe: Insets;
  /** Map size in cells including the decorative border. */
  cols: number;
  rows: number;
  device: 'phone' | 'tablet' | 'desktop';
  /** Build-bar slots (the loadout's size); phones size their slots to fit this many. */
  slots?: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  playfield: Rect;
  /** CSS px per cell. */
  cell: number;
  uiScale: number;
  arrangement: 'bottom' | 'side' | 'rails';
  /** Space reserved outside the playfield for the HUD (CSS px, already scaled). */
  bands: { top: number; bottom: number; right: number; left: number };
  /** Rails only (phones, ADR-0013): the HUD column, the build-bar column and the slot's side in CSS px. */
  rails: { hud: Rect; bar: Rect; slot: number } | null;
}

/** Base HUD sizes at --ui-scale 1 (CSS px). */
export const HUD_TOP = 60;
export const BUILD_BAR_H = 92;
export const BUILD_BAR_W = 92;
export const SLOT = 64;
const REF_W = 1280;
const REF_H = 720;
const MIN_TOUCH = 44;
/** §16.4: no touch-device text below this effective scale. */
export const TOUCH_MIN_SCALE = 0.9;

/** The HUD is sized to the playfield: a map this many CSS px wide gets --ui-scale 1. */
const REF_PLAYFIELD_W = 1000;

/** §18.2 item 4: a phone's safe viewport this size gets --ui-scale 1 (an iPhone 17 Pro in Safari, landscape). */
const PHONE_REF_H = 360;
const PHONE_REF_W = 750;
const PHONE_MAX_SCALE = 1.25;

/** Rails (units of --ui-scale): margin round the columns, the HUD's round buttons and gaps, the build bar's gap and lip. */
const RAIL_MARGIN = 6;
const ROUND = 48;
const HUD_GAP = 6;
const BAR_GAP = 4;
const LIP = 5;

export function computeLayout(i: LayoutInput): Layout {
  const availW = i.w - i.safe.l - i.safe.r;
  const availH = i.h - i.safe.t - i.safe.b;
  if (i.device === 'phone') {
    const u = Math.min(PHONE_MAX_SCALE, Math.max(TOUCH_MIN_SCALE, Math.min(availH / PHONE_REF_H, availW / PHONE_REF_W)));
    return rails(i, availW, availH, u);
  }
  const minScale = i.device === 'desktop' ? 0.75 : TOUCH_MIN_SCALE;
  const clampScale = (s: number): number => Math.min(2.5, Math.max(minScale, s));
  // First guess from the screen, then refine from the playfield it produces (the bands
  // depend on the scale and the playfield depends on the bands).
  let uiScale = clampScale(Math.min(availW / REF_W, availH / REF_H));
  let L = arrange(i, availW, availH, uiScale);
  for (let k = 0; k < 3; k++) {
    uiScale = clampScale(L.playfield.w / REF_PLAYFIELD_W);
    L = arrange(i, availW, availH, uiScale);
  }
  return L;
}

/**
 * ADR-0013: the HUD in a column down the left, the build bar down the right, the map between them
 * at full height. The HUD column is three round buttons wide (its foot row); slots are as large as the
 * column's height allows for the loadout, from the 44 px touch minimum up to 64 units.
 */
function rails(i: LayoutInput, availW: number, availH: number, u: number): Layout {
  const m = RAIL_MARGIN * u;
  const hudW = 3 * Math.max(MIN_TOUCH, ROUND * u) + 2 * HUD_GAP * u;
  const n = Math.max(1, i.slots ?? 6);
  const colH = availH - 2 * m;
  const fitted = (colH - n * LIP * u - (n - 1) * BAR_GAP * u) / n;
  const slot = Math.max(MIN_TOUCH, Math.min(SLOT * u, fitted));
  const left = hudW + 2 * m;
  const right = slot + 2 * m;
  const w = availW - left - right;
  const cell = Math.max(1, Math.min(w / i.cols, availH / i.rows));
  const pw = cell * i.cols;
  const ph = cell * i.rows;
  return {
    playfield: { x: i.safe.l + left + (w - pw) / 2, y: i.safe.t + (availH - ph) / 2, w: pw, h: ph },
    cell,
    uiScale: u,
    arrangement: 'rails',
    bands: { top: 0, bottom: 0, left, right },
    rails: {
      hud: { x: i.safe.l + m, y: i.safe.t + m, w: hudW, h: colH },
      bar: { x: i.w - i.safe.r - m - slot, y: i.safe.t + m, w: slot, h: colH },
      slot,
    },
  };
}

function arrange(i: LayoutInput, availW: number, availH: number, uiScale: number): Layout {
  const candidates = (['bottom', 'side'] as const).map((arrangement) => {
    const top = HUD_TOP * uiScale;
    const bottom = arrangement === 'bottom' ? BUILD_BAR_H * uiScale : 0;
    const right = arrangement === 'side' ? BUILD_BAR_W * uiScale : 0;
    const w = availW - right;
    const h = availH - top - bottom;
    const cell = Math.max(1, Math.min(w / i.cols, h / i.rows));
    return { arrangement, top, bottom, right, w, h, cell };
  });
  // Largest map wins; ties go to the bottom bar.
  const best = candidates[1]!.cell > candidates[0]!.cell * 1.02 ? candidates[1]! : candidates[0]!;
  const pw = best.cell * i.cols;
  const ph = best.cell * i.rows;
  const x = i.safe.l + (best.w - pw) / 2;
  const y = i.safe.t + best.top + (best.h - ph) / 2;
  return {
    playfield: { x, y, w: pw, h: ph },
    cell: best.cell,
    uiScale,
    arrangement: best.arrangement,
    bands: { top: best.top, bottom: best.bottom, right: best.right, left: 0 },
    rails: null,
  };
}
