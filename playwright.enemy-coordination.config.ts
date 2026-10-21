import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'enemy-coordination.spec.ts',
  workers: 1,
  outputDir: `./test-results-enemy-coordination-${process.env.MUGONG_SQUAD_MODE ?? 'source'}`,
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile: `docs/verification/enemy-coordination-v1/${process.env.MUGONG_SQUAD_MODE ?? 'source'}-raw.json`,
      },
    ],
  ],
  use: {
    baseURL: process.env.MUGONG_SQUAD_URL ?? 'http://127.0.0.1:5225',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
});
