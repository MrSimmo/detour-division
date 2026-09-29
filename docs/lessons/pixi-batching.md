In Pixi v8, every change of blend mode between neighbouring sprites breaks the batch. Keep additive sprites in their own containers.

This is what took draw calls from 88 to 10 (R-PERF-1): effects, the Sunbeam glow and enemy hit flashes now live in `fxAddLayer` and `flashLayer` in `src/render/scene.ts`, and `Fx.additive()` moves a sprite there.

To see what breaks a batch, read `app.stage.renderGroup.instructionSet.instructions` (the `renderPipeId` of each) while the game is paused. Count draw calls by wrapping `gl.drawElements` and its relatives (see `e2e/perf.spec.ts`).

Floating texts are capped (`MAX_FLOATERS` in `fx.ts`): at 3× speed with 300 enemies, 150 or more would otherwise be live.
