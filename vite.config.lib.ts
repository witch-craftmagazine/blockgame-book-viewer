import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'BlockgameBookViewer',
      formats: ['es', 'umd'],
      fileName: (format) => `blockgame-book-viewer.${format === 'es' ? 'js' : 'umd.cjs'}`,
    },
    rollupOptions: {
      // Keep jszip external or bundled depending on requirements.
      // Bundling jszip or making it optional for consumers. Here bundling jszip makes it zero-dep for web users!
    },
  },
});
