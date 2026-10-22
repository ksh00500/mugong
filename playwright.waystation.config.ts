import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'waystation-world.spec.ts',
  workers: 1,
  outputDir: `./test-results-waystation-${process.env.MUGONG_REST_MODE ?? 'source'}`,
  use: {
    baseURL: process.env.MUGONG_REST_URL ?? 'http://127.0.0.1:5225',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
});
