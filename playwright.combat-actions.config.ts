import { defineConfig } from '@playwright/test';
const mode = process.env.MUGONG_ACTION_MODE ?? 'source';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'combat-actions.spec.ts',
  workers: 1,
  timeout: 90000,
  outputDir: `test-results-combat-actions-${mode}`,
  reporter: [
    ['list'],
    ['json', { outputFile: `docs/verification/combat-actions-ux-v1/${mode}-raw.json` }],
  ],
  use: {
    baseURL: process.env.MUGONG_ACTION_URL ?? 'http://127.0.0.1:5225',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
});
