Phone UI is sized from the screen, not the playfield, and checked by measuring rendered text in px; a screenshot "looks fine" at 0.69 scale was how 5–9 px text shipped.

- **Measure text, not just fit.** R-LAYOUT-3 (fits, doesn't scroll) passed while Settings text was 6 px. `smallText()` in `e2e/helpers.ts` (V-8) is the check that bites; it failed with "Master (8.9 px)" when the old scale was put back.
- **A CSS px on a phone is about 0.17 mm** (against about 0.26 mm on a desktop monitor), and phones are held closer, so phone UI wants about the desktop reference sizes: `--ui-scale` near 1, never below 0.9 (ADR-0013).
- **`#ui > * { pointer-events: auto }` outranks any class selector.** A full-window layer under `#ui` must be written as `#ui > .that-layer { pointer-events: none }`, or it swallows every press. That is why dragging the world map never worked until v1.2.
- **The dialog fit can't shrink what has a floor** (`--tap`, `vw` caps). Shrinking a card narrowed a wrapping grid of 44 px entries into a taller one, and the fit chased it down to 0.45. Give grids a fixed column count, and floor the fit (touch: 0.9 effective scale).
- **Emulating the iPhone 17 Pro in Safari, landscape:** Playwright at 874×378, DPR 3, `isMobile`, `hasTouch`, with `?e2e&safe=0,62,20,62`; with Safari's toolbar showing, 874×334. `simctl` can't rotate or tap, so the Simulator can't check landscape (see `ios-simulator.md`).
- **Two-finger gestures in e2e:** CDP `Input.dispatchTouchEvent` with two `touchPoints` (Chromium only); `page.touchscreen` only taps.
