import { defineConfig } from '@playwright/test';
// Keep the user's local production preview running while tests use a separate origin.
const port = Number(process.env.MUGONG_E2E_PORT ?? 5173);
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
  },
});
