# 0002. Stack and dependencies

Date: 2026-09-24
Status: Accepted (M0 review, 2026-09-25)
Spec: DESIGN.md §22

## Context
The brief fixes the core stack: TypeScript, Vite, PixiJS v8, vite-plugin-pwa (Workbox), Vitest and Playwright. Any other runtime dependency needs a recorded reason. On 2026-09-24 the npm registry showed major versions newer than the training data: TypeScript 7 (the native compiler), Vite 8, Vitest 5 and @types/node 26.

## Decision
- Pin exact versions: typescript 7.0.2, vite 8.3.1, pixi.js 8.21.0, vite-plugin-pwa 1.3.0, workbox-window 7.4.1, workbox-build 7.4.1, vitest 5.0.1, @playwright/test 1.63.0, zod 4.6.5, @fontsource/lilita-one 5.3.0, @fontsource/fredoka 5.3.0 and @types/node 24.13.6. Commit `package-lock.json`.
- Peer ranges checked: vite-plugin-pwa 1.3.0 accepts `vite ^8.0.0`, and Vitest 5.0.1 accepts `vite ^8.0.0` and `@types/node >=24`.
- Node 24.16.0 runs `tools/*.ts` directly through built-in type stripping. Code uses only erasable TypeScript syntax, and relative imports carry `.ts` extensions (`allowImportingTsExtensions`, `noEmit`).
- TypeScript is used for type-checking only (`tsc -b`). Vite transpiles.
- Zod is the one added library. It is the single source for types, data validation, save-import validation and the generated level JSON Schema.
- The fonts are OFL-1.1 packages from @fontsource, bundled and self-hosted.

## Alternatives Considered
- TypeScript 6.x: rejected for now. TypeScript 7 is the current `latest`, and it only type-checks here. If a tool rejects it, a superseding ADR moves to 6.x.
- `tsx` or `vite-node` for scripts: unnecessary, because Node 24 strips types natively (verified with `process.features.typescript === 'strip'`).
- ajv plus hand-written JSON Schema: two sources that can drift apart, and still no inferred types.
- TypeBox: a viable choice, but Zod's error messages are friendlier for hand-edited level files.
- ESLint to police simulation purity: replaced by a DOM-free `tsconfig.sim.json` and a Vitest purity scan, so there is no extra toolchain.
- Preact or Solid for the UI: an avoidable runtime dependency. The UI is a modest set of DOM screens.
- `idb`: the wrapper needed is about 60 lines.
- Google Fonts through a CDN: forbidden, because the game must make no runtime network requests.
- @types/node 26.x: its types would not match the Node 24 runtime.

## Consequences
The toolchain is modern and fast, with 3 runtime libraries besides assets. TypeScript 7 is young, so type-checker regressions are possible. Keeping to erasable syntax means no `enum`s and no parameter properties.
