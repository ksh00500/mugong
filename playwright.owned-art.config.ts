import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'owned-art.spec.ts',
  workers: 1,
  timeout: 90000,
  outputDir: 'test-results-owned-art',
  reporter: [['list'], ['json', { outputFile: '.local-preview/owned-art/final.json' }]],
  use: { baseURL: 'http://127.0.0.1:5227', locale: 'ko-KR', trace: 'retain-on-failure' },
});
