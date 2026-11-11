import { copyFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const FONT_FILE = 'unifont-latin-400-normal.woff2';

/**
 * Vite library mode inlines every asset as base64 and ignores assetsInlineLimit, so importing
 * @fontsource/unifont made style.css 6 MB. Instead ship only the woff2 (the .woff fallback is
 * 3 MB and unnecessary) beside the other assets and reference it by a relative URL.
 */
function bundleUnifont(): Plugin {
  return {
    name: 'bundle-unifont',
    apply: 'build',
    closeBundle() {
      const require = createRequire(import.meta.url);
      const fontSrc = require.resolve(`@fontsource/unifont/files/${FONT_FILE}`);
      const fontDir = resolve(__dirname, 'dist/assets/fonts');
      mkdirSync(fontDir, { recursive: true });
      copyFileSync(fontSrc, resolve(fontDir, FONT_FILE));
      appendFileSync(
        resolve(__dirname, 'dist/style.css'),
        `\n@font-face{font-family:'Unifont';font-style:normal;font-display:swap;font-weight:400;src:url(./assets/fonts/${FONT_FILE}) format('woff2')}\n`
      );
    },
  };
}

export default defineConfig({
  plugins: [bundleUnifont()],
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'BlockgameBookViewer',
      cssFileName: 'style',
      formats: ['es', 'umd'],
      fileName: (format) => `blockgame-book-viewer.${format === 'es' ? 'js' : 'umd.cjs'}`,
    },
    rollupOptions: {
      // jszip is bundled so web users need no extra dependency.
    },
  },
});
