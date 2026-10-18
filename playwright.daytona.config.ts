import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    'daytona.spec.ts',
    'language.spec.ts',
    'audit.spec.ts',
    'glance.spec.ts',
    'combat-hud.spec.ts',
    'combat-feel.spec.ts',
    'wave-progression.spec.ts',
    'boss-nameplate.spec.ts',
    'storage-shortcuts.spec.ts',
    'daytona-presentation.spec.ts',
  ],
  timeout: 180000,
  // The first Phaser module download crosses the remote preview proxy.
  expect: { timeout: 75000 },
  workers: 1,
  use: {
    // Preview proxy HTTP/2 streams can stall image bodies in headless Chromium.
    launchOptions: { args: ['--disable-http2'] },
    baseURL: process.env.MUGONG_DAYTONA_URL,
    viewport: { width: 1366, height: 768 },
    locale: 'ko-KR',
    extraHTTPHeaders: { 'X-Daytona-Skip-Preview-Warning': 'true' },
    trace: 'retain-on-failure',
  },
});
