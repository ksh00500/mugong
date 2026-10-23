import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'online-personal.spec.ts',
  workers: 1,
  timeout: 120000,
  outputDir: 'test-results-online-personal',
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile: `docs/verification/online-personal-v1/${process.env.MUGONG_ONLINE_MODE ?? 'source'}-raw.json`,
      },
    ],
  ],
  use: {
    baseURL: process.env.MUGONG_ONLINE_URL ?? 'http://127.0.0.1:5227',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
});
