# 0005. DOM overlay for UI; PixiJS for the world

Date: 2026-09-24
Status: Accepted (M0 review, 2026-09-25)
Spec: DESIGN.md §16.5, §18, §21

## Context
The game needs chunky, tactile menus and HUD panels. They must scale with the playfield, respect safe-area insets, have touch targets of at least 44 pt, be navigable by keyboard with remappable keys, and render text crisply at every size from an iPhone SE to 4K.

## Decision
- The world renders in PixiJS: terrain, entities, effects, range rings, the ghost, the route marker, and floating text in world space.
- The HUD, build bar, tower panel, menus, world-map nodes, field guide and settings are DOM elements in a layer above the canvas. They are styled with the CSS tokens in DESIGN.md §16, scaled through `--ui-scale`, and written in plain TypeScript with a small `h()` helper and signals.
- Icons come from the baked UI atlas through the asset manifest, as CSS background frames.

## Alternatives Considered
- UI drawn entirely in Pixi: we would have to rebuild layout, focus handling, ARIA and text wrapping ourselves, and safe-area handling would be awkward.
- A UI framework (Preact or Solid): a runtime dependency the brief discourages, for a modest number of screens.

## Consequences
Accessibility, layout and text quality come mostly for free. There are two rendering systems to keep visually consistent, which is why both draw on the same tokens and the same baked art. The DOM HUD must update only on change, never every frame.
