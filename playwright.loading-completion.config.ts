import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'loading-completion.spec.ts', workers: 1,
  timeout: 90000, outputDir: 'test-results-loading-completion',
  reporter: [['list'], ['json', { outputFile: 'docs/verification/remaining-gameplay-v1/loading-raw.json' }]],
  use: { viewport: { width: 1366, height: 768 }, locale: 'ko-KR' },
});
