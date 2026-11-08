import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3001,
    open: false,
  },
  build: {
    outDir: 'dist-demo',
    target: 'esnext',
    assetsInlineLimit: 0,
  },
});
