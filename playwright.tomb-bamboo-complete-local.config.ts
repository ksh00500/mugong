import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['tomb-bamboo-complete-local.spec.ts'],
  workers: 1,
  timeout: 90000,
  outputDir: 'test-results-tomb-bamboo-complete-local',
  use: {
    baseURL: 'http://127.0.0.1:5201',
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js preview --outDir dist-tomb-bamboo-complete-v3 --host 127.0.0.1 --port 5201 --strictPort',
    url: 'http://127.0.0.1:5201',
    reuseExistingServer: true,
  },
});
