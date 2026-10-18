import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  timeout: 60000,
  use: { ...base.use, baseURL: 'http://127.0.0.1:5182' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5182 --strictPort',
    url: 'http://127.0.0.1:5182', reuseExistingServer: true,
  },
});
