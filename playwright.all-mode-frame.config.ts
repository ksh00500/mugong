import { defineConfig } from '@playwright/test';
const stage = process.env.MUGONG_ALL_FRAME_STAGE ?? 'after';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'all-mode-frame.spec.ts',
  workers: 1,
  timeout: 120000,
  outputDir: `test-results-all-mode-frame-${stage}`,
  reporter: [['list'], ['json', { outputFile: `.local-preview/all-frame-${stage}/tests.json` }]],
  use: {
    baseURL: 'http://127.0.0.1:5227',
    locale: 'ko-KR',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
});
