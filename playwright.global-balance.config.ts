import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch:
    process.env.MUGONG_GLOBAL_BROWSER_SUITE === 'regression'
      ? ['combat-prep.spec.ts', 'boss-balance.spec.ts']
      : ['global-balance.spec.ts'],
  workers: 1,
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile:
          process.env.MUGONG_GLOBAL_BROWSER_REPORT ??
          'docs/verification/global-balance-v1/source-regression-raw.json',
      },
    ],
  ],
  outputDir: `./test-results-global-balance-${process.env.MUGONG_GLOBAL_BROWSER_MODE ?? 'source'}-${process.env.MUGONG_GLOBAL_BROWSER_SUITE ?? 'stages'}`,
  use: {
    baseURL: process.env.MUGONG_GLOBAL_BROWSER_URL ?? 'http://127.0.0.1:5225',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
});
