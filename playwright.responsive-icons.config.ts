import { defineConfig } from '@playwright/test';
const mode = process.env.MUGONG_ICON_MODE ?? 'after';
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'responsive-icons.spec.ts', workers: 1, timeout: 90000,
  outputDir: `test-results-responsive-icons-${mode}`,
  reporter: [['list'], ['json', { outputFile: `docs/verification/responsive-icons-v1/${mode}-raw.json` }]],
  use: { baseURL: process.env.MUGONG_ICON_URL ?? 'http://127.0.0.1:5225', locale: 'ko-KR', trace: 'retain-on-failure' },
});
