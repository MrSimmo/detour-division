# 0007. Generate waves from per-level recipes

Date: 2026-09-24
Status: Accepted (M0 review, 2026-09-25)
Spec: DESIGN.md §9, §15

## Context
40 levels at 30–60 waves each, over three difficulties, comes to thousands of waves. They need an escalating curve, elite, boss, air-only and mixed waves, an exact next-wave preview, and validation by bot.

## Decision
- Each level declares a recipe: a budget curve (`b0`, `g`), an enemy pool with `fromWave` and weights, pattern rules (air-only, elite and breather waves), and explicit overrides for intro waves, boss waves and puzzles.
- A pure, seeded generator expands the recipe when the level loads, into concrete groups for each difficulty. Puzzle levels, or any level that wants it, may list every wave explicitly.
- The expanded waves are part of the level's deterministic input. The preview reads them directly.

## Alternatives Considered
- Writing every wave by hand: too slow to author and tune, and error-prone.
- Generating waves at runtime as the game goes: the preview could not be exact, and determinism would depend on when the player asks.

## Consequences
Tuning happens by editing recipes in data. Validation (R-WAVE-3) catches curves that aren't monotone. Hooks written into a specific wave use overrides, so they don't depend on the generator.
