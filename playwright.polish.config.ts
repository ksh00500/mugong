import { defineConfig } from '@playwright/test';
import config from './playwright.config';
// A fresh server avoids stale HMR module instances when tests inject state.
export default defineConfig({
  ...config,
  use: {...config.use, baseURL:'http://127.0.0.1:5181'},
  webServer:{command:'npm run dev -- --port 5181 --strictPort',url:'http://127.0.0.1:5181',reuseExistingServer:false},
});
