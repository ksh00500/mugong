import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: ['three-special.spec.ts'],
  outputDir: 'test-results-three-special',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5194' },
  webServer: {
    command: 'npm run dev -- --port 5194 --strictPort',
    url: 'http://127.0.0.1:5194',
    reuseExistingServer: true,
  },
});
