Measure against a production preview build with GPU flags. The dev server and a plain headless Chromium both mislead.

- **Not the dev server.** Every source edit hot-reloads its page, so a probe or benchmark running during edits loses `window.__game` part-way through. Build to a separate folder (`npx vite build --outDir <scratch>`) and serve it with `vite preview --outDir <scratch> --port <p>`.
- **The e2e specs use `dist/`.** The PWA spec copies `dist` itself, so snapshot e2e builds there and serve them on :4173; Playwright reuses that server.
- **WebGPU in headless Chromium** has only the SwiftShader fallback adapter unless it is launched with `--enable-unsafe-webgpu --use-angle=metal --enable-gpu --ignore-gpu-blocklist`. With those flags it gets the real Apple GPU for both WebGL and WebGPU. Playwright's WebKit gets a real Apple adapter without flags. `tools/dev/renderer-bench.ts` sets this up (ADR-0012).
- **Finder leaves `.DS_Store` in `data/levels`.** Anything that lists level folders must keep only `z\d` names (the validator, `tools/lib/data.ts` and the level tests do).
