import { defineConfig } from '@playwright/test';

// Actual public build, default Chromium network settings; no HTTP/2 workaround.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    'daytona.spec.ts',
    'release.spec.ts',
    'combat-hud.spec.ts',
    'combat-feel.spec.ts',
    'interactions.spec.ts',
    'details.spec.ts',
    'inventory-summary.spec.ts',
  ],
  timeout: 120000,
  expect: { timeout: 60000 },
  workers: 1,
  use: {
    baseURL: process.env.MUGONG_DAYTONA_URL,
    viewport: { width: 1093, height: 614 },
    locale: 'ko-KR',
    extraHTTPHeaders: { 'X-Daytona-Skip-Preview-Warning': 'true' },
    trace: 'retain-on-failure',
  },
});
