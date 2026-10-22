import { defineConfig } from '@playwright/test';
const mode = process.env.MUGONG_COMPLETION_MODE ?? 'source';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'completion.spec.ts',
  workers: 1,
  timeout: 90000,
  outputDir: `test-results-completion-${mode}`,
  reporter: [
    ['list'],
    ['json', { outputFile: `docs/verification/remaining-gameplay-v1/${mode}-raw.json` }],
  ],
  use: {
    baseURL: process.env.MUGONG_COMPLETION_URL ?? 'http://127.0.0.1:5225',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
});
