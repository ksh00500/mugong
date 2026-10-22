import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['ingame-capture.spec.ts'],workers:2,timeout:90000,
 outputDir:'test-results-ingame-capture',
 use:{baseURL:'http://127.0.0.1:5188',viewport:{width:1920,height:1080},locale:'ko-KR',trace:'retain-on-failure'},
 webServer:{command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5188 --strictPort --outDir dist-validation-hosting',url:'http://127.0.0.1:5188',reuseExistingServer:true},
});
