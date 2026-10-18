import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['daytona.spec.ts', 'weapon-release.spec.ts'],
  timeout: 180000,
  expect: { timeout: 75000 },
  workers: 1,
  use: {
    baseURL: process.env.MUGONG_DAYTONA_URL,
    viewport: { width: 1366, height: 768 },
    locale: 'ko-KR',
    launchOptions: { args: ['--disable-http2'] },
    extraHTTPHeaders: { 'X-Daytona-Skip-Preview-Warning': 'true' },
    trace: 'retain-on-failure',
  },
});
