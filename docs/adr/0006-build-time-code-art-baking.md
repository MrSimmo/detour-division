# 0006. Bake code-generated art at build time into manifest-keyed atlases

Date: 2026-09-24
Status: Accepted (M0 review, 2026-09-25)
Spec: DESIGN.md §16.1–16.2

## Context
All v1 art is drawn in code, and hand-painted PNG atlases must later drop in under the same keys with no code changes. Atlas pages are capped at 2048². Turret heads need 16 or more facings with fixed lighting, and phones must start quickly.

## Decision
- `src/art/` holds Canvas 2D drawing functions.
- `npm run bake-art` runs them in Playwright's headless Chromium (already a dev dependency). An in-house MaxRects packer packs the frames into atlas pages of at most 2048² at @1x and @2x, in Pixi spritesheet JSON. The same run writes the UI atlas, the PWA icons, and `public/assets/manifest.json`, which maps keys to frames.
- The baked output is committed to git, so `npm run build` does not need Chromium.
- At runtime the game loads atlases only through the manifest. It never draws art.
- Turret heads are baked in 16 facings. The renderer rotates the nearest facing by the remainder (at most ±11.25°).

## Alternatives Considered
- Baking at runtime on first launch: seconds of drawing on phones, a second code path, and the drop-in PNG path would go unexercised.
- Baking on every build: puts Chromium in CI and in every build. At the M0 review, committing the baked output was chosen instead.
- `@napi-rs/canvas` or `skia-canvas` in Node: an extra native dependency when Playwright's Chromium is already available.
- 32 facings: about 4 @2x pages for heads alone, which is too much GPU memory for phones.
- Rotating one top-down head sprite: its baked lighting would rotate with it, breaking the fixed top-left light.

## Consequences
Runtime loading is identical for code art and painted art. Adds roughly 5–15 MB of committed PNGs, all of it precached for offline use. Art changes need a re-bake; there is a `--watch` mode for development, and `/dev/art.html` for review.
