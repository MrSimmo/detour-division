# 0013. Phones use side rails and a legibility floor

Date: 2026-09-26
Status: Accepted (v1.2 phone review)
Spec: DESIGN.md §0.4, §16.4, §18.2, §18.4, R-LAYOUT-4, V-8

## Context
Played on a phone in Safari, landscape. The reference size is an iPhone 17 Pro's (874×378 CSS px, with 62 px notch insets at the sides and a 20 px home-indicator inset). Every screen's text was too small, the HUD hid a north entrance, and the build-bar slots were small.

Measured in emulation at that size before the change:
- `--ui-scale` was 0.69, its touch floor (44 ÷ 64, so that a 64-unit slot reached 44 px). The scale follows the playfield relative to 1280×720, and a phone's playfield is about 500 px wide.
- Dialogs then shrank to fit, down to 45% of that. Text rendered at 6–9 px in Settings, 5.5 px in the briefing and 5.3 px in the field guide.
- The phone HUD floated over the top of the map to save height. It is about 50 px tall; the map's decorative border is one cell, about 21 px. It covered the first playable row, where 13 of the 40 levels have an entrance.

A phone CSS pixel is about 0.17 mm, against about 0.26 mm on a desktop monitor, and a phone is held at roughly half the distance. So a phone needs about the same CSS px sizes as the desktop reference, not two thirds of them.

## Decision
- **Phones take their UI scale from the screen:** `min(safe height ÷ 360, safe width ÷ 750)`, clamped to 0.9–1.25. The iPhone 17 Pro in Safari gets 1.0, and an iPhone SE 0.9. Tablets keep the playfield rule, with the touch floor raised from 0.69 to 0.9.
- **A legibility floor on touch devices.** No text's effective scale goes below 0.9, dialogs included. The dialog fit stops there. If a dialog still doesn't fit a very small window, it scrolls instead of shrinking its text.
- **Short landscape dialogs go side by side** (a header row holding the title, tabs and Done or Close, with content in columns), so they fit at the floor instead of relying on the fit.
- **The Rails arrangement on phones:** the HUD in a column down the left, the build bar in a column down the right, and the map between them at full height. Nothing overlaps the map.
- **Build slots fill the right rail:** as large as the height allows for the loadout, from 44 px up to 64 units. That is about 48 px with six towers on an iPhone 17 Pro in Safari, and 64 px with four or fewer.

## Alternatives Considered
- **Raise the text size only, keeping the overlay HUD:** at scale 1 the HUD row is about 750 px wide, wider than the map, and still covers north entrances.
- **Reserve a band across the top for the HUD:** it costs the map about 35 px of its 358 px height, and a HUD row at readable size doesn't fit the width left beside the build bar.
- **Two columns of 64 px slots in the right rail:** slots about 35% larger than one fitted column, but the rail is about 70 px wider, and the map loses 13–16% of its width. On a phone the map is the scarcer resource: towers and enemies are already small, and a tower's 44 pt hit area is already two cells.
- **Let dialogs scroll on phones:** the v1.1 review asked for dialogs that don't scroll, and a scrolled Settings or briefing hides its Done or Start button.
- **Keep the fit but floor it only for text (separate text and box scales):** every font size would have to pick a scale, and text would outgrow boxes sized in the other one.

## Consequences
- The map on an iPhone 17 Pro is about the same size as before on the 1.4:1 maps, and about 9% narrower on the 1.6:1 maps. On an iPhone SE (16:9) it is about 24% narrower: the price of a HUD that covers nothing. Pinch zoom (1×–2.5×) is unchanged.
- The phone slots are larger only when the loadout is short. If six-tower slots still feel small, the two-column rail above is the next step, at the cost of map width.
- Short desktop windows (up to 500 px tall) get the side-by-side dialogs too.
