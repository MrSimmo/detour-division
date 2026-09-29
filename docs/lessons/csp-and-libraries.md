The page CSP forbids eval and inline styles. Pixi and Zod need their eval-free modes, and the dev server needs inline styles.

- `src/app/csp.ts` must be the first import in `main.ts`. It imports `pixi.js/unsafe-eval`, which replaces Pixi's code generators, and sets `z.config({ jitless: true })`. Without these, even the libraries' feature probes log CSP violations, which the e2e tests count as console errors.
- In development Vite injects CSS as `<style>` tags. The `dev-inline-styles` plugin in `vite.config.ts` adds `'unsafe-inline'` to the policy **on the dev server only**. Symptom without it: a completely unstyled page in dev while the e2e tests (production build) all pass.
