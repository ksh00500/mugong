import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Keep renderer inspection isolated from the user's long-lived HMR session on 5173.
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'http://127.0.0.1:5181' },
  webServer: {
    command: 'npm run dev -- --port 5181',
    url: 'http://127.0.0.1:5181',
    reuseExistingServer: false,
  },
});
