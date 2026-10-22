import { defineConfig } from '@playwright/test';

const mode = process.env.MUGONG_MEDIUM_MODE ?? 'source';
const regression = process.env.MUGONG_MEDIUM_SUITE === 'regression';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: regression
    ? [
        'ui-high.spec.ts',
        'ui-priority.spec.ts',
        'details.spec.ts',
        'ui-feedback.spec.ts',
        'combat-prep.spec.ts',
        'storage-shortcuts.spec.ts',
      ]
    : mode === 'source'
      ? ['ui-medium.spec.ts', 'ui-medium-states.spec.ts']
      : ['ui-medium.spec.ts'],
  workers: 1,
  outputDir: `./test-results-ui-medium-${regression ? 'regression' : mode}`,
  use: {
    baseURL: process.env.MUGONG_MEDIUM_URL ?? 'http://127.0.0.1:5225',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
});
