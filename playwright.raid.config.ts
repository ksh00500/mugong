import { defineConfig } from '@playwright/test';
const mode = process.env.MUGONG_RAID_MODE ?? 'source';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'raid.spec.ts',
  workers: 1,
  timeout: 120000,
  outputDir: `test-results-raid-${mode}`,
  reporter: [
    ['list'],
    ['json', { outputFile: `docs/verification/cooperative-raid-v1/${mode}-raw.json` }],
  ],
  use: {
    baseURL: process.env.MUGONG_RAID_URL ?? 'http://127.0.0.1:5227',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
});
