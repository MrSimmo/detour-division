# 0009. Ship atlases as lossy WebP at quality 0.9

Date: 2026-09-25
Status: Accepted
Spec: DESIGN.md §16, §19, §20
Supersedes: the PNG output in ADR-0006 (the rest of ADR-0006 stands)

## Context
The service worker precaches every asset at install (§20). The baked atlases came to 53 MB of PNG across @1x and @2x. That's a slow first install on a phone, and a large share of the storage that Safari may clear from sites that aren't installed.

## Decision
`bake-art` encodes every atlas page as WebP at quality 0.9, using Chromium's canvas encoder. Pages and their spritesheet JSON name `*.webp`. Both scales are precached, because the scale is chosen at boot from the device and the service worker can't know it at install.

Measured on the M4 atlases:

| Format | Size |
|---|---|
| PNG | 55.9 MB |
| WebP, lossless | 28.4 MB |
| WebP, quality 0.9 | 14.9 MB (the bake produced 14.98 MB) |

A 2× nearest-neighbour comparison of tower and unit crops showed no visible difference: outlines, highlights and alpha edges all hold up.

## Alternatives Considered
- **Keep PNG:** four times the size, for no visible gain.
- **Lossless WebP:** half the size, but still twice what lossy needs.
- **Precache only one scale:** the service worker can't tell the device's pixel ratio at install, and fetching the other scale later would break the promise of no runtime requests.
- **GPU-compressed textures (KTX2/Basis):** a transcoder dependency and an extra build tool, for a sprite game that's comfortably inside the GPU memory budget.

## Consequences
- WebP needs Safari 14 or later, which is inside the §18.1 targets.
- Hand-painted replacement atlases can still be PNG. The manifest names each page by file, and Pixi loads either.
- Re-baking changes every page file. The atlases are committed (§0.2), so each re-bake adds about 15 MB to the repository's history rather than 53.
