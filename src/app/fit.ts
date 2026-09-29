// DESIGN.md §18.2 items 6–7 and V-2: the UI scale outside a level, the minimum target size, and
// dialogs that shrink to fit the window instead of scrolling (R-LAYOUT-3).
import { levels } from './data.ts';
import { computeLayout, TOUCH_MIN_SCALE } from './layout.ts';
import { deviceClass, safeInsets } from './platform.ts';

/** Menus take their scale from this level laid out for the window (§18.2 item 6). */
const REFERENCE_LEVEL = 'z1-01';
/** V-2: a desktop window smaller than this may shrink targets, in proportion, down to MIN_TAP. */
const FULL_W = 1366;
const FULL_H = 768;
const TAP = 44;
const MIN_TAP = 24;
/** On desktop a dialog never shrinks below this share of its natural size (touch devices: TOUCH_MIN_SCALE). */
const MIN_FIT = 0.45;

const root = document.documentElement;

export function setUiScale(s: number): void {
  root.style.setProperty('--ui-scale', s.toFixed(3));
}

/** The UI scale for menus in the current window. */
export function menuScale(): number {
  const lv = levels[REFERENCE_LEVEL]!;
  return computeLayout({ w: innerWidth, h: innerHeight, safe: safeInsets(), cols: lv.grid.cols + 2, rows: lv.grid.rows + 2, device: deviceClass() }).uiScale;
}

export function applyMenuScale(): void {
  setUiScale(menuScale());
}

/** V-2: 44 px targets, except in a desktop window smaller than 1366×768. */
export function applyTapSize(): void {
  const k = deviceClass() === 'desktop' ? Math.min(1, innerWidth / FULL_W, innerHeight / FULL_H) : 1;
  root.style.setProperty('--tap', `${Math.max(MIN_TAP, Math.round(TAP * k))}px`);
}

/** Scales every open dialog (`.overlay > .card`) down through its --fit until it fits the safe viewport. */
export function fitDialogs(): void {
  const safe = safeInsets();
  // Overlays centre their dialog in the safe area, and the map bar sits inside it (styles.css).
  for (const [side, px] of Object.entries(safe)) root.style.setProperty(`--safe-${side}`, `${px}px`);
  const scale = parseFloat(getComputedStyle(root).getPropertyValue('--ui-scale')) || 1;
  // The card's wood frame and drop shadow are box-shadows, outside its box: keep room for them. The drop
  // shadow may fall into the bottom inset (the home indicator's strip); the frame may not.
  const margin = Math.max(4 + 11 * scale, 8 + 14 * scale - safe.b);
  const availW = innerWidth - safe.l - safe.r - margin * 2;
  const availH = innerHeight - safe.t - safe.b - margin * 2;
  // Short-screen dialogs cap their width at this (styles.css), so the insets are respected even where
  // env(safe-area-inset-*) is emulated (the e2e ?safe= hook).
  root.style.setProperty('--avail-w', `${Math.floor(availW)}px`);
  const cards = document.querySelectorAll<HTMLElement>('.overlay > .card');
  if (!cards.length) return;
  // §16.4: on a touch device a dialog shrinks only to the legibility floor.
  const touch = deviceClass() !== 'desktop';
  const minFit = touch ? Math.min(1, TOUCH_MIN_SCALE / scale) : MIN_FIT;
  for (const card of cards) {
    let fit = 1;
    card.style.setProperty('--fit', '1');
    card.classList.remove('scrolls');
    card.style.maxHeight = '';
    // Floors (--tap, vw caps) don't scale, so one ratio may not be enough: repeat a few times.
    for (let i = 0; i < 5; i++) {
      const size = extent(card);
      const r = Math.min(availW / size.w, availH / size.h);
      if (r >= 0.995 || fit <= minFit) break;
      fit = Math.max(minFit, fit * r * 0.99);
      card.style.setProperty('--fit', fit.toFixed(3));
    }
    // At the floor and still too tall for a touch screen: scroll rather than shrink the text (§18.2 item 7).
    if (touch && fit <= minFit && extent(card).h > availH + 1) {
      card.classList.add('scrolls');
      card.style.maxHeight = `${Math.floor(availH)}px`;
    }
  }
}

/** The card's size including anything spilling out of it (a row of buttons wider than its column),
 * in layout px: the entrance animation's scale is divided out. */
function extent(card: HTMLElement): { w: number; h: number } {
  const box = card.getBoundingClientRect();
  const k = box.width / (card.offsetWidth || 1) || 1;
  let right = box.right;
  let bottom = box.bottom;
  for (const el of card.querySelectorAll('*')) {
    const q = el.getBoundingClientRect();
    if (q.width === 0 && q.height === 0) continue;
    if (q.right > right) right = q.right;
    if (q.bottom > bottom) bottom = q.bottom;
  }
  // Content spills to the right and below; the card is centred, so count the spill on both sides.
  return { w: (box.width + 2 * (right - box.right)) / k, h: (box.height + 2 * (bottom - box.bottom)) / k };
}

let queued = false;

export function scheduleFit(): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    fitDialogs();
  });
}

/** Refits dialogs whenever one opens, changes size (a tab switch, a notice) or the window resizes. */
export function watchDialogs(ui: HTMLElement): void {
  const sizes = new ResizeObserver(() => scheduleFit());
  new MutationObserver((records) => {
    let touched = false;
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (!(n instanceof HTMLElement)) continue;
        for (const card of n.matches('.overlay > .card') ? [n] : n.querySelectorAll<HTMLElement>('.overlay > .card')) sizes.observe(card);
        if (n.closest('.overlay') || n.querySelector('.overlay')) touched = true;
      }
      if (r.target instanceof HTMLElement && r.target.closest('.overlay')) touched = true;
    }
    if (touched) scheduleFit();
  }).observe(ui, { childList: true, subtree: true });
  window.addEventListener('resize', () => {
    applyTapSize();
    scheduleFit();
  });
}
