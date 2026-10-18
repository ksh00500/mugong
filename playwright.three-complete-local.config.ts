import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['three-complete-local.spec.ts'],
  workers: 1,
  timeout: 90000,
  outputDir: 'test-results-three-complete-local',
  use: {
    baseURL: 'http://127.0.0.1:5203',
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js preview --outDir dist-three-complete-v3 --host 127.0.0.1 --port 5203 --strictPort',
    url: 'http://127.0.0.1:5203',
    reuseExistingServer: true,
  },
});
