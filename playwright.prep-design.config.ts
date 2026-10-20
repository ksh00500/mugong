import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch:
    process.env.MUGONG_PREP_DESIGN_SUITE === 'regression'
      ? ['combat-prep.spec.ts', 'ui-high.spec.ts']
      : ['prep-design.spec.ts'],
  workers: 1,
  outputDir: `./test-results-prep-design-${process.env.MUGONG_PREP_DESIGN_MODE ?? 'source'}-${process.env.MUGONG_PREP_DESIGN_SUITE ?? 'design'}`,
  use: {
    baseURL: process.env.MUGONG_PREP_DESIGN_URL ?? 'http://127.0.0.1:5225',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
});
