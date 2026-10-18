import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  server: { port: 5173, strictPort: true },
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        nextStage: resolve(import.meta.dirname, 'next-stage/index.html'),
      },
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
