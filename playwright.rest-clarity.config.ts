import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'rest-clarity.spec.ts',
  workers: 1,
  outputDir: `test-results-rest-clarity-${process.env.MUGONG_REST_CLARITY_MODE ?? 'source'}`,
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile: `docs/verification/rest-clarity-v1/${process.env.MUGONG_REST_CLARITY_MODE ?? 'source'}-raw.json`,
      },
    ],
  ],
  use: {
    baseURL: process.env.MUGONG_REST_CLARITY_URL ?? 'http://127.0.0.1:5225',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
});
