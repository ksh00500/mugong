import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'raid-pressure.spec.ts',
  workers: 1,
  timeout: 120000,
  outputDir: 'test-results-raid-pressure',
  reporter: [['list'], ['json', { outputFile: '.local-preview/balance-browser/final.json' }]],
  use: {
    baseURL: process.env.MUGONG_BALANCE_URL ?? 'http://127.0.0.1:5228',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
});
