# 0003. Deterministic fixed-step simulation

Date: 2026-09-24
Status: Accepted (M0 review, 2026-09-25)
Spec: DESIGN.md §13 (R-SIM-1 … R-SIM-5)

## Context
Four things depend on the simulation giving identical results for identical inputs: 3× speed, save and resume, headless level validation in Node, and export and import between devices. That has to hold across V8, SpiderMonkey and JavaScriptCore, and whatever the frame rate.

## Decision
- The simulation is pure TypeScript in `src/sim`. It has no DOM, no timers and no ambient randomness, and runs at a fixed **30 Hz** tick. Game speed only changes how many ticks run per real second. A frame runs at most 12 ticks.
- Numbers are float64, using only `+ − × ÷ sqrt`, which IEEE 754 rounds exactly in every engine. Trigonometry and powers come from `sim/core/math.ts`, built from those operations. Durations are integer ticks.
- The PRNG is `sfc32`, using 32-bit integer operations, with its state held in the simulation state.
- State is plain data, serialisable as JSON. Derived structures (distance fields, spatial hash) are rebuilt on `restore()`.
- All mutation goes through queued commands, applied at tick boundaries. Rendering and audio only read the state and drain events. They interpolate between ticks.
- Purity is enforced by `tsconfig.sim.json` (`lib: ["ES2023"]`, `types: []`) and a Vitest scan for banned APIs.

## Alternatives Considered
- 60 Hz ticks: twice the CPU at 3× speed (180 ticks a second on phones) and twice the validation time. 30 Hz with interpolation looks the same at this scale.
- Fixed-point integer maths: stronger guarantees, but much slower to write and harder to tune. Float64 with a restricted set of operations is deterministic across engines already.
- A variable timestep: breaks determinism and makes 3× speed change outcomes.
- The simulation in a Web Worker from day one: adds latency to the placement preview, and ceremony around messaging. Kept as a fallback for performance (DESIGN.md §19). The pure design makes that move contained.

## Consequences
Replays and bug repros come free from the seed and the command log. Every system must stay free of `Math.sin` and similar functions, and must iterate in ID order. The placement preview runs synchronously on the main thread, against the live simulation, with scratch buffers.
