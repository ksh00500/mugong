import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results-production',
  testMatch: [
    'local-preview-boss-special.spec.ts',
    'local-preview-staff.spec.ts',
    'local-preview-family.spec.ts',
    'local-preview-zhuge.spec.ts',
    'local-preview-tianjian.spec.ts',
    'local-preview-dokmu.spec.ts',
    'local-preview-hyeolma.spec.ts',
    'local-preview-desert.spec.ts',
    'local-preview-qingha.spec.ts',
    'local-preview-snow.spec.ts',
    'local-preview-bamboo.spec.ts',
    'local-preview-tomb.spec.ts',
  ],
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
});
