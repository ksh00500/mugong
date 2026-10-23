import { defineConfig } from '@playwright/test';
const mode = process.env.MUGONG_FRAME_MODE ?? 'source';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'local-frame.spec.ts',
  workers: 1,
  timeout: 90000,
  outputDir: `test-results-local-frame-${mode}`,
  reporter: [['list'], ['json', { outputFile: `.local-preview/frame-browser-${mode}.json` }]],
  use: {
    baseURL: process.env.MUGONG_FRAME_URL ?? 'http://127.0.0.1:5227',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
});
