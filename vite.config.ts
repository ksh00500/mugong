import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  preview: {
    proxy: {
      '/api/pvp': { target: process.env.PVP_API_TARGET ?? 'http://127.0.0.1:8787', ws: true },
    },
  },
  server: {
    proxy: {
      '/api/pvp': { target: process.env.PVP_API_TARGET ?? 'http://127.0.0.1:8787', ws: true },
    },
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        '**/test-results*/**',
        '**/docs/verification/**',
        '**/.local-preview/**',
        '**/dist/**',
        '**/dist-*/**',
      ],
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        nextStage: resolve(import.meta.dirname, 'next-stage/index.html'),
        pvp: resolve(import.meta.dirname, 'pvp/index.html'),
      },
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
