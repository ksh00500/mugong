import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'tang-jegal-online.spec.ts',
  workers: 1,
  timeout: 90000,
  outputDir: 'test-results-tang-jegal-online',
  reporter: [['list'], ['json', { outputFile: '.local-preview/tj-online/final.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:5228',
    locale: 'ko-KR',
    viewport: { width: 1366, height: 768 },
    trace: 'retain-on-failure',
  },
});
