import { defineConfig, devices } from '@playwright/test';

// e2e runs against the production build served by `vite preview` (DESIGN.md §23.2).
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  // Service workers are blocked except in the PWA spec: a 17 MB precache per test would slow every
  // run, and a controlling worker would sit between page.route() and the network.
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', serviceWorkers: 'block' },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  // The throttled performance trace (R-PERF-1) runs alone, via `npm run perf`: sharing the machine
  // with fifty other tests would measure them, not the game.
  testIgnore: process.env.PERF ? [] : /perf\.spec/,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /screens/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /screens/ },
  ],
});
