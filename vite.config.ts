import { defineConfig } from 'vite';
import { resolve } from 'path';

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
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'examples/web-component': resolve(__dirname, 'examples/web-component.html'),
        'examples/witchcraft-replica': resolve(__dirname, 'examples/witchcraft-replica.html'),
      },
    },
  },
});
