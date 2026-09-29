# 0015. Publish on GitHub Pages, built by GitHub Actions

Date: 2026-09-29
Status: Accepted
Spec: DESIGN.md §20 ("Hosting", R-HOST-1)

## Context
The repository is going public, and the game should be playable from it. The game is a static PWA. `dist/` is gitignored, and the baked atlases are committed (ADR-0006), so a build needs only Node. GitHub Pages serves a project site under `/<repo>/`, while the dev server, `vite preview` and the e2e suite (`page.goto('/?e2e')`) all assume `/`. Every runtime URL is already built from `import.meta.env.BASE_URL`, and a build with `--base=/detour-division/` served under that path was checked by hand: title to level with no errors, and the service worker scoped to the sub-path.

## Decision
- `.github/workflows/pages.yml` runs on every push to `main`, and by hand. It installs with `npm ci` on the Node version in `.nvmrc`, type-checks, builds with `vite build --base=<base_path>/`, and deploys `dist/` with the official Pages actions. The Pages source is "GitHub Actions".
- The base path comes from `actions/configure-pages` (`base_path`: `/<repo>` for a project site, empty for a user site or a custom domain). It is passed on the command line, so `vite.config.ts` keeps `/`.
- What is published:
  - `PROGRESS.md`, the session log, stays local (gitignored). It records the author's devices and machine.
  - Personal device and network details were removed from the published docs.
  - The published history starts from one squashed commit.

## Alternatives Considered
- **Deploy from a branch with a committed `dist/`**: build output in git, a manual step on every release, and Jekyll processing unless `.nojekyll` is added. Jekyll drops files whose names start with `_`, which Rollup-style chunk names can have.
- **Deploy from branch, `/docs` folder**: that would publish the ADRs, not the game.
- **`base` set in `vite.config.ts`**: moves dev, preview and e2e off `/` as well. A relative base (`./`) was not tested; the explicit sub-path was.
- **Hard-coding `/detour-division/`**: breaks if the repository is renamed or given a custom domain.

## Consequences
- Pages on a free plan needs a public repository.
- Every push to `main` deploys. The workflow type-checks but doesn't run `npm test`, `npm run e2e` or `npm run validate-levels`; they stay local gates (CLAUDE.md).
- Saves live in IndexedDB for the origin `<user>.github.io`, which that account's other project sites share (the database is named `detour-division`). A later custom domain is a new origin, so players would start empty there and would need export and import (§20).
