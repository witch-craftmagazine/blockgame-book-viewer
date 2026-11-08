import { MinecraftBookViewer } from './ui/MinecraftBookViewer';
import { WitchcraftPlugin } from './plugins/WitchcraftPlugin';
import { parseBook } from './io/BookParser';

const welcomeBook = {
  title: 'Welcome to Book Viewer',
  author: 'Minecraft Book Engine',
  pages: [
    '§0§lWelcome!§r\n\nThis is a §2modular§r, pixel-perfect §6Minecraft Book Viewer§r.\n\nUse the buttons below to:\n- Turn pages\n- Switch view modes\n- Change resource packs\n- Import/export books\n\n§8Turn page to continue...§r',
    '§1§lSupported Formats§r\n\n§0You can import & export:\n\n§4• Stendhal (.stendhal)\n§2• BookCopy (.json)\n§9• CMI BookExport (.txt)\n§5• In-game /give commands\n\nClick the 📂 icon below to open your own book!§r',
    '§5§lCustom Resource Packs§r\n\n§0Click 🎨 to switch between:\n- Vanilla (16x)\n- Lithos (32x HD)\n- Craftadia (Server pack)\n\nOr drop your own .zip resource pack!',
    '§6§lInteractive Easter Eggs§r\n\n§0The modular plugin system supports custom animations.\n\nTry the Witchcraft magazine issues to see the blinking runic eye ⏼ (click it to wink!).'
  ]
};

window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('viewer-container') as HTMLElement;
  if (!container) return;

  const witchcraftPlugin = new WitchcraftPlugin({
    gifUrl: './assets/textures/starsweetpea.gif'
  });

  const viewer = new MinecraftBookViewer(container, {
    book: welcomeBook,
    baseAssetPath: './assets',
    theme: 'transparent',
    controls: true,
    plugins: [witchcraftPlugin]
  });

  await viewer.init();

  // Theme toggle handler (Nectar dark / light)
  const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement | null;
  if (themeToggle) {
    const updateTheme = (isDark: boolean) => {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      themeToggle.textContent = isDark ? '🌙 Dark' : '☀️ Light';
      themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    };

    const isInitiallyDark =
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    updateTheme(isInitiallyDark);

    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      updateTheme(!isDark);
    });
  }

  // Book selection handler
  const bookSelect = document.getElementById('book-select') as HTMLSelectElement | null;
  if (bookSelect) {
    bookSelect.addEventListener('change', async (e) => {
      const val = (e.target as HTMLSelectElement).value;
      if (val === 'welcome') {
        viewer.setBook(welcomeBook);
      } else {
        try {
          const resp = await fetch(`./assets/books/${val}.stendhal`);
          if (resp.ok) {
            const text = await resp.text();
            const parsed = parseBook(text);
            if (parsed) viewer.setBook(parsed);
          }
        } catch (err) {
          console.error('Failed to load sample book:', err);
        }
      }
    });
  }
});
