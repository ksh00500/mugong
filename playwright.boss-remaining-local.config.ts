import { defineConfig } from '@playwright/test';
import production from './playwright.production.config';
export default defineConfig({
  ...production,
  testMatch: ['boss-remaining-local.spec.ts'],
  outputDir: 'test-results-boss-remaining-local',
  timeout: 90000,
});
