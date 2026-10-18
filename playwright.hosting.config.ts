import { defineConfig } from '@playwright/test';
const external=process.env.MUGONG_HOSTING_URL||undefined;
const directory=process.env.MUGONG_HOSTING_DIST??'dist';
if(!/^dist(?:-[a-z0-9-]+)?$/.test(directory))throw Error('Invalid hosting build directory');
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['hosting.spec.ts'],workers:1,timeout:90000,
 outputDir:'test-results-hosting',
 use:{baseURL:external??'http://127.0.0.1:5190',locale:'ko-KR',trace:'retain-on-failure'},
 webServer:external?undefined:{command:`npm run preview -- --port 5190 --strictPort --outDir ${directory}`,url:'http://127.0.0.1:5190',reuseExistingServer:false},
});
