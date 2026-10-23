import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'range-lines.spec.ts',
  workers: 1,
  timeout: 90000,
  outputDir: 'test-results-range-lines',
  reporter: [['list'], ['json', { outputFile: '.local-preview/range-browser.json' }]],
  use: { baseURL: 'http://127.0.0.1:5227', locale: 'ko-KR', trace: 'retain-on-failure' },
});
