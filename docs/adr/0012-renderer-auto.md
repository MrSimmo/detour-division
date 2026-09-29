# 0012. The renderer setting defaults to Auto, which prefers WebGL

Date: 2026-09-25
Status: Accepted (v1.1 review)
Spec: DESIGN.md §19, §18.3 (screen 8), §20 (profile v4)

## Context
Settings offered "WebGL" or "WebGPU", with WebGL the default. Players can't be expected to know what those are. The request was for an automatic choice that gives the best performance the device can manage.

The two were measured on the R-PERF-1 scene (The Last Roundabout, Heroic, 300 enemies at 3×, heavy effects), on a production build and an Apple-silicon GPU. The figures are CPU milliseconds per rendered frame, p50 / p95, over 15 s:

| Engine | WebGL | WebGPU |
|---|---|---|
| Chromium (ANGLE on Metal) | 0.90 / 1.20 | 1.10 / 1.40 |
| Chromium, 4× CPU throttling | 4.20 / 5.80 | 4.50 / 6.10 |
| WebKit | 1.0 / 2.0 | 1.0 / 2.0 |

Both held 60 fps with no errors. The game is CPU-bound on phones (§19), and WebGPU is never faster here. PixiJS's own guidance calls WebGL "recommended for production" and WebGPU "feature-complete but still experimental; browser implementations have inconsistencies".

## Decision
- The setting becomes **Auto** (the default), **WebGL** or **WebGPU**.
- **Auto** asks PixiJS for `['webgl', 'webgpu']`: WebGL where it's supported, WebGPU otherwise, and never the canvas renderer, which the game doesn't support. If the chosen renderer then fails to start, the game tries the other.
- **WebGPU** keeps its one-time notice in Settings when it falls back to WebGL.
- Each option has a tooltip in plain words (§18.6).
- Profile v4. The v3 value `webgl` becomes `auto`. It was the default, so almost nobody chose it, and Auto starts WebGL anyway: nobody's renderer changes.

## Alternatives Considered
- **Auto prefers WebGPU where available:** slower in every measurement here, and the renderer PixiJS warns about.
- **A benchmark on first launch:** seconds of work before the menu, noisy on phones that throttle, and it wouldn't beat the measured result above.
- **Remove the setting:** a player whose driver has a WebGL bug would lose the way round it.

## Consequences
- Auto behaves like the old default today. If a later PixiJS or browser release makes WebGPU faster, re-run the comparison (`node tools/dev/renderer-bench.ts <url>` against a preview build) and change the Auto order in `src/main.ts`, with a superseding ADR.
- Only Chromium and WebKit on Apple silicon were measured. Android GPUs were not.
