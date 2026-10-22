import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['three-special-local.spec.ts'],
  workers: 1,
  timeout: 90000,
  outputDir: 'test-results-three-special-local',
  use: {
    baseURL: 'http://127.0.0.1:5195',
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js preview --outDir dist-three-special-v2 --host 127.0.0.1 --port 5195 --strictPort',
    url: 'http://127.0.0.1:5195',
    reuseExistingServer: true,
  },
});
