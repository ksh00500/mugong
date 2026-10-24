import { defineConfig } from '@playwright/test';
const mode = process.env.MUGONG_ALL_ONLINE_MODE ?? 'compiled';
process.env.MUGONG_PVP_URL = process.env.MUGONG_ALL_ONLINE_URL ?? 'http://127.0.0.1:5228';
process.env.MUGONG_PVP_PROOF = `.local-preview/all-online-${mode}/pvp`;
process.env.MUGONG_ONLINE_PROOF = `.local-preview/all-online-${mode}/gangho`;
process.env.MUGONG_RAID_PROOF = `.local-preview/all-online-${mode}/raid`;
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['pvp.spec.ts', 'raid-pressure.spec.ts', 'online-personal.spec.ts'],
  grep: /friendly 1093|ranked:|normal personal raid|fresh account uses/,
  workers: 1,
  timeout: 120000,
  outputDir: `test-results-all-online-${mode}`,
  reporter: [['list'], ['json', { outputFile: `.local-preview/all-online-${mode}/tests.json` }]],
  use: {
    baseURL: process.env.MUGONG_ALL_ONLINE_URL ?? 'http://127.0.0.1:5228',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
});
